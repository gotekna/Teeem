import { Hedvig_Letters_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata, Viewport } from "next";
import { TAILWIND_COLORS } from "@/lib/constants/color-constants";

const hedvigSerif = Hedvig_Letters_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hedvig-serif",
});

export const metadata: Metadata = {
  title: "TEEEM",
  description: "Project management platform for construction - manage jobs, contacts, documents, and workflows",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TEEEM",
  },
  formatDetection: {
    telephone: false,
  },
  keywords: ["construction management", "project management", "job tracking", "construction software"],
};

export const viewport: Viewport = {
  themeColor: TAILWIND_COLORS.indigo[600],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout is intentionally lightweight - NO heavy providers here.
  // AppProviders lives in (app)/layout.tsx so public pages like /sign
  // never download or parse provider JS bundles.
  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable)} suppressHydrationWarning>
      <body
        className={cn(
          hedvigSerif.variable,
          GeistSans.className,
          "antialiased bg-background text-foreground"
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
