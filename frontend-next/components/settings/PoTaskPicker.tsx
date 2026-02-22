"use client";

import * as React from "react";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

/**
 * PoTaskPicker - Shared PO Task assignment picker.
 *
 * Used by both ScheduleMasterTab (Cost Centre + Tender assignments) and
 * TenderSectionsTab (Tender section assignments in Settings > Operations).
 *
 * Shows a searchable, checkable list of SM Schedule Master PO tasks
 * grouped by cost centre with collapsible sections.
 * Selected task IDs are synced to a ref so the parent can read them on save.
 *
 * Entire section is collapsible (collapsed by default).
 * All cost centre groups are collapsed by default.
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
  tenderHeaderId?: number | null;
  tenderHeaderName?: string | null;
  templateIds: number[];
}

export interface SmTemplate {
  id: number;
  name: string;
  is_default?: boolean;
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
  onNavigateToRecord?: (id: number, templateFilter: string) => void;
  /** Initial template filter to restore (e.g., after navigation) */
  initialTemplateFilter?: string;
  /** Called to create a new PO task. Returns the new task item if successful. */
  onCreateTask?: (name: string, templateId: number) => Promise<POTaskItem | null>;
  /** Called when user clicks a tender link to navigate to that tender's edit dialog */
  onNavigateToTender?: (id: number) => void;
}

