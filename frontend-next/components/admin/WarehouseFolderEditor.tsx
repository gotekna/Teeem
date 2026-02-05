"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { Plus, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// SSoT (Feb 2026): THE ONE editor for warehouse folder settings
// Used by WarehouseProviderTab.tsx and WarehouseFoldersConfig.tsx

export interface WarehouseFolderEditData {
  id: number;
  display_name: string;
  folder_path?: string;
  download_name?: string;
  ui_name?: string;
  base_folder_path_template?: string;
  parent_id?: number | null;
  base_folder_id?: number;
}

export interface ParentTabOption {
  id: number;
  display_name: string;
  hierarchy_path?: string;  // Full path like "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Asset/Asset Expenses"
  folder_path?: string;     // Actual folder_path from warehouse_folder
}

interface WarehouseFolderEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: WarehouseFolderEditData | null;
  onSave: (data: { folder_path: string; download_name: string; ui_name: string; parent_id?: number | null }) => Promise<void>;
  isSaving?: boolean;
  parentTabs?: ParentTabOption[];  // Available parent tabs to choose from
}

const AVAILABLE_TOKENS = [
  '{{OriginalFileName}}',
  '{{Subject}}',
  '{{FromName}}',
  '{{FromEmail}}',
  '{{ReceivedDate}}',
  '{{Date}}',
  '{{JobCode}}',
  '{{JobName}}',
  '{{ContactName}}',
  '{{CompanyCode}}',
  '{{DocTypeName}}',
];

