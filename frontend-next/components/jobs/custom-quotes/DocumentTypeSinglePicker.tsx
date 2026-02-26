"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ComboboxDropdown, type ComboboxItem, type ComboboxGroup } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";

interface DocTypeRaw {
  id: number;
  name: string;
  folder?: string | null;
  scope?: string | null;
}

type ScopeFilter = "all" | "job" | "company" | "contacts" | "library";

const SCOPE_TABS: { key: ScopeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "company", label: "Corporate" },
  { key: "job", label: "Job" },
  { key: "contacts", label: "Contact" },
  { key: "library", label: "Library" },
];

interface DocumentTypeSinglePickerProps {
  selectedId: number | null;
  selectedName: string | null;
  onChange: (id: number | null, name: string | null) => void;
}

/**
 * Single-select document type picker with scope tabs, folder tabs, and grouped dropdown.
 * Matches the standard DocumentTypePicker pattern (grouped by Primary Tab/folder).
 */
export function DocumentTypeSinglePicker({
  selectedId,
  selectedName,
  onChange,
}: DocumentTypeSinglePickerProps) {
  const [allDocTypes, setAllDocTypes] = useState<DocTypeRaw[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ success: boolean; data: DocTypeRaw[] }>(
          "/api/v1/document_types"
        );
        if (!cancelled) {
          setAllDocTypes(res?.data || []);
          setLoaded(true);
        }
      } catch (err) {
        console.error("[DocumentTypeSinglePicker] fetch error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter by scope
  const scopeFiltered = useMemo(() => {
    if (scopeFilter === "all") return allDocTypes;
    return allDocTypes.filter((dt) => {
      if (dt.scope === "both") return true;
      return dt.scope === scopeFilter;
    });
  }, [allDocTypes, scopeFilter]);


  // Build groups by folder (Primary Tab)
  const groups: ComboboxGroup<ComboboxItem>[] = useMemo(() => {
    const groupMap: Record<string, ComboboxItem[]> = {};
    for (const dt of scopeFiltered) {
      const folder = dt.folder || "Other";
      if (!groupMap[folder]) groupMap[folder] = [];
      groupMap[folder].push({
        id: String(dt.id),
        label: dt.name,
        searchText: folder,
      });
    }
    return Object.entries(groupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, items]) => ({
        label: folder,
        items: items.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [scopeFiltered]);

  // Build selectedItem for ComboboxDropdown
  const selectedItem: ComboboxItem | undefined = useMemo(() => {
    if (!selectedId) return undefined;
    return { id: String(selectedId), label: selectedName || "" };
  }, [selectedId, selectedName]);

  if (!loaded) return null;

  return (
    <div className="space-y-1.5">
      {/* Scope tabs */}
      <div className="flex gap-1">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setScopeFilter(tab.key)}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded border transition-colors",
              scopeFilter === tab.key
                ? "bg-primary text-primary-foreground font-medium border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            )}
          >
            {tab.label}
            <span className="ml-1 text-[10px] opacity-70">
              {tab.key === "all"
                ? allDocTypes.length
                : allDocTypes.filter((dt) => dt.scope === tab.key || dt.scope === "both").length}
            </span>
          </button>
        ))}
      </div>

      <ComboboxDropdown
        groups={groups}
        onSelect={(item) => onChange(Number(item.id), item.label)}
        placeholder="Select document type..."
        selectedItem={selectedItem}
        clearable={!!selectedId}
        onClear={() => onChange(null, null)}
      />
    </div>
  );
}
