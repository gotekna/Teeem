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

// SSoT (Feb 2026): THE ONE editor for warehouse folder settings
// Used by WarehouseProviderTab.tsx and WarehouseFoldersConfig.tsx

export interface WarehouseFolderEditData {
  id: number;
  display_name: string;
  folder_path?: string;
  download_name?: string;
  ui_name?: string;
  base_folder_path_template?: string;
}

interface WarehouseFolderEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: WarehouseFolderEditData | null;
  onSave: (data: { folder_path: string; download_name: string; ui_name: string }) => Promise<void>;
  isSaving?: boolean;
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
}: WarehouseFolderEditorProps) {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
    folder_path: '',
    download_name: '',
    ui_name: '',
  });

  // Initialize form when folder changes
  React.useEffect(() => {
    if (folder) {
      setFormData({
        folder_path: folder.folder_path || '',
        download_name: folder.download_name || '',
        ui_name: folder.ui_name || '',
      });
    }
  }, [folder]);

  const handleSave = async () => {
    await onSave(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Get the suffix (editable part) of the folder path
  const getPathSuffix = () => {
    if (folder?.base_folder_path_template && formData.folder_path.startsWith(folder.base_folder_path_template)) {
      return formData.folder_path.slice(folder.base_folder_path_template.length);
    }
    return formData.folder_path;
  };

  // Update folder path from suffix
  const updatePathFromSuffix = (suffix: string) => {
    const basePath = folder?.base_folder_path_template || '';
    setFormData(prev => ({
      ...prev,
      folder_path: basePath + suffix
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
              {/* Base folder path prefix - read-only, greyed out */}
              {folder?.base_folder_path_template && (
                <span className="px-3 py-2 bg-muted text-muted-foreground font-mono text-sm border-r whitespace-nowrap">
                  {folder.base_folder_path_template}
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
