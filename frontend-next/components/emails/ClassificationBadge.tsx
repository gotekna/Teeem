"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Megaphone, Mail, ShoppingCart, AlertTriangle, Briefcase } from "lucide-react";

export type EmailClassificationType =
  | "marketing"
  | "spam"
  | "business"
  | "transactional"
  | "personal"
  | "newsletter"
  | "notification"
  | null;

export interface ClassificationBadgeProps {
  /** Email classification type */
  classificationType: EmailClassificationType | undefined;
  /** Confidence score (0-100) */
  confidence?: number;
  /** Show confidence in tooltip */
  showConfidence?: boolean;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

const CLASSIFICATION_CONFIG: Record<
  NonNullable<EmailClassificationType>,
  {
    label: string;
    shortLabel: string;
    icon: typeof Megaphone;
    className: string;
  }
> = {
  marketing: {
    label: "Marketing",
    shortLabel: "Mkt",
    icon: Megaphone,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  spam: {
    label: "Spam",
    shortLabel: "Spam",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  business: {
    label: "Business",
    shortLabel: "Biz",
    icon: Briefcase,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  transactional: {
    label: "Transactional",
    shortLabel: "Txn",
    icon: ShoppingCart,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  personal: {
    label: "Personal",
    shortLabel: "Pers",
    icon: Mail,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  newsletter: {
    label: "Newsletter",
    shortLabel: "News",
    icon: Mail,
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  notification: {
    label: "Notification",
    shortLabel: "Notif",
    icon: Mail,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  },
};

/**
 * Badge component to display email classification type
 *
 * Shows the classification (marketing, spam, business, etc.) with appropriate
 * color coding. Optionally shows confidence score in tooltip.
 */
export function ClassificationBadge({
  classificationType,
  confidence,
  showConfidence = true,
  compact = false,
  className,
}: ClassificationBadgeProps) {
  // Don't render if no classification
  if (!classificationType) return null;

  const config = CLASSIFICATION_CONFIG[classificationType];
  if (!config) return null;

  const Icon = config.icon;

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] h-4 px-1.5 gap-0.5 font-medium border-0",
        config.className,
        compact && "px-1",
        className
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {!compact && <span>{config.shortLabel}</span>}
    </Badge>
  );

  // Wrap with tooltip if showing confidence
  if (showConfidence && confidence !== undefined) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">{config.label}</p>
            <p className="text-muted-foreground">
              {confidence}% confidence
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

export default ClassificationBadge;
