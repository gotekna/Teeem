"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DocumentTypePicker } from "@/components/settings/DocumentTypePicker";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface TenderDocumentTemplate {
  id: number;
  name: string;
  defaultDocumentTypes: string[];
  isDefault: boolean;
  isActive: boolean;
}

export function TenderDocumentTemplatesTab() {
  const [template, setTemplate] = useState<TenderDocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: TenderDocumentTemplate | null }>(
        "/api/v1/tender_document_templates/default"
      );
      const data = response?.data;
      if (data) {
        setTemplate(data);
        setSelectedTypes(data.defaultDocumentTypes || []);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        tender_document_template: {
          name: "Default Tender Template",
          default_document_types: selectedTypes,
        },
      };

      if (template) {
        await api.patch(`/api/v1/tender_document_templates/${template.id}`, payload);
      } else {
        const response = await api.post<{ success: boolean; data: TenderDocumentTemplate }>(
          "/api/v1/tender_document_templates",
          payload
        );
        if (response?.data) setTemplate(response.data);
      }
      toast.success("Default document types saved");
    } catch (err) {
      console.error("[TenderDocumentTemplatesTab] Save failed:", err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Tender Document Attachments</h2>
        <p className="text-sm text-muted-foreground">
          Select document types to auto-attach when sending tender documents.
          If the job has documents of these types, they will be pre-selected.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <DocumentTypePicker
            selected={selectedTypes}
            onChange={setSelectedTypes}
            label="Default Document Types"
          />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Spinner className="h-4 w-4 mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
