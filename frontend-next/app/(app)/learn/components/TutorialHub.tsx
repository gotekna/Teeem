"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TutorialChapter } from "@/lib/tutorials/tutorial-types";

interface TutorialHubProps {
  chapters: TutorialChapter[];
  completedChapters: string[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string) => void;
}

export function TutorialHub({
  chapters,
  completedChapters,
  selectedChapterId,
  onSelectChapter,
}: TutorialHubProps) {
  const completedCount = chapters.filter((c) => completedChapters.includes(c.id)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Progress summary */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Progress</span>
          <span className="text-xs font-medium text-muted-foreground">
            {completedCount}/{chapters.length}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${chapters.length > 0 ? (completedCount / chapters.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {chapters.map((chapter) => {
          const isCompleted = completedChapters.includes(chapter.id);
          const isSelected = selectedChapterId === chapter.id;
          const Icon = chapter.icon;

          return (
            <button
              key={chapter.id}
              onClick={() => onSelectChapter(chapter.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                isSelected
                  ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        isCompleted ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {chapter.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {chapter.estimatedMinutes} min
                    </span>
                    {chapter.roles !== "all" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {Array.isArray(chapter.roles) ? chapter.roles[0] : "all"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
