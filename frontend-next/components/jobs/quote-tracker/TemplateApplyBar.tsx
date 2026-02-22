"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { FileText, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import type { QuoteTemplateOption } from "./types";

interface TemplateApplyBarProps {
  jobId: string | number;
  hasExistingQuotes: boolean;
  onApplied: () => void;
}

export function TemplateApplyBar({ jobId, hasExistingQuotes, onApplied }: TemplateApplyBarProps) {
  const [templates, setTemplates] = useState<QuoteTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: QuoteTemplateOption[] }>(
        "/api/v1/quote_templates"
      );
      setTemplates(response?.data || []);
    } catch (err) {
      console.error("[TemplateApplyBar] Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleApply = async () => {
    if (!selectedId) return;
    try {
      setApplying(true);
      const response = await api.post<{ success: boolean; data: { rowsCreated: number; templateName: string }; message: string }>(
        `/api/v1/jobs/${jobId}/apply_quote_template`,
        { template_id: selectedId }
      );
      if (response?.data) {
        toast.success(response.message || `Applied template — ${response.data.rowsCreated} rows created`);
        setSelectedId(null);
        onApplied();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to apply template";
      toast.error(message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) return null;
  if (templates.length === 0) return null;

  const items: ComboboxItem[] = templates.map(t => ({
    id: String(t.id),
    label: `${t.name} (${t.tradeCount} tasks, ${t.supplierCount} suppliers)`,
  }));

  const selectedTemplate = templates.find(t => t.id === selectedId);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium shrink-0">
        {hasExistingQuotes ? "Apply another template:" : "Apply a quote template:"}
      </span>
      <ComboboxDropdown
        items={items}
        selectedItem={selectedId ? items.find(i => i.id === String(selectedId)) : undefined}
        onSelect={(item) => setSelectedId(Number(item.id))}
        placeholder="Select template..."
        searchPlaceholder="Search templates..."
        emptyResults="No templates found"
        className="w-72"
      />
      {selectedId && (
        <Button size="sm" onClick={handleApply} disabled={applying}>
          {applying ? <Spinner className="h-4 w-4 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
          Apply
        </Button>
      )}
    </div>
  );
}
