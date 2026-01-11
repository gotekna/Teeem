"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Zap, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  count: number;
  points: number;
  fixType: string; // 'name_casing', 'website_prefix', 'phone_format', 'review', 'connect', etc.
  checkType: string;
  checkName?: string;
  autoFixable: boolean;
  itemIds?: number[];
}

interface QuickWinsCardProps {
  quickWins: QuickWin[];
  onFix: (quickWin: QuickWin) => Promise<void>;
  loading?: boolean;
}

export function QuickWinsCard({ quickWins, onFix, loading }: QuickWinsCardProps) {
  const [fixingId, setFixingId] = React.useState<string | null>(null);
  const [justFixed, setJustFixed] = React.useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = React.useState<number | null>(null);

  const handleFix = async (quickWin: QuickWin) => {
    setFixingId(quickWin.id);
    try {
      await onFix(quickWin);
      setJustFixed(quickWin.id);
      setEarnedPoints(quickWin.points);

      // Clear animation after 2 seconds
      setTimeout(() => {
        setJustFixed(null);
        setEarnedPoints(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to fix:", error);
    } finally {
      setFixingId(null);
    }
  };

  const getButtonLabel = (quickWin: QuickWin) => {
    if (quickWin.autoFixable) {
      return `Fix All`;
    }
    switch (quickWin.fixType) {
      case "review":
        return `Review`;
      case "connect":
        return `Connect`;
      default:
        return `Fix`;
    }
  };

  if (loading) {
    return (
      <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <Zap className="h-5 w-5" />
            Quick Wins - Earn Kudos!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-orange-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quickWins.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            All Clear!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600 dark:text-green-400">
            No quick wins available - your data is looking great!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 relative overflow-hidden">
      {/* Points earned animation */}
      {earnedPoints && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-500/90 z-10 animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2 text-white">
            <Sparkles className="h-12 w-12 animate-pulse" />
            <span className="text-3xl font-bold">+{earnedPoints} pts!</span>
          </div>
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <Zap className="h-5 w-5" />
          Quick Wins - Earn Kudos!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickWins.slice(0, 5).map((quickWin) => (
          <div
            key={quickWin.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg bg-white/60 dark:bg-background/40 border border-orange-100 dark:border-orange-900/50 transition-all",
              justFixed === quickWin.id && "opacity-50 scale-95"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Zap className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {quickWin.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {quickWin.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 font-mono"
              >
                +{quickWin.points} pts
              </Badge>
              <Button
                size="sm"
                variant={quickWin.autoFixable ? "default" : "outline"}
                className={cn(
                  quickWin.autoFixable && "bg-orange-500 hover:bg-orange-600 text-white"
                )}
                onClick={() => handleFix(quickWin)}
                disabled={fixingId === quickWin.id}
              >
                {fixingId === quickWin.id ? (
                  <Spinner size={12} />
                ) : justFixed === quickWin.id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  getButtonLabel(quickWin)
                )}
              </Button>
            </div>
          </div>
        ))}

        {quickWins.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            +{quickWins.length - 5} more quick wins available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
