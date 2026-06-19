import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center px-4 py-8">
      {/* Warm brand bloom behind the card — quiet atmosphere, not a gradient slab. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="animate-rise relative w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-10" />
          <span className="font-display text-xl tracking-tight">Statements</span>
        </div>
        <div className="lift-lg rounded-2xl border border-border bg-card p-6">{children}</div>
      </div>
    </main>
  );
}
