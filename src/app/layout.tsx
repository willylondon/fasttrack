import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
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
  title: "FastTrack",
  description: "A social intermittent fasting tracker with progress stages, streaks, and history.",
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
