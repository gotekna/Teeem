import * as React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercentChange } from "@/utils/formatters";

export interface StatCardProps {
  /** Label shown above the value */
  title: string;
  /** Main value (pre-formatted) */
  value: string;
  /** Percent change (e.g., 12.5 for +12.5%) */
  change?: number;
  /** Label after the change (e.g., "vs last month") */
  changeLabel?: string;
  /** Icon component (lucide-react or heroicons) */
  icon: React.ElementType;
  /** Background class for the icon container (e.g., "bg-blue-100 dark:bg-blue-900/30") */
  iconBg: string;
  /** Color class for the icon (e.g., "text-blue-600 dark:text-blue-400") */
  iconColor: string;
  /** Direction of the trend arrow */
  trend?: "up" | "down" | "neutral";
  /** Secondary value shown below main */
  subValue?: string;
  /** Label for the secondary value */
  subLabel?: string;
  /** Makes the card clickable */
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  subValue,
  subLabel,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">
              {value}
            </p>
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm",
                  trend === "up"
                    ? "text-green-600 dark:text-green-400"
                    : trend === "down"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {trend === "up" ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : trend === "down" ? (
                  <ArrowDownRight className="h-4 w-4" />
                ) : null}
                {formatPercentChange(change)} {changeLabel}
              </div>
            )}
            {subValue && (
              <p className="text-xs text-muted-foreground">
                {subLabel}: <span className="font-mono">{subValue}</span>
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", iconBg)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
