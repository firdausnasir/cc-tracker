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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { deleteCardAction, reorderCardsAction } from "@/app/actions/cards";
import { CardFace } from "@/components/card-face";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ordinalDay } from "@/lib/dates";
import { Button } from "@/components/ui/button";

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

function SortableCardTile({ card }: { card: CardRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the tile above its siblings while it travels.
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card ${
        isDragging ? "lift-lg opacity-95 ring-1 ring-foreground/10" : "lift"
      }`}
    >
      <CardFace
        color={card.color}
        name={card.name}
        issuer={card.issuer}
        last4={card.last4}
        className="rounded-none"
        topRight={
          // The drag handle owns the gesture; it sits on the face so the whole
          // card reads as grabbable. Edit/Delete live in the footer and stay
          // independently clickable.
          <button
            type="button"
            aria-label={`Reorder ${card.name}`}
            className="-mt-1 -mr-1 cursor-grab touch-none rounded-md bg-white/15 p-1 transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        }
      >
        <div className="flex items-center gap-3 text-[0.7rem] leading-tight opacity-80">
          <span>
            stmt <span className="tabular font-medium">{ordinalDay(card.statementDay)}</span>
          </span>
          <span aria-hidden>·</span>
          <span>
            due <span className="tabular font-medium">{ordinalDay(card.paymentDay)}</span>
          </span>
          <span aria-hidden>·</span>
          <span className="font-medium">{card.currency}</span>
        </div>
      </CardFace>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {card.statementCount} statement{card.statementCount === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-0.5">
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
      </div>
    </div>
  );
}

export function CardList({ cards }: { cards: CardRow[] }) {
  // Local order so a drop reflects instantly; the server persists in the
  // background. Re-sync when the server sends a fresh list (add/edit/delete) —
  // done in render via a prev-prop guard rather than an effect.
  const [order, setOrder] = React.useState(cards);
  const [seenCards, setSeenCards] = React.useState(cards);
  if (cards !== seenCards) {
    setSeenCards(cards);
    setOrder(cards);
  }

  const sensors = useSensors(
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
      id="card-sort"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2">
          {order.map((card) => (
            <SortableCardTile key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
