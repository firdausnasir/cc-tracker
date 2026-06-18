import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const signinSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

const ISO_4217 = /^[A-Z]{3}$/;

// Day-of-month, coerced from the form string. 1-31; real month length is
// clamped later in cycleDates so the 31st still resolves in February.
const dayOfMonth = z.coerce
  .number()
  .int("Use a whole day of the month")
  .min(1, "Day must be between 1 and 31")
  .max(31, "Day must be between 1 and 31");

export const cardSchema = z.object({
  name: z.string().trim().min(1, "Card name is required").max(80),
  issuer: z.string().trim().max(80).optional().or(z.literal("")),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Last 4 must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  statementDay: dayOfMonth,
  paymentDay: dayOfMonth,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ISO_4217, "Use a 3-letter ISO currency code")
    .default("MYR"),
});

// Edit reuses the create shape plus the row id.
export const cardUpdateSchema = cardSchema.extend({
  id: z.string().min(1),
});

// Drag-drop reorder payload: the user's card ids in their new order. Ownership
// (this set === the user's owned set) is enforced in the action, not here — the
// schema only guarantees the shape.
export const cardReorderSchema = z
  .array(z.string().min(1))
  .min(1, "No cards to reorder");

// yyyy-MM cycle key from the month picker.
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");

// A statement now carries only its amount and cycle month — the dates and
// currency come from the parent card's schedule.
export const statementSchema = z.object({
  cardId: z.string().min(1),
  month: monthKey,
  // Reject zero/negative in v1 — keep the validator simple (brainstorm default).
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,15}(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
});

// Edit keeps the cycle month + amount; the card can't be reassigned.
export const statementUpdateSchema = z.object({
  id: z.string().min(1),
  month: monthKey,
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,15}(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
});

// The model's PDF-extraction output. Kept loose by design: a statement PDF may
// omit fields, so currency/cardId/month/amount are each nullable. The amount,
// when present, is the same decimal-string shape the statement validator
// accepts, so it round-trips through parseAmountToMinor unchanged. Ownership of
// any returned cardId is re-checked server-side — this schema only guards shape.
export const aiStatementDraftSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,15}(\.\d{1,2})?$/)
    .nullish(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullish(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ISO_4217)
    .nullish(),
  cardId: z.string().min(1).nullish(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type CardInput = z.infer<typeof cardSchema>;
export type StatementInput = z.infer<typeof statementSchema>;
export type AiStatementDraft = z.infer<typeof aiStatementDraftSchema>;
