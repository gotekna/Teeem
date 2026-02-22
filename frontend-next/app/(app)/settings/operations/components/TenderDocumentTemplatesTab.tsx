"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { RichTextEditorModal } from "@/components/ui/rich-text-editor-modal";
import { FileText, Pencil, Save } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types matching backend JSON response (camelCase)
// ═══════════════════════════════════════════════════════════════════════════

interface TenderDocumentTemplate {
  id: number;
  name: string;
  coverLetterHtml: string | null;
  termsAndConditionsHtml: string | null;
  baseSpecificationHtml: string | null;
  acceptancePageHtml: string | null;
  notesHtml: string | null;
  validityDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type EditorField = "coverLetterHtml" | "termsAndConditionsHtml" | "baseSpecificationHtml" | "acceptancePageHtml" | "notesHtml";

const EDITOR_SECTIONS: { key: EditorField; label: string; description: string }[] = [
  { key: "coverLetterHtml", label: "Cover Letter", description: "Opening letter to the client" },
  { key: "termsAndConditionsHtml", label: "Terms & Conditions", description: "Contract terms and conditions" },
  { key: "baseSpecificationHtml", label: "Base Specification", description: "Standard inclusions and specifications" },
  { key: "acceptancePageHtml", label: "Acceptance Page", description: "Client signature and acceptance section" },
  { key: "notesHtml", label: "Notes", description: "Additional notes or disclaimers" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function TenderDocumentTemplatesTab() {
  const [template, setTemplate] = useState<TenderDocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("Default Tender Template");
  const [validityDays, setValidityDays] = useState(30);
  const [editorValues, setEditorValues] = useState<Record<EditorField, string>>({
    coverLetterHtml: "",
    termsAndConditionsHtml: "",
    baseSpecificationHtml: "",
    acceptancePageHtml: "",
    notesHtml: "",
  });

  // Rich text editor modal state
  const [activeEditor, setActiveEditor] = useState<EditorField | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: TenderDocumentTemplate | null }>(
        "/api/v1/tender_document_templates/default"
      );
      const data = response?.data;
      if (data) {
        setTemplate(data);
        setName(data.name);
        setValidityDays(data.validityDays ?? 30);
        setEditorValues({
          coverLetterHtml: data.coverLetterHtml || "",
          termsAndConditionsHtml: data.termsAndConditionsHtml || "",
          baseSpecificationHtml: data.baseSpecificationHtml || "",
          acceptancePageHtml: data.acceptancePageHtml || "",
          notesHtml: data.notesHtml || "",
        });
      }
    } catch (err) {
      console.error("[TenderDocumentTemplatesTab] Failed to load:", err);
      toast.error("Failed to load tender document template");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        tender_document_template: {
          name: name.trim(),
          validity_days: validityDays,
          cover_letter_html: editorValues.coverLetterHtml || null,
          terms_and_conditions_html: editorValues.termsAndConditionsHtml || null,
          base_specification_html: editorValues.baseSpecificationHtml || null,
          acceptance_page_html: editorValues.acceptancePageHtml || null,
          notes_html: editorValues.notesHtml || null,
        },
      };

      if (template) {
        // Update existing
        const response = await api.patch<{ success: boolean; data: TenderDocumentTemplate }>(
          `/api/v1/tender_document_templates/${template.id}`,
          payload
        );
        if (response?.data) {
          setTemplate(response.data);
        }
        toast.success("Template saved");
      } else {
        // Create new
        const response = await api.post<{ success: boolean; data: TenderDocumentTemplate }>(
          "/api/v1/tender_document_templates",
          payload
        );
        if (response?.data) {
          setTemplate(response.data);
        }
        toast.success("Template created");
      }
    } catch (err) {
      console.error("[TenderDocumentTemplatesTab] Save failed:", err);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Editor modal handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleEditorSave = (value: string) => {
    if (activeEditor) {
      setEditorValues(prev => ({ ...prev, [activeEditor]: value }));
    }
    setActiveEditor(null);
  };

  const getEditorLabel = (key: EditorField): string => {
    return EDITOR_SECTIONS.find(s => s.key === key)?.label || "Edit";
  };

  const hasContent = (key: EditorField): boolean => {
    const val = editorValues[key];
    if (!val) return false;
    // Strip HTML tags to check if there's actual text content
    const text = val.replace(/<[^>]*>/g, "").trim();
    return text.length > 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Tender Document Templates</h2>
        <p className="text-sm text-muted-foreground">
          Configure default content for new tender documents. These defaults are pre-filled when creating a tender in the Job Tender Builder.
        </p>
      </div>

      {/* Template Settings */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Name + Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Default Tender Template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validity-days">Validity (days)</Label>
              <Input
                id="validity-days"
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                Number of days the tender is valid from creation
              </p>
            </div>
          </div>

          {/* HTML Sections */}
          <div className="space-y-3">
            <Label>Document Sections</Label>
            <p className="text-sm text-muted-foreground -mt-1">
              Click edit to open the rich text editor for each section
            </p>
            <div className="space-y-2">
              {EDITOR_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasContent(section.key) && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Has content
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveEditor(section.key)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? (
                <Spinner className="h-4 w-4 mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {template ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rich Text Editor Modal */}
      <RichTextEditorModal
        open={activeEditor !== null}
        onOpenChange={(open) => { if (!open) setActiveEditor(null); }}
        value={activeEditor ? editorValues[activeEditor] : ""}
        onSave={handleEditorSave}
        title={activeEditor ? `Edit ${getEditorLabel(activeEditor)}` : "Edit"}
        placeholder="Start typing..."
        minHeight={400}
      />
    </div>
  );
}
