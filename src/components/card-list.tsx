"use client";

import * as React from "react";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { deleteCardAction, reorderCardsAction } from "@/app/actions/cards";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ordinalDay } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type CardRow = {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
  color: string;
  statementDay: number;
  paymentDay: number;
  currency: string;
  statementCount: number;
};

function CardMeta({ card }: { card: CardRow }) {
  return (
    <div className="mt-0.5 text-sm text-muted-foreground">
      {card.issuer ? `${card.issuer} · ` : ""}
      {card.last4 ? `•••• ${card.last4} · ` : ""}
      Statement{" "}
      <span className="font-medium text-foreground">{ordinalDay(card.statementDay)}</span>
      {" · "}Pay{" "}
      <span className="font-medium text-foreground">{ordinalDay(card.paymentDay)}</span>
      {" · "}
      <span className="font-medium text-foreground">{card.currency}</span>
      {" · "}
      {card.statementCount} statement
      {card.statementCount === 1 ? "" : "s"}
    </div>
  );
}

function SortableCardRow({ card }: { card: CardRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the row above its siblings while it travels so it never slides under
    // an adjacent card mid-drag.
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      size="sm"
      style={style}
      className={
        isDragging
          ? "relative shadow-lg ring-1 ring-foreground/10 [&]:opacity-90"
          : "relative"
      }
    >
      <CardContent className="flex items-start gap-2">
        {/* Drag handle owns the drag gesture so the Edit/Delete controls and any
            text stay independently interactive. */}
        <button
          type="button"
          aria-label={`Reorder ${card.name}`}
          className="mt-0.5 -ml-1 cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-foreground/5"
          style={{ backgroundColor: card.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{card.name}</div>
          <CardMeta card={card} />
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
            description={`This deletes "${card.name}" and all ${card.statementCount} of its statement${card.statementCount === 1 ? "" : "s"}. This can’t be undone.`}
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
  );
}

export function CardList({ cards }: { cards: CardRow[] }) {
  // Local order so a drop reflects instantly; the server persists in the
  // background. Re-sync when the server sends a fresh list (add/edit/delete) —
  // done in render via a prev-prop guard rather than an effect, so there's no
  // extra commit. `cards` is referentially stable between client re-renders
  // (parent is a Server Component), so this fires only on real server updates.
  const [order, setOrder] = React.useState(cards);
  const [seenCards, setSeenCards] = React.useState(cards);
  if (cards !== seenCards) {
    setSeenCards(cards);
    setOrder(cards);
  }

  const sensors = useSensors(
    // A small drag threshold keeps a plain click/tap on the handle from being
    // read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const from = order.findIndex((c) => c.id === active.id);
    const to = order.findIndex((c) => c.id === over.id);

    if (from === -1 || to === -1) {
      return;
    }

    const next = arrayMove(order, from, to);
    setOrder(next);
    // Fire-and-forget: the optimistic order already shows; persistence + a
    // revalidate reconcile any divergence on the next load.
    void reorderCardsAction(next.map((c) => c.id));
  }

  return (
    <DndContext
      // Stable id so dnd-kit's a11y `aria-describedby` matches server↔client.
      // Without it dnd-kit falls back to an auto-increment counter that drifts
      // between SSR and hydration, throwing a hydration mismatch.
      id="card-sort"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {order.map((card) => (
            <SortableCardRow key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
