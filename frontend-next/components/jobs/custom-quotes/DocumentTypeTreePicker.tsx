"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

interface DocumentTypeTreePickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Multi-select document type picker with collapsible folder sections.
 * Clicking a folder header checkbox selects/deselects all children.
 */
export function DocumentTypeTreePicker({
  selectedIds,
  onChange,
}: DocumentTypeTreePickerProps) {
  const [allDocTypes, setAllDocTypes] = useState<DocTypeRaw[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

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
        console.error("[DocumentTypeTreePicker] fetch error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scopeFiltered = useMemo(() => {
    let filtered = allDocTypes;
    if (scopeFilter !== "all") {
      filtered = filtered.filter((dt) => dt.scope === "both" || dt.scope === scopeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((dt) =>
        dt.name.toLowerCase().includes(q) ||
        (dt.folder || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allDocTypes, scopeFilter, search]);

  // Group by folder
  const folderGroups = useMemo(() => {
    const groupMap: Record<string, DocTypeRaw[]> = {};
    for (const dt of scopeFiltered) {
      const folder = dt.folder || "Other";
      if (!groupMap[folder]) groupMap[folder] = [];
      groupMap[folder].push(dt);
    }
    return Object.entries(groupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, items]) => ({
        folder,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [scopeFiltered]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleItem = useCallback((id: number) => {
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next);
  }, [selectedIds, selectedSet, onChange]);

  const toggleFolder = useCallback((items: DocTypeRaw[]) => {
    const folderIds = items.map((dt) => dt.id);
    const allSelected = folderIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !folderIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...folderIds]);
      onChange(Array.from(merged));
    }
  }, [selectedIds, selectedSet, onChange]);

  const toggleFolderCollapse = useCallback((folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }, []);

  if (!loaded) return null;

  const totalSelected = selectedIds.length;

  return (
    <div className="space-y-1.5">
      {/* Scope tabs */}
      <div className="flex gap-1 flex-wrap items-center">
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
        {totalSelected > 0 && (
          <span className="px-2 py-0.5 text-[10px] text-green-600 dark:text-green-400 font-medium">
            {totalSelected} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search document types..."
          className="h-7 pl-7 text-xs"
        />
      </div>

      {/* Tree */}
      <div className="border rounded max-h-48 overflow-y-auto">
        {folderGroups.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            No document types found
          </div>
        )}
        {folderGroups.map(({ folder, items }) => {
          const folderIds = items.map((dt) => dt.id);
          const allSelected = folderIds.length > 0 && folderIds.every((id) => selectedSet.has(id));
          const someSelected = !allSelected && folderIds.some((id) => selectedSet.has(id));
          const isCollapsed = collapsedFolders.has(folder);

          return (
            <div key={folder}>
              {/* Folder header */}
              <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 hover:bg-muted">
                <button
                  type="button"
                  onClick={() => toggleFolderCollapse(folder)}
                  className="shrink-0"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  }
                </button>
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleFolder(items)}
                  className="h-3.5 w-3.5"
                />
                <button
                  type="button"
                  onClick={() => toggleFolder(items)}
                  className="text-xs font-medium text-muted-foreground flex-1 text-left"
                >
                  {folder}
                </button>
                <span className="text-[10px] text-muted-foreground">{items.length}</span>
              </div>

              {/* Children */}
              {!isCollapsed && items.map((dt) => (
                <div
                  key={dt.id}
                  className="flex items-center gap-2 px-2 py-1 pl-8 hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleItem(dt.id)}
                >
                  <Checkbox
                    checked={selectedSet.has(dt.id)}
                    onCheckedChange={() => toggleItem(dt.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{dt.name}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
