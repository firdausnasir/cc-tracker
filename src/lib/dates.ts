// Due-state classification for a statement, relative to today.
// Presentation is MYT; we compare date-only (ignore time) to avoid off-by-one.

export type DueState = "paid" | "overdue" | "soon" | "upcoming";

const SOON_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dueState(dueDate: Date, paid: boolean, now = new Date()): DueState {
  if (paid) {
    return "paid";
  }

  const diffDays = Math.round((startOfDay(dueDate) - startOfDay(now)) / MS_PER_DAY);

  if (diffDays < 0) {
    return "overdue";
  }

  if (diffDays <= SOON_DAYS) {
    return "soon";
  }

  return "upcoming";
}

// "22nd", "10th", "1st" — for displaying a card's day-of-month schedule.
export function ordinalDay(day: number): string {
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";

  return `${day}${suffix}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "January 2025" — labels which billing cycle a statement belongs to. The cycle
// is anchored to the statement month (see monthKeyOf). No timezone, matching
// formatDate: the dates are already the calendar values we want to show.
export function formatCycleMonth(d: Date): string {
  return d.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

// Presentation timezone. The worker clock is UTC, so the dashboard headline
// resolves its calendar month in Asia/Kuala_Lumpur explicitly rather than
// trusting server-local time.
const MYT = "Asia/Kuala_Lumpur";

// A statement is payable once it has been issued and is still unsettled —
// today is on/after its statement date and it isn't paid. This intentionally
// includes overdue statements (past the due date): money still owed is money to
// pay. Compared date-only to avoid intra-day off-by-one.
export function isPayable(statementDate: Date, paid: boolean, now = new Date()): boolean {
  if (paid) {
    return false;
  }

  return startOfDay(statementDate) <= startOfDay(now);
}

// Clamp a day-of-month (1-31) to the real last day of the given month so a card
// billed on the 31st still resolves in February.
function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  return new Date(year, monthIndex, Math.min(day, lastDay));
}

// Resolve a statement's concrete dates from the card schedule and the cycle
// month (a `yyyy-MM` key). The statement lands on statementDay of that month;
// the payment lands on paymentDay of the same month, rolling to the next month
// when paymentDay falls earlier in the month than statementDay.
export function cycleDates(
  statementDay: number,
  paymentDay: number,
  monthKey: string,
): { statementDate: Date; dueDate: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const monthIndex = month - 1;

  const statementDate = clampDay(year, monthIndex, statementDay);
  const dueMonthIndex = paymentDay < statementDay ? monthIndex + 1 : monthIndex;
  const dueDate = clampDay(year, dueMonthIndex, paymentDay);

  return { statementDate, dueDate };
}

// The cycle month key (yyyy-MM) a statement belongs to — taken from its
// statement date, which is the anchor the cycle was generated from.
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthYear(d: Date = new Date()): string {
  return d.toLocaleDateString("en-MY", {
    timeZone: MYT,
    month: "long",
    year: "numeric",
  });
}
