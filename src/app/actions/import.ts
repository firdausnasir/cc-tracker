"use server";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import {
  AiExtractError,
  extractStatementFromPdf,
  type CardForMatch,
} from "@/lib/ai-extract";

// The reviewed draft handed back to the client. Everything is optional except
// what we could read — the client prefills the create form with it and the user
// confirms. No DB write happens in this action.
export type StatementDraft = {
  cardId: string | null;
  month: string | null;
  amount: string | null;
  currency: string | null;
};

export type ImportState = { error: string } | { draft: StatementDraft } | null;

// 8 MB ceiling — generous for a statement PDF, bounded so we don't base64 a
// huge upload into a model request.
const MAX_PDF_BYTES = 8 * 1024 * 1024;

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return session.user.id;
}

export async function extractStatementAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const userId = await requireUserId();

  const file = formData.get("pdf");

  // Validate the upload at the boundary before doing any work.
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to import." };
  }

  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are supported." };
  }

  if (file.size > MAX_PDF_BYTES) {
    return { error: "That PDF is too large (max 8 MB)." };
  }

  const prisma = await getPrisma();
  const cards = await prisma.card.findMany({
    where: { userId },
    select: { id: true, name: true, issuer: true, last4: true },
  });

  if (cards.length === 0) {
    return { error: "Add a card first, then import a statement against it." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const forMatch: CardForMatch[] = cards;

  let draft: StatementDraft;
  try {
    const extracted = await extractStatementFromPdf(bytes, forMatch);

    // Only accept a suggested card that actually belongs to this user — an id
    // alone must never preselect another account's card.
    const suggestedCardId =
      extracted.cardId && cards.some((c) => c.id === extracted.cardId)
        ? extracted.cardId
        : null;

    draft = {
      cardId: suggestedCardId,
      month: extracted.month ?? null,
      amount: extracted.amount ?? null,
      currency: extracted.currency ?? null,
    };
  } catch (error) {
    if (error instanceof AiExtractError) {
      return { error: error.message };
    }

    // Don't surface internal error details (may carry PII from the document).
    return { error: "Something went wrong reading that PDF." };
  }

  return { draft };
}
