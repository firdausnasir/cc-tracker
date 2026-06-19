import type { ReactNode } from "react";

import { cardFaceStyle } from "@/lib/card-color";
import { cn } from "@/lib/utils";

type CardFaceProps = {
  color: string;
  name: string;
  issuer?: string | null;
  last4?: string | null;
  /** Top-right slot — a status badge, currency chip, or controls. */
  topRight?: ReactNode;
  /** Bottom slot under the card name — total owed, schedule, etc. */
  children?: ReactNode;
  className?: string;
};

// A credit-card face rendered from the card's own color. The gradient + chip +
// last-4 give it the tactile "this is a real card" read that anchors the wallet
// aesthetic; text color is chosen for contrast (see cardFaceStyle). Purely
// presentational and server-safe.
export function CardFace({ color, name, issuer, last4, topRight, children, className }: CardFaceProps) {
  return (
    <div
      style={cardFaceStyle(color)}
      className={cn(
        "lift relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4",
        className,
      )}
    >
      {/* Soft depth — a large off-canvas highlight, kept faint so it reads as
          sheen on the card stock rather than a shape. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[0.7rem] font-semibold tracking-widest uppercase opacity-80">
          {issuer || "Card"}
        </span>
        {topRight}
      </div>

      {/* EMV chip — a small flourish that sells the card metaphor. */}
      <div
        aria-hidden
        className="relative grid h-6 w-9 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-[5px] bg-white/35 ring-1 ring-white/20"
      >
        <span className="bg-white/20" />
        <span className="bg-white/30" />
        <span className="bg-white/30" />
        <span className="bg-white/20" />
      </div>

      <div className="relative mt-1">
        <div className="truncate font-display text-lg leading-tight tracking-tight">{name}</div>
        {last4 && (
          <div className="tabular mt-0.5 text-sm opacity-80">•••• {last4}</div>
        )}
      </div>

      {children && <div className="relative">{children}</div>}
    </div>
  );
}
