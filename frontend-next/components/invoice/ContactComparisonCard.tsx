"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface FieldComparison {
  extracted: string | null;
  stored: string | null;
  display_name: string;
  status: "match" | "different" | "add";
}

interface ContactComparisonData {
  fields: Record<string, FieldComparison>;
  has_updates: boolean;
  compared_at: string;
}

interface Supplier {
  id: number;
  display_name: string;
}

interface ContactComparisonCardProps {
  supplierId: number;
  supplierName: string;
  contactComparisonData: ContactComparisonData | null;
  billId: number;
  onContactUpdated?: () => void;
}

export function ContactComparisonCard({
  supplierId,
  supplierName,
  contactComparisonData,
  billId,
  onContactUpdated,
}: ContactComparisonCardProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  if (!contactComparisonData || !contactComparisonData.fields) {
    return null;
  }

  const { fields, has_updates } = contactComparisonData;
  const fieldEntries = Object.entries(fields);

  // Filter to only show fields with data
  const fieldsWithData = fieldEntries.filter(([, field]) => field.extracted);

  if (fieldsWithData.length === 0) {
    return null;
  }

  // Count updateable fields (add or different)
  const updateableFields = fieldsWithData.filter(
    ([, field]) => field.status === "add" || field.status === "different"
  );

  const handleFieldToggle = (fieldKey: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFields(newSelected);
  };

  const handleSelectAll = () => {
    const updateableKeys = updateableFields.map(([key]) => key);
    setSelectedFields(new Set(updateableKeys));
  };

  const handleDeselectAll = () => {
    setSelectedFields(new Set());
  };

  const handleUpdateContact = async () => {
    if (selectedFields.size === 0) return;

    setUpdating(true);
    try {
      const fieldsToUpdate: Record<string, string> = {};
      selectedFields.forEach((fieldKey) => {
        const field = fields[fieldKey];
        if (field?.extracted) {
          fieldsToUpdate[fieldKey] = field.extracted;
        }
      });

      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${supplierId}/update_from_bill`,
        {
          fields: fieldsToUpdate,
          bill_id: billId,
        }
      );

      if (response?.success) {
        toast({
          title: "Contact updated",
          description: `Successfully updated ${selectedFields.size} field(s) for ${supplierName}`,
        });
        setSelectedFields(new Set());
        onContactUpdated?.();
      } else {
        throw new Error(response?.error || "Failed to update contact");
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update contact",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "match":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Match
          </Badge>
        );
      case "add":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Badge>
        );
      case "different":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <RefreshCw className="h-3 w-3 mr-1" />
            Update
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Contact Enrichment
            </CardTitle>
            <CardDescription>
              Compare invoice data with stored contact: {supplierName}
            </CardDescription>
          </div>
          {has_updates && updateableFields.length > 0 && (
            <Badge variant="secondary" className="text-blue-600">
              {updateableFields.length} update{updateableFields.length !== 1 ? "s" : ""} available
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Field comparison table */}
        <div className="rounded-md border">
          <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 text-sm font-medium border-b">
            <div className="col-span-1"></div>
            <div className="col-span-2">Field</div>
            <div className="col-span-4">On Invoice</div>
            <div className="col-span-4">Stored Contact</div>
            <div className="col-span-1">Status</div>
          </div>
          {fieldsWithData.map(([fieldKey, field]) => {
            const isUpdateable = field.status === "add" || field.status === "different";
            const isSelected = selectedFields.has(fieldKey);

            return (
              <div
                key={fieldKey}
                className={`grid grid-cols-12 gap-2 p-3 border-b last:border-b-0 items-center text-sm ${
                  isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <div className="col-span-1">
                  {isUpdateable && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleFieldToggle(fieldKey)}
                    />
                  )}
                </div>
                <div className="col-span-2 font-medium text-muted-foreground">
                  {field.display_name}
                </div>
                <div className="col-span-4">
                  <span className={field.status !== "match" ? "font-medium" : ""}>
                    {field.extracted || "-"}
                  </span>
                </div>
                <div className="col-span-4">
                  {field.stored ? (
                    <span className={field.status === "different" ? "line-through text-muted-foreground" : ""}>
                      {field.stored}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Not set</span>
                  )}
                </div>
                <div className="col-span-1">
                  {getStatusBadge(field.status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {updateableFields.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedFields.size === updateableFields.length}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={selectedFields.size === 0}
                >
                  Deselect All
                </Button>
              </div>
              <Button
                onClick={handleUpdateContact}
                disabled={selectedFields.size === 0 || updating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Contact ({selectedFields.size})
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* All fields match message */}
        {updateableFields.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">All extracted fields match stored contact</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
