export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            $
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Statement Tracker
          </span>
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-xl shadow-primary/5 ring-1 ring-foreground/10">
          {children}
        </div>
      </div>
    </main>
  );
}
