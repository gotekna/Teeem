"use client";

import * as React from "react";

/**
 * PoTaskPicker - Shared PO Task assignment picker.
 *
 * Used by both ScheduleMasterTab (Cost Centre + Tender assignments) and
 * TenderSectionsTab (Tender section assignments in Settings > Operations).
 *
 * Shows a searchable, checkable list of SM Schedule Master PO tasks.
 * Selected task IDs are synced to a ref so the parent can read them on save.
 */

export interface POTaskItem {
  id: number;
  name: string;
  taskCode: string | null;
  taskNumber: number;
  costCentreId?: number | null;
  costCentreName?: string | null;
  tenderId?: number | null;
  tenderName?: string | null;
  templateIds: number[];
}

export interface SmTemplate {
  id: number;
  name: string;
}

interface PoTaskPickerProps {
  allTasks: POTaskItem[];
  initialSelectedIds: number[];
  recordId?: string | number;
  templates?: SmTemplate[];
  selectedIdsRef: React.MutableRefObject<number[]>;
  assignmentField?: "costCentre" | "tender";
  entityLabel?: string;
  /** Called when user clicks a linked record name (e.g., cost centre name in brackets) */
  onNavigateToRecord?: (id: number) => void;
}

export function PoTaskPicker({
  allTasks,
  initialSelectedIds,
  recordId,
  templates = [],
  selectedIdsRef,
  assignmentField = "tender",
  entityLabel = "Tender Section",
  onNavigateToRecord,
}: PoTaskPickerProps) {
  const [selectedIds, setSelectedIds] = React.useState<number[]>(initialSelectedIds);
  const [templateFilter, setTemplateFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [hideSelected, setHideSelected] = React.useState(false);

  // Sync ref whenever local selection changes so parent can read it on save
  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds, selectedIdsRef]);

  const filteredTasks = React.useMemo(() => {
    let tasks = allTasks;
    if (templateFilter !== "all") {
      const tid = Number(templateFilter);
      tasks = tasks.filter((t) => t.templateIds.includes(tid));
    }
    if (search) {
      const lower = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          (t.taskCode && t.taskCode.toLowerCase().includes(lower))
      );
    }
    if (hideSelected) {
      const recId = recordId != null ? Number(recordId) : null;
      tasks = tasks.filter((t) => {
        const aId = assignmentField === "tender" ? t.tenderId : t.costCentreId;
        // Keep: unassigned, assigned to THIS record, or currently selected
        return aId == null || aId === recId || selectedIds.includes(t.id);
      });
    }
    return tasks;
  }, [allTasks, templateFilter, search, hideSelected, selectedIds, recordId, assignmentField]);

  const toggleTask = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Selected task objects for badge display - filtered by current template
  const selectedTasks = React.useMemo(() => {
    let tasks = allTasks.filter((t) => selectedIds.includes(t.id));
    if (templateFilter !== "all") {
      const tid = Number(templateFilter);
      tasks = tasks.filter((t) => t.templateIds.includes(tid));
    }
    return tasks;
  }, [allTasks, selectedIds, templateFilter]);

  return (
    <div className="py-4 border-t">
      <label className="text-sm font-medium">PO Tasks</label>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        Assign SM PO Tasks to this {entityLabel}. Tasks showing a name in brackets will be reassigned.
      </p>
      {/* Badges showing currently assigned tasks */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleTask(task.id);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer"
            >
              {task.taskCode ? `${task.taskCode} - ${task.name}` : task.name}
              <span className="ml-0.5 text-blue-500 dark:text-blue-300 font-bold">
                &times;
              </span>
            </button>
          ))}
        </div>
      )}
      {/* Template filter pills - only show if templates provided */}
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            type="button"
            onClick={() => setTemplateFilter("all")}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              templateFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-accent"
            }`}
          >
            All Templates
          </button>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateFilter(String(t.id))}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                templateFilter === String(t.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-accent"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      <div className="border rounded-md">
        <div className="p-2 border-b flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO tasks..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideSelected}
              onChange={(e) => setHideSelected(e.target.checked)}
              className="rounded border-input"
            />
            Hide assigned
          </label>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredTasks.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-2">
              No PO tasks found
            </p>
          )}
          {filteredTasks.map((task) => {
            const isSelected = selectedIds.includes(task.id);
            const assignedId =
              assignmentField === "tender" ? task.tenderId : task.costCentreId;
            const assignedName =
              assignmentField === "tender" ? task.tenderName : task.costCentreName;
            const isAssignedElsewhere =
              assignedId != null &&
              (recordId != null ? assignedId !== Number(recordId) : true);
            const taskDisplay = task.taskCode
              ? `${task.taskCode} - ${task.name}`
              : task.name;
            return (
              <label
                key={task.id}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTask(task.id)}
                  className="rounded border-input"
                />
                <span className="truncate">
                  {taskDisplay}
                  {isAssignedElsewhere && (
                    onNavigateToRecord && assignedId ? (
                      <button
                        type="button"
                        className="ml-1.5 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onNavigateToRecord(assignedId);
                        }}
                      >
                        ({assignedName || `${entityLabel} #${assignedId}`})
                      </button>
                    ) : (
                      <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">
                        ({assignedName || `${entityLabel} #${assignedId}`})
                      </span>
                    )
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.length} task{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
