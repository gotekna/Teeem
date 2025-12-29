"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Code,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatValue } from "@/lib/formatters/display-formatters";
import { reloadTypeDefinitions, type ColumnTypeDefinition } from "@/lib/column-type-registry";

interface TypeDefinitionsResponse {
  success: boolean;
  data: ColumnTypeDefinition[];
  meta: {
    total: number;
    categories: string[];
  };
}

interface TypeDefinitionResponse {
  success: boolean;
  data: ColumnTypeDefinition;
  message?: string;
  error?: string;
}

const CATEGORIES = [
  "Text",
  "Number",
  "Date",
  "Boolean",
  "Choice",
  "Relationship",
  "Australian",
  "Contact",
  "File",
  "Advanced",
  "Special",
];

const DISPLAY_FORMATTERS = [
  { value: "text", label: "Text" },
  { value: "multiline", label: "Multiline Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "choice", label: "Choice (Badge)" },
  { value: "lookup", label: "Lookup" },
  { value: "multiple_lookups", label: "Multiple Lookups" },
  { value: "australian_spaced", label: "Australian Spaced (ABN, ACN)" },
  { value: "australian_dashed", label: "Australian Dashed (BSB)" },
  { value: "postcode", label: "Postcode" },
  { value: "masked", label: "Masked (TFN)" },
  { value: "color", label: "Color" },
  { value: "json", label: "JSON" },
  { value: "array", label: "Array" },
  { value: "file", label: "File" },
  { value: "gps", label: "GPS Coordinates" },
];

export function ColumnTypeDefinitionsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [definitions, setDefinitions] = useState<ColumnTypeDefinition[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingDef, setEditingDef] = useState<ColumnTypeDefinition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewValue, setPreviewValue] = useState<string>("");

  const fetchDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<TypeDefinitionsResponse>("/api/v1/column_type_definitions");
      if (response.success) {
        setDefinitions(response.data);
        setCategories(response.meta?.categories || []);
      }
    } catch (error) {
      console.error("Failed to fetch type definitions:", error);
      toast({
        title: "Error",
        description: "Failed to load column type definitions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleEdit = (def: ColumnTypeDefinition) => {
    setEditingDef({ ...def });
    setPreviewValue(def.example_values?.split(",")[0]?.trim() || "");
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingDef({
      id: 0,
      type_key: "",
      display_name: "",
      category: "Text",
      sql_type: "VARCHAR(255)",
      rails_type: "string",
      validation_regex: null,
      validation_message: null,
      default_max_length: null,
      default_min_length: null,
      default_min_value: null,
      default_max_value: null,
      display_formatter: "text",
      display_format: null,
      link_template: null,
      input_mask: null,
      locale: "en-AU",
      icon: null,
      emoji: null,
      example_values: null,
      used_for: null,
      needs_config: false,
      is_active: true,
      version: 1,
      column_count: 0,
      compliance_percentage: 100,
    });
    setPreviewValue("");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingDef) return;

    setSaving(true);
    try {
      const payload = {
        column_type_definition: {
          type_key: editingDef.type_key,
          display_name: editingDef.display_name,
          category: editingDef.category,
          sql_type: editingDef.sql_type,
          rails_type: editingDef.rails_type,
          validation_regex: editingDef.validation_regex,
          validation_message: editingDef.validation_message,
          default_max_length: editingDef.default_max_length,
          default_min_length: editingDef.default_min_length,
          default_min_value: editingDef.default_min_value,
          default_max_value: editingDef.default_max_value,
          display_formatter: editingDef.display_formatter,
          display_format: editingDef.display_format,
          link_template: editingDef.link_template,
          input_mask: editingDef.input_mask,
          locale: editingDef.locale,
          icon: editingDef.icon,
          emoji: editingDef.emoji,
          example_values: editingDef.example_values,
          used_for: editingDef.used_for,
          needs_config: editingDef.needs_config,
          is_active: editingDef.is_active,
        },
      };

      let response: TypeDefinitionResponse | null;
      if (editingDef.id === 0) {
        response = await api.post<TypeDefinitionResponse>("/api/v1/column_type_definitions", payload);
      } else {
        response = await api.patch<TypeDefinitionResponse>(
          `/api/v1/column_type_definitions/${editingDef.id}`,
          payload
        );
      }

      if (response?.success) {
        toast({
          title: "Success",
          description: response.message || "Column type definition saved successfully",
        });
        setIsDialogOpen(false);
        await fetchDefinitions();
        // Reload the type definitions in the registry
        await reloadTypeDefinitions();
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to save column type definition",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save type definition:", error);
      toast({
        title: "Error",
        description: "Failed to save column type definition",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (def: ColumnTypeDefinition) => {
    if (!confirm(`Are you sure you want to deactivate "${def.display_name}"?`)) {
      return;
    }

    try {
      const response = await api.delete<TypeDefinitionResponse>(
        `/api/v1/column_type_definitions/${def.id}`
      );
      if (response?.success) {
        toast({
          title: "Success",
          description: "Column type definition deactivated",
        });
        await fetchDefinitions();
        await reloadTypeDefinitions();
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to deactivate",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete type definition:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate column type definition",
        variant: "destructive",
      });
    }
  };

  const filteredDefinitions =
    selectedCategory === "all"
      ? definitions
      : definitions.filter((d) => d.category === selectedCategory);

  const updateEditingField = (field: keyof ColumnTypeDefinition, value: unknown) => {
    if (!editingDef) return;
    setEditingDef({ ...editingDef, [field]: value });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Column Type Definitions (SSoT)
            </CardTitle>
            <CardDescription>
              The single source of truth for all column type behavior. Changes here affect the entire
              application.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDefinitions} disabled={loading}>
              {loading ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Label>Filter by category:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filteredDefinitions.length} types</Badge>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-32">Type Key</TableHead>
                    <TableHead className="w-32">Display Name</TableHead>
                    <TableHead className="w-24">Category</TableHead>
                    <TableHead className="w-32">Formatter</TableHead>
                    <TableHead className="w-40">Preview</TableHead>
                    <TableHead className="w-24 text-center">Columns</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDefinitions.map((def) => (
                    <TableRow key={def.id}>
                      <TableCell className="font-mono text-xs">{def.type_key}</TableCell>
                      <TableCell>{def.display_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {def.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{def.display_formatter}</TableCell>
                      <TableCell>
                        {formatValue(
                          def.example_values?.split(",")[0]?.trim() || "Example",
                          def.type_key
                        )}
                      </TableCell>
                      <TableCell className="text-center">{def.column_count}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(def)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(def)}
                            disabled={def.column_count > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDef?.id === 0 ? "Create Column Type" : "Edit Column Type"}
            </DialogTitle>
            <DialogDescription>
              {editingDef?.id === 0
                ? "Create a new column type definition"
                : `Editing ${editingDef?.display_name}`}
            </DialogDescription>
          </DialogHeader>

          {editingDef && (
            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type_key">Type Key</Label>
                  <Input
                    id="type_key"
                    value={editingDef.type_key}
                    onChange={(e) => updateEditingField("type_key", e.target.value)}
                    placeholder="e.g., abn, currency, email"
                    disabled={editingDef.id !== 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={editingDef.display_name}
                    onChange={(e) => updateEditingField("display_name", e.target.value)}
                    placeholder="e.g., ABN, Currency, Email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={editingDef.category}
                    onValueChange={(v) => updateEditingField("category", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_formatter">Display Formatter</Label>
                  <Select
                    value={editingDef.display_formatter}
                    onValueChange={(v) => updateEditingField("display_formatter", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPLAY_FORMATTERS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Display Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_format">Display Format Pattern</Label>
                  <Input
                    id="display_format"
                    value={editingDef.display_format || ""}
                    onChange={(e) => updateEditingField("display_format", e.target.value || null)}
                    placeholder="e.g., XX XXX XXX XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input_mask">Input Mask</Label>
                  <Input
                    id="input_mask"
                    value={editingDef.input_mask || ""}
                    onChange={(e) => updateEditingField("input_mask", e.target.value || null)}
                    placeholder="e.g., ## ### ### ###"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_template">Link Template</Label>
                <Input
                  id="link_template"
                  value={editingDef.link_template || ""}
                  onChange={(e) => updateEditingField("link_template", e.target.value || null)}
                  placeholder="e.g., mailto:{value} or tel:{value}"
                />
              </div>

              {/* Validation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validation_regex">Validation Regex</Label>
                  <Input
                    id="validation_regex"
                    value={editingDef.validation_regex || ""}
                    onChange={(e) => updateEditingField("validation_regex", e.target.value || null)}
                    placeholder="e.g., ^\\d{11}$"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validation_message">Validation Message</Label>
                  <Input
                    id="validation_message"
                    value={editingDef.validation_message || ""}
                    onChange={(e) => updateEditingField("validation_message", e.target.value || null)}
                    placeholder="e.g., Must be 11 digits"
                  />
                </div>
              </div>

              {/* SQL Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sql_type">SQL Type</Label>
                  <Input
                    id="sql_type"
                    value={editingDef.sql_type}
                    onChange={(e) => updateEditingField("sql_type", e.target.value)}
                    placeholder="e.g., VARCHAR(255), DECIMAL(10,2)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rails_type">Rails Type</Label>
                  <Input
                    id="rails_type"
                    value={editingDef.rails_type || ""}
                    onChange={(e) => updateEditingField("rails_type", e.target.value || null)}
                    placeholder="e.g., string, decimal, datetime"
                  />
                </div>
              </div>

              {/* Constraints */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_min_length">Min Length</Label>
                  <Input
                    id="default_min_length"
                    type="number"
                    value={editingDef.default_min_length || ""}
                    onChange={(e) =>
                      updateEditingField("default_min_length", e.target.value ? parseInt(e.target.value) : null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_max_length">Max Length</Label>
                  <Input
                    id="default_max_length"
                    type="number"
                    value={editingDef.default_max_length || ""}
                    onChange={(e) =>
                      updateEditingField("default_max_length", e.target.value ? parseInt(e.target.value) : null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_min_value">Min Value</Label>
                  <Input
                    id="default_min_value"
                    type="number"
                    value={editingDef.default_min_value || ""}
                    onChange={(e) =>
                      updateEditingField("default_min_value", e.target.value ? parseFloat(e.target.value) : null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_max_value">Max Value</Label>
                  <Input
                    id="default_max_value"
                    type="number"
                    value={editingDef.default_max_value || ""}
                    onChange={(e) =>
                      updateEditingField("default_max_value", e.target.value ? parseFloat(e.target.value) : null)
                    }
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon Name</Label>
                  <Input
                    id="icon"
                    value={editingDef.icon || ""}
                    onChange={(e) => updateEditingField("icon", e.target.value || null)}
                    placeholder="e.g., Building2, Mail"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input
                    id="emoji"
                    value={editingDef.emoji || ""}
                    onChange={(e) => updateEditingField("emoji", e.target.value || null)}
                    placeholder="e.g., building emoji"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">Locale</Label>
                  <Input
                    id="locale"
                    value={editingDef.locale}
                    onChange={(e) => updateEditingField("locale", e.target.value)}
                    placeholder="e.g., en-AU"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="example_values">Example Values (comma-separated)</Label>
                <Input
                  id="example_values"
                  value={editingDef.example_values || ""}
                  onChange={(e) => updateEditingField("example_values", e.target.value || null)}
                  placeholder="e.g., 51 824 753 556, 12 345 678 901"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="used_for">Used For (description)</Label>
                <Textarea
                  id="used_for"
                  value={editingDef.used_for || ""}
                  onChange={(e) => updateEditingField("used_for", e.target.value || null)}
                  placeholder="Description of what this type is used for"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={editingDef.is_active}
                    onCheckedChange={(v) => updateEditingField("is_active", v)}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="needs_config"
                    checked={editingDef.needs_config}
                    onCheckedChange={(v) => updateEditingField("needs_config", v)}
                  />
                  <Label htmlFor="needs_config">Needs Configuration</Label>
                </div>
              </div>

              {/* Preview */}
              <div className="border rounded-md p-4 bg-muted/50">
                <Label className="text-sm font-medium mb-2 block">Live Preview</Label>
                <div className="flex items-center gap-4">
                  <Input
                    value={previewValue}
                    onChange={(e) => setPreviewValue(e.target.value)}
                    placeholder="Enter test value"
                    className="flex-1"
                  />
                  <div className="flex-1 p-2 bg-background rounded border">
                    {formatValue(previewValue || editingDef.example_values?.split(",")[0]?.trim() || "", editingDef.type_key || "single_line_text")}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner size={16} className="mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
