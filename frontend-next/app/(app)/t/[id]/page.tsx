"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TeeemTableView } from "@/components/table";
import type { TableColumn, TableRow } from "@/components/table/types";
import { api } from "@/lib/api";
import { slugifyJobTitle, slugifyContactName, slugifyPricebookCode } from "@/lib/url-utils";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { Plus, ArrowLeft } from "lucide-react";

// Table ID to route mapping for legacy compatibility
const TABLE_ROUTES: Record<number, { name: string; apiEndpoint: string; itemRoute: string }> = {
  1: { name: "Components", apiEndpoint: "/api/v1/gold_standard_table", itemRoute: "/admin/system?tab=components" },
  204: { name: "Jobs", apiEndpoint: "/api/v1/jobs", itemRoute: "/jobs" },
  205: { name: "Pricebook", apiEndpoint: "/api/v1/pricebook", itemRoute: "/pricebook" },
  214: { name: "Contacts", apiEndpoint: "/api/v1/contacts", itemRoute: "/contacts" },
};

// System-generated column types that users cannot edit
const SYSTEM_GENERATED_TYPES = [
  'computed', 'formula', 'auto_number', 'created_time', 'modified_time',
  'created_by', 'modified_by', 'rollup', 'count'
];

// Check if a column is system-generated
const isSystemColumn = (columnName: string, columnType: string): boolean => {
  return ['id', 'created_at', 'updated_at'].includes(columnName) ||
         SYSTEM_GENERATED_TYPES.includes(columnType);
};

interface FoundationData {
  id: number;
  name: string;
  description?: string;
  columns: Array<{
    id: number;
    column_name: string;
    name: string;
    column_type: string;
    position?: number;
  }>;
}

export default function TablePage() {
  const router = useRouter();
  const params = useParams();
  const tableId = Number(params.id);

  const [foundation, setFoundation] = useState<FoundationData | null>(null);
  const [entries, setEntries] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tableInfo = TABLE_ROUTES[tableId];

  useEffect(() => {
    loadTableData();
     
  }, [tableId]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch foundation (table) metadata including columns
      const foundationData = await api.get<{
        success?: boolean;
        foundation?: FoundationData;
        id?: number;
        name?: string;
        columns?: FoundationData["columns"];
      }>(`/api/v1/foundations/${tableId}`);

      const foundationInfo = foundationData.foundation || foundationData;
      if (!foundationInfo || !foundationInfo.name) {
        throw new Error(`Table ${tableId} not found`);
      }

      setFoundation(foundationInfo as FoundationData);

      // Build columns from foundation
      const sortedCols = [...(foundationInfo.columns || [])].sort(
        (a, b) => (a.position || 0) - (b.position || 0)
      );

      const tableColumns: TableColumn[] = [
        { key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 },
        ...sortedCols.map((col) => {
          const isSysCol = isSystemColumn(col.column_name, col.column_type);
          return {
            key: col.column_name,
            label: col.name || col.column_name,
            column_type: col.column_type,
            resizable: true,
            sortable: true,
            filterable: true,
            width: col.column_name === 'id' ? 60 : 150,
            editable: !isSysCol,
            system: isSysCol,
          };
        }),
        { key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 100 },
      ];
      setColumns(tableColumns);

      // Fetch table data
      if (tableInfo?.apiEndpoint) {
        const response = await api.get<{ items?: TableRow[]; jobs?: TableRow[]; contacts?: TableRow[]; [key: string]: unknown }>(tableInfo.apiEndpoint);
        // Handle different response formats
        const items = response.items || response.jobs || response.contacts || [];
        setEntries(Array.isArray(items) ? items : []);
      } else {
        // Generic foundation entries endpoint
        const entriesData = await api.get<{ entries?: TableRow[]; items?: TableRow[] }>(`/api/v1/foundations/${tableId}/entries`);
        setEntries(entriesData.entries || entriesData.items || []);
      }
    } catch (err) {
      console.error("Failed to load table:", err);
      setError(err instanceof Error ? err.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (row: TableRow) => {
    if (tableInfo?.itemRoute) {
      // Use appropriate slug function based on table type
      if (tableId === 204 && row.title) {
        router.push(`${tableInfo.itemRoute}/${slugifyJobTitle(String(row.title))}`);
      } else if (tableId === 214) {
        const slug = slugifyContactName(row.first_name as string, row.last_name as string, row.company_name as string);
        router.push(`${tableInfo.itemRoute}/${slug}`);
      } else if (tableId === 205 && row.item_code) {
        router.push(`${tableInfo.itemRoute}/${slugifyPricebookCode(String(row.item_code))}`);
      } else {
        router.push(`${tableInfo.itemRoute}/${row.id}`);
      }
    }
  };

  const handleEdit = (row: TableRow) => {
    if (tableInfo?.itemRoute) {
      router.push(`${tableInfo.itemRoute}/${row.id}?edit=true`);
    }
  };

  const handleDelete = async (row: TableRow) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      if (tableInfo?.apiEndpoint) {
        await api.delete(`${tableInfo.apiEndpoint}/${row.id}`);
      } else {
        await api.delete(`/api/v1/foundations/${tableId}/entries/${row.id}`);
      }
      setEntries((prev) => prev.filter((e) => e.id !== row.id));
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete item");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error}</p>
        <BackButton fallbackHref="/" label="Go Back" variant="outline" />
      </div>
    );
  }

  // Left actions - Add New button (moved from duplicate header)
  const leftActions = tableInfo?.itemRoute ? (
    <Button asChild>
      <Link href={`${tableInfo.itemRoute}/new`}>
        <Plus className="h-4 w-4 mr-2" />
        New
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* TeeemTableView handles the header (tableName), no duplicate h1 needed */}
      <TeeemTableView
        entries={entries}
        foundationId={`table-${tableId}`}
        foundationIdNumeric={tableId}
        tableName={foundation?.name || `Table ${tableId}`}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowDoubleClick={handleView}
        onRefresh={loadTableData}
        enableExport={true}
        leftActions={leftActions}
      />
    </div>
  );
}
