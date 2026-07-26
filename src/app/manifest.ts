import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pump — Social Workout Tracker",
    short_name: "Pump",
    description: "Track your lifts. Train with your friends.",
    start_url: "/feed",
    scope: "/",
    // Standalone is what unlocks the Push API on iOS, and it's what makes the
    // app lose the browser chrome once added to the Home Screen.
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
