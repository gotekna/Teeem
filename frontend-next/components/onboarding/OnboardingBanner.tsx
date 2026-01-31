"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, AlertCircle } from "lucide-react";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";

const BANNER_DISMISSED_KEY = "onboarding_banner_dismissed";

export default function OnboardingBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, isLoading, isComplete, requiredComplete } = useOnboardingStatus();
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed to avoid flash

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY) === "true";
    setIsDismissed(dismissed);
  }, []);

  // Don't show on onboarding page itself
  if (pathname?.startsWith("/onboarding")) {
    return null;
  }

  // Don't show if loading or complete
  if (isLoading || isComplete) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "true");
  };

  const handleContinue = () => {
    router.push("/onboarding");
  };

  if (!status) {
    return null;
  }

  const remainingRequired = status.progress.required_total - status.progress.required_complete;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-900">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-800 dark:text-yellow-200">
            {requiredComplete ? (
              <span>
                Onboarding {status.progress.percentage}% complete.
                <span className="hidden sm:inline"> Finish setup to unlock all features.</span>
              </span>
            ) : (
              <span>
                Setup incomplete — {remainingRequired} required step{remainingRequired > 1 ? "s" : ""} remaining.
                <span className="hidden sm:inline"> Some features may be limited.</span>
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleContinue}
            className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:text-yellow-100 dark:hover:bg-yellow-900/50"
          >
            Continue Setup
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-6 w-6 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:text-yellow-200 dark:hover:bg-yellow-900/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
