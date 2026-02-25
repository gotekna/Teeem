"use client";

import { Button } from "@/components/ui/button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Calendar, Plus, Save, Upload } from "lucide-react";
import type { CustomQuoteSummary, CustomQuoteTemplate } from "./types";

interface CustomQuoteSetupProps {
  jobId: string | number;
  quotes: CustomQuoteSummary[];
  templates: CustomQuoteTemplate[];
  templatesLoading: boolean;
  onApplyTemplate: (templateId: number) => void;
  onCreateBlank: () => void;
  onPopulateFromSchedule: () => void;
  onSelectQuote: (quoteId: number) => void;
  onSaveAsTemplate: () => void;
  onOverwriteTemplate: () => void;
  activeTemplateName: string | null;
  hasActiveQuote: boolean;
  hasLinkedTemplate: boolean;
}

export function CustomQuoteSetup({
  quotes,
  templates,
  templatesLoading,
  onApplyTemplate,
  onCreateBlank,
  onPopulateFromSchedule,
  onSelectQuote,
  onSaveAsTemplate,
  onOverwriteTemplate,
  hasActiveQuote,
  hasLinkedTemplate,
}: CustomQuoteSetupProps) {
  const templateItems: ComboboxItem[] = templates.map((t) => ({
    id: String(t.id),
    label: `${t.name} (${t.lineCount} lines)`,
  }));

  const quoteItems: ComboboxItem[] = quotes.map((q) => ({
    id: String(q.id),
    label: `${q.name} (${q.status})`,
  }));

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
      {/* Existing quotes selector */}
      {quotes.length > 0 && (
        <ComboboxDropdown
          items={quoteItems}
          onSelect={(item) => onSelectQuote(Number(item.id))}
          placeholder="Select existing quote..."
          className="w-64"
        />
      )}

      {/* Template picker - auto-applies on select */}
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
    </div>
  );
}
