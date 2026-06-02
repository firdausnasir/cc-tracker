"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";

import { updateCardAction } from "@/app/actions/cards";
import { CardForm, type CardDefaults } from "@/components/card-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EditCardDialog({ card }: { card: CardDefaults }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit this card"
            aria-label="Edit this card"
            className="text-muted-foreground hover:text-foreground"
          >
            <PencilIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
          <DialogDescription>
            Update the card details and billing schedule. Existing statements
            keep the dates they were logged with.
          </DialogDescription>
        </DialogHeader>
        <CardForm
          action={updateCardAction}
          defaults={card}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
