"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  Folder,
  ChevronRight,
  Home,
  Check,
} from "lucide-react";

interface FolderItem {
  id: string;
  name: string;
  child_count: number;
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

interface SelectedFolder {
  id: string | null;
  name: string;
  path: string;
}

interface SharePointFolderPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (folder: SelectedFolder) => void;
  title?: string;
}


export function SharePointFolderPicker({
  open,
  onOpenChange,
  onSelect,
  title = "Select Storage Folder",
}: SharePointFolderPickerProps) {
  const [folders, setFolders] = React.useState<FolderItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = React.useState<Breadcrumb[]>([
    { id: null, name: "My Drive" },
  ]);

  React.useEffect(() => {
    if (open) {
      loadFolders(null);
      setBreadcrumbs([{ id: null, name: "My Drive" }]);
    }
  }, [open]);

  const loadFolders = async (folderId: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = folderId ? { folder_id: folderId } : {};
      const response = await api.get<{ folders: FolderItem[] }>(
        "/api/v1/documents/browse_folders",
        { params }
      );
      setFolders(response.folders || []);
      setCurrentFolderId(folderId);
    } catch (err) {
      setError("Failed to load folders. Make sure cloud storage is connected.");
      console.error("Failed to load folders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: FolderItem) => {
    loadFolders(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const clickedBreadcrumb = breadcrumbs[index];
    loadFolders(clickedBreadcrumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleSelectCurrentFolder = () => {
    const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    onSelect({
      id: currentFolderId,
      name: currentBreadcrumb.name,
      path: breadcrumbs.slice(1).map((b) => b.name).join("/"),
    });
    onOpenChange(false);
  };

  const handleSelectSpecificFolder = (folder: FolderItem) => {
    onSelect({
      id: folder.id,
      name: folder.name,
      path: [...breadcrumbs.slice(1).map((b) => b.name), folder.name].join("/"),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1">
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                {index === 0 && <Home className="h-4 w-4" />}
                <span className="whitespace-nowrap">{crumb.name}</span>
              </button>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Current folder select button */}
        {breadcrumbs.length > 1 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">
                Current: {breadcrumbs[breadcrumbs.length - 1].name}
              </span>
            </div>
            <Button size="sm" onClick={handleSelectCurrentFolder}>
              <Check className="h-4 w-4 mr-1" />
              Select This Folder
            </Button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Folder list */}
        <div className="border rounded-md max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={20} className="text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading folders...
              </span>
            </div>
          ) : folders.length === 0 ? (
            <div className="py-12 text-center">
              <Folder className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No subfolders in this location
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted"
                >
                  <button
                    onClick={() => handleFolderClick(folder)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folder.child_count} {folder.child_count === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectSpecificFolder(folder)}
                    className="ml-2"
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {breadcrumbs.length === 1 && (
            <Button onClick={handleSelectCurrentFolder}>Select Root</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
