import { Hedvig_Letters_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { QueryProvider } from "@/components/providers/query-provider";
import { JotaiProvider } from "@/components/providers/jotai-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { DynamicTitle } from "@/components/dynamic-title";
import { CompanyColorsProvider } from "@/components/providers/company-colors-provider";
import { OfflineProvider } from "@/components/providers/offline-provider";
import type { Metadata, Viewport } from "next";

const hedvigSerif = Hedvig_Letters_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hedvig-serif",
});

export const metadata: Metadata = {
  title: "Teeem",
  description: "Project management for construction",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TEEEM",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
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
          <JotaiProvider>
            <QueryProvider>
              <AuthProvider>
                <TenantProvider>
                  <CompanyColorsProvider>
                    <OfflineProvider>
                      <DynamicTitle />
                      {children}
                      <Toaster />
                      <SonnerToaster />
                    </OfflineProvider>
                  </CompanyColorsProvider>
                </TenantProvider>
              </AuthProvider>
            </QueryProvider>
          </JotaiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
// Trigger rebuild Sun Dec 28 11:06:24 AEST 2025
