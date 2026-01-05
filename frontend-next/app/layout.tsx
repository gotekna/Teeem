import { Hedvig_Letters_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/components/providers/query-provider";
import { JotaiProvider } from "@/components/providers/jotai-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { DynamicTitle } from "@/components/dynamic-title";

const hedvigSerif = Hedvig_Letters_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hedvig-serif",
});

export const metadata = {
  title: "Teeem",
  description: "Project management for construction",
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
                <DynamicTitle />
                {children}
                <Toaster />
                <SonnerToaster />
              </AuthProvider>
            </QueryProvider>
          </JotaiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
// Trigger rebuild Sun Dec 28 11:06:24 AEST 2025
