import { Trash2Icon } from "lucide-react";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { AddCardForm } from "@/components/add-card-form";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteCardAction } from "@/app/actions/cards";
import { ordinalDay } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const prisma = await getPrisma();
  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { statements: true } } },
  });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Your cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each card is an account you pay into. Add the cards you want to track.
          </p>
        </div>

        {cards.length === 0 ? (
          <Card>
            <CardContent className="py-2 text-sm text-muted-foreground">
              No cards yet — add one on the right.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {cards.map((card) => (
              <Card key={card.id} size="sm">
                <CardContent className="flex items-start gap-3">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-foreground/5"
                    style={{ backgroundColor: card.color }}
                    aria-hidden
                  />
                  {/* Name leads; one consolidated meta line keeps the card compact
                      while the schedule numbers stay scannable in foreground. */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{card.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {card.issuer ? `${card.issuer} · ` : ""}
                      {card.last4 ? `•••• ${card.last4} · ` : ""}
                      Statement{" "}
                      <span className="font-medium text-foreground">
                        {ordinalDay(card.statementDay)}
                      </span>
                      {" · "}Pay{" "}
                      <span className="font-medium text-foreground">
                        {ordinalDay(card.paymentDay)}
                      </span>
                      {" · "}
                      <span className="font-medium text-foreground">{card.currency}</span>
                      {" · "}
                      {card._count.statements} statement
                      {card._count.statements === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <EditCardDialog
                      card={{
                        id: card.id,
                        name: card.name,
                        issuer: card.issuer,
                        last4: card.last4,
                        color: card.color,
                        statementDay: card.statementDay,
                        paymentDay: card.paymentDay,
                        currency: card.currency,
                      }}
                    />
                    <ConfirmDeleteButton
                      action={deleteCardAction}
                      id={card.id}
                      title="Delete card?"
                      description={`This deletes "${card.name}" and all ${card._count.statements} of its statement${card._count.statements === 1 ? "" : "s"}. This can’t be undone.`}
                      confirmLabel="Delete card"
                      trigger={
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          title="Delete card and its statements"
                          aria-label="Delete card and its statements"
                        >
                          <Trash2Icon />
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
