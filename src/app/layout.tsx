import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import { THEME_BOOT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Den",
  description: "The student network for every college in India: notes, placements, voice Spaces, live debates, events and more.",
  icons: { icon: "/icon.svg", apple: "/icons/apple-180.png" },
  appleWebApp: { capable: true, title: "Den", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F171D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400&family=Hind:wght@400;500;600&display=swap" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
