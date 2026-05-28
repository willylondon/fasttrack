import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaSupport } from "@/components/system/pwa-support";
import { Toaster } from "@/components/ui/sonner";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://fasttrack-alpha.vercel.app"),
  title: "FastTrack — Fasting Window Tracker & Accountability App",
  description:
    "Track fasting windows, build streaks, log sessions, and stay accountable with friends.",
  applicationName: "FastTrack",
  keywords: [
    "fasting window tracker",
    "fasting accountability",
    "streak tracker",
    "health habit tracker",
    "FastTrack",
  ],
  openGraph: {
    title: "FastTrack — Fasting Window Tracker & Accountability App",
    description:
      "Track fasting windows, build streaks, log sessions, and stay accountable with friends.",
    url: "https://fasttrack-alpha.vercel.app",
    siteName: "FastTrack",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FastTrack app preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FastTrack — Fasting Window Tracker & Accountability App",
    description:
      "Track fasting windows, build streaks, log sessions, and stay accountable with friends.",
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FastTrack",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${monoFont.variable} dark h-full`}
      suppressHydrationWarning
    >
      <body className="theme min-h-full font-sans">
        <PwaSupport />
        {children}
        <Toaster
          closeButton
          expand
          position="top-center"
          richColors
          theme="dark"
        />
      </body>
    </html>
  );
}
