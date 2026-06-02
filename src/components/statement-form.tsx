"use client";

import * as React from "react";
import { useActionState } from "react";

import type { ActionState } from "@/app/actions/statements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CardOption = { id: string; name: string };

type MonthOption = { value: string; label: string };

// A short, relevant window of cycle months — next month plus the last six,
// newest first. Generated from a reference date passed in by the caller so the
// value stays stable across a render and SSR/client agree.
function buildMonthOptions(reference: Date): MonthOption[] {
  const options: MonthOption[] = [];

  for (let offset = 1; offset >= -5; offset--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
    options.push({ value, label });
  }

  return options;
}

type StatementFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Cards to log against — create mode only. */
  cards?: CardOption[];
  /** Preselect a card in create mode (e.g. quick-add from a card row). */
  defaultCardId?: string;
  /** Present in edit mode: prefills the cycle month + amount, carries the id. */
  defaults?: { id: string; month: string; amount: string; cardName: string };
  /** Current month key (yyyy-MM) and the option list, resolved by the caller. */
  currentMonth: string;
  monthOptions: MonthOption[];
  submitLabel: string;
  pendingLabel: string;
  onSuccess?: () => void;
};

function StatementFormInner({
  action,
  cards,
  defaultCardId,
  defaults,
  currentMonth,
  monthOptions,
  submitLabel,
  pendingLabel,
  onSuccess,
}: StatementFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null,
  );
  const [cardId, setCardId] = React.useState(
    defaultCardId ?? (cards?.length === 1 ? cards[0].id : ""),
  );
  const [month, setMonth] = React.useState(defaults?.month ?? currentMonth);

  // Base UI resolves the trigger label from this map, so the closed trigger
  // shows "May 2026" instead of the raw "2026-05" value before the popup mounts.
  const cardItems = React.useMemo(
    () => cards?.map((c) => ({ value: c.id, label: c.name })) ?? [],
    [cards],
  );

  // The action returns `null` on success and `{error}` on failure, so success
  // is only the pending true->false edge with no error. Watch that edge.
  const wasPending = React.useRef(false);
  React.useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  const isEdit = Boolean(defaults);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      {isEdit ? (
        <input type="hidden" name="id" value={defaults!.id} />
      ) : (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="cardId">Card</Label>
          <input type="hidden" name="cardId" value={cardId} required />
          <Select
            items={cardItems}
            value={cardId}
            onValueChange={(value) => setCardId(value as string)}
          >
            <SelectTrigger id="cardId" size="default" className="h-9 w-full">
              <SelectValue placeholder="Choose a card…" />
            </SelectTrigger>
            <SelectContent>
              {cards?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isEdit && (
        <p className="col-span-2 text-sm text-muted-foreground">
          Editing statement for{" "}
          <span className="font-medium text-foreground">{defaults!.cardName}</span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="month">Statement month</Label>
        <input type="hidden" name="month" value={month} />
        <Select
          items={monthOptions}
          value={month}
          onValueChange={(value) => setMonth(value as string)}
        >
          <SelectTrigger id="month" size="default" className="h-9 w-full">
            <SelectValue placeholder="Choose a month…" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Statement balance</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          placeholder="0.00"
          required
          defaultValue={defaults?.amount}
          className="tabular h-9"
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

// Public create-mode wrapper: resolves the month window once on the client so
// the option list and default selection are consistent.
export function StatementForm({
  action,
  cards,
  defaultCardId,
  submitLabel,
  pendingLabel,
  onSuccess,
}: {
  action: StatementFormProps["action"];
  cards: CardOption[];
  defaultCardId?: string;
  submitLabel: string;
  pendingLabel: string;
  onSuccess?: () => void;
}) {
  const { currentMonth, monthOptions } = React.useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return { currentMonth, monthOptions: buildMonthOptions(now) };
  }, []);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a card first, then you can log statements against it.
      </p>
    );
  }

  return (
    <StatementFormInner
      action={action}
      cards={cards}
      defaultCardId={defaultCardId}
      currentMonth={currentMonth}
      monthOptions={monthOptions}
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      onSuccess={onSuccess}
    />
  );
}

// Edit-mode wrapper: card is fixed; the month window still surrounds today.
export function EditStatementForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  onSuccess,
}: {
  action: StatementFormProps["action"];
  defaults: NonNullable<StatementFormProps["defaults"]>;
  submitLabel: string;
  pendingLabel: string;
  onSuccess?: () => void;
}) {
  const { currentMonth, monthOptions } = React.useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    // Make sure the statement's own month is always selectable even if it falls
    // outside the default window.
    const options = buildMonthOptions(now);
    if (!options.some((o) => o.value === defaults.month)) {
      const [y, m] = defaults.month.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      options.push({
        value: defaults.month,
        label: d.toLocaleDateString("en-MY", { month: "long", year: "numeric" }),
      });
    }
    return { currentMonth, monthOptions: options };
  }, [defaults.month]);

  return (
    <StatementFormInner
      action={action}
      defaults={defaults}
      currentMonth={currentMonth}
      monthOptions={monthOptions}
      submitLabel={submitLabel}
      pendingLabel={pendingLabel}
      onSuccess={onSuccess}
    />
  );
}
