"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { api } from "@/lib/api";
import { PoTaskPicker, type POTaskItem } from "@/components/settings/PoTaskPicker";
import { DocumentTypePicker } from "@/components/settings/DocumentTypePicker";
import type { TableRow } from "@/components/table/types";

/**
 * TenderSectionsTab - Manage tender sections for grouping PO items in tender documents.
 *
 * SSoT: This is THE ONE location for managing tender section definitions.
 * Sections belong to TenderHeaders via tender_header_id.
 *
 * Includes PO Task picker and Document Type picker in edit/create dialogs.
 *
 * Headers are managed separately in TenderHeadersTab.
 * Part of Settings > Operations.
 */
export function TenderSectionsTab() {
  // PO Task picker state - uses refs to avoid re-rendering TeeemTableView
  const poTasksRef = React.useRef<POTaskItem[]>([]);
  const poTasksLoadedRef = React.useRef(false);
  const selectedPoTaskIdsRef = React.useRef<number[]>([]);
  const editRecordIdRef = React.useRef<number | string | null>(null);

  // Document type picker state - same ref pattern
  const docTypesRef = React.useRef<string[]>([]);

  const fetchPoTasks = React.useCallback(async () => {
    try {
      const data = await api.get<{ success: boolean; data: POTaskItem[] }>(
        "/api/v1/tenders/po_tasks"
      );
      if (data?.data) {
        poTasksRef.current = data.data;
        poTasksLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Failed to fetch tender PO tasks:", error);
    }
  }, []);

  // Fetch current attached_document_types for a tender section via tree API
  const fetchDocTypesForSection = React.useCallback(async (tenderId: number | string) => {
    try {
      const response = await api.get<{ success: boolean; data: Array<{ children: Array<{ id: number; attachedDocumentTypes: string[] }> }> }>(
        "/api/v1/tenders/tree"
      );
      if (response?.data) {
        for (const header of response.data) {
          for (const section of header.children) {
            if (section.id === Number(tenderId)) {
              docTypesRef.current = section.attachedDocumentTypes || [];
              return;
            }
          }
        }
      }
    } catch {
      // Silent - default to empty
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
      docTypesRef.current = [];
    }
    return (
      <>
        <PoTaskPicker
          key="tender-section-create"
          allTasks={poTasksRef.current}
          initialSelectedIds={[]}
          recordId={undefined}
          selectedIdsRef={selectedPoTaskIdsRef}
          assignmentField="tender"
          entityLabel="Tender Section"
        />
        <div className="py-2 border-t">
          <DocumentTypePicker
            selected={docTypesRef.current}
            onChange={(types) => { docTypesRef.current = types; }}
          />
        </div>
      </>
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
        .filter((t) => t.tenderId === Number(recordId))
        .map((t) => t.id);
      selectedPoTaskIdsRef.current = initialIds;
      // Fetch doc types for this section
      fetchDocTypesForSection(recordId);
    } else {
      initialIds = selectedPoTaskIdsRef.current;
    }
    return (
      <>
        <PoTaskPicker
          key={String(recordId)}
          allTasks={poTasksRef.current}
          initialSelectedIds={initialIds}
          recordId={recordId}
          selectedIdsRef={selectedPoTaskIdsRef}
          assignmentField="tender"
          entityLabel="Tender Section"
        />
        <div className="py-2 border-t">
          <DocumentTypePicker
            selected={docTypesRef.current}
            onChange={(types) => { docTypesRef.current = types; }}
          />
        </div>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAfterSave = React.useCallback(
    async (record: Record<string, unknown>) => {
      const tenderId = record.id;
      if (!tenderId) return;
      try {
        await Promise.all([
          api.post(`/api/v1/tenders/${tenderId}/assign_po_tasks`, {
            po_task_ids: selectedPoTaskIdsRef.current,
          }),
          api.post(`/api/v1/tenders/${tenderId}/update_document_types`, {
            document_types: docTypesRef.current,
          }),
        ]);
        await fetchPoTasks();
        selectedPoTaskIdsRef.current = [];
        docTypesRef.current = [];
        editRecordIdRef.current = null;
      } catch (error) {
        console.error("[TenderSections] Failed to save PO tasks / doc types:", error);
      }
    },
    [fetchPoTasks]
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
        createDialogRenderExtra={renderExtraForCreate}
        editDialogRenderExtra={renderExtraForEdit}
        createDialogOnAfterSave={handleAfterSave}
        editDialogOnAfterSave={handleAfterSave}
      />
    </div>
  );
}
