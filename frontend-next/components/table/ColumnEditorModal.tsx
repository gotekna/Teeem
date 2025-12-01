"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  X,
  Loader2,
  Save,
  Lock,
  Info,
  RefreshCw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FolderOpen,
  Database,
  FileText,
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
      `Warning: You are changing the type from "${editedColumn.data_type}" to "${newColumnType}".\n\n` +
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
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Edit Column: {column.label}
                {isSystemGenerated && (
                  <Badge variant="secondary" className="ml-2">
                    <Lock className="h-3 w-3 mr-1" />
                    System
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {metadata.icon} {metadata.label} • {(column as any).required ? "Required" : "Optional"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "type")} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-6">
            <TabsList className="h-10">
              <TabsTrigger value="info" className="gap-2">
                <Info className="h-4 w-4" />
                Column Info
              </TabsTrigger>
              <TabsTrigger value="type" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Change Type
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="info" className="m-0 space-y-6">
                {/* System Generated Warning */}
                {isSystemGenerated && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        System-Generated Column
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        This column is automatically managed by the database. Modifying system columns is not recommended.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Column Name */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Column Name
                    </CardTitle>
                    <CardDescription>Display name and database identifier</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input
                        value={editedColumn.name}
                        onChange={(e) =>
                          setEditedColumn((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Column display name"
                      />
                      <p className="text-xs text-muted-foreground">
                        The name shown to users in the interface
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Column Name (Database)</Label>
                      <Input
                        value={editedColumn.column_name}
                        disabled
                        className="font-mono bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Database column name cannot be changed after creation
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Column Alignment */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlignLeft className="h-4 w-4" />
                      Column Alignment
                    </CardTitle>
                    <CardDescription>Control text alignment for headers and data cells</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Header Alignment</Label>
                      <div className="flex gap-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <Button
                            key={align}
                            type="button"
                            variant={editedColumn.header_align === align ? "default" : "outline"}
                            className="flex-1"
                            onClick={() =>
                              setEditedColumn((prev) => ({ ...prev, header_align: align }))
                            }
                          >
                            {align === "left" && <AlignLeft className="h-4 w-4 mr-2" />}
                            {align === "center" && <AlignCenter className="h-4 w-4 mr-2" />}
                            {align === "right" && <AlignRight className="h-4 w-4 mr-2" />}
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Alignment</Label>
                      <div className="flex gap-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <Button
                            key={align}
                            type="button"
                            variant={editedColumn.data_align === align ? "default" : "outline"}
                            className="flex-1"
                            onClick={() =>
                              setEditedColumn((prev) => ({ ...prev, data_align: align }))
                            }
                          >
                            {align === "left" && <AlignLeft className="h-4 w-4 mr-2" />}
                            {align === "center" && <AlignCenter className="h-4 w-4 mr-2" />}
                            {align === "right" && <AlignRight className="h-4 w-4 mr-2" />}
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Currency columns default to right alignment
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Column Group */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Column Group
                    </CardTitle>
                    <CardDescription>Group columns together in the visibility panel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Group Name</Label>
                      <Input
                        value={editedColumn.column_group}
                        onChange={(e) =>
                          setEditedColumn((prev) => ({ ...prev, column_group: e.target.value }))
                        }
                        placeholder="e.g., Contact Info, Financial, System"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty for &quot;Other&quot; group
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Column Type Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Column Type
                    </CardTitle>
                    <CardDescription>Data type and validation rules</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <span className="text-xl">{metadata.icon}</span>
                      <div>
                        <p className="font-medium">{metadata.label}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          SQL: {metadata.sqlType}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Validation</Label>
                        <p className="text-sm mt-1">{metadata.validation}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Example</Label>
                        <p className="text-sm mt-1 font-mono">{metadata.example}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Used For</Label>
                        <p className="text-sm mt-1">{metadata.usedFor}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="type" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Change Column Type
                    </CardTitle>
                    <CardDescription>Convert this column to a different data type</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Warning:</strong> Changing column types may result in data loss if the types are incompatible.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Current Type</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-lg">{metadata.icon}</span>
                        <span className="font-medium">{metadata.label}</span>
                        <span className="text-sm text-muted-foreground">({editedColumn.data_type})</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>New Type</Label>
                      <Select value={newColumnType} onValueChange={setNewColumnType}>
                        <SelectTrigger>
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
                      variant="destructive"
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Convert Column Type
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* Columns Sidebar */}
            <div className="w-64 border-l bg-muted/30 overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Available Columns
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {allColumns.length} columns in this table
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {allColumns.map((col) => (
                    <div
                      key={col.key}
                      className={cn(
                        "p-2 rounded-md text-sm",
                        col.key === column?.key
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="font-medium truncate">
                        {col.label}
                        {col.key === column?.key && (
                          <span className="ml-1 text-xs text-primary">(current)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        [{col.key}]
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {col.column_type || "text"}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {activeTab === "info" && hasChanges() && (
                <span className="text-orange-600 dark:text-orange-400">Unsaved changes</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {activeTab === "info" && (
                <Button onClick={handleSave} disabled={saving || !hasChanges()}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
