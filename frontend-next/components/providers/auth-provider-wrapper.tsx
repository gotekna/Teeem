"use client";

/**
 * AuthProviderWrapper - Lightweight provider wrapper for auth pages (login, signup).
 *
 * These pages live outside the (app) route group so they don't get AppProviders.
 * They only need AuthProvider (for useAuth hook) + QueryProvider (for react-query)
 * + JotaiProvider (for global atoms). Toaster is included so login errors show.
 */

import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/components/providers/query-provider";
import { JotaiProvider } from "@/components/providers/jotai-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster />
          <SonnerToaster />
        </AuthProvider>
      </QueryProvider>
    </JotaiProvider>
  );
}
