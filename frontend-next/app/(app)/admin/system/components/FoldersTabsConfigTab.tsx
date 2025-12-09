"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Folder,
  Building2,
  Scale,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

// Entity types
const ENTITY_TYPES = [
  { value: "trading_company", label: "Trading Company", icon: Building2, color: "blue" },
  { value: "trust", label: "Trust", icon: Scale, color: "purple" },
  { value: "trustee_company", label: "Trustee (Non-Trading)", icon: Users, color: "gray" }
];

// Initial folder/tab configuration
const INITIAL_FOLDERS = [
  {
    id: 1,
    name: "COMPANY",
    order: 1,
    entity_types: ["trading_company", "trustee_company"],
    description: "Company setup, structure, shareholding"
  },
  {
    id: 2,
    name: "XERO",
    order: 2,
    entity_types: ["trading_company", "trust"],
    description: "Xero integration, invoices, accounting"
  },
  {
    id: 3,
    name: "BANK",
    order: 3,
    entity_types: ["trading_company", "trust"],
    description: "Bank statements, accounts"
  },
  {
    id: 4,
    name: "ATO",
    order: 4,
    entity_types: ["trading_company", "trust"],
    description: "Tax returns, BAS, tax documents"
  },
  {
    id: 5,
    name: "ASIC",
    order: 5,
    entity_types: ["trading_company", "trustee_company"],
    description: "ASIC filings, company changes"
  },
  {
    id: 6,
    name: "TRUST",
    order: 6,
    entity_types: ["trust"],
    description: "Trust deeds, distributions, trustee resolutions"
  },
  {
    id: 7,
    name: "REGISTRY",
    order: 7,
    entity_types: ["trading_company"],
    description: "Share registry, shareholding changes"
  },
  {
    id: 8,
    name: "DIVIDENDS",
    order: 8,
    entity_types: ["trading_company"],
    description: "Dividend payments and records"
  },
  {
    id: 9,
    name: "FINANCIALS",
    order: 9,
    entity_types: ["trading_company", "trust"],
    description: "Financial statements, reports"
  },
  {
    id: 10,
    name: "LOANS",
    order: 10,
    entity_types: ["trading_company", "trust"],
    description: "Loan agreements, lending documents"
  },
  {
    id: 11,
    name: "ASSETS",
    order: 11,
    entity_types: ["trading_company", "trust"],
    description: "Property, equipment, asset registers"
  },
  {
    id: 12,
    name: "INSURANCE",
    order: 12,
    entity_types: ["trading_company", "trust"],
    description: "Insurance policies, claims"
  },
  {
    id: 13,
    name: "MINUTES",
    order: 13,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Board/trustee meeting minutes"
  },
  {
    id: 14,
    name: "ADVICE",
    order: 14,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Professional advice (legal, accounting, etc.)"
  },
  {
    id: 15,
    name: "GENERAL",
    order: 15,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Miscellaneous documents"
  }
];

interface Folder {
  id: number;
  name: string;
  order_position: number;
  entity_types: string[];
  description: string;
  active: boolean;
}

