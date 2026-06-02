"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import {
  cardReorderSchema,
  cardSchema,
  cardUpdateSchema,
} from "@/lib/validation";

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

  // Append the new card to the end of the user's manual order. No transaction
  // on D1; a concurrent create could collide on position, but ties fall back to
  // createdAt in every read so the list stays stable (B1, single user).
  const last = await prisma.card.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

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
      position,
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

// Persist a drag-drop reorder. Fire-and-forget from the client after a drop;
// the optimistic UI already shows the new order.
export async function reorderCardsAction(orderedIds: string[]): Promise<void> {
  const userId = await requireUserId();

  const parsed = cardReorderSchema.safeParse(orderedIds);

  if (!parsed.success) {
    return;
  }

  const ids = parsed.data;
  const prisma = await getPrisma();

  // Ownership boundary: trust the DB, not the client list. Reorder only if the
  // submitted set is exactly this user's cards — same size, every id owned. A
  // mismatch (stale tab, tampering) is dropped silently rather than partially
  // applied, leaving the stored order untouched.
  const owned = await prisma.card.findMany({
    where: { userId },
    select: { id: true },
  });

  if (owned.length !== ids.length) {
    return;
  }

  const ownedIds = new Set(owned.map((c) => c.id));

  if (!ids.every((id) => ownedIds.has(id))) {
    return;
  }

  // No transaction on D1 — apply per row. Each write keeps the userId in its
  // where clause so an id alone can never reach another user's row.
  for (let position = 0; position < ids.length; position++) {
    await prisma.card.updateMany({
      where: { id: ids[position], userId },
      data: { position },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/cards");
}
