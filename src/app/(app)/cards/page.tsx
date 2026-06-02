import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { AddCardForm } from "@/components/add-card-form";
import { CardList } from "@/components/card-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Your cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each card is an account you pay into. Drag to reorder — the order is
            used in the statement card picker.
          </p>
        </div>

        {cards.length === 0 ? (
          <Card>
            <CardContent className="py-2 text-sm text-muted-foreground">
              No cards yet — add one on the right.
            </CardContent>
          </Card>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add a card
        </h2>
        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Add a card</CardTitle>
          </CardHeader>
          <CardContent>
            <AddCardForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
