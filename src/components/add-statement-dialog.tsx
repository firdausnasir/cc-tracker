"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { StatementForm } from "@/components/statement-form";
import { createStatementAction } from "@/app/actions/statements";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CardOption = { id: string; name: string };

export function AddStatementDialog({
  cards,
  defaultCardId,
  trigger,
}: {
  cards: CardOption[];
  /** Preselect a card (quick-add from a specific card row). */
  defaultCardId?: string;
  /** Override the default "Add statement" button. */
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" className="gap-1.5 active:scale-[0.97]">
              <PlusIcon className="size-4" />
              Add statement
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a statement</DialogTitle>
          <DialogDescription>
            Enter the statement balance — the dates come from the card&apos;s
            schedule.
          </DialogDescription>
        </DialogHeader>
        <StatementForm
          action={createStatementAction}
          cards={cards}
          defaultCardId={defaultCardId}
          submitLabel="Add statement"
          pendingLabel="Adding…"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
