"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Loader2,
  Save,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { getColumnTypeEmoji, COLUMN_TYPES } from "@/lib/column-types";
import type { TableColumn } from "./types";

interface ColumnEditorModalProps {
  isOpen: boolean;
  column: TableColumn | null;
  foundationId: number | null;
  allColumns: TableColumn[];
  onClose: () => void;
  onUpdate: () => void;
}

interface EditedColumn {
  name: string;
  column_name: string;
  data_type: string;
  header_align: "left" | "center" | "right";
  data_align: "left" | "center" | "right";
  column_group: string;
}

// Get column metadata from COLUMN_TYPES
const getColumnMetadata = (columnType: string) => {
  const columnTypeDef = COLUMN_TYPES.find(
    (type) => type.value === columnType
  );

  if (columnTypeDef) {
    return {
      sqlType: columnTypeDef.sqlType || "Unknown",
      validation: columnTypeDef.validationRules || "No validation rules defined",
      usedFor: columnTypeDef.usedFor || "No description available",
      example: columnTypeDef.example || "No example available",
      label: columnTypeDef.label || columnType,
      icon: getColumnTypeEmoji(columnType),
    };
  }

  return {
    sqlType: "Unknown",
    validation: "No validation rules defined",
    usedFor: "No description available",
    example: "No example available",
    label: columnType,
    icon: getColumnTypeEmoji(columnType),
  };
};

