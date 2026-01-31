"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Settings,
  Database,
  Plug,
  AlertCircle,
  Clock,
  User,
  Download,
  Upload,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  OnboardingStatus,
  OnboardingStep,
  useOnboardingStatus,
  skipStep,
  completeOnboarding,
} from "@/lib/hooks/useOnboardingStatus";
import { toast } from "sonner";
import StepCard from "./StepCard";

interface OnboardingHubProps {
  status: OnboardingStatus;
}

const categoryConfig = {
  required: {
    title: "Required Setup",
    description: "Complete these steps to start using TEEEM",
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
  },
  configuration: {
    title: "Configuration",
    description: "Customize TEEEM for your business",
    icon: Settings,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  data_import: {
    title: "Data Import",
    description: "Bring in your existing data",
    icon: Database,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  integrations: {
    title: "Integrations",
    description: "Connect your external systems",
    icon: Plug,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
};

export default function OnboardingHub({ status }: OnboardingHubProps) {
  const router = useRouter();
  const { refresh, requiredComplete } = useOnboardingStatus();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    required: true,
    configuration: false,
    data_import: false,
    integrations: false,
  });
  const [isCompleting, setIsCompleting] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSkipStep = async (stepKey: string) => {
    try {
      await skipStep(stepKey);
      toast.success("Step skipped");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to skip step");
    }
  };

  const handleComplete = async () => {
    if (!requiredComplete) {
      toast.error("Please complete all required steps first");
      return;
    }

    setIsCompleting(true);
    try {
      await completeOnboarding();
      toast.success("Welcome to TEEEM! 🎉");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete onboarding");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleStepClick = (step: OnboardingStep) => {
    if (step.import_type) {
      router.push(`/onboarding/import/${step.import_type}`);
    } else if (step.settings_path) {
      router.push(step.settings_path);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Welcome to TEEEM</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Let&apos;s get your account set up. This should take about 30 minutes.
        </p>
      </div>

      {/* Progress Card */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold">{status.progress.percentage}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Required Steps</p>
              <p className="text-lg font-semibold">
                {status.progress.required_complete}/{status.progress.required_total} done
              </p>
            </div>
          </div>
          <Progress value={status.progress.percentage} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>
              {status.progress.completed_steps} of {status.progress.total_steps} steps complete
            </span>
            {requiredComplete && (
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✓ Ready to start using TEEEM
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Sections */}
      <div className="space-y-4">
        {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((categoryKey) => {
          const config = categoryConfig[categoryKey];
          const category = status.categories[categoryKey];
          const Icon = config.icon;
          const isExpanded = expandedCategories[categoryKey];
          const isComplete = category.complete === category.total;

          return (
            <Card key={categoryKey} className={isComplete ? "opacity-75" : ""}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryKey)}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.bgColor}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {config.title}
                            {isComplete && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={isComplete ? "secondary" : "outline"}>
                          {category.complete}/{category.total}
                        </Badge>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {category.steps.map((step) => (
                        <StepCard
                          key={step.key}
                          step={step}
                          onClick={() => handleStepClick(step)}
                          onSkip={() => handleSkipStep(step.key)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Complete Button */}
      {requiredComplete && (
        <div className="mt-8 text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Ready to Go!</h3>
              <p className="text-muted-foreground mb-4">
                You&apos;ve completed all required steps. You can continue configuring or start using TEEEM now.
              </p>
              <Button
                size="lg"
                onClick={handleComplete}
                disabled={isCompleting}
                className="gap-2"
              >
                {isCompleting ? "Completing..." : "Start Using TEEEM"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skip to App Link */}
      {!requiredComplete && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Want to explore first?{" "}
            <button
              onClick={() => router.push("/dashboard")}
              className="text-primary hover:underline"
            >
              Skip to dashboard
            </button>
            {" "}(some features may be limited)
          </p>
        </div>
      )}
    </div>
  );
}
