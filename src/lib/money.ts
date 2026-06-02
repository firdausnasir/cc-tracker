// Money helpers. We store minor units (sen) as bigint and NEVER use float math.
// Display happens only at the edges.

const DECIMAL_INPUT = /^\d{1,15}(\.\d{1,2})?$/;

// Parse a user-entered decimal string (e.g. "1234.50") into bigint minor units.
// Throws on malformed input — callers validate at the boundary.
export function parseAmountToMinor(input: string): bigint {
  const trimmed = input.trim();

  if (!DECIMAL_INPUT.test(trimmed)) {
    throw new Error("Amount must be a number with up to 2 decimal places");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(2, "0");

  return BigInt(whole) * 100n + BigInt(paddedFraction);
}

// Format bigint minor units for display, e.g. 123450n -> "1,234.50".
export function formatMinor(minor: bigint, currency = "MYR"): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const cents = abs % 100n;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";

  return `${currency} ${sign}${wholeStr}.${cents.toString().padStart(2, "0")}`;
}

// Render minor units as a plain decimal string for an <input> default value —
// no currency code, no thousands separators (so it round-trips through the
// amount validator). e.g. 123450n -> "1234.50".
export function minorToAmountInput(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const cents = abs % 100n;

  return `${negative ? "-" : ""}${whole}.${cents.toString().padStart(2, "0")}`;
}

// Sum statements grouped by currency — never sum across currencies.
export function sumByCurrency(
  rows: { amountDue: bigint; currency: string }[],
): Record<string, bigint> {
  return rows.reduce<Record<string, bigint>>((acc, row) => {
    acc[row.currency] = (acc[row.currency] ?? 0n) + row.amountDue;

    return acc;
  }, {});
}