interface TaskGroup {
  key: string; // costCentreId or "unassigned"
  label: string;
  tasks: POTaskItem[];
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
  initialTemplateFilter,
  onCreateTask,
  onNavigateToTender,
}: PoTaskPickerProps) {
  const [selectedIds, setSelectedIds] = React.useState<number[]>(initialSelectedIds);
  // Template filter priority: initialTemplateFilter (nav) > localStorage > is_default template > "all"
  const [templateFilter, setTemplateFilterRaw] = React.useState(() => {
    if (initialTemplateFilter) return initialTemplateFilter;
    const saved = getStorageItem<string>(STORAGE_KEYS.SM_DEFAULT_PO_TEMPLATE, "");
    // Validate saved template exists in available templates (might be stale)
    if (saved && saved !== "all" && templates.length > 0) {
      if (templates.some((t) => String(t.id) === saved)) return saved;
    } else if (saved === "all") {
      return "all";
    }
    // Fall back to is_default template from database
    const defaultTemplate = templates.find((t) => t.is_default);
    if (defaultTemplate) return String(defaultTemplate.id);
    return "all";
  });
  // Persist template filter changes to localStorage
  const setTemplateFilter = React.useCallback((value: string) => {
    setTemplateFilterRaw(value);
    setStorageItem(STORAGE_KEYS.SM_DEFAULT_PO_TEMPLATE, value);
  }, []);
  const [search, setSearch] = React.useState("");
  const [hideSelected, setHideSelected] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newTaskName, setNewTaskName] = React.useState("");
  const [newTaskTemplateId, setNewTaskTemplateId] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  const [locallyCreatedTasks, setLocallyCreatedTasks] = React.useState<POTaskItem[]>([]);
  // Track which groups are EXPANDED (empty = all collapsed by default)
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  // Track which badge groups are EXPANDED (empty = all collapsed by default)
  const [expandedBadgeGroups, setExpandedBadgeGroups] = React.useState<Set<string>>(new Set());

  // Sync ref whenever local selection changes so parent can read it on save
  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds, selectedIdsRef]);

  // Combine passed-in tasks with any created during this session
  const combinedTasks = React.useMemo(
    () => [...allTasks, ...locallyCreatedTasks],
    [allTasks, locallyCreatedTasks]
  );

  const filteredTasks = React.useMemo(() => {
    let tasks = combinedTasks;
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
        return aId == null || aId === recId || selectedIds.includes(t.id);
      });
    }
    return tasks;
  }, [combinedTasks, templateFilter, search, hideSelected, selectedIds, recordId, assignmentField]);

  // Group tasks by cost centre
  const groupedTasks = React.useMemo(() => {
    const groups = new Map<string, TaskGroup>();
    for (const task of filteredTasks) {
      const ccId = task.costCentreId;
      const key = ccId != null ? String(ccId) : "unassigned";
      const label = ccId != null ? (task.costCentreName || `Cost Centre #${ccId}`) : "Unassigned";
      if (!groups.has(key)) {
        groups.set(key, { key, label, tasks: [] });
      }
      groups.get(key)!.tasks.push(task);
    }
    // Sort: unassigned last, then alphabetical by label
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (a.key === "unassigned") return 1;
      if (b.key === "unassigned") return -1;
      return a.label.localeCompare(b.label);
    });
    return sorted;
  }, [filteredTasks]);

  const toggleTask = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Select/deselect all tasks in a group
  const toggleGroupSelection = (group: TaskGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const groupIds = group.tasks.map((t) => t.id);
    const allSelected = groupIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !groupIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...groupIds])]);
    }
  };

  // Selected task objects for badge display - filtered by current template, grouped by cost centre
  const selectedTasks = React.useMemo(() => {
    let tasks = combinedTasks.filter((t) => selectedIds.includes(t.id));
    if (templateFilter !== "all") {
      const tid = Number(templateFilter);
      tasks = tasks.filter((t) => t.templateIds.includes(tid));
    }
    return tasks;
  }, [combinedTasks, selectedIds, templateFilter]);

  // Group selected tasks by cost centre for badge display
  const selectedTaskGroups = React.useMemo(() => {
    const groups = new Map<string, { label: string; tasks: POTaskItem[] }>();
    for (const task of selectedTasks) {
      const ccId = task.costCentreId;
      const key = ccId != null ? String(ccId) : "unassigned";
      const label = ccId != null ? (task.costCentreName || `Cost Centre #${ccId}`) : "Unassigned";
      if (!groups.has(key)) {
        groups.set(key, { label, tasks: [] });
      }
      groups.get(key)!.tasks.push(task);
    }
    return Array.from(groups.entries()).sort(([keyA], [keyB]) => {
      if (keyA === "unassigned") return 1;
      if (keyB === "unassigned") return -1;
      return (groups.get(keyA)!.label).localeCompare(groups.get(keyB)!.label);
    });
  }, [selectedTasks]);

  const handleCreateTask = React.useCallback(async () => {
    if (!onCreateTask || !newTaskName.trim() || creating) return;
    let tplId: number;
    if (templateFilter !== "all") {
      tplId = Number(templateFilter);
    } else if (templates.length === 1) {
      tplId = templates[0].id;
    } else if (newTaskTemplateId) {
      tplId = Number(newTaskTemplateId);
    } else {
      return;
    }
    setCreating(true);
    try {
      const newTask = await onCreateTask(newTaskName.trim(), tplId);
      if (newTask) {
        setLocallyCreatedTasks((prev) => [...prev, newTask]);
        setSelectedIds((prev) => [...prev, newTask.id]);
        setNewTaskName("");
        setNewTaskTemplateId("");
        setShowCreateForm(false);
      }
    } finally {
      setCreating(false);
    }
  }, [onCreateTask, newTaskName, creating, templateFilter, templates, newTaskTemplateId]);

  const renderTaskRow = (task: POTaskItem) => {
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
    // Tender info for cross-reference display (shown when in costCentre context)
    const showTenderInfo = assignmentField === "costCentre" && task.tenderId != null;
    const tenderLabel = task.tenderHeaderName
      ? `${task.tenderHeaderName} › ${task.tenderName}`
      : task.tenderName;

    return (
      <label
        key={task.id}
        className={`flex items-start gap-2 px-2 py-1 text-sm rounded cursor-pointer hover:bg-accent ${
          isSelected ? "bg-accent/50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleTask(task.id)}
          className="rounded border-input mt-0.5"
        />
        <span className="min-w-0">
          <span className="truncate block">
            {taskDisplay}
            {isAssignedElsewhere && (
              onNavigateToRecord && assignedId ? (
                <button
                  type="button"
                  className="ml-1.5 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigateToRecord(assignedId, templateFilter);
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
          {showTenderInfo && (
            onNavigateToTender && task.tenderId ? (
              <button
                type="button"
                className="block text-xs text-purple-600 dark:text-purple-400 underline hover:text-purple-800 dark:hover:text-purple-300 truncate"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigateToTender(task.tenderId!);
                }}
              >
                Tender: {tenderLabel}
              </button>
            ) : (
              <span className="block text-xs text-muted-foreground truncate">
                Tender: {tenderLabel}
              </span>
            )
          )}
        </span>
      </label>
    );
  };

  return (
    <div className="py-4 border-t">
      <label className="text-sm font-medium">PO Tasks</label>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        Assign SM PO Tasks to this {entityLabel}. Tasks showing a name in brackets will be reassigned.
      </p>
          {/* Badges showing currently assigned tasks - grouped by cost centre, scrollable when many */}
          {selectedTasks.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto mb-2 border rounded-md p-1.5 bg-muted/20">
              {selectedTaskGroups.length <= 1 ? (
                // Single group or all unassigned - render flat
                <div className="flex flex-wrap gap-1">
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
                      <span className="ml-0.5 text-blue-500 dark:text-blue-300 font-bold">&times;</span>
                    </button>
                  ))}
                </div>
              ) : (
                // Multiple groups - collapsible cost centre headers (all collapsed by default)
                <div className="space-y-0.5">
                  <div className="flex justify-end px-0.5 mb-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = selectedTaskGroups.map(([k]) => k);
                        const allExpanded = allKeys.every((k) => expandedBadgeGroups.has(k));
                        setExpandedBadgeGroups(allExpanded ? new Set() : new Set(allKeys));
                      }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {selectedTaskGroups.every(([k]) => expandedBadgeGroups.has(k)) ? "Collapse all" : "Expand all"}
                    </button>
                  </div>
                  {selectedTaskGroups.map(([key, group]) => {
                    const isBadgeExpanded = expandedBadgeGroups.has(key);
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => setExpandedBadgeGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })}
                          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5 py-0.5 hover:text-foreground cursor-pointer w-full text-left"
                        >
                          <span className={`transition-transform text-[8px] ${isBadgeExpanded ? "rotate-90" : ""}`}>▶</span>
                          {group.label} ({group.tasks.length})
                        </button>
                        {isBadgeExpanded && (
                          <div className="flex flex-wrap gap-1 pb-1">
                            {group.tasks.map((task) => (
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
                                <span className="ml-0.5 text-blue-500 dark:text-blue-300 font-bold">&times;</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {t.is_default && <span className="mr-0.5">★</span>}
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
              {groupedTasks.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const allKeys = groupedTasks.map((g) => g.key);
                    const allExpanded = allKeys.every((k) => expandedGroups.has(k));
                    setExpandedGroups(allExpanded ? new Set() : new Set(allKeys));
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                >
                  {groupedTasks.every((g) => expandedGroups.has(g.key)) ? "Collapse all" : "Expand all"}
                </button>
              )}
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
            <div className="max-h-80 overflow-y-auto">
              {filteredTasks.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  No PO tasks found
                </p>
              )}
              {groupedTasks.length === 1 && groupedTasks[0].key === "unassigned" ? (
                // No grouping needed if all tasks are unassigned
                <div className="p-1">
                  {groupedTasks[0].tasks.map(renderTaskRow)}
                </div>
              ) : (
                groupedTasks.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  const groupSelectedCount = group.tasks.filter((t) =>
                    selectedIds.includes(t.id)
                  ).length;
                  const allGroupSelected =
                    group.tasks.length > 0 &&
                    groupSelectedCount === group.tasks.length;
                  return (
                    <div key={group.key} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium bg-muted/40 hover:bg-muted/60 text-left"
                      >
                        <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          ▶
                        </span>
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          onChange={() => {/* handled by onClick below */}}
                          onClick={(e) => toggleGroupSelection(group, e as unknown as React.MouseEvent)}
                          className="rounded border-input"
                        />
                        <span className="flex-1 truncate">{group.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {groupSelectedCount > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 mr-1">{groupSelectedCount}/</span>
                          )}
                          {group.tasks.length}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="pl-2 p-1">
                          {group.tasks.map(renderTaskRow)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* Create new PO task inline form */}
          {onCreateTask && (
            showCreateForm ? (
              <div className="mt-2 p-2 border rounded-md bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="New PO task name..."
                    className="flex-1 bg-background text-sm border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !creating) {
                        e.preventDefault();
                        handleCreateTask();
                      } else if (e.key === "Escape") {
                        setShowCreateForm(false);
                        setNewTaskName("");
                        setNewTaskTemplateId("");
                      }
                    }}
                  />
                </div>
                {templateFilter === "all" && templates.length > 1 && (
                  <select
                    value={newTaskTemplateId}
                    onChange={(e) => setNewTaskTemplateId(e.target.value)}
                    className="w-full bg-background text-sm border rounded px-2 py-1.5 outline-none"
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={creating || !newTaskName.trim() || (templateFilter === "all" && templates.length > 1 && !newTaskTemplateId)}
                    onClick={handleCreateTask}
                    className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTaskName("");
                      setNewTaskTemplateId("");
                    }}
                    className="px-3 py-1 text-xs rounded border hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="mt-2 text-xs text-primary hover:text-primary/80 font-medium"
              >
                + New PO Task
              </button>
            )
          )}
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.length} task{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
