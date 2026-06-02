"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "Cards" },
] as const;

// Primary section nav. Highlights the active route off the pathname so the user
// always knows where they are; a nested route (e.g. /cards/123) keeps its parent lit.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Button
            key={link.href}
            variant="ghost"
            size="sm"
            nativeButton={false}
            aria-current={active ? "page" : undefined}
            className={cn(active && "bg-muted text-foreground")}
            render={<Link href={link.href} />}
          >
            {link.label}
          </Button>
        );
      })}
    </nav>
  );
}
