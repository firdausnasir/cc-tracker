import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

// Single typeface for all headings and UI — one consistent voice.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

// Numbers only: monospace for tabular money figures.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#2b2342" },
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
      className={`${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
