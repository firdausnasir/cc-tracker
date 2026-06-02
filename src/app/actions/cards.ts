"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { cardSchema, cardUpdateSchema } from "@/lib/validation";

export type ActionState = { error: string } | null;

async function requireUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return session.user.id;
}

export async function createCardAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = cardSchema.safeParse({
    name: formData.get("name"),
    issuer: formData.get("issuer") || "",
    last4: formData.get("last4") || "",
    color: formData.get("color") || "#6366f1",
    statementDay: formData.get("statementDay"),
    paymentDay: formData.get("paymentDay"),
    currency: formData.get("currency") || "MYR",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid card details" };
  }

  const { name, issuer, last4, color, statementDay, paymentDay, currency } =
    parsed.data;

  const prisma = await getPrisma();

  await prisma.card.create({
    data: {
      userId,
      name,
      issuer: issuer || null,
      last4: last4 || null,
      color,
      statementDay,
      paymentDay,
      currency,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/cards");

  return null;
}

export async function updateCardAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = cardUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    issuer: formData.get("issuer") || "",
    last4: formData.get("last4") || "",
    color: formData.get("color") || "#6366f1",
    statementDay: formData.get("statementDay"),
    paymentDay: formData.get("paymentDay"),
    currency: formData.get("currency") || "MYR",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid card details" };
  }

  const { id, name, issuer, last4, color, statementDay, paymentDay, currency } =
    parsed.data;

  const prisma = await getPrisma();

  // Scope the update to the owner so an id alone can't touch others' rows.
  // Editing the schedule does NOT rewrite existing statements' stored dates —
  // those stay historically accurate to the cycle they were logged in.
  const { count } = await prisma.card.updateMany({
    where: { id, userId },
    data: {
      name,
      issuer: issuer || null,
      last4: last4 || null,
      color,
      statementDay,
      paymentDay,
      currency,
    },
  });

  if (count === 0) {
    return { error: "Card not found" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/cards");

  return null;
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // Scope the delete to the owner so an id alone can't touch others' rows.
  const prisma = await getPrisma();

  await prisma.card.deleteMany({ where: { id, userId } });

  revalidatePath("/dashboard");
  revalidatePath("/cards");
}
