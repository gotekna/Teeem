"use client";

/**
 * AppProviders - Full application provider stack.
 *
 * Wraps children with all providers needed by the main application.
 * Excluded from lightweight pages (e.g., /sign) to keep their bundle tiny.
 */

import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { QueryProvider } from "@/components/providers/query-provider";
import { JotaiProvider } from "@/components/providers/jotai-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { DynamicTitle } from "@/components/dynamic-title";
import { CompanyColorsProvider } from "@/components/providers/company-colors-provider";
import { OfflineProvider } from "@/components/providers/offline-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
