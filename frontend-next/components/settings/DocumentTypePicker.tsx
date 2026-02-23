"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ComboboxDropdownMulti } from "@/components/ui/combobox-dropdown-multi";
import type { ComboboxItem, ComboboxGroup } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";

interface DocTypeRaw {
  id: number;
  name: string;
  folder?: string | null;
  scope?: string | null;
}

type ScopeFilter = "all" | "job" | "company" | "contacts";

const SCOPE_TABS: { key: ScopeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "company", label: "Corporate" },
  { key: "job", label: "Job" },
  { key: "contacts", label: "Contact" },
];

interface DocumentTypePickerProps {
  /** Currently selected document type names */
  selected: string[];
  /** Called when selection changes */
  onChange: (types: string[]) => void;
  /** Optional pre-loaded document types (skips API fetch if provided) */
  documentTypes?: DocTypeRaw[];
  /** Label text (defaults to "Attach Document Types") */
  label?: string;
  /** Default scope filter (defaults to "job") */
  defaultScope?: ScopeFilter;
  /** Show scope tabs (defaults to true) */
  showScopeTabs?: boolean;
}

/**
 * DocumentTypePicker - Shared component for selecting document types.
 *
 * Uses ComboboxDropdownMulti (THE ONE for multi-select) with:
 * - Scope filter tabs (All, Corporate, Job, Contact) - defaults to Job
 * - Grouped by Primary Tab / Folder with section headers
 * - Self-loading from /api/v1/document_types
 */
export function DocumentTypePicker({
  selected,
  onChange,
  documentTypes: externalDocTypes,
  label = "Attach Document Types",
  defaultScope = "job",
  showScopeTabs = true,
}: DocumentTypePickerProps) {
  const [allDocTypes, setAllDocTypes] = useState<DocTypeRaw[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(defaultScope);

  // Load all document types (no scope filter - filter client-side)
  useEffect(() => {
    if (externalDocTypes) {
      setAllDocTypes(externalDocTypes);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: DocTypeRaw[];
        }>("/api/v1/document_types");
        if (!cancelled) {
          setAllDocTypes(res?.data || []);
          setLoaded(true);
        }
      } catch (err) {
        console.error("[DocumentTypePicker] Failed to load document types:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [externalDocTypes]);

  // Filter by scope
  const filteredDocTypes = useMemo(() => {
    if (scopeFilter === "all") return allDocTypes;
    return allDocTypes.filter((dt) => {
      if (dt.scope === "both") return true;
      return dt.scope === scopeFilter;
    });
  }, [allDocTypes, scopeFilter]);

  // Build groups for ComboboxDropdownMulti
  const groups: ComboboxGroup<ComboboxItem>[] = useMemo(() => {
    const groupMap: Record<string, ComboboxItem[]> = {};
    for (const dt of filteredDocTypes) {
      const folder = dt.folder || "Other";
      if (!groupMap[folder]) groupMap[folder] = [];
      groupMap[folder].push({
        id: dt.name, // Use name as ID since selected[] uses names
        label: dt.name,
      });
    }
    return Object.entries(groupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, items]) => ({
        label: folder,
        items: items.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [filteredDocTypes]);

  // Convert selected names to ComboboxItem[]
  const selectedItems: ComboboxItem[] = useMemo(
    () => selected.map((name) => ({ id: name, label: name })),
    [selected]
  );

  if (!loaded) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3 w-3" />
        {label}
      </Label>

      {/* Scope filter tabs */}
      {showScopeTabs && (
        <div className="flex gap-1">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setScopeFilter(tab.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded border transition-colors",
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
      )}

      {/* Multi-select dropdown with folder groups */}
      <ComboboxDropdownMulti
        groups={groups}
        selectedItems={selectedItems}
        onSelectionChange={(items) => onChange(items.map((i) => i.label))}
        placeholder="Select document types..."
        searchPlaceholder="Search document types..."
        badgeVariant="secondary"
      />
    </div>
  );
}
