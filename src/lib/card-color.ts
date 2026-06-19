// Presentation helpers for the user-chosen per-card color (a #rrggbb / #rgb
// hex stored on Card.color). Drives the "wallet" card-face look: a gradient
// built from the color plus a text color picked for contrast, so a card with a
// pale hue stays legible instead of rendering white-on-white.

import type { CSSProperties } from "react";

// Parse #rgb / #rrggbb to [r,g,b] 0–255. Returns null on anything unexpected so
// callers fall back to a safe default rather than crashing on bad data.
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.replace(/(.)/g, "$1$1") : m;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null;
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// WCAG relative luminance (0 dark – 1 light).
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Inline style for a card face: a diagonal gradient from the card color into a
// darker shade of itself, with a text color chosen for contrast. A pale card
// gets dark ink; everything else gets warm white.
export function cardFaceStyle(hex: string): CSSProperties {
  const rgb = parseHex(hex);
  const light = rgb ? luminance(rgb) > 0.6 : false;
  const fg = light ? "oklch(0.24 0.012 55)" : "oklch(0.98 0.01 80)";

  return {
    background: `linear-gradient(135deg, ${hex}, color-mix(in oklab, ${hex}, #000 32%))`,
    color: fg,
    // Used by children that need to dim against the face (meta text, hairlines).
    ["--on-face" as string]: fg,
  };
}
