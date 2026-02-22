"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { api } from "@/lib/api";
import { PoTaskPicker, type POTaskItem, type SmTemplate } from "@/components/settings/PoTaskPicker";
import type { TableRow } from "@/components/table/types";

/**
 * CostCentresTab - Global cost centre management
 *
 * SSoT: This is THE ONE location for managing cost centres.
 * Previously nested under Schedule Master > Tables, now promoted to
 * a top-level Operations tab alongside Profit Centres.
 *
 * Includes PO Task picker in edit/create dialogs for assigning
 * SM PO Tasks to cost centres.
 *
 * Part of Settings > Operations.
 */
export function CostCentresTab() {
  // PO Task picker state - uses refs to avoid re-rendering TeeemTableView
  const poTasksRef = React.useRef<POTaskItem[]>([]);
  const poTasksLoadedRef = React.useRef(false);
  const selectedPoTaskIdsRef = React.useRef<number[]>([]);
  const editRecordIdRef = React.useRef<number | string | null>(null);
  const templatesRef = React.useRef<SmTemplate[]>([]);

  const fetchPoTasks = React.useCallback(async () => {
    try {
      const [poData, tplData] = await Promise.all([
        api.get<{ success: boolean; data: POTaskItem[] }>(
          "/api/v1/cost_centres/po_tasks"
        ),
        api.get<{ success: boolean; sm_schedule_master_templates: SmTemplate[] }>(
          "/api/v1/sm_schedule_master_templates"
        ),
      ]);
      if (poData?.data) {
        poTasksRef.current = poData.data;
        poTasksLoadedRef.current = true;
      }
      if (tplData?.sm_schedule_master_templates) {
        templatesRef.current = tplData.sm_schedule_master_templates;
      }
    } catch (error) {
      console.error("Failed to fetch cost centre PO tasks:", error);
    }
  }, []);

  const renderExtraForCreate = React.useCallback(() => {
    if (!poTasksLoadedRef.current) {
      fetchPoTasks();
      return (
        <div className="py-4 border-t">
          <label className="text-sm font-medium">PO Tasks</label>
          <p className="text-xs text-muted-foreground mt-1">Loading PO tasks...</p>
        </div>
      );
    }
    if (editRecordIdRef.current !== null && editRecordIdRef.current !== "create") {
      editRecordIdRef.current = "create";
      selectedPoTaskIdsRef.current = [];
    }
    return (
      <PoTaskPicker
        key="cost-centre-create"
        allTasks={poTasksRef.current}
        initialSelectedIds={[]}
        recordId={undefined}
        templates={templatesRef.current}
        selectedIdsRef={selectedPoTaskIdsRef}
        assignmentField="costCentre"
        entityLabel="Cost Centre"
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderExtraForEdit = React.useCallback((record: TableRow) => {
    if (!poTasksLoadedRef.current) {
      fetchPoTasks();
      return (
        <div className="py-4 border-t">
          <label className="text-sm font-medium">PO Tasks</label>
          <p className="text-xs text-muted-foreground mt-1">Loading PO tasks...</p>
        </div>
      );
    }
    const recordId = record.id;
    let initialIds: number[];
    if (editRecordIdRef.current !== recordId) {
      editRecordIdRef.current = recordId;
      initialIds = poTasksRef.current
        .filter((t) => t.costCentreId === Number(recordId))
        .map((t) => t.id);
      selectedPoTaskIdsRef.current = initialIds;
    } else {
      initialIds = selectedPoTaskIdsRef.current;
    }
    return (
      <PoTaskPicker
        key={String(recordId)}
        allTasks={poTasksRef.current}
        initialSelectedIds={initialIds}
        recordId={recordId}
        templates={templatesRef.current}
        selectedIdsRef={selectedPoTaskIdsRef}
        assignmentField="costCentre"
        entityLabel="Cost Centre"
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAfterSave = React.useCallback(
    async (record: Record<string, unknown>) => {
      const costCentreId = record.id;
      if (!costCentreId) return;
      try {
        await api.post(`/api/v1/cost_centres/${costCentreId}/assign_po_tasks`, {
          po_task_ids: selectedPoTaskIdsRef.current,
        });
        await fetchPoTasks();
        selectedPoTaskIdsRef.current = [];
        editRecordIdRef.current = null;
      } catch (error) {
        console.error("[CostCentres] Failed to assign PO tasks:", error);
      }
    },
    [fetchPoTasks]
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.COST_CENTRES}
        autoFetchRecords={true}
        createDialogRenderExtra={renderExtraForCreate}
        editDialogRenderExtra={renderExtraForEdit}
        createDialogOnAfterSave={handleAfterSave}
        editDialogOnAfterSave={handleAfterSave}
      />
    </div>
  );
}
