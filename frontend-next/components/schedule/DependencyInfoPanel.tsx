"use client";

/**
 * DependencyInfoPanel - Shared info sidebar for dependency editors
 *
 * SSoT: THE ONE info panel used by both:
 * - GanttDependencyEditor (Gantt view)
 * - EditRowDialog Dependencies tab (Data View)
 *
 * Shows:
 * - Visual drag guide (Gantt-only, optional)
 * - Predecessors/Successors explanations
 * - Dependency type reference
 * - Lag explanation
 */

import * as React from "react";

interface DependencyInfoPanelProps {
  /** Show the "Drag to connect on Gantt" visual guide (only in Gantt context) */
  showDragGuide?: boolean;
}

export function DependencyInfoPanel({ showDragGuide = false }: DependencyInfoPanelProps) {
  return (
    <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
      {/* Visual Guide - only shown in Gantt context */}
      {showDragGuide && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Drag to connect on Gantt</p>
          <div className="flex flex-col items-center gap-2 py-2">
            {/* Predecessor line: black/yellow */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center">
                <div className="bg-indigo-500 text-white text-[10px] px-2 py-1 rounded font-medium">A</div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full -ml-0.5 ring-1 ring-white" />
              </div>
              <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fbbf24 3px, #fbbf24 6px)' }} />
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-amber-400" />
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
              </div>
              <span className="text-[9px] text-muted-foreground ml-1">predecessor</span>
            </div>
            {/* Successor line: black/blue */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center">
                <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -ml-0.5 ring-1 ring-white" />
              </div>
              <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #60a5fa 3px, #60a5fa 6px)' }} />
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-blue-400" />
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-muted0 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                <div className="bg-muted0 text-white text-[10px] px-2 py-1 rounded font-medium">C</div>
              </div>
              <span className="text-[9px] text-muted-foreground ml-1">successor</span>
            </div>
          </div>
          <p className="text-[10px] text-blue-700 dark:text-blue-300 text-center">
            Drag from right dot → left dot
          </p>
        </div>
      )}

      {/* Predecessors Info */}
      <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-1">Predecessors</h4>
        <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
          Tasks that must <strong>finish before</strong> this task can start. Controls when this task begins.
        </p>
      </div>

      {/* Successors Info */}
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-1">Successors</h4>
        <p className="text-[10px] text-purple-700 dark:text-purple-300">
          Tasks that <strong>wait for</strong> this task. When this task moves, successors may cascade.
        </p>
      </div>

      {/* Dependency Types */}
      <div className="bg-muted/50 rounded-lg p-3">
        <h4 className="text-xs font-semibold mb-2">Dependency Types</h4>
        <div className="space-y-1.5 text-[10px]">
          <div><strong>FS</strong> - Finish-to-Start (most common)</div>
          <div><strong>SS</strong> - Start-to-Start</div>
          <div><strong>FF</strong> - Finish-to-Finish</div>
          <div><strong>SF</strong> - Start-to-Finish (rare)</div>
        </div>
      </div>

      {/* Lag Info */}
      <div className="bg-muted/50 rounded-lg p-3">
        <h4 className="text-xs font-semibold mb-1">Lag (Days)</h4>
        <p className="text-[10px] text-muted-foreground">
          <strong>+3</strong> = wait 3 days after<br/>
          <strong>-2</strong> = overlap by 2 days
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Shared dependency type label helper
// =============================================================================

const DEP_TYPE_LABELS: Record<string, string> = {
  FS: "Finish-to-Start (FS)",
  SS: "Start-to-Start (SS)",
  FF: "Finish-to-Finish (FF)",
  SF: "Start-to-Finish (SF)",
};

export function getDependencyTypeLabel(type: string): string {
  return DEP_TYPE_LABELS[type] || type;
}

/** Grid column definition shared between Gantt editor and read-only view */
export const DEPENDENCY_GRID_COLS = "grid-cols-[72px_60px_1fr_180px_60px]";
export const DEPENDENCY_GRID_COLS_EDITABLE = "grid-cols-[72px_60px_1fr_180px_60px_32px]";
