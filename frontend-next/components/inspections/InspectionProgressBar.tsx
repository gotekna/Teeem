"use client";

import { useAtomValue } from "jotai";
import { completionPercentageAtom, autoSavingAtom, inspectionDirtyAtom } from "@/lib/inspection-atoms";
import { Loader2, Check, AlertCircle } from "lucide-react";

export function InspectionProgressBar() {
  const percentage = useAtomValue(completionPercentageAtom);
  const autoSaving = useAtomValue(autoSavingAtom);
  const dirty = useAtomValue(inspectionDirtyAtom);

  const getBarColor = () => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 75) return "bg-emerald-500";
    if (percentage >= 50) return "bg-yellow-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-gray-400";
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t bg-background">
      <div className="flex items-center gap-2 min-w-[120px]">
        {autoSaving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Saving...</span>
          </>
        ) : dirty ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">Saved</span>
          </>
        )}
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums w-10 text-right">{percentage}%</span>
      </div>
    </div>
  );
}
