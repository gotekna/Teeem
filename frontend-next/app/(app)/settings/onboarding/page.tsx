"use client";

import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import OnboardingHub from "../../onboarding/components/OnboardingHub";
import { Spinner } from "@/components/ui/spinner";

export default function SettingsSetupPage() {
  const { status, isLoading, error } = useOnboardingStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Error Loading Setup Status</h2>
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
