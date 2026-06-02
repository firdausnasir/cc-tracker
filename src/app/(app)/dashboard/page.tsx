import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { formatMinor, minorToAmountInput } from "@/lib/money";
import {
  dueState,
  formatCycleMonth,
  formatMonthYear,
  isPayable,
  monthKeyOf,
  ordinalDay,
  type DueState,
} from "@/lib/dates";
import type { ReactNode } from "react";
import { PlusIcon, CheckIcon, Undo2Icon, Trash2Icon, ChevronDownIcon } from "lucide-react";

import { AddStatementDialog } from "@/components/add-statement-dialog";
import { EditStatementDialog } from "@/components/edit-statement-dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { togglePaidAction, deleteStatementAction } from "@/app/actions/statements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATE_BADGE: Record<DueState, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-destructive/10 text-destructive" },
  soon: { label: "Due soon", cls: "bg-warn/15 text-warn" },
  upcoming: { label: "Upcoming", cls: "bg-muted text-muted-foreground" },
  paid: { label: "Paid", cls: "bg-ok/15 text-ok" },
};

type Row = {
  id: string;
  cardId: string;
  dueDate: Date;
  statementDate: Date;
  amountDue: bigint;
  currency: string;
  paid: boolean;
  card: {
    id: string;
    name: string;
    color: string;
    currency: string;
    issuer: string | null;
    last4: string | null;
    statementDay: number;
    paymentDay: number;
  };
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const prisma = await getPrisma();
  const [cards, statements] = await Promise.all([
    prisma.card.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.statement.findMany({
      where: { card: { userId } },
      orderBy: { dueDate: "desc" },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            color: true,
            currency: true,
            issuer: true,
            last4: true,
            statementDay: true,
            paymentDay: true,
          },
        },
      },
    }),
  ]);

  const now = new Date();

  // Currency lives on the card now; flatten it onto each row so the totals and
  // row rendering keep working against a single shape.
  const rows: Row[] = statements.map((s) => ({
    id: s.id,
    cardId: s.cardId,
    dueDate: s.dueDate,
    statementDate: s.statementDate,
    amountDue: s.amountDue,
    currency: s.card.currency,
    paid: s.paid,
    card: s.card,
  }));

  const unpaid = rows.filter((s) => !s.paid);
  const paid = rows.filter((s) => s.paid);

  // Headline: everything to pay right now — issued (statement date reached) and
  // still unpaid, including overdue. Strictly-future statements are excluded.
  const payable = unpaid.filter((s) => isPayable(s.statementDate, false, now));
  const monthTotals = buildMonthTotals(payable, now);

  // Per-card breakdown across all unpaid statements, most-urgent card first.
  const groups = groupByCard(unpaid);

  // Paid history, grouped by statement cycle (newest first); each row is a card.
  const paidCycles = groupByCycle(paid);

  return (
    <div className="flex flex-col gap-5">
      <header className="animate-enter flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">To pay now</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {formatMonthYear(now)}
          </h1>
        </div>
        <AddStatementDialog cards={cards} />
      </header>

      {/* Hero — one figure per currency, never summed across currencies. */}
      <section
        className="animate-enter grid gap-3 sm:grid-cols-2"
        style={{ animationDelay: "60ms" }}
      >
        {monthTotals.length === 0 ? (
          <Card className="bg-ok/[0.05] ring-ok/20 sm:col-span-2">
            <CardContent className="py-2">
              <p className="text-lg font-medium text-ok">Nothing to pay right now</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No issued statements are awaiting payment.
              </p>
            </CardContent>
          </Card>
        ) : (
          monthTotals.map(({ currency, total, overdue, upcoming, count }) => {
            const amount = formatMinor(total, currency).slice(currency.length + 1);
            const hasOverdue = overdue > 0n;
            return (
              <Card key={currency} className="justify-between">
                <CardContent className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {currency}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {count} statement{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="tabular text-4xl font-semibold leading-none tracking-tight">
                    {amount}
                  </div>
                  <div className="text-sm">
                    {hasOverdue ? (
                      <span className="font-medium text-destructive">
                        {formatMinor(overdue, currency)} overdue
                        {upcoming > 0n && (
                          <span className="font-normal text-muted-foreground">
                            {" "}· {formatMinor(upcoming, currency)} upcoming
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nothing overdue</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* Per-card statement balances. */}
      <section
        className="animate-enter flex flex-col gap-3"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cards
        </h2>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-2 text-sm text-muted-foreground">
              No unpaid statements. Add one to start tracking.
            </CardContent>
          </Card>
        ) : (
          groups.map(({ card, rows }) => {
            const total = rows.reduce((sum, r) => sum + r.amountDue, 0n);

            return (
              <Card key={card.id} size="sm" className="gap-0! py-0!">
                <CardGroupHeader card={card} total={total}>
                  <AddStatementDialog
                    cards={cards}
                    defaultCardId={card.id}
                    trigger={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                        title={`Add a statement for ${card.name}`}
                        aria-label={`Add a statement for ${card.name}`}
                      >
                        <PlusIcon />
                      </Button>
                    }
                  />
                </CardGroupHeader>
                <div className="flex flex-col divide-y divide-border border-t border-border">
                  {rows.map((s) => (
                    <StatementRow key={s.id} statement={s} state={dueState(s.dueDate, false, now)} />
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </section>

      {paidCycles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Paid history
          </h2>
          {paidCycles.map((cycle) => (
            <PaidCycleGroup key={cycle.monthKey} cycle={cycle} />
          ))}
        </section>
      )}
    </div>
  );
}

// Shared header for a card's statement group: color tile, name, issuer/last4, and
// the card's running total. `children` is an optional trailing action (e.g. the
// quick-add button); `mutedTotal` quiets the figure for paid history.
function CardGroupHeader({
  card,
  total,
  mutedTotal = false,
  children,
}: {
  card: Row["card"];
  total?: bigint;
  mutedTotal?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="size-2.5 shrink-0 rounded-full ring-2 ring-foreground/5"
        style={{ backgroundColor: card.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{card.name}</div>
        {(card.issuer || card.last4) && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {card.issuer ?? ""}
            {card.issuer && card.last4 ? " · " : ""}
            {card.last4 ? `•••• ${card.last4}` : ""}
          </div>
        )}
        {/* The card's recurring schedule lives here, not on every row — the
            statement / due day-of-month is identical across cycles. */}
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            Statement{" "}
            <span className="tabular font-medium text-foreground/75">
              {ordinalDay(card.statementDay)}
            </span>
          </span>
          <span aria-hidden className="text-foreground/30">
            →
          </span>
          <span>
            Due{" "}
            <span className="tabular font-medium text-foreground/75">
              {ordinalDay(card.paymentDay)}
            </span>
          </span>
        </div>
      </div>
      {total !== undefined && (
        <div
          className={`tabular shrink-0 text-sm font-semibold tracking-tight ${
            mutedTotal ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {formatMinor(total, card.currency)}
        </div>
      )}
      {children}
    </div>
  );
}

function StatementRow({
  statement: s,
  state,
  muted = false,
}: {
  statement: Row;
  state: DueState;
  muted?: boolean;
}) {
  const badge = STATE_BADGE[state];
  const amountCls = `tabular shrink-0 font-semibold tracking-tight ${
    muted ? "text-muted-foreground" : "text-foreground"
  }`;

  // The card header carries the currency, so the per-row figure drops the code
  // and just reads as a number — less "MYR MYR MYR" repeating down the list.
  const amount = formatMinor(s.amountDue, s.currency).slice(s.currency.length + 1);

  // The concrete statement / due dates now live on the card header (same day
  // every cycle); each row only needs to say which cycle it is.
  const cycle = formatCycleMonth(s.statementDate);

  return (
    <div className="group/row px-4 py-2.5 transition-colors hover:bg-muted/40 sm:py-3">
      {/* Mobile: cycle shares a line with the amount; the status badge sits below
          the cycle, actions below the amount. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:hidden">
        <div className="col-start-1 row-start-1 truncate text-sm font-medium">{cycle}</div>
        <div className={`col-start-2 row-start-1 justify-self-end text-sm ${amountCls}`}>
          {amount}
        </div>
        <Badge
          className={`${badge.cls} col-start-1 row-start-2 justify-self-start border-transparent`}
        >
          {badge.label}
        </Badge>
        <div className="col-start-2 row-start-2 flex items-center justify-self-end gap-0.5">
          <StatementActions statement={s} />
        </div>
      </div>

      {/* Desktop: single line, status badge on the far left. */}
      <div className="hidden items-center gap-3 sm:flex">
        <Badge className={`${badge.cls} shrink-0 border-transparent`}>{badge.label}</Badge>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{cycle}</div>
        <div className={`text-base ${amountCls}`}>{amount}</div>
        <div className="flex shrink-0 items-center gap-0.5">
          <StatementActions statement={s} />
        </div>
      </div>
    </div>
  );
}

// Toggle (mark paid / unpay), edit, and delete for one statement. The primary
// button keeps its word on desktop and drops to an icon on mobile.
function StatementActions({ statement: s }: { statement: Row }) {
  const toggleLabel = s.paid ? "Move back to unpaid" : "Mark this statement paid";

  return (
    <>
      <form action={togglePaidAction} className="contents">
        <input type="hidden" name="id" value={s.id} />
        <Button
          type="submit"
          variant={s.paid ? "ghost" : "default"}
          size="sm"
          title={toggleLabel}
          aria-label={toggleLabel}
          className={s.paid ? "text-muted-foreground" : ""}
        >
          {s.paid ? <Undo2Icon /> : <CheckIcon />}
          <span className="hidden sm:inline">{s.paid ? "Unpay" : "Mark paid"}</span>
        </Button>
      </form>
      <EditStatementDialog
        statement={{
          id: s.id,
          month: monthKeyOf(s.statementDate),
          amount: minorToAmountInput(s.amountDue),
          cardName: s.card.name,
        }}
      />
      <ConfirmDeleteButton
        action={deleteStatementAction}
        id={s.id}
        title="Delete statement?"
        description="This permanently removes this statement balance. This can’t be undone."
        trigger={
          <Button
            variant="destructive"
            size="icon-sm"
            title="Delete this statement"
            aria-label="Delete this statement"
          >
            <Trash2Icon />
          </Button>
        }
      />
    </>
  );
}

// One paid-history cycle: its month, all the cards paid in it, and the totals
// split per currency (a cycle can hold cards billed in different currencies).
type CycleGroup = {
  monthKey: string;
  label: string;
  rows: Row[];
  totals: { currency: string; total: bigint }[];
};

// A paid cycle rendered as a native <details> accordion, collapsed by default.
// The summary shows the cycle and its per-currency total(s); expanding reveals
// one row per card.
function PaidCycleGroup({ cycle }: { cycle: CycleGroup }) {
  const count = cycle.rows.length;

  return (
    <Card size="sm" className="gap-0! py-0!">
      <details className="group/cycle">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/cycle:rotate-180"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{cycle.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {count} card{count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="tabular shrink-0 text-right text-sm font-semibold tracking-tight text-muted-foreground">
            {cycle.totals.map((t) => (
              <div key={t.currency}>{formatMinor(t.total, t.currency)}</div>
            ))}
          </div>
        </summary>
        <div className="flex flex-col divide-y divide-border border-t border-border">
          {cycle.rows.map((s) => (
            <PaidCardRow key={s.id} statement={s} />
          ))}
        </div>
      </details>
    </Card>
  );
}

// A single paid statement inside a cycle group. Grouping is by cycle now, so the
// row identifies its card; the currency stays on the figure because a cycle can
// mix currencies.
function PaidCardRow({ statement: s }: { statement: Row }) {
  const meta = [s.card.issuer, s.card.last4 ? `•••• ${s.card.last4}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group/row flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:py-3">
      <span
        className="size-2.5 shrink-0 rounded-full ring-2 ring-foreground/5"
        style={{ backgroundColor: s.card.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{s.card.name}</div>
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      <div className="tabular shrink-0 text-sm font-semibold tracking-tight text-muted-foreground">
        {formatMinor(s.amountDue, s.currency)}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <StatementActions statement={s} />
      </div>
    </div>
  );
}

type MonthTotal = {
  currency: string;
  total: bigint;
  overdue: bigint;
  upcoming: bigint;
  count: number;
};

// Per-currency totals for statements due this month, split into overdue vs the
// rest. Never sums across currencies (financially meaningless).
function buildMonthTotals(rows: Row[], now: Date): MonthTotal[] {
  const map = new Map<string, MonthTotal>();

  for (const s of rows) {
    const bucket =
      map.get(s.currency) ??
      { currency: s.currency, total: 0n, overdue: 0n, upcoming: 0n, count: 0 };

    bucket.total += s.amountDue;
    bucket.count += 1;
    if (dueState(s.dueDate, false, now) === "overdue") {
      bucket.overdue += s.amountDue;
    } else {
      bucket.upcoming += s.amountDue;
    }
    map.set(s.currency, bucket);
  }

  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

// Group statements by card, ordering cards by their soonest due date so the most
// urgent card surfaces first. Statements arrive due-date descending (latest first)
// and keep that order within each card; card ordering uses each group's min due
// date so it's independent of the row order.
function groupByCard(rows: Row[]): { card: Row["card"]; rows: Row[] }[] {
  const map = new Map<string, { card: Row["card"]; rows: Row[] }>();

  for (const s of rows) {
    const group = map.get(s.card.id) ?? { card: s.card, rows: [] };
    group.rows.push(s);
    map.set(s.card.id, group);
  }

  const minDue = (rows: Row[]) =>
    Math.min(...rows.map((r) => r.dueDate.getTime()));

  return [...map.values()].sort((a, b) => minDue(a.rows) - minDue(b.rows));
}

// Group statements by statement cycle (yyyy-MM), newest cycle first. Within a
// cycle rows are ordered by card name, and totals are split per currency —
// summing across currencies is financially meaningless. The yyyy-MM key sorts
// chronologically as a plain string, so no date math is needed for ordering.
function groupByCycle(rows: Row[]): CycleGroup[] {
  const map = new Map<string, { monthKey: string; label: string; rows: Row[] }>();

  for (const s of rows) {
    const monthKey = monthKeyOf(s.statementDate);
    const group =
      map.get(monthKey) ??
      { monthKey, label: formatCycleMonth(s.statementDate), rows: [] };
    group.rows.push(s);
    map.set(monthKey, group);
  }

  return [...map.values()]
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map((c) => ({
      monthKey: c.monthKey,
      label: c.label,
      rows: [...c.rows].sort((a, b) => a.card.name.localeCompare(b.card.name)),
      totals: sumByCurrency(c.rows),
    }));
}

// Per-currency totals for a set of statements, currency-sorted for stable order.
function sumByCurrency(rows: Row[]): { currency: string; total: bigint }[] {
  const map = new Map<string, bigint>();

  for (const s of rows) {
    map.set(s.currency, (map.get(s.currency) ?? 0n) + s.amountDue);
  }

  return [...map.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
