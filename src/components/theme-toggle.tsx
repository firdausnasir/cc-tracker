"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={toggle}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
