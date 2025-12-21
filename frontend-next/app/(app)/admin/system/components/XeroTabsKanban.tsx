"use client";

/**
 * XeroTabsKanban - Kanban board for managing Xero feature tab hierarchy
 *
 * Allows drag-and-drop to:
 * - Set parent relationships (drag to a parent column)
 * - Remove parent (drag to Standalone column)
 * - Reorder within columns
 *
 * SSoT: XeroFeatureTab database table
 */

import * as React from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  KanbanBoard,
  KanbanCard,
  type KanbanColumnDef,
  type KanbanItem,
} from "@/components/ui/kanban";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import { Loader2, RefreshCw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface XeroTab extends KanbanItem {
  id: string;
  name: string;
  type: string;
  component?: string;
  group: string;
  icon?: string;
  parent?: string | null;
  head_only?: boolean;
  group_member?: boolean;
  visible?: boolean;
  order_position?: number;
}

interface XeroTabsKanbanProps {
  tabs: XeroTab[];
  onUpdate: () => void;
}

// =============================================================================
// COLUMN DEFINITIONS
// =============================================================================

// All 8 parent tab columns - any tab can have sub-tabs
const BASE_COLUMNS: Array<{ id: string; baseTitle: string; color: "gray" | "blue" | "green" | "purple" | "orange" }> = [
  { id: "connection", baseTitle: "Connection", color: "gray" },
  { id: "contacts", baseTitle: "Contacts", color: "gray" },
  { id: "invoices", baseTitle: "Invoices", color: "gray" },
  { id: "bills", baseTitle: "Bills & POs", color: "gray" },
  { id: "accounts", baseTitle: "Accounts", color: "blue" },
  { id: "profit-loss", baseTitle: "Profit & Loss", color: "green" },
  { id: "balance-sheet", baseTitle: "Balance Sheet", color: "purple" },
  { id: "bank", baseTitle: "Bank", color: "orange" },
];

// Group badge colors
const GROUP_COLORS: Record<string, string> = {
  setup: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  data: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  reports: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  documents: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function XeroTabsKanban({ tabs, onUpdate }: XeroTabsKanbanProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [localTabs, setLocalTabs] = React.useState<XeroTab[]>(tabs);

  // Sync with parent tabs prop
  React.useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  // Column order state (initialized from database, can be reordered by dragging)
  const [columnOrder, setColumnOrder] = React.useState(() => {
    // Get order from tabs data if available, otherwise use default
    const parentTabIds = BASE_COLUMNS.map(c => c.id);
    const parentTabs = tabs
      .filter(t => parentTabIds.includes(t.id))
      .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));

    if (parentTabs.length > 0) {
      // Use database order, then append any missing columns at the end
      const orderedIds = parentTabs.map(t => t.id);
      const missingIds = parentTabIds.filter(id => !orderedIds.includes(id));
      return [...orderedIds, ...missingIds];
    }
    return parentTabIds;
  });

  // Sync column order when tabs change (e.g., after refresh)
  React.useEffect(() => {
    const parentTabIds = BASE_COLUMNS.map(c => c.id);
    const parentTabs = tabs
      .filter(t => parentTabIds.includes(t.id))
      .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));

    if (parentTabs.length > 0) {
      const orderedIds = parentTabs.map(t => t.id);
      const missingIds = parentTabIds.filter(id => !orderedIds.includes(id));
      setColumnOrder([...orderedIds, ...missingIds]);
    }
  }, [tabs]);

  // Build columns with position numbers based on current order
  const columns = React.useMemo((): KanbanColumnDef[] => {
    return columnOrder.map((colId, index) => {
      const col = BASE_COLUMNS.find(c => c.id === colId);
      if (!col) return null;
      return {
        id: col.id,
        title: `${index + 1}. ${col.baseTitle}`,
        color: col.color,
      };
    }).filter(Boolean) as KanbanColumnDef[];
  }, [columnOrder]);

  // Tabs without a parent (not sub-tabs) - shown separately
  const standaloneTabs = React.useMemo(() => {
    const parentIds = BASE_COLUMNS.map((c) => c.id);
    return localTabs
      .filter((t) => !t.parent && !parentIds.includes(t.id))
      .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
  }, [localTabs]);

  // Only include tabs that are sub-tabs (have a parent) in the Kanban
  const kanbanTabs = React.useMemo(() => {
    return localTabs.filter((t) => t.parent);
  }, [localTabs]);

  // Determine which column a tab belongs to
  const getItemColumn = React.useCallback((tab: XeroTab): string => {
    return tab.parent || "";
  }, []);

  // Handle card move between columns (changes parent_key)
  const handleCardMove = React.useCallback(
    async ({
      item,
      toColumnId,
    }: {
      item: XeroTab;
      fromColumnId: string;
      toColumnId: string;
      toIndex: number;
    }) => {
      const parentKey = toColumnId === "standalone" ? null : toColumnId;

      // Optimistic update
      setLocalTabs((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, parent: parentKey } : t))
      );

      setSaving(true);
      try {
        await api.patch(`/api/v1/xero/tabs/${item.id}`, {
          tab: { parent_key: parentKey },
        });
        toast({
          title: parentKey ? `Moved under ${toColumnId}` : "Made standalone",
          description: `"${item.name}" parent updated`,
        });
        onUpdate();
      } catch (error) {
        console.error("Failed to update parent:", error);
        toast({
          title: "Error",
          description: "Failed to update tab parent",
          variant: "destructive",
        });
        // Revert on error
        setLocalTabs(tabs);
      } finally {
        setSaving(false);
      }
    },
    [tabs, onUpdate, toast]
  );

  // Handle card reorder within same column
  const handleCardReorder = React.useCallback(
    async ({
      item,
      columnId,
      fromIndex,
      toIndex,
    }: {
      item: XeroTab;
      columnId: string;
      fromIndex: number;
      toIndex: number;
    }) => {
      // Get items in this column
      const columnItems = localTabs
        .filter((t) => getItemColumn(t) === columnId)
        .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));

      // Reorder
      const reordered = [...columnItems];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, removed);

      // Prepare reorder payload
      const reorderPayload = reordered.map((t, idx) => ({
        id: t.id,
        order_position: idx + 1,
      }));

      setSaving(true);
      try {
        await api.post("/api/v1/xero/tabs/reorder", { tabs: reorderPayload });
        toast({
          title: "Reordered",
          description: `"${item.name}" moved to position ${toIndex + 1}`,
        });
        onUpdate();
      } catch (error) {
        console.error("Failed to reorder:", error);
        toast({
          title: "Error",
          description: "Failed to reorder tabs",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [localTabs, getItemColumn, onUpdate, toast]
  );

  // Handle reordering column/parent tabs (the 8 main tabs)
  const handleColumnReorder = React.useCallback(
    async (newOrder: string[]) => {
      // Prepare reorder payload - column IDs are the tab_keys
      const reorderPayload = newOrder.map((tabKey, idx) => ({
        id: tabKey,
        order_position: idx + 1,
      }));

      setSaving(true);
      try {
        await api.post("/api/v1/xero/tabs/reorder", { tabs: reorderPayload });
        setColumnOrder(newOrder);
        toast({
          title: "Tab order saved",
          description: "Column order updated in database",
        });
        onUpdate();
      } catch (error) {
        console.error("Failed to reorder columns:", error);
        toast({
          title: "Error",
          description: "Failed to save column order",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, toast]
  );

  // Handle reordering standalone tabs (top-level tabs)
  const handleStandaloneReorder = React.useCallback(
    async (reorderedTabs: XeroTab[]) => {
      // Prepare reorder payload
      const reorderPayload = reorderedTabs.map((t, idx) => ({
        id: t.id,
        order_position: idx + 1,
      }));

      setSaving(true);
      try {
        await api.post("/api/v1/xero/tabs/reorder", { tabs: reorderPayload });
        toast({
          title: "Reordered",
          description: "Tab order updated",
        });
        onUpdate();
      } catch (error) {
        console.error("Failed to reorder:", error);
        toast({
          title: "Error",
          description: "Failed to reorder tabs",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, toast]
  );

  // Get position within column for numbering
  const getPositionInColumn = React.useCallback(
    (tab: XeroTab): number => {
      const columnId = tab.parent || "standalone";
      const columnTabs = localTabs
        .filter((t) => (t.parent || "standalone") === columnId)
        .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
      return columnTabs.findIndex((t) => t.id === tab.id) + 1;
    },
    [localTabs]
  );

  // Render each card (compact for 8 columns)
  const renderCard = React.useCallback(
    (tab: XeroTab, isDragging: boolean) => {
      const position = getPositionInColumn(tab);
      return (
        <KanbanCard id={tab.id} isDragging={isDragging}>
          <div className="p-2 space-y-1">
            {/* Header row with position number and badges */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Position number */}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted text-[9px] font-bold text-muted-foreground">
                {position}
              </span>
              {/* Group member badge */}
              {tab.group_member && (
                <Badge
                  variant="outline"
                  className="text-[8px] px-1 py-0 border-purple-400 text-purple-700 dark:border-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40"
                >
                  GRP
                </Badge>
              )}
              {/* Tab group badge */}
              <Badge
                variant="outline"
                className={cn("text-[8px] px-1 py-0", GROUP_COLORS[tab.group] || "")}
              >
                {tab.group}
              </Badge>
            </div>

            {/* Tab name */}
            <div className="font-medium text-xs leading-tight">{tab.name}</div>

            {/* Component name */}
            {tab.component && (
              <div className="text-[9px] font-mono text-muted-foreground truncate">
                {tab.component}
              </div>
            )}
          </div>
        </KanbanCard>
      );
    },
    [getPositionInColumn]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Drag tabs between columns to set parent relationships. Drag within a column to reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" onClick={onUpdate} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Standalone Tabs (no parent - drag to reorder) */}
      {standaloneTabs.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h4 className="text-sm font-medium mb-3">Top-Level Tabs (drag to reorder)</h4>
          <SortableList
            items={standaloneTabs}
            onReorder={handleStandaloneReorder}
            strategy="horizontal"
            className="flex flex-nowrap gap-2 overflow-x-auto pb-2"
          >
            {standaloneTabs.map((tab, index) => (
              <SortableItem key={tab.id} id={tab.id} showHandle={false}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm cursor-grab active:cursor-grabbing whitespace-nowrap">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="font-medium">{tab.name}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] px-1.5 py-0", GROUP_COLORS[tab.group] || "")}
                  >
                    {tab.group}
                  </Badge>
                </div>
              </SortableItem>
            ))}
          </SortableList>
        </div>
      )}

      {/* Column Order - Drag to reorder tabs */}
      <div className="border rounded-lg p-3 bg-muted/20">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Tab Order (drag to reorder)</h4>
        <SortableList
          items={columnOrder.map((id, idx) => ({ id, idx }))}
          onReorder={(newItems) => {
            handleColumnReorder(newItems.map(item => item.id));
          }}
          strategy="horizontal"
          className="flex flex-nowrap gap-2 overflow-x-auto pb-1"
        >
          {columnOrder.map((colId, index) => {
            const col = BASE_COLUMNS.find(c => c.id === colId);
            return (
              <SortableItem
                key={colId}
                id={colId}
                position={index + 1}
                variant="card"
                className="whitespace-nowrap"
              >
                <span className="font-medium text-sm">{col?.baseTitle}</span>
              </SortableItem>
            );
          })}
        </SortableList>
      </div>

      {/* Kanban Board - Sub-tabs under each column */}
      <div className="overflow-x-auto pb-4">
        <KanbanBoard
          columns={columns}
          items={kanbanTabs}
          getItemColumn={getItemColumn}
          renderCard={renderCard}
          onCardMove={handleCardMove}
          onCardReorder={handleCardReorder}
          minColumnWidth={160}
          columnGap="sm"
          renderEmptyColumn={(column) => (
            <div className="text-center py-4 text-muted-foreground text-xs">
              Drop sub-tabs here
            </div>
          )}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
            GROUP
          </Badge>
          <span>Shows for companies in a group</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            data
          </Badge>
          <span>Data tabs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            reports
          </Badge>
          <span>Report tabs</span>
        </div>
      </div>
    </div>
  );
}
