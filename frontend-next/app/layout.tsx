import { Hedvig_Letters_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/providers/app-providers";
import type { Metadata, Viewport } from "next";
import { TAILWIND_COLORS } from "@/lib/constants/color-constants";
import { headers } from "next/headers";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detect lightweight pages that don't need the full app provider stack.
  // The signing page is public-facing and must load instantly for external signers.
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLightweightPage = pathname.startsWith("/sign");

  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable)} suppressHydrationWarning>
      <body
        className={cn(
          hedvigSerif.variable,
          GeistSans.className,
          "antialiased bg-background text-foreground"
        )}
      >
        {isLightweightPage ? (
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        ) : (
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <AppProviders>
              {children}
            </AppProviders>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
// Trigger rebuild Sun Dec 28 11:06:24 AEST 2025
