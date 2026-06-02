"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  /** Server action that performs the delete; receives the hidden `id`. */
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  /** The trigger element (e.g. an icon or text Button). */
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
};

// Wraps a destructive server action in a confirmation dialog so a single click
// can't delete a row. The trigger opens the dialog; confirming submits the form.
export function ConfirmDeleteButton({
  action,
  id,
  trigger,
  title,
  description,
  confirmLabel = "Delete",
}: Props) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose
            render={
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            }
          />
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive" size="sm">
              {confirmLabel}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
