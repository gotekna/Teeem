"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Briefcase,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface HealthCategory {
  id: string;
  name: string;
  score: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  checksCount: number;
  routeSlug?: string;
  foundationId?: number;
}

interface HealthCategoryCardProps {
  title: string;
  icon: React.ReactNode;
  categories: HealthCategory[];
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  companies: <Building2 className="h-4 w-4" />,
  contacts: <Users className="h-4 w-4" />,
  jobs: <Briefcase className="h-4 w-4" />,
  documents: <FileText className="h-4 w-4" />,
  pricebook: <DollarSign className="h-4 w-4" />,
};

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getHealthBg(score: number): string {
  if (score >= 90) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 70) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getHealthIcon(score: number) {
  if (score >= 90) return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
  if (score >= 70) return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />;
  return <XCircle className="h-3.5 w-3.5 text-red-600" />;
}

function getScoreIndicator(score: number) {
  if (score >= 90) return { symbol: "", color: "text-green-600" };
  if (score >= 70) return { symbol: "", color: "text-yellow-600" };
  return { symbol: "", color: "text-red-600" };
}

export function HealthCategoryCard({
  title,
  icon,
  categories,
  className,
}: HealthCategoryCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Calculate overall score for this category
  const overallScore = categories.length > 0
    ? Math.round(categories.reduce((sum, cat) => sum + cat.score, 0) / categories.length)
    : 100;

  const totalIssues = categories.reduce((sum, cat) => sum + cat.totalIssues, 0);
  const criticalIssues = categories.reduce((sum, cat) => sum + cat.criticalIssues, 0);

  return (
    <Card className={cn("transition-all", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            {icon}
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-bold font-mono", getHealthColor(overallScore))}>
              {overallScore}%
            </span>
            {totalIssues > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  criticalIssues > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                )}
              >
                {totalIssues}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Progress value={overallScore} className="h-2 mb-3" />

        {/* Category list */}
        <div className="space-y-1">
          {categories.slice(0, expanded ? undefined : 3).map((category) => {
            const content = (
              <div
                key={category.id}
                className={cn(
                  "flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors",
                  category.routeSlug && "hover:bg-secondary/50 cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2">
                  {iconMap[category.name.toLowerCase()] || <FileText className="h-4 w-4" />}
                  <span className="truncate">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {category.totalIssues > 0 ? (
                    <span className={cn(
                      "text-xs",
                      category.criticalIssues > 0 ? "text-red-600" : "text-yellow-600"
                    )}>
                      {category.totalIssues} issues
                    </span>
                  ) : (
                    getHealthIcon(category.score)
                  )}
                  <span className={cn("font-mono font-medium text-sm", getHealthColor(category.score))}>
                    {category.score}%
                  </span>
                </div>
              </div>
            );

            return category.routeSlug ? (
              <Link key={category.id} href={`/${category.routeSlug}`}>
                {content}
              </Link>
            ) : (
              <div key={category.id}>{content}</div>
            );
          })}
        </div>

        {/* Expand/collapse button */}
        {categories.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center w-full py-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {categories.length - 3} more
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
