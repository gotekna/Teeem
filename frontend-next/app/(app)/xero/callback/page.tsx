"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface Status {
  loading: boolean;
  success: boolean;
  error: string | null;
}

export default function XeroCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>({
    loading: true,
    success: false,
    error: null,
  });

  useEffect(() => {
    handleCallback();
     
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    // Check if this is a company-specific callback (from Corporate > Company > Bank tab)
    const isCompanyCallback = state && state.startsWith("company_");
    const companyId = isCompanyCallback ? state.replace("company_", "") : null;

    // Check if we've already processed this code to prevent duplicate OAuth exchanges on refresh
    const processedCode = sessionStorage.getItem("xero_processed_code");
    if (code && code === processedCode) {
      if (isCompanyCallback) {
        // Company callback - just close the popup, parent is polling
        window.close();
      } else {
        router.replace("/settings");
      }
      return;
    }

    // Check for errors from Xero
    if (error) {
      setStatus({
        loading: false,
        success: false,
        error: `Authorization failed: ${error}`,
      });
      if (isCompanyCallback) {
        // For company callbacks, show error briefly then close
        setTimeout(() => window.close(), 3000);
      } else {
        setTimeout(() => router.push("/dashboard"), 3000);
      }
      return;
    }

    // Check if code is present
    if (!code) {
      setStatus({
        loading: false,
        success: false,
        error: "No authorization code received",
      });
      if (isCompanyCallback) {
        setTimeout(() => window.close(), 3000);
      } else {
        setTimeout(() => router.push("/dashboard"), 3000);
      }
      return;
    }

    try {
      if (isCompanyCallback && companyId) {
        // Company-specific callback - call the company endpoint
        await api.get(`/api/v1/companies/${companyId}/xero/callback`, {
          params: { code, state }
        });
      } else {
        // Global callback for Settings page
        await api.post("/api/v1/xero/callback", { code });
      }

      // Mark this code as processed to prevent re-execution on refresh
      sessionStorage.setItem("xero_processed_code", code);

      setStatus({
        loading: false,
        success: true,
        error: null,
      });

      if (isCompanyCallback) {
        // Company callback - close popup after brief success message
        // Parent window (XeroConnectionCard) is polling for status
        setTimeout(() => window.close(), 1500);
      } else {
        // Redirect back to dashboard instead of settings
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    } catch (err) {
      setStatus({
        loading: false,
        success: false,
        error: (err as Error).message || "Failed to complete Xero connection",
      });

      if (isCompanyCallback) {
        setTimeout(() => window.close(), 3000);
      } else {
        setTimeout(() => router.push("/dashboard"), 3000);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-card p-8 shadow-lg">
          <div className="text-center">
            {status.loading ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <Spinner size={20} className="text-primary" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">Connecting to Xero...</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please wait while we complete the connection.
                </p>
              </>
            ) : status.success ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                  <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">Successfully Connected!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your Xero account has been connected. Redirecting...
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                  <XCircleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">Connection Failed</h2>
                <p className="mt-2 text-sm text-muted-foreground">{status.error}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Redirecting back to settings...
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
