"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const ICON = {
  light: SunIcon,
  dark: MoonIcon,
  device: MonitorIcon,
} satisfies Record<Theme, typeof SunIcon>;

const LABEL = {
  light: "Theme: light — switch to dark",
  dark: "Theme: dark — switch to device",
  device: "Theme: device — switch to light",
} satisfies Record<Theme, string>;

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const Icon = ICON[theme];

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={cycle}
      title={LABEL[theme]}
      aria-label={LABEL[theme]}
    >
      <Icon />
    </Button>
  );
}
