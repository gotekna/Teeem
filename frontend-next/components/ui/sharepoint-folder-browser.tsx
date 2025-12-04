"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface SharePointFolder {
  id: string;
  name: string;
  web_url?: string;
  child_count: number;
}

interface BrowseFoldersResponse {
  folders: SharePointFolder[];
  current_folder: {
    id: string;
    name: string;
    parent_id: string | null;
  } | null;
  breadcrumbs: Array<{ name: string; id: string | null }>;
  parent_folder_id: string | null;
}

interface SharePointFolderBrowserProps {
  onSelect: (folder: SharePointFolder | null, path: string) => void;
  selectedFolderId?: string | null;
  className?: string;
}

export function SharePointFolderBrowser({
  onSelect,
  selectedFolderId,
  className,
}: SharePointFolderBrowserProps) {
  const [folders, setFolders] = React.useState<SharePointFolder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = React.useState<Array<{ name: string; id: string | null }>>([]);
  const [selectedFolder, setSelectedFolder] = React.useState<SharePointFolder | null>(null);
  const [navigationStack, setNavigationStack] = React.useState<string[]>([]);

  const loadFolders = React.useCallback(async (folderId: string | null = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = folderId ? `?folder_id=${folderId}` : "";
      const response = await api.get<BrowseFoldersResponse>(
        `/api/v1/organization_onedrive/browse_folders${params}`
      );
      setFolders(response.folders || []);
      setBreadcrumbs(response.breadcrumbs || []);
      setCurrentFolderId(folderId);
    } catch (err) {
      console.error("Failed to load folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleFolderClick = (folder: SharePointFolder) => {
    // Single click selects the folder
    setSelectedFolder(folder);
    // Build the path from breadcrumbs + selected folder
    const pathParts = breadcrumbs.map((b) => b.name);
    pathParts.push(folder.name);
    const fullPath = pathParts.join("/");
    onSelect(folder, fullPath);
  };

  const handleFolderDoubleClick = (folder: SharePointFolder) => {
    // Double click navigates into the folder
    if (folder.child_count > 0) {
      setNavigationStack((prev) => [...prev, currentFolderId || ""]);
      setSelectedFolder(null);
      loadFolders(folder.id);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root clicked
      setNavigationStack([]);
      setSelectedFolder(null);
      loadFolders(null);
    } else {
      const breadcrumb = breadcrumbs[index];
      if (breadcrumb?.id) {
        // Navigate to that folder
        setNavigationStack((prev) => prev.slice(0, index));
        setSelectedFolder(null);
        loadFolders(breadcrumb.id);
      }
    }
  };

  const handleBack = () => {
    if (navigationStack.length > 0) {
      const newStack = [...navigationStack];
      const previousFolderId = newStack.pop() || null;
      setNavigationStack(newStack);
      setSelectedFolder(null);
      loadFolders(previousFolderId || null);
    }
  };

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => loadFolders(currentFolderId)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-t-md border-b text-sm overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => handleBreadcrumbClick(-1)}
        >
          <Home className="h-4 w-4" />
        </Button>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 shrink-0",
                index === breadcrumbs.length - 1 && "font-medium"
              )}
              onClick={() => handleBreadcrumbClick(index)}
              disabled={!crumb.id}
            >
              {crumb.name}
            </Button>
          </React.Fragment>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      {/* Folder List */}
      <ScrollArea className="h-[300px] rounded-b-md border border-t-0">
        {loading ? (
          <div className="p-2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No folders found</p>
            <p className="text-xs">This folder is empty or contains only files</p>
          </div>
        ) : (
          <div className="p-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                  selectedFolder?.id === folder.id
                    ? "bg-primary/10 border border-primary"
                    : "hover:bg-muted"
                )}
                onClick={() => handleFolderClick(folder)}
                onDoubleClick={() => handleFolderDoubleClick(folder)}
              >
                {selectedFolder?.id === folder.id ? (
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                )}
                <span className="flex-1 truncate text-sm">{folder.name}</span>
                {folder.child_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{folder.child_count}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Help Text */}
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Click to select a folder. Double-click to navigate into it.
      </p>
    </div>
  );
}
