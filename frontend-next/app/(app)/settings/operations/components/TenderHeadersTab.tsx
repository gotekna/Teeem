"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

/**
 * TenderHeadersTab - Manage tender headers (top-level groupings).
 *
 * Headers are tender records with parent_id = NULL.
 * They group tender sections into two-level hierarchy for tender documents
 * (e.g., "Site Costs" header contains "Site Preparation", "Piering to Slab", etc.)
 *
 * SSoT: This tab manages headers only. Sections are managed in TenderSectionsTab.
 * Part of Settings > Operations.
 */

interface TenderSection {
  id: number;
  code: string;
  name: string;
  sort_order: number | null;
}

function LinkedSections({ headerId }: { headerId: number | string }) {
  const [sections, setSections] = React.useState<TenderSection[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const filters = JSON.stringify([
          { column: "parent_id", operator: "equals", value: String(headerId) },
        ]);
        const data = await api.get<{ success: boolean; records: Record<string, unknown>[] }>(
          `/api/v1/foundations/${FOUNDATION_SLUGS.TENDERS}/records?per_page=200&filters=${encodeURIComponent(filters)}`
        );
        if (!cancelled && data?.records) {
          const mapped = data.records.map((r) => ({
            id: Number(r.id),
            code: String(r.code || ""),
            name: String(r.name || ""),
            sort_order: r.sort_order != null ? Number(r.sort_order) : null,
          }));
          mapped.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
          setSections(mapped);
        }
      } catch {
        // Silently handle - not critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [headerId]);

  if (loading) {
    return (
      <div className="py-4 border-t">
        <p className="text-sm font-medium mb-1">Linked Sections</p>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="py-4 border-t">
      <p className="text-sm font-medium mb-2">
        Linked Sections ({sections.length})
      </p>
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sections linked to this header.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sections.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-muted/50"
            >
              <span className="text-muted-foreground font-mono text-xs min-w-[4rem]">
                {s.code}
              </span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TenderHeadersTab() {
  const renderLinkedSections = React.useCallback(
    (record: TableRow) => <LinkedSections headerId={record.id} />,
    []
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
        initialFilters={[
          {
            id: "header-filter",
            column: "parent_id",
            operator: "is_empty",
            value: null,
            locked: true,
          },
        ]}
        editDialogRenderExtra={renderLinkedSections}
      />
    </div>
  );
}
