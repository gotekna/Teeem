"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import OnboardingHub from "./components/OnboardingHub";
import { Spinner } from "@/components/ui/spinner";

export default function OnboardingPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();
  const { status, isLoading, error, isComplete } = useOnboardingStatus();

  // Redirect to dashboard if onboarding is complete
  useEffect(() => {
    if (isComplete) {
      router.push("/dashboard");
    }
  }, [isComplete, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Error Loading Onboarding</h2>
          <p className="text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return <OnboardingHub status={status} />;
}
