"use client";

import * as React from "react";
import { Paperclip } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { api } from "@/lib/api";

interface DocumentTypePickerProps {
  /** Currently selected document type names */
  selected: string[];
  /** Called when selection changes */
  onChange: (types: string[]) => void;
  /** Optional pre-loaded document types (skips API fetch if provided) */
  documentTypes?: { id: number; name: string }[];
  /** Label text (defaults to "Attach Document Types") */
  label?: string;
}

/**
 * DocumentTypePicker - Shared component for selecting job document types.
 *
 * Self-loading: fetches /api/v1/document_types?scope=job on mount unless
 * documentTypes prop is provided. Used by both QuoteTemplatesTab and
 * TenderSectionsTab.
 */
export function DocumentTypePicker({
  selected,
  onChange,
  documentTypes: externalDocTypes,
  label = "Attach Document Types",
}: DocumentTypePickerProps) {
  const [docTypes, setDocTypes] = React.useState<{ id: number; name: string }[]>(
    externalDocTypes || []
  );
  const [loaded, setLoaded] = React.useState(!!externalDocTypes);

  React.useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: Array<{ id: number; name: string }>;
        }>("/api/v1/document_types?scope=job");
        if (!cancelled) {
          setDocTypes((res?.data || []).map((dt) => ({ id: dt.id, name: dt.name })));
          setLoaded(true);
        }
      } catch (err) {
        console.error("[DocumentTypePicker] Failed to load document types:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [loaded]);

  if (!loaded || docTypes.length === 0) return null;

  const selectedSet = new Set(selected);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3 w-3" />
        {label}
      </Label>
      <MultiSelectFilter
        values={docTypes.map((dt) => dt.name)}
        selected={selectedSet}
        onToggle={(name) => {
          const updated = selected.includes(name)
            ? selected.filter((n) => n !== name)
            : [...selected, name];
          onChange(updated);
        }}
        placeholder="Select document types..."
        label="Doc types"
      />
    </div>
  );
}
