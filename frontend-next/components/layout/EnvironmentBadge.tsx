"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Environment Badge - Fixed position bottom left corner
 * Shows when company is using non-production backend (beta/staging)
 * SSoT: Environment is stored in localStorage after login, retrieved via AuthContext
 */
export function EnvironmentBadge() {
  const { getEnvironment } = useAuth();
  const [environment, setEnvironment] = React.useState<string | null>(null);

  // Check environment after mount to avoid hydration mismatch
  React.useEffect(() => {
    setEnvironment(getEnvironment());
  }, [getEnvironment]);

  // Environment is now shown inline in sidebar next to company name
  // This fixed badge is no longer needed
  return null;

  // Don't render on production or if not yet loaded
  if (!environment || environment === "production") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-3 left-3 z-[9998] px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-lg cursor-default select-none",
        environment === "staging"
          ? "bg-orange-500 text-white"
          : "bg-yellow-500 text-black"
      )}
      title={`Environment: ${environment}. Change in Settings > Company > Info. Takes effect on next login.`}
    >
      {environment}
    </div>
  );
}
