"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import type { TableColumn } from "./types";

interface CreateRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foundationId: number;
  tableName: string;
  columns: TableColumn[];
  onSuccess?: () => void;
}

// Columns to exclude from the form (system-managed or UI-only)
const EXCLUDED_COLUMNS = ["id", "created_at", "updated_at", "actions", "select"];

export function CreateRecordDialog({
  open,
  onOpenChange,
  foundationId,
  tableName,
  columns,
  onSuccess,
}: CreateRecordDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Filter and sort columns
  const { visibleColumns, hiddenColumns } = useMemo(() => {
    const filtered = columns
      .filter((col) => !EXCLUDED_COLUMNS.includes(col.key))
      .filter((col) => !col.system) // Exclude system columns
      .filter((col) => col.label); // Exclude columns without labels (UI-only columns)

    // Show first 8 columns by default, rest are hidden
    const visible = filtered.slice(0, 8);
    const hidden = filtered.slice(8);

    return { visibleColumns: visible, hiddenColumns: hidden };
  }, [columns]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData({});
      setShowMoreFields(false);
    }
  }, [open]);

  // Render form field based on column type
  const renderFormField = (col: TableColumn) => {
    const value = formData[col.key];
    const label = col.label || col.key;

    switch (col.column_type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={col.key}
              checked={value === true}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, [col.key]: checked === true })
              }
            />
            <Label htmlFor={col.key} className="cursor-pointer">
              {label}
            </Label>
          </div>
        );

      case "multiple_lines_text":
      case "long_text":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <textarea
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        );

      case "number":
      case "whole_number":
      case "currency":
      case "percentage":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="number"
              step={col.column_type === "whole_number" ? "1" : "any"}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
            />
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="date"
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
            />
          </div>
        );

      case "date_and_time":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="datetime-local"
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
            />
          </div>
        );

      case "email":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="email"
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="email@example.com"
            />
          </div>
        );

      case "url":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="url"
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="https://"
            />
          </div>
        );

      case "phone":
      case "mobile":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              type="tel"
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="+61 400 000 000"
            />
          </div>
        );

      case "color_picker":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={col.key}
                type="color"
                value={String(value || "#000000")}
                onChange={(e) =>
                  setFormData({ ...formData, [col.key]: e.target.value })
                }
                className="w-16 h-10 p-1"
              />
              <Input
                value={String(value || "")}
                onChange={(e) =>
                  setFormData({ ...formData, [col.key]: e.target.value })
                }
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
        );

      // Australian types
      case "abn":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="XX XXX XXX XXX"
              maxLength={14}
            />
          </div>
        );

      case "acn":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="XXX XXX XXX"
              maxLength={11}
            />
          </div>
        );

      case "bsb":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="XXX-XXX"
              maxLength={7}
            />
          </div>
        );

      case "postcode":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
              placeholder="4000"
              maxLength={4}
            />
          </div>
        );

      // Default text input
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={col.key}>{label}</Label>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) =>
                setFormData({ ...formData, [col.key]: e.target.value })
              }
            />
          </div>
        );
    }
  };

  // Handle form submission
  const handleCreate = async () => {
    setSaving(true);
    try {
      // Build the payload - use foundation's database_table_name for the key
      const payload = {
        record: formData,
      };

      await api.post(`/api/v1/foundations/${foundationId}/records`, payload);

      toast({
        title: "Success",
        description: "Record created successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create record:", error);
      toast({
        title: "Error",
        description: "Failed to create record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Record</DialogTitle>
          <DialogDescription>
            Create a new record in {tableName}.
          </DialogDescription>
        </DialogHeader>

        {/* Visible Fields */}
        <div className="grid grid-cols-2 gap-4 py-4">
          {visibleColumns.map((col) => (
            <div key={col.key}>{renderFormField(col)}</div>
          ))}
        </div>

        {/* Hidden Fields Toggle */}
        {hiddenColumns.length > 0 && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowMoreFields(!showMoreFields)}
              className="w-full justify-between"
            >
              <span>Show Hidden Fields ({hiddenColumns.length})</span>
              {showMoreFields ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showMoreFields && (
              <div className="grid grid-cols-2 gap-4 pt-4">
                {hiddenColumns.map((col) => (
                  <div key={col.key}>{renderFormField(col)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Item
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateRecordDialog;
