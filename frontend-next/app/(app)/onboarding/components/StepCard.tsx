"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  SkipForward,
  Download,
  Upload,
  User,
  ExternalLink,
} from "lucide-react";
import { OnboardingStep, downloadTemplate } from "@/lib/hooks/useOnboardingStatus";
import { toast } from "sonner";

interface StepCardProps {
  step: OnboardingStep;
  onClick: () => void;
  onSkip: () => void;
}

const statusConfig = {
  not_started: {
    icon: Circle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  in_progress: {
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  complete: {
    icon: CheckCircle2,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  skipped: {
    icon: SkipForward,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

export default function StepCard({ step, onClick, onSkip }: StepCardProps) {
  const config = statusConfig[step.status];
  const StatusIcon = config.icon;
  const isComplete = step.status === "complete";
  const isSkipped = step.status === "skipped";

  const handleDownloadTemplate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!step.import_type) return;

    try {
      const blob = await downloadTemplate(step.import_type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${step.import_type}_import_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip();
  };

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-lg border cursor-pointer
        transition-all hover:border-primary/50 hover:shadow-sm
        ${isComplete || isSkipped ? "opacity-60" : ""}
        ${config.bgColor}
      `}
      onClick={onClick}
    >
      {/* Status Icon */}
      <div className={`flex-shrink-0 ${config.color}`}>
        <StatusIcon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium truncate">{step.name}</h4>
          {step.required && (
            <Badge variant="destructive" className="text-xs">
              Required
            </Badge>
          )}
          {isSkipped && (
            <Badge variant="secondary" className="text-xs">
              Skipped
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {step.description}
        </p>
        {step.estimated_minutes && !isComplete && !isSkipped && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{step.estimated_minutes} minutes
          </p>
        )}
      </div>

      {/* Assigned User */}
      {step.assigned_user_name && (
        <div className="flex-shrink-0 flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {step.assigned_user_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {step.assigned_user_name}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {/* Download Template Button */}
        {step.template_available && step.import_type && !isComplete && !isSkipped && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Template</span>
          </Button>
        )}

        {/* Skip Button */}
        {!step.required && !isComplete && !isSkipped && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
          </Button>
        )}

        {/* Action Button */}
        {!isComplete && !isSkipped && (
          <Button variant="outline" size="sm" className="gap-1">
            {step.import_type ? (
              <>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Configure</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}

        {/* View/Edit for completed steps */}
        {isComplete && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
        )}
      </div>
    </div>
  );
}
