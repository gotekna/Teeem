import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SDA Property Hub | Specialist Disability Accommodation",
    template: "%s | SDA Property Hub",
  },
  description:
    "Find specialist disability accommodation (SDA) vacancies and properties for sale across Australia. NDIS-funded housing for people with disability.",
  keywords: [
    "SDA", "specialist disability accommodation", "NDIS housing",
    "disability accommodation", "SDA vacancies", "SDA for sale",
    "accessible housing", "disability housing Australia",
  ],
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "SDA Property Hub",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
