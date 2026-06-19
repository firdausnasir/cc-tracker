import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Figtree, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

// Body + UI: a warm geometric grotesque, the workhorse voice.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Display: wordmark, headings, big figures — chunky and characterful.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Numbers only: monospace for tabular ledger figures.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Statement Tracker",
  description: "Track your credit-card statements and what you owe each cycle.",
  // <link rel="manifest"> is injected automatically from app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "Statements",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/apple-icon.png",
  },
};

// theme-color lives on the viewport export in Next 16, not metadata. Match the
// status bar to the light/dark background so the PWA chrome blends in.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#26211d" },
  ],
};

// Set the theme class before first paint so there's no light-mode flash on a
// dark-preferring device. Runs synchronously at the top of <body> (avoids
// manually rendering <head>, which clashes with Next's head management and
// caused a hydration mismatch). The <html> class it mutates is marked
// suppressHydrationWarning so React doesn't flag the server/client difference.
// "device" (the default) and any absent/unknown value follow the OS preference;
// only an explicit "light"/"dark" choice overrides it.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${bricolage.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="no-flash-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: noFlashTheme }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
