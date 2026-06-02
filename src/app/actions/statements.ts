"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { statementSchema, statementUpdateSchema } from "@/lib/validation";
import { parseAmountToMinor } from "@/lib/money";
import { cycleDates } from "@/lib/dates";

export type ActionState = { error: string } | null;

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return session.user.id;
}

export async function createStatementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = statementSchema.safeParse({
    cardId: formData.get("cardId"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid statement" };
  }

  const { cardId, month, amount } = parsed.data;

  const prisma = await getPrisma();

  // Confirm the card belongs to this user before writing anything. The card's
  // schedule drives the statement's dates — the form only supplies the amount.
  const card = await prisma.card.findFirst({ where: { id: cardId, userId } });

  if (!card) {
    return { error: "Card not found" };
  }

  const { statementDate, dueDate } = cycleDates(
    card.statementDay,
    card.paymentDay,
    month,
  );

  await prisma.statement.create({
    data: {
      cardId,
      statementDate,
      dueDate,
      amountDue: parseAmountToMinor(amount),
    },
  });

  revalidatePath("/dashboard");

  return null;
}

export async function updateStatementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = statementUpdateSchema.safeParse({
    id: formData.get("id"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid statement" };
  }

  const { id, month, amount } = parsed.data;

  const prisma = await getPrisma();

  // Load with the parent card so we can recompute dates from its schedule, and
  // confirm ownership in the same query.
  const statement = await prisma.statement.findFirst({
    where: { id, card: { userId } },
    include: { card: { select: { statementDay: true, paymentDay: true } } },
  });

  if (!statement) {
    return { error: "Statement not found" };
  }

  const { statementDate, dueDate } = cycleDates(
    statement.card.statementDay,
    statement.card.paymentDay,
    month,
  );

  await prisma.statement.update({
    where: { id },
    data: {
      statementDate,
      dueDate,
      amountDue: parseAmountToMinor(amount),
    },
  });

  revalidatePath("/dashboard");

  return null;
}

export async function togglePaidAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const prisma = await getPrisma();
  const statement = await prisma.statement.findFirst({
    where: { id, card: { userId } },
  });

  if (!statement) {
    return;
  }

  const nowPaid = !statement.paid;

  await prisma.statement.update({
    where: { id },
    data: { paid: nowPaid, paidAt: nowPaid ? new Date() : null },
  });

  revalidatePath("/dashboard");
}

export async function deleteStatementAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const prisma = await getPrisma();

  await prisma.statement.deleteMany({ where: { id, card: { userId } } });

  revalidatePath("/dashboard");
}
