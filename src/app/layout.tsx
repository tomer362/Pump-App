import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { ScrollRestoration } from "@/components/ui/scroll-restoration";
import { DocumentScrollGuard } from "@/components/ui/document-scroll-guard";
import { Toaster } from "@/components/ui/toast";

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
      <head>
        {/* Chromium fires `beforeinstallprompt` once, early, and never replays
            it — so a listener registered from a component effect misses it on
            every cold load and the install button would work only after a soft
            navigation. This runs before hydration, stashes the event for
            `lib/install-client.ts`, and `preventDefault()`s it so Chrome's own
            mini-infobar stays down and ours is the only prompt. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              addEventListener('beforeinstallprompt',function(e){
                e.preventDefault();
                window.__pumpInstallPrompt=e;
                dispatchEvent(new Event('pump:installable'));
              });
              addEventListener('appinstalled',function(){
                window.__pumpInstallPrompt=null;
                dispatchEvent(new Event('pump:installable'));
              });
            })();`,
          }}
        />
      </head>
      {/* The document itself never scrolls: it is exactly one viewport tall and
          clipped. Content scrolls in the container below, whose rubber-band is
          contained, so an over-scroll can't drag the fixed tab bar out of
          place or expose a blank strip under the content. `position: fixed`
          descendants still resolve against the viewport — the scroller sets no
          transform or filter — so docked chrome needs no change.

          It carries an id because scroll restoration has to reach the element
          itself, imperatively, before any scroll event has fired.
          `use-scroll-watch.ts` deliberately still finds it through a
          capture-phase listener instead: it only ever wants the events. */}
      <body className="bg-bg text-text-1 h-screen-d overflow-hidden">
        <div
          id="app-scroll"
          className="h-full overflow-y-auto overscroll-y-contain"
        >
          {children}
        </div>
        <ScrollRestoration />
        {/* The document is supposed to sit permanently at zero. This is what
            makes that true on a phone, where the keyboard pans a clipped page
            and does not always pan it back — and where the cost of it staying
            panned is the workout header, and the only Finish button in the
            app, above the top of the screen until a reload. */}
        <DocumentScrollGuard />
        <ServiceWorkerRegistrar />
        {/* The one place a failed background write can say so. */}
        <Toaster />
      </body>
    </html>
  );
}
