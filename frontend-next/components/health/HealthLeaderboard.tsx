"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Trophy,
  Bot,
  Users,
  Crown,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  isCurrentUser?: boolean;
  isSystem?: boolean;
  trend?: "up" | "down" | "same";
  fixCount?: number;
}

interface HealthLeaderboardProps {
  systemPoints: number;
  humansPoints: number;
  entries: LeaderboardEntry[];
  currentUserPoints?: number;
  loading?: boolean;
  timeframe?: string;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-4 w-4 text-yellow-500" />;
    case 2:
      return <Medal className="h-4 w-4 text-muted-foreground" />;
    case 3:
      return <Award className="h-4 w-4 text-amber-600" />;
    default:
      return <span className="text-xs text-muted-foreground w-4 text-center">{rank}</span>;
  }
}

function getTrendIcon(trend?: string) {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    case "down":
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    default:
      return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
}

export function HealthLeaderboard({
  systemPoints,
  humansPoints,
  entries,
  currentUserPoints,
  loading,
  timeframe = "This Week",
}: HealthLeaderboardProps) {
  const systemWinning = systemPoints > humansPoints;
  const totalPoints = systemPoints + humansPoints;
  const systemPercentage = totalPoints > 0 ? (systemPoints / totalPoints) * 100 : 50;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Leaderboard</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {timeframe}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* System vs Humans header */}
            <div className="mb-4 p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className={cn(
                    "h-5 w-5",
                    systemWinning ? "text-purple-600" : "text-muted-foreground"
                  )} />
                  <span className="font-medium text-sm">System</span>
                  <span className={cn(
                    "font-mono font-bold",
                    systemWinning ? "text-purple-600" : "text-muted-foreground"
                  )}>
                    {systemPoints} pts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono font-bold",
                    !systemWinning ? "text-blue-600" : "text-muted-foreground"
                  )}>
                    {humansPoints} pts
                  </span>
                  <span className="font-medium text-sm">Humans</span>
                  <Users className={cn(
                    "h-5 w-5",
                    !systemWinning ? "text-blue-600" : "text-muted-foreground"
                  )} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 rounded-full bg-blue-200 dark:bg-blue-900/50 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
                  style={{ width: `${systemPercentage}%` }}
                />
              </div>

              {/* Winner message */}
              <p className={cn(
                "text-xs text-center mt-2",
                systemWinning ? "text-purple-600" : "text-blue-600"
              )}>
                {systemWinning ? (
                  <>System is winning! Fix issues faster to beat the robots!</>
                ) : (
                  <>Humans are winning! Keep up the great work!</>
                )}
              </p>
            </div>

            {/* Individual leaderboard */}
            <div className="space-y-1">
              {entries.slice(0, 5).map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center justify-between py-2 px-2 rounded transition-colors",
                    entry.isCurrentUser && "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800",
                    entry.isSystem && "bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex justify-center">
                      {getRankIcon(index + 1)}
                    </div>
                    {entry.isSystem ? (
                      <Bot className="h-4 w-4 text-purple-500" />
                    ) : (
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                        entry.isCurrentUser
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-muted text-foreground dark:bg-gray-800 dark:text-muted-foreground"
                      )}>
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      entry.isCurrentUser && "text-blue-700 dark:text-blue-300",
                      entry.isSystem && "text-purple-700 dark:text-purple-300"
                    )}>
                      {entry.isCurrentUser ? "You" : entry.name}
                      {entry.isSystem && " (Auto-Fix)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getTrendIcon(entry.trend)}
                    <span className="font-mono font-bold text-sm">
                      {entry.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Current user not in top 5 */}
            {currentUserPoints !== undefined && !entries.slice(0, 5).some((e) => e.isCurrentUser) && (
              <div className="mt-2 pt-2 border-t border-dashed">
                <div className="flex items-center justify-between py-2 px-2 rounded bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-center">...</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Y
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      You
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {currentUserPoints} pts
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
