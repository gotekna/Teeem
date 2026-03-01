"use client";

import { Button } from "@/components/ui/button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Calendar, Plus, Save, Trash2, Upload } from "lucide-react";
import type { CustomQuoteTemplate } from "./types";

interface CustomQuoteSetupProps {
  jobId: string | number;
  templates: CustomQuoteTemplate[];
  templatesLoading: boolean;
  onApplyTemplate: (templateId: number) => void;
  onCreateBlank: () => void;
  onPopulateFromSchedule: () => void;
  onSaveAsTemplate: () => void;
  onOverwriteTemplate: () => void;
  onDeleteQuote: () => void;
  activeTemplateName: string | null;
  hasActiveQuote: boolean;
  hasLinkedTemplate: boolean;
}

export function CustomQuoteSetup({
  templates,
  templatesLoading,
  onApplyTemplate,
  onCreateBlank,
  onPopulateFromSchedule,
  onSaveAsTemplate,
  onOverwriteTemplate,
  onDeleteQuote,
  hasActiveQuote,
  hasLinkedTemplate,
}: CustomQuoteSetupProps) {
  const templateItems: ComboboxItem[] = templates.map((t) => ({
    id: String(t.id),
    label: `${t.name} (${t.lineCount} lines)`,
  }));

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
      {/* Only show create options when no quote exists yet */}
      {!hasActiveQuote && (
        <>
          <ComboboxDropdown
            items={templateItems}
            onSelect={(item) => onApplyTemplate(Number(item.id))}
            placeholder="Apply template..."
            className="w-64"
            disabled={templatesLoading}
          />

          <Button size="sm" variant="outline" onClick={onCreateBlank}>
            <Plus className="h-4 w-4 mr-1" />
            Blank Quote
          </Button>

          <Button size="sm" variant="outline" onClick={onPopulateFromSchedule}>
            <Calendar className="h-4 w-4 mr-1" />
            From Schedule
          </Button>
        </>
      )}

      {hasActiveQuote && hasLinkedTemplate && (
        <Button size="sm" variant="outline" onClick={onOverwriteTemplate}>
          <Upload className="h-4 w-4 mr-1" />
          Save to Template
        </Button>
      )}

      {hasActiveQuote && (
        <Button size="sm" variant="outline" onClick={onSaveAsTemplate}>
          <Save className="h-4 w-4 mr-1" />
          Save as Template
        </Button>
      )}

      {hasActiveQuote && (
        <div className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (window.confirm("Delete this custom quote? This cannot be undone.")) {
                onDeleteQuote();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Quote
          </Button>
        </div>
      )}
    </div>
  );
}
