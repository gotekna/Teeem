"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { CommandList } from "cmdk";
import { api } from "@/lib/api";

interface DocTypeItem {
  id: number;
  name: string;
  folder: string | null;
  scope: string | null;
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
  documentTypes?: { id: number; name: string; folder?: string; scope?: string }[];
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
 * Features:
 * - Scope filter tabs (All, Corporate, Job, Contact) - defaults to Job
 * - Grouped by Primary Tab / Folder with group headers
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
  const [allDocTypes, setAllDocTypes] = useState<DocTypeItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(defaultScope);

  // Load all document types (no scope filter - filter client-side)
  useEffect(() => {
    if (externalDocTypes) {
      setAllDocTypes(
        externalDocTypes.map((dt) => ({
          id: dt.id,
          name: dt.name,
          folder: dt.folder || null,
          scope: dt.scope || null,
        }))
      );
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: Array<{ id: number; name: string; folder?: string; scope?: string }>;
        }>("/api/v1/document_types");
        if (!cancelled) {
          setAllDocTypes(
            (res?.data || []).map((dt) => ({
              id: dt.id,
              name: dt.name,
              folder: dt.folder || null,
              scope: dt.scope || null,
            }))
          );
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
      if (scopeFilter === "company") return dt.scope === "company";
      if (scopeFilter === "job") return dt.scope === "job";
      if (scopeFilter === "contacts") return dt.scope === "contacts";
      return true;
    });
  }, [allDocTypes, scopeFilter]);

  // Group by folder
  const grouped = useMemo(() => {
    const groups: Record<string, DocTypeItem[]> = {};
    for (const dt of filteredDocTypes) {
      const folder = dt.folder || "Other";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(dt);
    }
    // Sort groups alphabetically, sort items within each group
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, items]) => ({
        folder,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredDocTypes]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const handleToggle = useCallback(
    (name: string) => {
      const updated = selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name];
      onChange(updated);
    },
    [selected, onChange]
  );

  if (!loaded || allDocTypes.length === 0) return null;

  const count = selectedSet.size;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3 w-3" />
        {label}
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1 h-8 px-2 text-sm rounded border border-input bg-background hover:bg-muted transition-colors w-full min-w-0",
              count > 0 && "border-primary/50 bg-primary/5"
            )}
          >
            {count > 0 ? (
              <span className="truncate font-medium">
                {count} document type{count !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span className="truncate text-muted-foreground">Select document types...</span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-auto" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          {/* Scope tabs */}
          {showScopeTabs && (
            <div className="flex border-b px-1 pt-1 gap-0.5">
              {SCOPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setScopeFilter(tab.key)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-t transition-colors",
                    scopeFilter === tab.key
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <Command>
            <CommandInput placeholder="Search document types..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                No matches.
              </CommandEmpty>
              {grouped.map(({ folder, items }) => (
                <CommandGroup
                  key={folder}
                  heading={folder}
                  className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {items.map((dt) => (
                    <CommandItem
                      key={dt.id}
                      value={dt.name}
                      onSelect={() => handleToggle(dt.name)}
                      className="text-xs gap-2"
                    >
                      <Check
                        className={cn(
                          "h-3 w-3 shrink-0",
                          selectedSet.has(dt.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{dt.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Show selected items as tags */}
      {count > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => handleToggle(name)}
              title="Click to remove"
            >
              {name}
              <span className="text-primary/50">&times;</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
