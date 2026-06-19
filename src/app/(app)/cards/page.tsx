import type { CSSProperties } from "react";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { AddCardForm } from "@/components/add-card-form";
import { CardList } from "@/components/card-list";

export default async function CardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const prisma = await getPrisma();
  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { statements: true } } },
  });

  return (
    <div className="flex flex-col gap-7">
      <header className="animate-rise">
        <h1 className="font-display text-3xl tracking-tight">Your cards</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Each card is an account you pay into. Drag a card to reorder — the order
          carries into the statement card picker.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <section className="animate-rise" style={{ "--i": 1 } as CSSProperties}>
          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No cards yet — add your first one on the right.
            </div>
          ) : (
            <CardList
              cards={cards.map((card) => ({
                id: card.id,
                name: card.name,
                issuer: card.issuer,
                last4: card.last4,
                color: card.color,
                statementDay: card.statementDay,
                paymentDay: card.paymentDay,
                currency: card.currency,
                statementCount: card._count.statements,
              }))}
            />
          )}
        </section>

        <section
          className="animate-rise lg:sticky lg:top-6"
          style={{ "--i": 2 } as CSSProperties}
        >
          <div className="lift rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg tracking-tight">Add a card</h2>
            <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
              Set its billing schedule and color.
            </p>
            <AddCardForm />
          </div>
        </section>
      </div>
    </div>
  );
}
