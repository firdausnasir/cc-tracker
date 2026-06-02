import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signoutAction } from "@/app/actions/auth";
import { InstallPrompt } from "@/components/install-prompt";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Server-side route guard for the whole authenticated section.
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2.5 font-display font-semibold tracking-tight"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                $
              </span>
              <span className="hidden sm:inline">Statement Tracker</span>
            </Link>
            <NavLinks />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <form action={signoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">{children}</main>
      <InstallPrompt />
    </div>
  );
}
