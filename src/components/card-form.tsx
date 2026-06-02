"use client";

import * as React from "react";
import { useActionState } from "react";

import type { ActionState } from "@/app/actions/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CardDefaults = {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
  color: string;
  statementDay: number;
  paymentDay: number;
  currency: string;
};

type CardFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Present in edit mode — prefills the fields and carries the row id. */
  defaults?: CardDefaults;
  submitLabel: string;
  pendingLabel: string;
  onSuccess?: () => void;
};

// Shared card editor used by both the add form (create) and the edit dialog
// (update). The schedule (statement/payment day) + currency live on the card,
// so statements only ever need an amount.
export function CardForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  onSuccess,
}: CardFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null,
  );

  // The action returns `null` on success — detect the pending true->false edge
  // with no error and notify the parent (e.g. to close the dialog).
  const wasPending = React.useRef(false);
  React.useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}

      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="name">Card name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder="Maybank Visa Signature"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuer">Issuer (optional)</Label>
        <Input
          id="issuer"
          name="issuer"
          defaultValue={defaults?.issuer ?? ""}
          placeholder="Maybank"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="last4">Last 4 (optional)</Label>
        <Input
          id="last4"
          name="last4"
          inputMode="numeric"
          maxLength={4}
          defaultValue={defaults?.last4 ?? ""}
          placeholder="1234"
          className="tabular h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="statementDay">Statement day</Label>
        <Input
          id="statementDay"
          name="statementDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={defaults?.statementDay}
          placeholder="22"
          className="tabular h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentDay">Payment day</Label>
        <Input
          id="paymentDay"
          name="paymentDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={defaults?.paymentDay}
          placeholder="10"
          className="tabular h-9"
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Input
          id="currency"
          name="currency"
          maxLength={3}
          defaultValue={defaults?.currency ?? "MYR"}
          className="h-9 w-24 uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Days are 1–31. A payment day earlier than the statement day rolls to
          the next month.
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <Label htmlFor="color">Accent color</Label>
        <input
          id="color"
          name="color"
          type="color"
          defaultValue={defaults?.color ?? "#6366f1"}
          className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
      </div>

      {state?.error && (
        <p className="col-span-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="col-span-2 mt-1 w-full active:scale-[0.98]"
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