export function ColumnEditorModal({
  isOpen,
  column,
  foundationId,
  allColumns,
  onClose,
  onUpdate,
}: ColumnEditorModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"info" | "type">("info");
  const [editedColumn, setEditedColumn] = useState<EditedColumn>({
    name: "",
    column_name: "",
    data_type: "text",
    header_align: "left",
    data_align: "left",
    column_group: "",
  });
  const [saving, setSaving] = useState(false);
  const [newColumnType, setNewColumnType] = useState("");

  // System-generated columns
  const isSystemGenerated = column
    ? ["id", "created_at", "updated_at"].includes(column.key)
    : false;

  // Sync state when column changes
  useEffect(() => {
    if (column) {
      setEditedColumn({
        name: column.label || "",
        column_name: column.key || "",
        data_type: column.column_type || "text",
        header_align: (column as any).header_align || "left",
        data_align: (column as any).data_align || "left",
        column_group: (column as any).column_group || "",
      });
      setNewColumnType(column.column_type || "text");
    }
  }, [column]);

  const hasChanges = useCallback(() => {
    if (!column) return false;
    return (
      editedColumn.name !== column.label ||
      editedColumn.header_align !== ((column as any).header_align || "left") ||
      editedColumn.data_align !== ((column as any).data_align || "left") ||
      editedColumn.column_group !== ((column as any).column_group || "")
    );
  }, [column, editedColumn]);

  const handleSave = async () => {
    if (!column || !foundationId) return;

    // Validate
    if (!editedColumn.name.trim()) {
      toast({
        title: "Error",
        description: "Column name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const columnId = column.id;
      if (!columnId) {
        throw new Error("Column ID not found");
      }

      await api.patch(`/api/v1/foundations/${foundationId}/columns/${columnId}`, {
        column: {
          name: editedColumn.name,
          column_group: editedColumn.column_group || null,
          header_align: editedColumn.header_align,
          data_align: editedColumn.data_align,
        },
      });

      toast({ title: "Success", description: "Column updated successfully" });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating column:", error);
      toast({
        title: "Error",
        description: "Failed to update column",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = async () => {
    if (!column || !foundationId || !newColumnType) return;
    if (newColumnType === editedColumn.data_type) {
      toast({
        title: "No change",
        description: "Column type is already set to this value",
      });
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Warning: You are changing the type from "${editedColumn.data_type}" to "${newColumnType}".\n\n` +
        "This will rebuild the database table and may result in data loss if the types are incompatible.\n\n" +
        "Are you sure you want to continue?"
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const columnId = column.id;
      if (!columnId) throw new Error("Column ID not found");

      await api.patch(`/api/v1/foundations/${foundationId}/columns/${columnId}`, {
        column: {
          column_type: newColumnType,
        },
      });

      toast({ title: "Success", description: "Column type changed successfully" });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error changing column type:", error);
      toast({
        title: "Error",
        description: "Failed to change column type",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!column) return null;

  const metadata = getColumnMetadata(editedColumn.data_type);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Header - Purple gradient */}
        <div
          className={cn(
            "px-6 py-4 bg-gradient-to-r flex-shrink-0",
            isSystemGenerated
              ? "from-red-600 to-red-700"
              : "from-purple-500 to-pink-600"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">
                  Edit Column: {column.label}
                </h2>
                {isSystemGenerated && (
                  <Badge
                    variant="secondary"
                    className="bg-white/20 text-white border-white/30"
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    System Generated
                  </Badge>
                )}
              </div>
              <p
                className={cn(
                  "text-sm mt-1",
                  isSystemGenerated ? "text-red-100" : "text-purple-100"
                )}
              >
                {metadata.icon} {metadata.label} •{" "}
                {(column as any).required ? "Required" : "Optional"}
                {isSystemGenerated && " • Auto-managed by database"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-muted/30 px-6 flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab("info")}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === "info"
                  ? "border-purple-500 text-purple-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mr-2">ℹ️</span>
              Column Info
            </button>
            <button
              onClick={() => setActiveTab("type")}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === "type"
                  ? "border-purple-500 text-purple-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mr-2">🔄</span>
              Change Type
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "info" && (
              <div className="space-y-6">
                {/* System Generated Warning */}
                {isSystemGenerated && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">🔒</div>
                      <div>
                        <h3 className="font-bold text-red-900 dark:text-red-100">
                          System-Generated Column
                        </h3>
                        <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                          This column is automatically managed by the database.
                          While you can view its configuration, modifying system
                          columns is not recommended.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Column Name Section - Blue */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">✏️</div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        Column Name
                      </h3>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Display name and database identifier
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Display Name
                      </Label>
                      <Input
                        value={editedColumn.name}
                        onChange={(e) =>
                          setEditedColumn((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="mt-2 bg-white dark:bg-gray-700"
                        placeholder="Column display name"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        The name shown to users in the interface
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Column Name (Database)
                      </Label>
                      <div className="mt-2 px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-lg border-2 border-gray-300 dark:border-gray-500 font-mono text-sm text-gray-700 dark:text-gray-300">
                        {editedColumn.column_name}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Database column name cannot be changed after creation
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column Alignment Section - Yellow */}
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-6 border-2 border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">⚡</div>
                    <div>
                      <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                        Column Alignment
                      </h3>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Control text alignment for headers and data cells
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Header Alignment */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Header Alignment
                      </Label>
                      <div className="flex gap-2 mt-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() =>
                              setEditedColumn((prev) => ({
                                ...prev,
                                header_align: align,
                              }))
                            }
                            className={cn(
                              "flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all",
                              editedColumn.header_align === align
                                ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                            )}
                          >
                            <span className="mr-2">
                              {align === "left" && "⬅️"}
                              {align === "center" && "↔️"}
                              {align === "right" && "➡️"}
                            </span>
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Controls how the column header text is aligned
                      </p>
                    </div>

                    {/* Data Alignment */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Data Alignment
                      </Label>
                      <div className="flex gap-2 mt-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() =>
                              setEditedColumn((prev) => ({
                                ...prev,
                                data_align: align,
                              }))
                            }
                            className={cn(
                              "flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all",
                              editedColumn.data_align === align
                                ? "bg-green-500 text-white border-green-600 shadow-lg"
                                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400"
                            )}
                          >
                            <span className="mr-2">
                              {align === "left" && "⬅️"}
                              {align === "center" && "↔️"}
                              {align === "right" && "➡️"}
                            </span>
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Controls how the data cell content is aligned (currency
                        columns default to right)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column Group Section - Teal */}
                <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-xl p-6 border-2 border-teal-200 dark:border-teal-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">📁</div>
                    <div>
                      <h3 className="text-lg font-bold text-teal-900 dark:text-teal-100">
                        Column Group
                      </h3>
                      <p className="text-xs text-teal-700 dark:text-teal-300">
                        Group columns together in the visibility panel
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Group Name
                    </Label>
                    <Input
                      value={editedColumn.column_group}
                      onChange={(e) =>
                        setEditedColumn((prev) => ({
                          ...prev,
                          column_group: e.target.value,
                        }))
                      }
                      className="mt-2 bg-white dark:bg-gray-700"
                      placeholder="e.g., Contact Info, Financial, System"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Columns with the same group name will be grouped together.
                      Leave empty for &quot;Other&quot; group.
                    </p>
                  </div>
                </div>

                {/* Column Type Display - Purple */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">🎯</div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">
                        Column Type
                      </h3>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Data type and validation rules
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Current Type
                    </Label>
                    <div className="mt-2 px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-lg border-2 border-gray-300 dark:border-gray-500 font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="text-xl">{metadata.icon}</span>
                      <span>{metadata.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use the &quot;Change Type&quot; tab to convert column type (requires data migration)
                    </p>
                  </div>
                </div>

                {/* SQL Type & Metadata - Green */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">🗄️</div>
                    <div>
                      <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                        SQL Type & Metadata
                      </h3>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Database implementation details
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Current Type Display */}
                    <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border-2 border-green-300 dark:border-green-600">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{metadata.icon}</span>
                        <span className="text-base font-bold text-green-900 dark:text-green-100">
                          {metadata.label}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-green-700 dark:text-green-300">
                        SQL Type: {metadata.sqlType}
                      </p>
                    </div>

                    {/* Validation Rules */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Validation Rules
                      </Label>
                      <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-700 text-sm text-orange-900 dark:text-orange-100">
                        {metadata.validation}
                      </div>
                    </div>

                    {/* Example */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Example
                      </Label>
                      <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-700 text-sm font-mono text-purple-900 dark:text-purple-100">
                        {metadata.example}
                      </div>
                    </div>

                    {/* Used For */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Used For
                      </Label>
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700 text-sm text-blue-900 dark:text-blue-100">
                        {metadata.usedFor}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "type" && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">🔄</div>
                    <div>
                      <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100">
                        Change Column Type
                      </h3>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Convert this column to a different data type
                      </p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ Warning:</strong> Changing column types may result in
                      data loss if the types are incompatible. The database table
                      will be rebuilt.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Current Type</Label>
                      <div className="mt-2 p-3 bg-white dark:bg-gray-700 rounded-lg border flex items-center gap-2">
                        <span className="text-xl">{metadata.icon}</span>
                        <span className="font-medium">{metadata.label}</span>
                        <span className="text-sm text-muted-foreground">
                          ({editedColumn.data_type})
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-semibold">New Type</Label>
                      <Select value={newColumnType} onValueChange={setNewColumnType}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select new type" />
                        </SelectTrigger>
                        <SelectContent>
                          {COLUMN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{getColumnTypeEmoji(type.value)}</span>
                                <span>{type.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleTypeChange}
                      disabled={saving || newColumnType === editedColumn.data_type}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Converting...
                        </>
                      ) : (
                        <>
                          🔄 Convert Column Type
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columns Sidebar */}
          <div className="w-72 border-l bg-gray-50 dark:bg-gray-900/30 overflow-hidden flex flex-col flex-shrink-0">
            <div className="p-4 border-b">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>📊</span> Available Columns
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {allColumns.length} columns in this table
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {allColumns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      col.key === column?.key
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm font-medium truncate",
                            col.key === column?.key &&
                              "text-purple-900 dark:text-purple-100"
                          )}
                        >
                          {col.label}
                          {col.key === column?.key && (
                            <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">
                              (current)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          [{col.key}]
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {col.column_type || "text"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center flex-shrink-0">
          <div className="text-sm">
            {activeTab === "info" && hasChanges() ? (
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                Unsaved changes
              </span>
            ) : (
              <span className="text-muted-foreground">No changes</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {activeTab === "info" && (
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges()}
                className={cn(
                  "bg-green-600 hover:bg-green-700",
                  !hasChanges() && "opacity-50"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
