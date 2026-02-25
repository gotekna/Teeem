"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Calendar, Plus, Save } from "lucide-react";
import { useCustomQuoteTemplates } from "./useCustomQuote";
import type { CustomQuoteSummary } from "./types";

interface CustomQuoteSetupProps {
  jobId: string | number;
  quotes: CustomQuoteSummary[];
  onApplyTemplate: (templateId: number) => void;
  onCreateBlank: () => void;
  onPopulateFromSchedule: () => void;
  onSelectQuote: (quoteId: number) => void;
  onSaveAsTemplate: () => void;
  hasActiveQuote: boolean;
}

export function CustomQuoteSetup({
  jobId,
  quotes,
  onApplyTemplate,
  onCreateBlank,
  onPopulateFromSchedule,
  onSelectQuote,
  onSaveAsTemplate,
  hasActiveQuote,
}: CustomQuoteSetupProps) {
  const { templates, loading, fetchTemplates } = useCustomQuoteTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<ComboboxItem | undefined>();

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

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

      {/* Template picker */}
      <ComboboxDropdown
        items={templateItems}
        selectedItem={selectedTemplate}
        onSelect={(item) => setSelectedTemplate(item)}
        placeholder="Template..."
        className="w-64"
        disabled={loading}
      />

      <Button
        size="sm"
        onClick={() => {
          if (selectedTemplate) {
            onApplyTemplate(Number(selectedTemplate.id));
          }
        }}
        disabled={!selectedTemplate}
      >
        Apply Template
      </Button>

      <Button size="sm" variant="outline" onClick={onCreateBlank}>
        <Plus className="h-4 w-4 mr-1" />
        Blank Quote
      </Button>

      <Button size="sm" variant="outline" onClick={onPopulateFromSchedule}>
        <Calendar className="h-4 w-4 mr-1" />
        From Schedule
      </Button>

      {hasActiveQuote && (
        <Button size="sm" variant="outline" onClick={onSaveAsTemplate}>
          <Save className="h-4 w-4 mr-1" />
          Save as Template
        </Button>
      )}
    </div>
  );
}
