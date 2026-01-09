"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Circle,
  Link2,
  Database,
  Landmark,
  FileText,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

interface XeroSetupWizardProps {
  companyId: string;
  companyName?: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "pending" | "in_progress" | "completed" | "skipped";
  action?: () => Promise<void>;
  actionLabel?: string;
  skipLabel?: string;
  canSkip?: boolean;
}

interface SetupStatus {
  connected: boolean;
  accounts_imported: boolean;
  accounts_count: number;
  bank_accounts_linked: boolean;
  bank_accounts_count: number;
  contacts_synced: boolean;
  contacts_count: number;
  setup_complete: boolean;
}

export function XeroSetupWizard({ companyId, companyName, onComplete, onDismiss }: XeroSetupWizardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [status, setStatus] = React.useState<SetupStatus | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);

  // Load setup status
  const loadSetupStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: SetupStatus }>(
        `/api/v1/companies/${companyId}/xero/setup_status`
      );
      if (response.success && response.data) {
        setStatus(response.data);
        // Auto-advance to first incomplete step
        if (response.data.connected) {
          if (!response.data.accounts_imported) {
            setCurrentStepIndex(1);
          } else if (!response.data.bank_accounts_linked) {
            setCurrentStepIndex(2);
          } else if (!response.data.contacts_synced) {
            setCurrentStepIndex(3);
          } else {
            setCurrentStepIndex(4);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load setup status:", error);
      // Fallback - try to get basic status
      try {
        const basicStatus = await api.get<{ success: boolean; connected: boolean }>(
          `/api/v1/companies/${companyId}/xero/status`
        );
        setStatus({
          connected: basicStatus.connected || false,
          accounts_imported: false,
          accounts_count: 0,
          bank_accounts_linked: false,
          bank_accounts_count: 0,
          contacts_synced: false,
          contacts_count: 0,
          setup_complete: false,
        });
      } catch {
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadSetupStatus();
  }, [loadSetupStatus]);

  const handleSync = async (type: 'accounts' | 'bank_accounts' | 'contacts' | 'all') => {
    try {
      setSyncing(true);
      const response = await api.post<{ success: boolean; message?: string }>(
        `/api/v1/companies/${companyId}/xero/sync`,
        { sync_type: type }
      );
      if (response?.success) {
        toast({
          title: "Sync completed",
          description: response.message || `Successfully synced ${type.replace('_', ' ')}`,
        });
        await loadSetupStatus();
      }
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync data from Xero",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleComplete = () => {
    onComplete?.();
  };

  // Define steps based on current status
  const steps: SetupStep[] = React.useMemo(() => {
    if (!status) return [];

    return [
      {
        id: "connect",
        title: "Connect to Xero",
        description: "Authorize TEEEM to access your Xero organization",
        icon: Link2,
        status: status.connected ? "completed" : "pending",
      },
      {
        id: "accounts",
        title: "Import Chart of Accounts",
        description: status.accounts_imported
          ? `${status.accounts_count} accounts imported`
          : "Sync your chart of accounts from Xero",
        icon: Database,
        status: status.accounts_imported ? "completed" : status.connected ? "pending" : "pending",
        action: () => handleSync('accounts'),
        actionLabel: "Import Accounts",
        canSkip: true,
        skipLabel: "Skip for now",
      },
      {
        id: "bank_accounts",
        title: "Link Bank Accounts",
        description: status.bank_accounts_linked
          ? `${status.bank_accounts_count} bank accounts linked`
          : "Connect your bank feeds from Xero",
        icon: Landmark,
        status: status.bank_accounts_linked ? "completed" : "pending",
        action: () => handleSync('bank_accounts'),
        actionLabel: "Link Bank Accounts",
        canSkip: true,
        skipLabel: "Skip for now",
      },
      {
        id: "contacts",
        title: "Sync Contacts",
        description: status.contacts_synced
          ? `${status.contacts_count} contacts synced`
          : "Import contacts from Xero",
        icon: FileText,
        status: status.contacts_synced ? "completed" : "pending",
        action: () => handleSync('contacts'),
        actionLabel: "Sync Contacts",
        canSkip: true,
        skipLabel: "Skip for now",
      },
      {
        id: "complete",
        title: "Setup Complete",
        description: "Your Xero integration is ready to use",
        icon: CheckCircle,
        status: status.setup_complete ? "completed" : "pending",
      },
    ];
  }, [status]);

  const completedSteps = steps.filter(s => s.status === "completed").length;
  const progressPercent = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;
  const currentStep = steps[currentStepIndex];
  const isComplete = completedSteps === steps.length;

  if (loading) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <Spinner size={20} className="text-blue-600" />
            <span className="text-sm text-muted-foreground">Loading setup status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dismissed || !status?.connected) {
    return null;
  }

  if (isComplete) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Xero Setup Complete!</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your Xero integration is fully configured and ready to use.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900">
      <CardContent className="py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-lg">Xero Setup Wizard</h3>
            <p className="text-sm text-muted-foreground">
              Complete these steps to fully configure your Xero integration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white dark:bg-gray-900">
              {completedSteps} of {steps.length} complete
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCurrentStep = index === currentStepIndex;
            const isPastStep = index < currentStepIndex || step.status === "completed";
            const isFutureStep = index > currentStepIndex && step.status !== "completed";

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg transition-colors",
                  isCurrentStep && "bg-white dark:bg-gray-900 shadow-sm border border-blue-200 dark:border-blue-800",
                  isPastStep && !isCurrentStep && "opacity-60",
                  isFutureStep && "opacity-40"
                )}
              >
                {/* Step Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  step.status === "completed" && "bg-green-100 dark:bg-green-900/50",
                  step.status === "pending" && isCurrentStep && "bg-blue-100 dark:bg-blue-900/50",
                  step.status === "pending" && !isCurrentStep && "bg-gray-100 dark:bg-gray-800",
                  step.status === "in_progress" && "bg-blue-100 dark:bg-blue-900/50"
                )}>
                  {step.status === "completed" ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : step.status === "in_progress" || (isCurrentStep && syncing) ? (
                    <Spinner size={20} className="text-blue-600" />
                  ) : (
                    <StepIcon className={cn(
                      "h-5 w-5",
                      isCurrentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                    )} />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "font-medium",
                    step.status === "completed" && "text-green-700 dark:text-green-300",
                    isCurrentStep && step.status !== "completed" && "text-blue-700 dark:text-blue-300"
                  )}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>

                {/* Step Actions */}
                {isCurrentStep && step.action && step.status !== "completed" && (
                  <div className="flex items-center gap-2 shrink-0">
                    {step.canSkip && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStepIndex(Math.min(currentStepIndex + 1, steps.length - 1))}
                        disabled={syncing}
                      >
                        {step.skipLabel || "Skip"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={step.action}
                      disabled={syncing}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {syncing ? (
                        <>
                          <Spinner size={16} className="mr-2" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {step.actionLabel || "Continue"}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Completed Badge */}
                {step.status === "completed" && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 shrink-0">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Done
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        {currentStepIndex === steps.length - 1 && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Setup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroSetupWizard;
