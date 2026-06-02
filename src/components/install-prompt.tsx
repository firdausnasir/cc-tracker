"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DownloadIcon, PlusSquareIcon, ShareIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// `beforeinstallprompt` isn't in the DOM lib types — declare the slice we use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

// Hydration-safe "are we on the client yet" flag. Server snapshot is false, so
// the first client render matches the server (renders nothing); React then
// re-renders with `true` once mounted. Avoids reading browser-only APIs during
// render on the server.
const subscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function isStandalone() {
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;

  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

/**
 * Dismissible "add to home screen" nudge. Chromium/desktop get a real install
 * button via the captured `beforeinstallprompt` event; iOS has no such API, so
 * we show the manual share-sheet instructions instead. Hidden once installed or
 * once the user dismisses it (remembered in localStorage).
 */
export function InstallPrompt() {
  const isClient = useIsClient();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // stop Chrome's mini-infobar; we drive the prompt
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;

    await deferred.prompt();
    await deferred.userChoice;
    // The event is single-use; drop it and stop showing the banner either way.
    setDeferred(null);
    dismiss();
  }

  // All browser-API reads happen at render, guarded behind isClient so they
  // never run during SSR or the hydrating first paint.
  if (!isClient || dismissed) {
    return null;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const persistentlyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
  const canPromptNatively = deferred !== null;

  // Show only when installable: a captured prompt (Chromium) or iOS (manual).
  if (isStandalone() || persistentlyDismissed || (!canPromptNatively && !isIOS)) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-lg backdrop-blur-md">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <DownloadIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold tracking-tight">Install Statement Tracker</p>
          {isIOS ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Tap
              <ShareIcon className="inline size-3.5" aria-label="the Share button" />
              then
              <PlusSquareIcon className="inline size-3.5" aria-label="Add to Home Screen" />
              Add to Home Screen.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add it to your home screen for one-tap access.
            </p>
          )}
          {canPromptNatively && (
            <Button type="button" size="sm" className="mt-2.5" onClick={install}>
              <DownloadIcon />
              Install
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
