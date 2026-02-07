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
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { TabTypeBadge } from "@/components/ui/tab-type-badge";
import { deriveTabType } from "@/lib/constants/tab-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlaceholderBuilder } from "@/components/ui/placeholders";
import { getWarehouseScopeForType, type PlaceholderScope } from "@/lib/placeholders";

// SSoT (Feb 2026): THE ONE editor for warehouse folder settings
// Uses PlaceholderBuilder (THE ONE component for template building)
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
  warehouse_type?: string;  // Used to determine which tokens to show
  is_system?: boolean;  // SSoT: System tab (functional/code-driven)
  is_mailbox?: boolean;     // SSoT: Mailbox tab
  dynamic_type?: 'mailbox' | null;  // SSoT: Dynamic folder type
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

export function WarehouseFolderEditor({
  open,
  onOpenChange,
  folder,
  onSave,
  isSaving = false,
  parentTabs = [],
}: WarehouseFolderEditorProps) {
  const [formData, setFormData] = React.useState({
    folder_path: '',
    download_name: '',
    ui_name: '',
    parent_id: null as number | null,
  });

  // Initialize form when folder changes
  // SSoT: folder_path must include base path prefix for correct save
  React.useEffect(() => {
    if (folder) {
      // DEBUG: Log folder type data
      console.log('[WarehouseFolderEditor] folder:', {
        display_name: folder.display_name,
        is_mailbox: folder.is_mailbox,
        is_system: folder.is_system,
        dynamic_type: folder.dynamic_type
      });
      // Combine base path + suffix for full folder_path
      const basePath = folder.base_folder_path_template || '';
      const suffix = folder.folder_path || '';
      setFormData({
        folder_path: basePath + suffix,  // Full path for saving
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

  // SSoT: Get appropriate placeholder scope based on warehouse type
  const placeholderScope: PlaceholderScope = React.useMemo(() => {
    return getWarehouseScopeForType(folder?.warehouse_type || 'storage');
  }, [folder?.warehouse_type]);

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

  // Update folder path from suffix (adds base path prefix)
  const updatePathFromSuffix = (suffix: string) => {
    setFormData(prev => ({
      ...prev,
      folder_path: effectiveBasePath + suffix
    }));
  };

  const handleSave = async () => {
    await onSave(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Edit Warehouse Folder</DialogTitle>
            {/* SSoT: Tab type badge */}
            {folder && (
              <TabTypeBadge tabType={deriveTabType(folder)} />
            )}
          </div>
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

          {/* Full Warehouse Folder Path - Uses PlaceholderBuilder */}
          <PlaceholderBuilder
            label="Full Warehouse Folder Path"
            value={getPathSuffix()}
            onChange={updatePathFromSuffix}
            scope={placeholderScope}
            separator="/"
            prefixValue={effectiveBasePath}
            showPreview
            helpText="Full folder path saved to warehouse_folders table."
            defaultExpanded={false}
          />

          {/* UI Name Template - Uses PlaceholderBuilder */}
          <PlaceholderBuilder
            label="UI Name Template"
            value={formData.ui_name}
            onChange={(value) => setFormData(prev => ({ ...prev, ui_name: value }))}
            scope={placeholderScope}
            separator=" "
            showPreview
            placeholder="Leave blank for default (original filename)"
            defaultValue="{{OriginalFileName}}"
            helpText="How this folder's items appear in the UI. Leave blank for default."
            defaultExpanded={false}
          />

          {/* Download Name Template - Uses PlaceholderBuilder */}
          <PlaceholderBuilder
            label="Download Name Template"
            value={formData.download_name}
            onChange={(value) => setFormData(prev => ({ ...prev, download_name: value }))}
            scope={placeholderScope}
            separator=" "
            showPreview
            placeholder="Leave blank for default (original filename)"
            defaultValue="{{OriginalFileName}}"
            helpText="Filename used when downloading. Include extension."
            defaultExpanded={false}
          />

          {/* Live preview of full path */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24">Full Path:</span>
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