export function WarehouseFolderEditor({
  open,
  onOpenChange,
  folder,
  onSave,
  isSaving = false,
  parentTabs = [],
}: WarehouseFolderEditorProps) {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
    folder_path: '',
    download_name: '',
    ui_name: '',
    parent_id: null as number | null,
  });

  // Initialize form when folder changes
  React.useEffect(() => {
    if (folder) {
      setFormData({
        folder_path: folder.folder_path || '',
        download_name: folder.download_name || '',
        ui_name: folder.ui_name || '',
        parent_id: folder.parent_id ?? null,
      });
    }
  }, [folder]);

  // SSoT: Compute effective base path based on selected parent
  // When a parent is selected, the base path includes the parent's full path
  const effectiveBasePath = React.useMemo(() => {
    if (formData.parent_id) {
      const selectedParent = parentTabs.find(p => p.id === formData.parent_id);
      if (selectedParent) {
        // Use the parent's folder_path or hierarchy_path, ensuring it ends with /
        const parentPath = selectedParent.folder_path || selectedParent.hierarchy_path || '';
        return parentPath.endsWith('/') ? parentPath : parentPath + '/';
      }
    }
    // No parent selected - use the original base path
    return folder?.base_folder_path_template || '';
  }, [formData.parent_id, parentTabs, folder?.base_folder_path_template]);

  // Track previous base path to detect changes
  const prevBasePathRef = React.useRef(effectiveBasePath);

  // SSoT: Update folder_path when parent changes (base path changes)
  React.useEffect(() => {
    const prevBasePath = prevBasePathRef.current;
    if (prevBasePath !== effectiveBasePath && folder) {
      // Use callback to get current folder_path safely
      setFormData(prev => {
        // Extract current suffix from old path
        let suffix = prev.folder_path;
        if (prevBasePath && suffix.startsWith(prevBasePath)) {
          suffix = suffix.slice(prevBasePath.length);
        } else if (folder.base_folder_path_template && suffix.startsWith(folder.base_folder_path_template)) {
          suffix = suffix.slice(folder.base_folder_path_template.length);
        }
        // Rebuild path with new base
        return {
          ...prev,
          folder_path: effectiveBasePath + suffix
        };
      });
      prevBasePathRef.current = effectiveBasePath;
    }
  }, [effectiveBasePath, folder]);

  const handleSave = async () => {
    await onSave(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Get the suffix (editable part) of the folder path
  const getPathSuffix = () => {
    // Try to match against effective base path first, then original base path
    if (effectiveBasePath && formData.folder_path.startsWith(effectiveBasePath)) {
      return formData.folder_path.slice(effectiveBasePath.length);
    }
    if (folder?.base_folder_path_template && formData.folder_path.startsWith(folder.base_folder_path_template)) {
      return formData.folder_path.slice(folder.base_folder_path_template.length);
    }
    return formData.folder_path;
  };

  // Update folder path from suffix
  const updatePathFromSuffix = (suffix: string) => {
    setFormData(prev => ({
      ...prev,
      folder_path: effectiveBasePath + suffix
    }));
  };

  // Handle token drop with auto-separator
  const handleTokenDrop = (field: 'folder_path' | 'ui_name' | 'download_name', token: string) => {
    setFormData(prev => {
      if (field === 'folder_path') {
        // Add / before token if current value doesn't end with /
        const currentPath = prev.folder_path;
        const separator = currentPath.endsWith('/') ? '' : '/';
        return { ...prev, folder_path: currentPath + separator + token };
      }
      return { ...prev, [field]: prev[field] + token };
    });
  };

  // Common drag handlers
  const dragOverHandler = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-primary');
  };

  const dragLeaveHandler = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-primary');
  };

  const createDropHandler = (field: 'folder_path' | 'ui_name' | 'download_name') => (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-primary');
    const token = e.dataTransfer.getData('text/plain');
    if (token) {
      handleTokenDrop(field, token);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Edit Warehouse Folder</DialogTitle>
          <DialogDescription>
            {folder?.display_name} - Configure folder path and name templates
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Parent Tab Selector */}
          <div className="space-y-2">
            <Label htmlFor="parent_tab">Parent Tab</Label>
            <Select
              value={formData.parent_id?.toString() || "none"}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                parent_id: value === "none" ? null : parseInt(value, 10)
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent tab (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No parent (root level)</span>
                </SelectItem>
                {parentTabs
                  .filter(tab => tab.id !== folder?.id)  // Don't show self as parent option
                  .map((tab) => (
                    <SelectItem key={tab.id} value={tab.id.toString()}>
                      {tab.hierarchy_path || tab.display_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose a parent tab to nest this folder under.
            </p>
          </div>

          {/* Available Tokens */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Available Tokens (drag to field or click to copy)</Label>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  draggable
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-muted hover:bg-muted/80 rounded border cursor-grab active:cursor-grabbing"
                  onClick={() => {
                    navigator.clipboard.writeText(token);
                    toast({ title: 'Copied', description: `${token} copied to clipboard` });
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', token);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title={`Drag to field or click to copy ${token}`}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Full Warehouse Folder Path - Editable with greyed-out base path prefix */}
          <div className="space-y-2">
            <Label htmlFor="folder_path">Full Warehouse Folder Path</Label>
            <div className="flex items-center border rounded-md overflow-hidden">
              {/* Base folder path prefix - read-only, greyed out - updates based on selected parent */}
              {effectiveBasePath && (
                <span className="px-3 py-2 bg-muted text-muted-foreground font-mono text-sm border-r whitespace-nowrap">
                  {effectiveBasePath}
                </span>
              )}
              {/* Editable suffix */}
              <Input
                id="folder_path"
                value={getPathSuffix()}
                onChange={(e) => updatePathFromSuffix(e.target.value)}
                placeholder=""
                className="font-mono text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onDragOver={dragOverHandler}
                onDragLeave={dragLeaveHandler}
                onDrop={createDropHandler('folder_path')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Full folder path saved to warehouse_folders table.
            </p>
          </div>

          {/* UI Name Template */}
          <div className="space-y-2">
            <Label htmlFor="ui_name">UI Name Template</Label>
            <div className="flex gap-2">
              <Input
                id="ui_name"
                value={formData.ui_name}
                onChange={(e) => setFormData(prev => ({ ...prev, ui_name: e.target.value }))}
                placeholder="e.g., {{Subject}} - {{FromName}}"
                className="flex-1"
                onDragOver={dragOverHandler}
                onDragLeave={dragLeaveHandler}
                onDrop={createDropHandler('ui_name')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, ui_name: '{{OriginalFileName}}' }))}
                title="Set to default template"
              >
                <Plus className="h-3 w-3 mr-1" />
                Default
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              How this folder&apos;s items appear in the UI. Leave blank for default.
            </p>
          </div>

          {/* Download Name Template */}
          <div className="space-y-2">
            <Label htmlFor="download_name">Download Name Template</Label>
            <div className="flex gap-2">
              <Input
                id="download_name"
                value={formData.download_name}
                onChange={(e) => setFormData(prev => ({ ...prev, download_name: e.target.value }))}
                placeholder="e.g., {{Subject}} - {{ReceivedDate}}.eml"
                className="flex-1"
                onDragOver={dragOverHandler}
                onDragLeave={dragLeaveHandler}
                onDrop={createDropHandler('download_name')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, download_name: '{{OriginalFileName}}' }))}
                title="Set to default template"
              >
                <Plus className="h-3 w-3 mr-1" />
                Default
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Filename used when downloading. Include extension.
            </p>
          </div>

          {/* Live preview of full path */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24">Path:</span>
              <span className="font-mono text-xs">{formData.folder_path || folder?.display_name || ''}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
