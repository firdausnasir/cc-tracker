"use client";

import { createCardAction } from "@/app/actions/cards";
import { CardForm } from "@/components/card-form";

export function AddCardForm() {
  return (
    <CardForm
      action={createCardAction}
      submitLabel="Add card"
      pendingLabel="Adding…"
    />
  );
}
