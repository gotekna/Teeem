"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import type { TableRow } from "@/components/table/types";

/**
 * TenderSectionsTab - Manage tender sections for grouping PO items in tender documents.
 *
 * SSoT: This is THE ONE location for managing tender section definitions.
 * Sections like "Base Price & Essential Inclusions", "Site Costs", etc.
 * are linked to SM Schedule Masters via sm_schedule_masters.tender_id.
 *
 * Part of Settings > Operations.
 */

interface POTaskItem {
  id: number;
  name: string;
  taskCode: string | null;
  taskNumber: number;
  tenderId?: number | null;
  tenderName?: string | null;
  templateIds: number[];
}

function PoTaskPicker({
  allTasks,
  initialSelectedIds,
  recordId,
  selectedIdsRef,
}: {
  allTasks: POTaskItem[];
  initialSelectedIds: number[];
  recordId?: string | number;
  selectedIdsRef: React.MutableRefObject<number[]>;
}) {
  const [selectedIds, setSelectedIds] = React.useState<number[]>(initialSelectedIds);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds, selectedIdsRef]);

  const filteredTasks = React.useMemo(() => {
    if (!search) return allTasks;
    const lower = search.toLowerCase();
    return allTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        (t.taskCode && t.taskCode.toLowerCase().includes(lower))
    );
  }, [allTasks, search]);

  const toggleTask = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const selectedTasks = React.useMemo(
    () => allTasks.filter((t) => selectedIds.includes(t.id)),
    [allTasks, selectedIds]
  );

  return (
    <div className="py-4 border-t">
      <Label className="text-sm font-medium">PO Tasks</Label>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        Assign SM PO Tasks to this Tender Section. Tasks showing a name in brackets will be reassigned.
      </p>
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
              <span className="ml-0.5 text-blue-500 dark:text-blue-300 font-bold">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="border rounded-md">
        <div className="p-2 border-b">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO tasks..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredTasks.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-2">No PO tasks found</p>
          )}
          {filteredTasks.map((task) => {
            const isSelected = selectedIds.includes(task.id);
            const isAssignedElsewhere =
              recordId != null
                ? task.tenderId != null && task.tenderId !== Number(recordId) && !isSelected
                : task.tenderId != null && !isSelected;
            const taskDisplay = task.taskCode ? `${task.taskCode} - ${task.name}` : task.name;
            const label = isAssignedElsewhere
              ? `${taskDisplay} (${task.tenderName || `Tender #${task.tenderId}`})`
              : taskDisplay;
            return (
              <label
                key={task.id}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent ${isSelected ? "bg-accent/50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTask(task.id)}
                  className="rounded border-input"
                />
                <span className="truncate">{label}</span>
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

export function TenderSectionsTab() {
  const poTasksRef = React.useRef<POTaskItem[]>([]);
  const poTasksLoadedRef = React.useRef(false);
  const selectedIdsRef = React.useRef<number[]>([]);
  const editRecordIdRef = React.useRef<number | string | null>(null);

  const fetchPoTasks = React.useCallback(async () => {
    try {
      const data = await api.get<{ success: boolean; data: POTaskItem[] }>("/api/v1/tenders/po_tasks");
      if (data?.data) {
        poTasksRef.current = data.data;
        poTasksLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Failed to fetch tender PO tasks:", error);
    }
  }, []);

  const renderPickerForCreate = React.useCallback(() => {
    if (!poTasksLoadedRef.current) {
      fetchPoTasks();
      return (
        <div className="py-4 border-t">
          <Label className="text-sm font-medium">PO Tasks</Label>
          <p className="text-xs text-muted-foreground mt-1">Loading PO tasks...</p>
        </div>
      );
    }
    if (editRecordIdRef.current !== null && editRecordIdRef.current !== "create") {
      editRecordIdRef.current = "create";
      selectedIdsRef.current = [];
    }
    return (
      <PoTaskPicker
        key="tender-create"
        allTasks={poTasksRef.current}
        initialSelectedIds={[]}
        recordId={undefined}
        selectedIdsRef={selectedIdsRef}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPickerForEdit = React.useCallback((record: TableRow) => {
    if (!poTasksLoadedRef.current) {
      fetchPoTasks();
      return (
        <div className="py-4 border-t">
          <Label className="text-sm font-medium">PO Tasks</Label>
          <p className="text-xs text-muted-foreground mt-1">Loading PO tasks...</p>
        </div>
      );
    }
    const recordId = record.id;
    let initialIds: number[];
    if (editRecordIdRef.current !== recordId) {
      editRecordIdRef.current = recordId;
      initialIds = poTasksRef.current
        .filter((t) => t.tenderId === Number(recordId))
        .map((t) => t.id);
      selectedIdsRef.current = initialIds;
    } else {
      initialIds = selectedIdsRef.current;
    }
    return (
      <PoTaskPicker
        key={String(recordId)}
        allTasks={poTasksRef.current}
        initialSelectedIds={initialIds}
        recordId={recordId}
        selectedIdsRef={selectedIdsRef}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAfterSave = React.useCallback(
    async (record: Record<string, unknown>) => {
      const tenderId = record.id;
      if (!tenderId) return;
      try {
        await api.post(`/api/v1/tenders/${tenderId}/assign_po_tasks`, {
          po_task_ids: selectedIdsRef.current,
        });
        await fetchPoTasks();
        selectedIdsRef.current = [];
        editRecordIdRef.current = null;
      } catch (error) {
        console.error("[PO Tasks] Failed to assign tender PO tasks:", error);
      }
    },
    [fetchPoTasks]
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
        createDialogRenderExtra={renderPickerForCreate}
        createDialogOnAfterSave={handleAfterSave}
        editDialogRenderExtra={renderPickerForEdit}
        editDialogOnAfterSave={handleAfterSave}
      />
    </div>
  );
}
