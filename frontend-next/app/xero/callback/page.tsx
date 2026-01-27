"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

// Public callback page - outside (app) so no auth required
// Uses direct fetch instead of api lib to avoid auth redirect issues

interface Status {
  loading: boolean;
  success: boolean;
  error: string | null;
}

function XeroCallbackContent() {
  const searchParams = useSearchParams();
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

    // Check if this is a company-specific callback
    const isCompanyCallback = state && state.startsWith("company_");
    const companyId = isCompanyCallback ? state.replace("company_", "") : null;

    // Check if we've already processed this code
    const processedCode = sessionStorage.getItem("xero_processed_code");
    if (code && code === processedCode) {
      window.close();
      // Fallback redirect if close doesn't work
      setTimeout(() => {
        const returnUrl = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
        window.location.href = returnUrl;
      }, 500);
      return;
    }

    // Check for errors from Xero
    if (error) {
      setStatus({
        loading: false,
        success: false,
        error: `Authorization failed: ${error}`,
      });
      setTimeout(() => {
        window.close();
        setTimeout(() => {
          const returnUrl = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
          window.location.href = returnUrl;
        }, 500);
      }, 3000);
      return;
    }

    // Check if code is present
    if (!code) {
      setStatus({
        loading: false,
        success: false,
        error: "No authorization code received",
      });
      setTimeout(() => {
        window.close();
        setTimeout(() => {
          const returnUrl = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
          window.location.href = returnUrl;
        }, 500);
      }, 3000);
      return;
    }

    try {
      // Get auth token from localStorage (shared with main window)
      const token = localStorage.getItem("teeem_token");
      const apiUrl = localStorage.getItem("teeem_api_url") || "https://teeem-staging-d60a657ed68a.herokuapp.com";

      if (!token) {
        throw new Error("No auth token found. Please log in again.");
      }

      const endpoint = isCompanyCallback && companyId
        ? `${apiUrl}/api/v1/companies/${companyId}/xero/callback?code=${code}&state=${state}`
        : `${apiUrl}/api/v1/xero/callback`;

      const response = await fetch(endpoint, {
        method: isCompanyCallback ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: isCompanyCallback ? undefined : JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed with status ${response.status}`);
      }

      // Mark as processed
      sessionStorage.setItem("xero_processed_code", code);

      setStatus({
        loading: false,
        success: true,
        error: null,
      });

      // Try to notify parent window (if opened via window.open)
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'xero-callback-success' }, '*');
        } catch (e) {
          // Ignore cross-origin errors
        }
      }

      // Try to close popup after success
      setTimeout(() => {
        window.close();
        // If window.close() didn't work (blocked by browser), redirect after a delay
        setTimeout(() => {
          // Still here? Redirect to integrations page
          const returnUrl = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
          window.location.href = returnUrl;
        }, 500);
      }, 1500);
    } catch (err) {
      setStatus({
        loading: false,
        success: false,
        error: (err as Error).message || "Failed to complete Xero connection",
      });
      // Try to close after error, with fallback redirect
      setTimeout(() => {
        window.close();
        setTimeout(() => {
          const returnUrl = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
          window.location.href = returnUrl;
        }, 500);
      }, 3000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-8 shadow-lg">
          <div className="text-center">
            {status.loading ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Connecting to Xero...
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Please wait while we complete the connection.
                </p>
              </>
            ) : status.success ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                  <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Successfully Connected!
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your Xero account has been connected. Redirecting...
                </p>
                <button
                  onClick={() => {
                    window.close();
                    // Fallback if close doesn't work
                    setTimeout(() => {
                      window.location.href = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
                    }, 100);
                  }}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                  Click here if not redirected automatically
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                  <XCircleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Connection Failed
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{status.error}</p>
                <p className="mt-4 text-xs text-gray-400">
                  Redirecting...
                </p>
                <button
                  onClick={() => {
                    window.close();
                    setTimeout(() => {
                      window.location.href = sessionStorage.getItem("xero_return_url") || "/settings/integrations/xero";
                    }, 100);
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                  Click here to return to settings
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page wrapped in Suspense (required for useSearchParams in Next.js 16)
export default function XeroCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <XeroCallbackContent />
    </Suspense>
  );
}
