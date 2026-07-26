import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pump",
  description: "Track your lifts. Train with your friends.",
  applicationName: "Pump",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pump",
    // Lets our own background run under the status bar instead of a white band.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report anything but 0.
  viewportFit: "cover",
  // Lets users pinch-zoom (accessibility) while `touch-action: manipulation`
  // still removes the double-tap delay.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} antialiased`}>
      <body className="bg-bg text-text-1 min-h-screen-d">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
