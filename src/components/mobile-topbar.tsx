"use client";

import Link from "next/link";

import { signoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

// Mobile header: wordmark + the controls that live in the sidebar footer on
// desktop (theme, sign out). Section nav is handled by the bottom tab bar, so
// this bar carries no links. Hidden at md+.
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <Logo className="size-8" />
        <span className="font-display text-base leading-none tracking-tight">Statements</span>
      </Link>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <form action={signoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
