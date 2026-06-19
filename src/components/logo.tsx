import { cn } from "@/lib/utils";

// The product mark — same card glyph as the favicon (public/icon.svg), inlined
// so it scales crisply in the UI and stays in lockstep with the installed-app
// icon. A rounded tangerine tile with a single tilted card; simplified vs the
// full-bleed favicon so it stays legible at navbar size (~28px).
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Statement Tracker"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A4C" />
          <stop offset="1" stopColor="#E64F1B" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-bg)" />
      <g transform="rotate(-7 20 20)">
        <rect x="9" y="13" width="22" height="15" rx="3.4" fill="#FFF4EC" />
        <rect x="12" y="16.4" width="4.6" height="3.6" rx="1" fill="#F2682F" />
        <rect x="12" y="22" width="13.5" height="1.9" rx="0.95" fill="#F2682F" opacity="0.85" />
      </g>
    </svg>
  );
}
