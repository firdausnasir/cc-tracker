"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";

import { updateStatementAction } from "@/app/actions/statements";
import { EditStatementForm } from "@/components/statement-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type StatementDefaults = {
  id: string;
  month: string;
  amount: string;
  cardName: string;
};

export function EditStatementDialog({ statement }: { statement: StatementDefaults }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit this statement"
            aria-label="Edit this statement"
            className="text-muted-foreground hover:text-foreground"
          >
            <PencilIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit statement</DialogTitle>
          <DialogDescription>
            Adjust the balance or move it to another cycle month. Dates recompute
            from the card&apos;s schedule.
          </DialogDescription>
        </DialogHeader>
        <EditStatementForm
          action={updateStatementAction}
          defaults={statement}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
