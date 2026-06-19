// AI-assisted statement extraction from a PDF.
//
// Extracts the PDF's text layer locally (unpdf, a serverless pdf.js build) and
// sends that TEXT to an OpenAI-compatible chat-completions
// endpoint, asking the model to return a small JSON draft (amount, cycle month,
// currency, best-match card). Text-first rather than a multimodal `file` block:
// most OpenAI-compatible endpoints silently drop file blocks or run
// text-only/reasoning models that never see the attachment. This is a DRAFT
// only — nothing is written to the DB here. The user reviews and confirms
// downstream through the normal create-statement path.
//
// PII note: a statement PDF and its extracted values are sensitive (D4). We
// never log the PDF bytes, the extracted text, the model response, or any
// extracted figure. The text is sent to the operator-configured external
// provider — that is inherent to this feature and scoped to a single
// self-hosted user.

import { extractText, getDocumentProxy } from "unpdf";

import { aiStatementDraftsSchema, type AiStatementDraft } from "@/lib/validation";

type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

// Card summary handed to the model so it can suggest a match. `last4` and
// `issuer` are the only signals a statement PDF reliably exposes.
export type CardForMatch = {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
};

// A clear, surfaced failure rather than a silent fallback — callers turn this
// into a user-facing message.
export class AiExtractError extends Error {}

// Resolve and validate provider config. Throws loudly if any var is unset so a
// misconfigured instance fails fast at the boundary instead of mid-request.
function getAiConfig(): AiConfig {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();

  if (!baseUrl || !apiKey || !model) {
    throw new AiExtractError(
      "AI import is not configured. Set OPENAI_BASE_URL, OPENAI_API_KEY and OPENAI_MODEL.",
    );
  }

  return { baseUrl, apiKey, model };
}

function buildPrompt(cards: CardForMatch[], statementText: string): string {
  // The card list is the only place ids are exposed to the model; it must echo
  // one back verbatim (or null) — the server re-checks ownership regardless.
  const cardLines = cards
    .map((c) => {
      const label = c.issuer ? `${c.issuer} ${c.name}` : c.name;
      const last4 = c.last4 ? `, ending ${c.last4}` : "";

      return `- id="${c.id}": ${label}${last4}`;
    })
    .join("\n");

  return [
    "You extract credit-card statement key fields from the statement text below.",
    "A single PDF may consolidate more than one card — return one entry per",
    "distinct card statement found in the document.",
    'Return ONLY a JSON object (no prose, no markdown fences): { "statements": [ ... ] },',
    "where each array entry has these keys:",
    '- "amount": the statement balance / total amount due, as a plain decimal string (e.g. "1234.50"). No currency symbol, no thousands separators.',
    '- "month": the statement cycle as "YYYY-MM", derived from the statement date printed on the document.',
    '- "currency": the ISO-4217 code (e.g. "MYR", "USD"). Use null if you cannot tell.',
    '- "cardId": the id of the matching card from the list below, matched by issuer and/or last 4 digits. Use null if none clearly matches.',
    "",
    "Candidate cards:",
    cardLines || "(none)",
    "",
    "If a value is not present on a statement, use null. Do not guess the amount.",
    "If no statement is readable, return an empty array.",
    "",
    "Statement text:",
    '"""',
    statementText,
    '"""',
  ].join("\n");
}

// Upper bound on the text we send. A statement's text layer is small; this caps
// a pathological PDF rather than base64-ing an unbounded blob into the request.
const MAX_TEXT_CHARS = 24_000;

// Extract the PDF's text layer on-device. unpdf bundles a serverless pdf.js
// build (no native deps). Returns trimmed text.
async function pdfToText(bytes: Uint8Array): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } catch {
    // Never echo the underlying parser error — it can carry document content.
    throw new AiExtractError("Could not read this PDF — the file may be corrupt.");
  }

  const trimmed = text.trim();

  // A scanned/image-only statement has no text layer; OCR is out of scope.
  if (trimmed.length < 20) {
    throw new AiExtractError(
      "No readable text in this PDF — it may be scanned images. Enter the statement manually.",
    );
  }

  return trimmed.slice(0, MAX_TEXT_CHARS);
}

// Reasoning/instruct models often wrap the answer in <think> blocks or prose
// even when asked for JSON only. Strip reasoning, then take the outermost
// {...} span so we parse the object regardless of surrounding chatter.
function extractJsonObject(raw: string): string | null {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = withoutThink.indexOf("{");
  const end = withoutThink.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return withoutThink.slice(start, end + 1);
}

// Extract the PDF text locally, send it to the provider, and return validated
// drafts — one per card statement found (a PDF may consolidate several).
// `bytes` is the raw PDF file content.
export async function extractStatementFromPdf(
  bytes: Uint8Array,
  cards: CardForMatch[],
): Promise<AiStatementDraft[]> {
  const { baseUrl, apiKey, model } = getAiConfig();

  const statementText = await pdfToText(bytes);

  const body = {
    model,
    // Force JSON where honored; we also tolerate prose-wrapped output below for
    // providers/reasoning models that ignore this.
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "user",
        content: buildPrompt(cards, statementText),
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Never echo the underlying error — it can carry request details.
    throw new AiExtractError("Could not reach the AI provider.");
  }

  if (!res.ok) {
    throw new AiExtractError(`AI provider returned ${res.status}.`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiExtractError("AI provider returned an empty response.");
  }

  const jsonText = extractJsonObject(content);

  if (!jsonText) {
    throw new AiExtractError("Could not read the statement from this PDF.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AiExtractError("Could not read the statement from this PDF.");
  }

  const result = aiStatementDraftsSchema.safeParse(parsed);

  if (!result.success) {
    throw new AiExtractError("Could not read the statement from this PDF.");
  }

  // No readable statement is the same surfaced failure as a malformed response —
  // never hand the caller an empty list to render.
  if (result.data.statements.length === 0) {
    throw new AiExtractError("Could not read the statement from this PDF.");
  }

  return result.data.statements;
}
