import type { MetadataRoute } from "next";

// Web app manifest — App Router auto-serves this at /manifest.webmanifest and
// injects <link rel="manifest">. Colors mirror the light-fintech palette:
// brand indigo status bar over a warm-paper splash. Icons are full-bleed so
// they double as maskable icons on Android.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Statement Tracker",
    short_name: "Statements",
    description: "Track your credit-card statements and what you owe each cycle.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#5b3fd6",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
