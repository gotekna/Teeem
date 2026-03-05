"use client";

import { Badge } from "@/components/ui/badge";
import { CONDITIONS } from "@/lib/inspection-atoms";

interface ConditionBadgeProps {
  condition: string | null;
  size?: "sm" | "md";
  className?: string;
}

const CONDITION_STYLES: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700",
  good: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
  fair: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700",
  poor: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700",
  damaged: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  // Legacy
  excellent: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700",
};

export function ConditionBadge({ condition, size = "sm", className = "" }: ConditionBadgeProps) {
  if (!condition) {
    return (
      <Badge variant="outline" className={`text-xs text-muted-foreground ${className}`}>
        Not checked
      </Badge>
    );
  }

  const style = CONDITION_STYLES[condition] || "";
  const label = CONDITIONS.find(c => c.value === condition)?.label || condition;

  return (
    <Badge
      className={`border ${style} ${size === "sm" ? "text-xs" : "text-sm"} ${className}`}
    >
      {label}
    </Badge>
  );
}

/** Inline condition comparison indicator for exit inspections */
export function ConditionComparisonIndicator({
  entryCondition,
  currentCondition,
}: {
  entryCondition: string | null;
  currentCondition: string | null;
}) {
  if (!entryCondition || !currentCondition) return null;

  const entryIndex = CONDITIONS.findIndex(c => c.value === entryCondition);
  const currentIndex = CONDITIONS.findIndex(c => c.value === currentCondition);

  if (entryIndex === -1 || currentIndex === -1) return null;

  if (currentIndex < entryIndex) {
    return <span className="text-xs text-green-600 dark:text-green-400 font-medium">Improved</span>;
  } else if (currentIndex > entryIndex) {
    return <span className="text-xs text-red-600 dark:text-red-400 font-medium">Degraded</span>;
  }
  return <span className="text-xs text-muted-foreground">Unchanged</span>;
}
