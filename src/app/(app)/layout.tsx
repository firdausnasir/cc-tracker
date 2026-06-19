import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileTabBar } from "@/components/mobile-tabbar";
import { MobileTopBar } from "@/components/mobile-topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Server-side route guard for the whole authenticated section.
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        {/* Bottom padding clears the fixed mobile tab bar; the sidebar layout
            doesn't need it (pb resets at md). */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:px-6 md:pb-10">
          {children}
        </main>
        <MobileTabBar />
      </div>
      <InstallPrompt />
    </div>
  );
}