export function FoldersTabsConfigTab() {
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [newFolderDescription, setNewFolderDescription] = React.useState("");
  const [selectedEntityType, setSelectedEntityType] = React.useState<string | null>(null);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Fetch folders from API on mount
  React.useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/document_folders");
      const data = await response.json();

      if (data.success) {
        setFolders(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const moveFolder = (index: number, direction: "up" | "down") => {
    const newFolders = [...folders];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFolders.length) return;

    [newFolders[index], newFolders[targetIndex]] = [newFolders[targetIndex], newFolders[index]];

    // Update order values
    newFolders.forEach((folder, idx) => {
      folder.order_position = idx;
    });

    setFolders(newFolders);
    setHasChanges(true);
  };

  const addFolder = async () => {
    if (!newFolderName.trim()) return;

    const newFolder = {
      name: newFolderName.toUpperCase(),
      order_position: folders.length,
      entity_types: [],
      description: newFolderDescription,
      active: true
    };

    try {
      const response = await fetch("/api/v1/document_folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: newFolder })
      });

      const data = await response.json();
      if (data.success) {
        setFolders([...folders, data.data]);
        setNewFolderName("");
        setNewFolderDescription("");
        setHasChanges(false); // Just saved
      }
    } catch (error) {
      console.error("Failed to add folder:", error);
    }
  };

  const deleteFolder = async (id: number) => {
    if (!confirm("Delete this folder? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/v1/document_folders/${id}`, {
        method: "DELETE"
      });

      const data = await response.json();
      if (data.success) {
        setFolders(folders.filter(f => f.id !== id).map((f, idx) => ({ ...f, order_position: idx })));
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const toggleEntityType = (folderId: number, entityType: string) => {
    setFolders(folders.map(f => {
      if (f.id !== folderId) return f;

      const hasType = f.entity_types.includes(entityType);
      return {
        ...f,
        entity_types: hasType
          ? f.entity_types.filter(t => t !== entityType)
          : [...f.entity_types, entityType]
      };
    }));
    setHasChanges(true);
  };

  const updateDescription = (folderId: number, description: string) => {
    setFolders(folders.map(f =>
      f.id === folderId ? { ...f, description } : f
    ));
    setHasChanges(true);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);

      // Update each folder individually
      for (const folder of folders) {
        await fetch(`/api/v1/document_folders/${folder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder: {
              name: folder.name,
              description: folder.description,
              order_position: folder.order_position,
              entity_types: folder.entity_types,
              active: folder.active
            }
          })
        });
      }

      // Reorder all folders
      await fetch("/api/v1/document_folders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folders: folders.map(f => ({ id: f.id, order_position: f.order_position }))
        })
      });

      setHasChanges(false);
      alert("Configuration saved successfully!");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredFolders = () => {
    if (!selectedEntityType) return folders;
    return folders.filter(f => f.entity_types.includes(selectedEntityType));
  };

  const getEntityTypeColor = (entityType: string) => {
    const type = ENTITY_TYPES.find(t => t.value === entityType);
    return type?.color || "gray";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading folders configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Folders & Tabs Configuration</h2>
          <p className="text-muted-foreground mt-1">
            Manage document folders/tabs and configure which ones appear for different entity types
          </p>
        </div>
        <Button
          onClick={saveChanges}
          disabled={!hasChanges || isSaving}
          size="lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Entity Type Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter by Entity Type</CardTitle>
          <CardDescription>
            View which folders appear for each entity type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedEntityType === null ? "default" : "outline"}
              onClick={() => setSelectedEntityType(null)}
              size="sm"
            >
              All Folders ({folders.length})
            </Button>
            {ENTITY_TYPES.map(type => {
              const count = folders.filter(f => f.entity_types.includes(type.value)).length;
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant={selectedEntityType === type.value ? "default" : "outline"}
                  onClick={() => setSelectedEntityType(type.value)}
                  size="sm"
                  className={cn(
                    selectedEntityType === type.value && type.color === "blue" && "bg-blue-600 hover:bg-blue-700",
                    selectedEntityType === type.value && type.color === "purple" && "bg-purple-600 hover:bg-purple-700",
                    selectedEntityType === type.value && type.color === "gray" && "bg-gray-600 hover:bg-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {type.label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Folders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Document Folders/Tabs
          </CardTitle>
          <CardDescription>
            Drag to reorder. Check entity types to control visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {getFilteredFolders().map((folder, index) => (
            <div
              key={folder.id}
              className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              {/* Order controls */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveFolder(folders.indexOf(folder), "up")}
                  disabled={folders.indexOf(folder) === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <div className="flex items-center justify-center h-6 w-6 text-xs font-mono text-muted-foreground">
                  {folder.order_position + 1}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveFolder(folders.indexOf(folder), "down")}
                  disabled={folders.indexOf(folder) === folders.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              {/* Folder info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono font-bold">
                    {folder.name}
                  </Badge>
                  <Input
                    value={folder.description}
                    onChange={(e) => updateDescription(folder.id, e.target.value)}
                    placeholder="Description..."
                    className="h-7 text-sm"
                  />
                </div>

                {/* Entity type checkboxes */}
                <div className="flex gap-3 pt-1">
                  {ENTITY_TYPES.map(type => {
                    const isChecked = folder.entity_types.includes(type.value);
                    const Icon = type.icon;
                    return (
                      <div
                        key={type.value}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded border cursor-pointer transition-colors",
                          isChecked && type.color === "blue" && "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
                          isChecked && type.color === "purple" && "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700",
                          isChecked && type.color === "gray" && "bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700",
                          !isChecked && "hover:bg-muted"
                        )}
                        onClick={() => toggleEntityType(folder.id, type.value)}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleEntityType(folder.id, type.value)}
                        />
                        <Icon className="h-3 w-3" />
                        <Label className="cursor-pointer text-xs font-normal">
                          {type.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteFolder(folder.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Add new folder */}
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="Folder name (e.g., CONTRACTS)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addFolder()}
              className="font-mono uppercase"
            />
            <Input
              placeholder="Description..."
              value={newFolderDescription}
              onChange={(e) => setNewFolderDescription(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addFolder()}
            />
            <Button onClick={addFolder} disabled={!newFolderName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary by entity type */}
      <div className="grid grid-cols-3 gap-4">
        {ENTITY_TYPES.map(type => {
          const Icon = type.icon;
          const typeFolders = folders.filter(f => f.entity_types.includes(type.value));
          return (
            <Card key={type.value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {type.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {typeFolders.length} folders
                </div>
                <div className="flex flex-wrap gap-1">
                  {typeFolders.map(f => (
                    <Badge key={f.id} variant="secondary" className="text-xs">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
