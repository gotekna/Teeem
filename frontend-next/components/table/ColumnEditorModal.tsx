"use client";

import { useState, useEffect } from "react";
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
  Calculator,
  List,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { getColumnTypeEmoji, COLUMN_TYPES } from "@/lib/column-types";
import type { TableColumn } from "./types";
import { useSetAtom } from "jotai";
import { invalidateColumnsCacheAtom } from "@/lib/column-state-atoms";

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
  formula: string;
  choices: string[];
  lookup_table_id: number | null;
  lookup_display_column: string;
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

  // Get cache invalidation function
  const invalidateColumnsCache = useSetAtom(invalidateColumnsCacheAtom);

  const [activeTab, setActiveTab] = useState<"info" | "type" | "formula" | "choices" | "lookup">("info");
  const [editedColumn, setEditedColumn] = useState<EditedColumn>({
    name: "",
    column_name: "",
    data_type: "text",
    header_align: "left",
    data_align: "left",
    column_group: "",
    formula: "",
    choices: [],
    lookup_table_id: null,
    lookup_display_column: "",
  });
  const [newChoice, setNewChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [newColumnType, setNewColumnType] = useState("");
  const [availableTables, setAvailableTables] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [targetTableRecords, setTargetTableRecords] = useState<Array<{ id: number; display: string }>>([]);

  // System-generated columns
  const isSystemGenerated = column
    ? ["id", "created_at", "updated_at"].includes(column.key)
    : false;

  // Load available tables for lookup dropdown
  useEffect(() => {
    const loadTables = async () => {
      if (!isOpen) return;
      setLoadingTables(true);
      try {
        const response = await api.get<{ success: boolean; foundations: Array<{ id: number; name: string }> }>("/api/v1/foundations");
        if (response?.foundations && Array.isArray(response.foundations)) {
          setAvailableTables(response.foundations.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.error("Failed to load tables:", error);
      } finally {
        setLoadingTables(false);
      }
    };
    loadTables();
  }, [isOpen]);

  // Note: Target table columns loading was removed as the state was never used

  // Load records from target table when lookup_table_id changes
  useEffect(() => {
    const loadTargetRecords = async () => {
      setTargetTableRecords([]);

      if (!editedColumn.lookup_table_id) {
        return;
      }

      const tableIdToLoad = editedColumn.lookup_table_id;
      console.log('[ColumnEditorModal] Loading records for target table:', tableIdToLoad);

      try {
        const response = await api.get<{ records: Array<Record<string, unknown>> }>(
          `/api/v1/foundations/${tableIdToLoad}/records`
        );
        console.log('[ColumnEditorModal] Records response for table', tableIdToLoad, ':', response);

        if (response?.records) {
          // Get display column from current config, default to 'name'
          const displayColumn = editedColumn.lookup_display_column || 'name';
          const records = response.records.map((record) => ({
            id: record.id as number,
            display: String(record[displayColumn] || record.name || record.title || record.id),
          }));
          console.log('[ColumnEditorModal] Setting records for table', tableIdToLoad, ':', records);
          setTargetTableRecords(records);
        }
      } catch (error) {
        console.error("Failed to load target table records:", error);
        setTargetTableRecords([]);
      }
    };
    loadTargetRecords();
  }, [editedColumn.lookup_table_id, editedColumn.lookup_display_column]);

  // Sync state when column changes
  useEffect(() => {
    if (column) {
      console.log('[ColumnEditorModal] Column changed:', column.key, 'lookup_foundation_id:', column.lookup_foundation_id);
      const newLookupTableId = column.lookup_foundation_id || null;
      console.log('[ColumnEditorModal] Setting lookup_table_id to:', newLookupTableId);

      setEditedColumn({
        name: column.label || "",
        column_name: column.key || "",
        data_type: column.column_type || "text",
        header_align: (column as any).header_align || "left",
        data_align: (column as any).data_align || "left",
        column_group: (column as any).column_group || "",
        formula: (column as any).formula || "",
        choices: column.choices || [],
        lookup_table_id: newLookupTableId,
        lookup_display_column: column.lookup_display_column || "",
      });
      setNewColumnType(column.column_type || "text");
    }
  }, [column]);

  const hasChanges = () => {
    if (!column) return false;
    return (
      editedColumn.name !== column.label ||
      editedColumn.header_align !== ((column as any).header_align || "left") ||
      editedColumn.data_align !== ((column as any).data_align || "left") ||
      editedColumn.column_group !== ((column as any).column_group || "")
    );
  };

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
      console.log('[ColumnEditorModal] handleSave column:', {
        column_key: column.key,
        column_id: column.id,
        foundationId,
      });
      if (!columnId) {
        toast({
          title: "Error",
          description: "Cannot save: Column ID not found. This column may not exist in the database yet.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      await api.patch(`/api/v1/foundations/${foundationId}/columns/${columnId}`, {
        column: {
          name: editedColumn.name,
          column_group: editedColumn.column_group || null,
          header_align: editedColumn.header_align,
          data_align: editedColumn.data_align,
          available_choices: editedColumn.choices.length > 0 ? editedColumn.choices : null,
        },
      });

      console.log('[ColumnEditorModal] Saved column with choices:', editedColumn.choices);
      toast({ title: "Success", description: "Column updated successfully" });

      // Invalidate columns cache so ViewManagerSheet shows the updated column
      if (foundationId) {
        invalidateColumnsCache(foundationId);
      }

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

      // Invalidate columns cache so ViewManagerSheet shows the type change
      if (foundationId) {
        invalidateColumnsCache(foundationId);
      }

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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "type" | "formula" | "choices" | "lookup")} className="flex-1 flex flex-col overflow-hidden">
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
              {/* Show Formula tab for computed columns */}
              {editedColumn.data_type === "computed" && (
                <TabsTrigger value="formula" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Formula
                </TabsTrigger>
              )}
              {/* Show Choices tab for choice/dropdown columns */}
              {(editedColumn.data_type === "choice" || editedColumn.data_type === "dropdown") && (
                <TabsTrigger value="choices" className="gap-2">
                  <List className="h-4 w-4" />
                  Choices
                </TabsTrigger>
              )}
              {/* Show Lookup tab for lookup/relationship columns */}
              {(editedColumn.data_type === "lookup" || editedColumn.data_type === "multiple_lookups") && (
                <TabsTrigger value="lookup" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Lookup
                </TabsTrigger>
              )}
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

              {/* Formula Tab - for computed columns with sub-tabs */}
              <TabsContent value="formula" className="m-0 space-y-4">
                <Tabs defaultValue="formula-editor" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="formula-editor" className="gap-2">
                      <Calculator className="h-4 w-4" />
                      Formula
                    </TabsTrigger>
                    <TabsTrigger value="text-template" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Text Template
                    </TabsTrigger>
                    <TabsTrigger value="linked-data" className="gap-2">
                      <Link2 className="h-4 w-4" />
                      Linked Data
                    </TabsTrigger>
                  </TabsList>

                  {/* Formula Editor Sub-Tab */}
                  <TabsContent value="formula-editor" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Excel-like Formula</CardTitle>
                        <CardDescription>
                          Write formulas using functions like SUM, AVG, IF, CONCAT
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Formula Expression</Label>
                          <Textarea
                            value={editedColumn.formula}
                            onChange={(e) =>
                              setEditedColumn((prev) => ({ ...prev, formula: e.target.value }))
                            }
                            placeholder="e.g., SUM({quantity} * {unit_price})"
                            rows={4}
                            className="font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Click to insert column</Label>
                          <div className="flex flex-wrap gap-1">
                            {allColumns
                              .filter(c => c.key !== column?.key && c.key !== "select" && c.key !== "actions")
                              .map((col) => (
                                <Badge
                                  key={col.key}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-primary/20 font-mono text-xs"
                                  onClick={() => {
                                    setEditedColumn((prev) => ({
                                      ...prev,
                                      formula: prev.formula + `{${col.key}}`,
                                    }));
                                  }}
                                >
                                  {col.key}
                                </Badge>
                              ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Operators</Label>
                          <div className="flex flex-wrap gap-1">
                            {["+", "-", "*", "/", "(", ")", "=", ">", "<", ","].map((op) => (
                              <Badge
                                key={op}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary/20 font-mono"
                                onClick={() => {
                                  setEditedColumn((prev) => ({
                                    ...prev,
                                    formula: prev.formula + ` ${op} `,
                                  }));
                                }}
                              >
                                {op}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Functions</Label>
                          <div className="flex flex-wrap gap-1">
                            {["SUM", "AVG", "IF", "CONCAT", "ROUND", "ABS", "UPPER", "LOWER", "LEN", "LOOKUP", "ROLLUP"].map((fn) => (
                              <Badge
                                key={fn}
                                variant="outline"
                                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-mono text-xs"
                                onClick={() => {
                                  setEditedColumn((prev) => ({
                                    ...prev,
                                    formula: prev.formula + `${fn}()`,
                                  }));
                                }}
                              >
                                {fn}()
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-md text-xs space-y-1">
                          <p><strong>Examples:</strong></p>
                          <p className="font-mono text-muted-foreground">{`{quantity} * {unit_price}`}</p>
                          <p className="font-mono text-muted-foreground">{`IF({status} = "paid", {amount}, 0)`}</p>
                          <p className="font-mono text-muted-foreground">{`CONCAT({first_name}, " ", {last_name})`}</p>
                          <p className="font-mono text-muted-foreground">{`ROUND({total} * 1.1, 2)`}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Text Template Sub-Tab */}
                  <TabsContent value="text-template" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Text Template Builder</CardTitle>
                        <CardDescription>
                          Create text by combining columns with static text
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{"{column_name}"}</code> to insert column values.
                            This will be converted to a CONCAT formula.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Template</Label>
                          <Textarea
                            value={editedColumn.formula}
                            onChange={(e) =>
                              setEditedColumn((prev) => ({ ...prev, formula: e.target.value }))
                            }
                            placeholder="e.g., {first_name} {last_name} - {email}"
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Click to insert column</Label>
                          <div className="flex flex-wrap gap-1">
                            {allColumns
                              .filter(c => c.key !== column?.key && c.key !== "select" && c.key !== "actions")
                              .map((col) => (
                                <Badge
                                  key={col.key}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-primary/20 text-xs"
                                  onClick={() => {
                                    setEditedColumn((prev) => ({
                                      ...prev,
                                      formula: prev.formula + `{${col.key}}`,
                                    }));
                                  }}
                                >
                                  {col.label || col.key}
                                </Badge>
                              ))}
                          </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-md text-xs space-y-1">
                          <p><strong>Examples:</strong></p>
                          <p><span className="text-muted-foreground">Full Name:</span> <code>{`{first_name} {last_name}`}</code></p>
                          <p><span className="text-muted-foreground">Address:</span> <code>{`{street}, {city} {state} {postcode}`}</code></p>
                          <p><span className="text-muted-foreground">Reference:</span> <code>{`INV-{id}-{year}`}</code></p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Linked Data Sub-Tab */}
                  <TabsContent value="linked-data" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Cross-Table References</CardTitle>
                        <CardDescription>
                          Pull data from related tables using LOOKUP and ROLLUP
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>LOOKUP:</strong> Get a value from a linked record<br />
                            <strong>ROLLUP:</strong> Aggregate values from linked records (SUM, AVG, COUNT, MIN, MAX)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Formula</Label>
                          <Textarea
                            value={editedColumn.formula}
                            onChange={(e) =>
                              setEditedColumn((prev) => ({ ...prev, formula: e.target.value }))
                            }
                            placeholder="e.g., LOOKUP({contact_id}, contacts, email)"
                            rows={4}
                            className="font-mono"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Lookup columns in this table</Label>
                          <div className="flex flex-wrap gap-1">
                            {allColumns
                              .filter(c => c.column_type === "lookup" || c.column_type === "multiple_lookups")
                              .map((col) => (
                                <Badge
                                  key={col.key}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900 text-green-700 dark:text-green-300 text-xs"
                                  onClick={() => {
                                    setEditedColumn((prev) => ({
                                      ...prev,
                                      formula: prev.formula + `LOOKUP({${col.key}}, table_name, column_name)`,
                                    }));
                                  }}
                                >
                                  🔗 {col.label || col.key}
                                </Badge>
                              ))}
                            {allColumns.filter(c => c.column_type === "lookup" || c.column_type === "multiple_lookups").length === 0 && (
                              <p className="text-xs text-muted-foreground">No lookup columns in this table</p>
                            )}
                          </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-md text-xs space-y-2">
                          <p><strong>LOOKUP Syntax:</strong></p>
                          <p className="font-mono text-muted-foreground">LOOKUP({"{lookup_column}"}, target_table, field_to_get)</p>
                          <p className="mt-2"><strong>ROLLUP Syntax:</strong></p>
                          <p className="font-mono text-muted-foreground">ROLLUP({"{link_column}"}, linked_table, field, SUM)</p>
                          <p className="mt-2"><strong>Examples:</strong></p>
                          <p className="font-mono text-muted-foreground">LOOKUP({"{contact_id}"}, contacts, email)</p>
                          <p className="font-mono text-muted-foreground">ROLLUP({"{job_id}"}, line_items, amount, SUM)</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Formula
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* Choices Tab - for choice/dropdown columns */}
              <TabsContent value="choices" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Dropdown Choices
                    </CardTitle>
                    <CardDescription>
                      Define the available options for this dropdown field.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Add New Choice</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newChoice}
                          onChange={(e) => setNewChoice(e.target.value)}
                          placeholder="Enter a choice value"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newChoice.trim()) {
                              e.preventDefault();
                              if (!editedColumn.choices.includes(newChoice.trim())) {
                                setEditedColumn((prev) => ({
                                  ...prev,
                                  choices: [...prev.choices, newChoice.trim()],
                                }));
                              }
                              setNewChoice("");
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            if (newChoice.trim() && !editedColumn.choices.includes(newChoice.trim())) {
                              setEditedColumn((prev) => ({
                                ...prev,
                                choices: [...prev.choices, newChoice.trim()],
                              }));
                              setNewChoice("");
                            }
                          }}
                          disabled={!newChoice.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Current Choices ({editedColumn.choices.length})</Label>
                      <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                        {editedColumn.choices.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No choices defined yet. Add choices above.
                          </div>
                        ) : (
                          editedColumn.choices.map((choice, index) => (
                            <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/50">
                              <span className="text-sm">{choice}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditedColumn((prev) => ({
                                    ...prev,
                                    choices: prev.choices.filter((_, i) => i !== index),
                                  }));
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Choices
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Lookup Tab - for lookup/relationship columns */}
              <TabsContent value="lookup" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Lookup Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure the relationship to another table.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Lookup columns link to records in another table.
                        The display column determines what value is shown.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Table</Label>
                      <Select
                        value={editedColumn.lookup_table_id?.toString() || ""}
                        onValueChange={(value) =>
                          setEditedColumn((prev) => ({
                            ...prev,
                            lookup_table_id: value ? parseInt(value) : null,
                            lookup_display_column: "", // Reset display column when table changes
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingTables ? "Loading tables..." : "Select a table"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTables.map((table) => (
                            <SelectItem key={table.id} value={table.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{table.name}</span>
                                <span className="text-xs text-muted-foreground">#{table.id}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The table this column links to
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Display Column</Label>
                      <Select
                        value={editedColumn.lookup_display_column || ""}
                        onValueChange={(value) =>
                          setEditedColumn((prev) => ({
                            ...prev,
                            lookup_display_column: value,
                          }))
                        }
                        disabled={!editedColumn.lookup_table_id}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !editedColumn.lookup_table_id
                                ? "Select a target table first"
                                : "Select display value"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {targetTableRecords.map((record) => (
                            <SelectItem key={record.id} value={record.display}>
                              {record.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The value that will be shown when this lookup is displayed
                      </p>
                    </div>

                    {editedColumn.lookup_table_id && (
                      <div className="p-3 bg-muted/50 rounded-md border">
                        <div className="text-sm">
                          <strong>Target Table:</strong>{" "}
                          {availableTables.find(t => t.id === editedColumn.lookup_table_id)?.name || "Unknown"}
                          {editedColumn.lookup_display_column && (
                            <span className="ml-2 text-muted-foreground">
                              → Display: <code className="bg-muted px-1 rounded">{editedColumn.lookup_display_column}</code>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* All available values from target table */}
                    {editedColumn.lookup_table_id && targetTableRecords.length > 0 && (
                      <div className="space-y-2">
                        <Label>All Available Values ({targetTableRecords.length})</Label>
                        <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                          <div className="divide-y">
                            {targetTableRecords.slice(0, 50).map((record) => (
                              <div key={record.id} className="px-3 py-2 text-sm hover:bg-muted/50">
                                {record.display}
                              </div>
                            ))}
                            {targetTableRecords.length > 50 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                ... and {targetTableRecords.length - 50} more
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          These are the values users can select from when editing this column
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Lookup Config
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
