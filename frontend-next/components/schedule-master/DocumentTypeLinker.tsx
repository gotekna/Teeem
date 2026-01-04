"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LinkedDocumentType {
  id?: number;
  document_type_id: number;
  document_type_name?: string;
  lag_days: number;
  assigned_role: string | null;
  _destroy?: boolean;
}

export interface DocumentType {
  id: number;
  name: string;
  display_name: string;
}

interface DocumentTypeLinkerProps {
  linkedDocumentTypes: LinkedDocumentType[];
  documentTypes: DocumentType[];
  onChange: (linkedDocumentTypes: LinkedDocumentType[]) => void;
}

// SSoT: Use User::ASSIGNABLE_ROLES from backend
const ASSIGNABLE_ROLES = [
  { value: "project_manager", label: "Project Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "accounts", label: "Accounts" },
  { value: "admin", label: "Admin" },
  { value: "estimator", label: "Estimator" },
];

export function DocumentTypeLinker({
  linkedDocumentTypes,
  documentTypes,
  onChange,
}: DocumentTypeLinkerProps) {
  // Filter out deleted items for display
  const visibleItems = linkedDocumentTypes.filter((dt) => !dt._destroy);

  const handleAdd = () => {
    if (documentTypes.length === 0) return;

    // Find a document type that isn't already linked
    const alreadyLinkedIds = new Set(visibleItems.map((dt) => dt.document_type_id));
    const availableType = documentTypes.find((dt) => !alreadyLinkedIds.has(dt.id));

    if (!availableType) {
      // All types already linked
      return;
    }

    onChange([
      ...linkedDocumentTypes,
      {
        document_type_id: availableType.id,
        document_type_name: availableType.display_name || availableType.name,
        lag_days: 0,
        assigned_role: null,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const item = linkedDocumentTypes[index];
    if (item.id) {
      // Mark existing record for deletion
      const updated = [...linkedDocumentTypes];
      updated[index] = { ...item, _destroy: true };
      onChange(updated);
    } else {
      // Remove unsaved item
      onChange(linkedDocumentTypes.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index: number, field: keyof LinkedDocumentType, value: unknown) => {
    const updated = [...linkedDocumentTypes];
    updated[index] = { ...updated[index], [field]: value };

    // If document_type_id changed, update the name
    if (field === "document_type_id") {
      const docType = documentTypes.find((dt) => dt.id === value);
      updated[index].document_type_name = docType?.display_name || docType?.name || "";
    }

    onChange(updated);
  };

  // Get available document types (not already linked)
  const getAvailableDocTypes = (currentId: number) => {
    const linkedIds = new Set(
      visibleItems.map((dt) => dt.document_type_id).filter((id) => id !== currentId)
    );
    return documentTypes.filter((dt) => !linkedIds.has(dt.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Document Types (GET Tasks)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={documentTypes.length === 0 || visibleItems.length >= documentTypes.length}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No document types linked. Add document types to spawn &quot;GET&quot; tasks on completion.
        </p>
      ) : (
        <div className="space-y-3">
          {linkedDocumentTypes.map((item, index) => {
            if (item._destroy) return null;

            return (
              <div
                key={item.id || `new-${index}`}
                className="flex items-end gap-2 p-3 border rounded-md bg-muted/30"
              >
                {/* Document Type Selector */}
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Document Type</Label>
                  <Select
                    value={String(item.document_type_id)}
                    onValueChange={(value) =>
                      handleChange(index, "document_type_id", parseInt(value))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDocTypes(item.document_type_id).map((dt) => (
                        <SelectItem key={dt.id} value={String(dt.id)}>
                          {dt.display_name || dt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lag Days */}
                <div className="w-24 space-y-1">
                  <Label className="text-xs text-muted-foreground">Lag Days</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.lag_days}
                    onChange={(e) =>
                      handleChange(index, "lag_days", parseInt(e.target.value) || 0)
                    }
                    className="h-9"
                  />
                </div>

                {/* Assigned Role */}
                <div className="w-40 space-y-1">
                  <Label className="text-xs text-muted-foreground">Assigned Role</Label>
                  <Select
                    value={item.assigned_role || "none"}
                    onValueChange={(value) =>
                      handleChange(index, "assigned_role", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  className="h-9 w-9 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        When this task is completed, a &quot;GET - [Document Type]&quot; task will be created for each linked document type.
        Lag days specifies the number of working days after completion.
      </p>
    </div>
  );
}
