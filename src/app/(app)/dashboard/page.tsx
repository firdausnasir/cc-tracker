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
import type { ReactNode, CSSProperties } from "react";
import { PlusIcon, CheckIcon, Undo2Icon, Trash2Icon, ChevronDownIcon } from "lucide-react";

import { AddStatementDialog } from "@/components/add-statement-dialog";
import { ImportStatementDialog } from "@/components/import-statement-dialog";
import { EditStatementDialog } from "@/components/edit-statement-dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CardFace } from "@/components/card-face";
import { togglePaidAction, deleteStatementAction } from "@/app/actions/statements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATE_BADGE: Record<DueState, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-destructive/10 text-destructive" },
  soon: { label: "Due soon", cls: "bg-warn/15 text-warn" },
  upcoming: { label: "Upcoming", cls: "bg-muted text-muted-foreground" },
  paid: { label: "Paid", cls: "bg-ok/15 text-ok" },
};

// Priority order for picking the single state that best describes a card with
// several open statements.
const STATE_RANK: Record<DueState, number> = { overdue: 0, soon: 1, upcoming: 2, paid: 3 };

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Human relative due label for the timeline — "3d overdue", "Due today",
// "in 5 days", "in 3 weeks". Tone mirrors the due state so urgency reads at a
// glance. Date-only compare to avoid intra-day off-by-one.
function relativeDue(due: Date, now: Date): { label: string; cls: string } {
  const days = Math.round((startOfDay(due) - startOfDay(now)) / MS_PER_DAY);

  if (days < 0) {
    return { label: `${-days}d overdue`, cls: "text-destructive" };
  }
  if (days === 0) {
    return { label: "Due today", cls: "text-warn" };
  }
  if (days <= 7) {
    return { label: `in ${days} day${days === 1 ? "" : "s"}`, cls: "text-warn" };
  }
  if (days <= 28) {
    const weeks = Math.round(days / 7);

    return { label: `in ${weeks} week${weeks === 1 ? "" : "s"}`, cls: "text-muted-foreground" };
  }

  return { label: `in ${days} days`, cls: "text-muted-foreground" };
}

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
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, issuer: true },
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

  // Timeline: the soonest-due open statements, ascending. Includes not-yet-issued
  // cycles so the user sees what's coming, not just what's payable today.
  const timeline = [...unpaid]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 6);

  // Per-card breakdown across all unpaid statements, most-urgent card first.
  const groups = groupByCard(unpaid);

  // Paid history, grouped by statement cycle (newest first); each row is a card.
  const paidCycles = groupByCycle(paid);

  return (
    <div className="flex flex-col gap-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {formatMonthYear(now)}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportStatementDialog cards={cards} />
          <AddStatementDialog cards={cards} />
        </div>
      </header>

      {/* Hero — what you owe right now, one figure per currency. Never summed
          across currencies. */}
      <section className="animate-rise" style={{ "--i": 1 } as CSSProperties}>
        <HeroPanel totals={monthTotals} />
      </section>

      {/* Upcoming-dues timeline — the forward view, soonest first. */}
      {timeline.length > 0 && (
        <section className="animate-rise flex flex-col gap-3" style={{ "--i": 2 } as CSSProperties}>
          <SectionLabel>Upcoming dues</SectionLabel>
          <div className="lift overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col divide-y divide-border">
              {timeline.map((s) => (
                <TimelineRow key={s.id} statement={s} now={now} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Wallet — per-card open balances, each as a real card face. */}
      <section className="animate-rise flex flex-col gap-3" style={{ "--i": 3 } as CSSProperties}>
        <SectionLabel>Your cards</SectionLabel>
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No open statements. Add one to start tracking.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map(({ card, rows }) => (
              <CardWallet key={card.id} card={card} rows={rows} cards={cards} now={now} />
            ))}
          </div>
        )}
      </section>

      {paidCycles.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Paid history</SectionLabel>
          {paidCycles.map((cycle) => (
            <PaidCycleGroup key={cycle.monthKey} cycle={cycle} />
          ))}
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

// The outstanding hero. One warm gradient panel; each currency gets a big
// figure with an overdue/upcoming split beneath it.
function HeroPanel({ totals }: { totals: MonthTotal[] }) {
  if (totals.length === 0) {
    return (
      <div className="lift flex items-center gap-4 rounded-2xl border border-ok/30 bg-ok/[0.06] p-5 sm:p-6">
        <div className="grid size-11 place-items-center rounded-full bg-ok/15 text-ok">
          <CheckIcon className="size-5" />
        </div>
        <div>
          <p className="font-display text-xl text-ok">Nothing to pay right now</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            No issued statements are awaiting payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lift-lg relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      {/* Brand wash — faint tangerine bloom in the corner for warmth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <p className="relative text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        To pay now
      </p>
      <div className="relative mt-3 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-x-12">
        {totals.map(({ currency, total, overdue, upcoming, count }) => {
          const amount = formatMinor(total, currency).slice(currency.length + 1);

          return (
            <div key={currency} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{currency}</span>
                <span className="tabular text-4xl leading-none font-semibold tracking-tight sm:text-5xl">
                  {amount}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                {overdue > 0n && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                    <span className="tabular">{formatMinor(overdue, currency)}</span> overdue
                  </span>
                )}
                {upcoming > 0n && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                    <span className="tabular">{formatMinor(upcoming, currency)}</span> upcoming
                  </span>
                )}
                <span className="text-muted-foreground">
                  · {count} statement{count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One row of the upcoming-dues timeline: color dot, card + cycle, relative due,
// amount. Compact and scannable — the forward-looking glance.
function TimelineRow({ statement: s, now }: { statement: Row; now: Date }) {
  const rel = relativeDue(s.dueDate, now);
  const amount = formatMinor(s.amountDue, s.currency).slice(s.currency.length + 1);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="size-2.5 shrink-0 rounded-full ring-2 ring-foreground/5"
        style={{ backgroundColor: s.card.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{s.card.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatCycleMonth(s.statementDate)}
        </div>
      </div>
      <div className={`shrink-0 text-xs font-medium ${rel.cls}`}>{rel.label}</div>
      <div className="tabular w-24 shrink-0 text-right text-sm font-semibold tracking-tight">
        {amount}
      </div>
    </div>
  );
}

// A wallet card: the colored card face, its running total + schedule, then the
// open statement rows with their actions, then a quick-add. The whole thing
// clips to one rounded surface so the face reads as the lid of the stack.
function CardWallet({
  card,
  rows,
  cards,
  now,
}: {
  card: Row["card"];
  rows: Row[];
  cards: { id: string; name: string; issuer: string | null }[];
  now: Date;
}) {
  const total = rows.reduce((sum, r) => sum + r.amountDue, 0n);
  const worst = rows
    .map((r) => dueState(r.dueDate, false, now))
    .reduce((a, b) => (STATE_RANK[b] < STATE_RANK[a] ? b : a), "upcoming" as DueState);
  const badge = STATE_BADGE[worst];
  const amount = formatMinor(total, card.currency).slice(card.currency.length + 1);

  return (
    <div className="lift flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <CardFace
        color={card.color}
        name={card.name}
        issuer={card.issuer}
        last4={card.last4}
        className="rounded-none"
        topRight={
          <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        }
      >
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[0.7rem] tracking-wide uppercase opacity-70">Owed</div>
            <div className="tabular text-2xl font-semibold tracking-tight">
              <span className="mr-1 text-sm opacity-70">{card.currency}</span>
              {amount}
            </div>
          </div>
          <div className="text-right text-[0.7rem] leading-tight opacity-75">
            <div>
              stmt <span className="tabular">{ordinalDay(card.statementDay)}</span>
            </div>
            <div>
              due <span className="tabular">{ordinalDay(card.paymentDay)}</span>
            </div>
          </div>
        </div>
      </CardFace>

      <div className="flex flex-col divide-y divide-border">
        {rows.map((s) => (
          <StatementRow key={s.id} statement={s} state={dueState(s.dueDate, false, now)} />
        ))}
      </div>

      <div className="border-t border-border p-2">
        <AddStatementDialog
          cards={cards}
          defaultCardId={card.id}
          trigger={
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              <PlusIcon />
              Add statement
            </Button>
          }
        />
      </div>
    </div>
  );
}

function StatementRow({ statement: s, state }: { statement: Row; state: DueState }) {
  const badge = STATE_BADGE[state];

  // The card face carries the currency, so the per-row figure drops the code
  // and just reads as a number.
  const amount = formatMinor(s.amountDue, s.currency).slice(s.currency.length + 1);
  const cycle = formatCycleMonth(s.statementDate);

  return (
    <div className="group/row flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <Badge className={`${badge.cls} shrink-0 border-transparent`}>{badge.label}</Badge>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{cycle}</div>
      <div className="tabular shrink-0 text-sm font-semibold tracking-tight">{amount}</div>
      <div className="flex shrink-0 items-center gap-0.5">
        <StatementActions statement={s} />
      </div>
    </div>
  );
}

// Toggle (mark paid / unpay), edit, and delete for one statement.
function StatementActions({ statement: s }: { statement: Row }) {
  const toggleLabel = s.paid ? "Move back to unpaid" : "Mark this statement paid";

  return (
    <>
      <form action={togglePaidAction} className="contents">
        <input type="hidden" name="id" value={s.id} />
        <Button
          type="submit"
          variant={s.paid ? "ghost" : "default"}
          size="icon-sm"
          title={toggleLabel}
          aria-label={toggleLabel}
          className={s.paid ? "text-muted-foreground" : ""}
        >
          {s.paid ? <Undo2Icon /> : <CheckIcon />}
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
function PaidCycleGroup({ cycle }: { cycle: CycleGroup }) {
  const count = cycle.rows.length;

  return (
    <div className="lift overflow-hidden rounded-2xl border border-border bg-card">
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
    </div>
  );
}

// A single paid statement inside a cycle group.
function PaidCardRow({ statement: s }: { statement: Row }) {
  const meta = [s.card.issuer, s.card.last4 ? `•••• ${s.card.last4}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group/row flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
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
// urgent card surfaces first.
function groupByCard(rows: Row[]): { card: Row["card"]; rows: Row[] }[] {
  const map = new Map<string, { card: Row["card"]; rows: Row[] }>();

  for (const s of rows) {
    const group = map.get(s.card.id) ?? { card: s.card, rows: [] };
    group.rows.push(s);
    map.set(s.card.id, group);
  }

  const minDue = (rows: Row[]) => Math.min(...rows.map((r) => r.dueDate.getTime()));

  return [...map.values()].sort((a, b) => minDue(a.rows) - minDue(b.rows));
}

// Group statements by statement cycle (yyyy-MM), newest cycle first.
function groupByCycle(rows: Row[]): CycleGroup[] {
  const map = new Map<string, { monthKey: string; label: string; rows: Row[] }>();

  for (const s of rows) {
    const monthKey = monthKeyOf(s.statementDate);
    const group =
      map.get(monthKey) ?? { monthKey, label: formatCycleMonth(s.statementDate), rows: [] };
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
