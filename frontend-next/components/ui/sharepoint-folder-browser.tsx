"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Cloud,
  Building2,
} from "lucide-react";

interface SharePointFolder {
  id: string;
  name: string;
  web_url?: string;
  child_count: number;
}

interface SharePointSite {
  id: string;
  name: string;
  display_name?: string;
  web_url: string;
  description?: string;
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

interface SharePointSitesResponse {
  sites: SharePointSite[];
  current_site: string | null;
}

interface DriveStatusResponse {
  connected: boolean;
  drive_type?: string;
  drive_name?: string;
  site_name?: string;
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

  // Drive/Site selection state
  const [sites, setSites] = React.useState<SharePointSite[]>([]);
  const [currentDrive, setCurrentDrive] = React.useState<string>("personal"); // "personal" or site_id
  const [currentDriveName, setCurrentDriveName] = React.useState<string>("My OneDrive");
  const [loadingSites, setLoadingSites] = React.useState(true);
  const [switchingDrive, setSwitchingDrive] = React.useState(false);

  // Load available SharePoint sites
  const loadSites = React.useCallback(async () => {
    setLoadingSites(true);
    try {
      const [sitesResponse, statusResponse] = await Promise.all([
        api.get<SharePointSitesResponse>("/api/v1/organization_onedrive/sharepoint_sites"),
        api.get<DriveStatusResponse>("/api/v1/organization_onedrive/status"),
      ]);

      setSites(sitesResponse.sites || []);

      // Determine current drive from status
      if (statusResponse.drive_type === "sharepoint" && statusResponse.site_name) {
        const site = sitesResponse.sites?.find(
          (s) => s.name === statusResponse.site_name
        );
        if (site) {
          setCurrentDrive(site.id);
          setCurrentDriveName(site.name);
        } else {
          setCurrentDrive("sharepoint");
          setCurrentDriveName(statusResponse.site_name || "SharePoint");
        }
      } else {
        setCurrentDrive("personal");
        setCurrentDriveName(statusResponse.drive_name || "My OneDrive");
      }
    } catch (err) {
      console.error("Failed to load SharePoint sites:", err);
      // Not critical - can still browse current drive
    } finally {
      setLoadingSites(false);
    }
  }, []);

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

  // Switch to a different drive/site
  const switchDrive = React.useCallback(async (driveId: string) => {
    setSwitchingDrive(true);
    setError(null);
    try {
      if (driveId === "personal") {
        await api.post("/api/v1/organization_onedrive/use_personal_drive");
        setCurrentDriveName("My OneDrive");
      } else {
        // Find the site to get its name (backend uses name to search/switch)
        const site = sites.find((s) => s.id === driveId);
        if (!site?.name) {
          throw new Error("Site not found");
        }
        await api.post("/api/v1/organization_onedrive/use_sharepoint_site", {
          site_name: site.name,
        });
        setCurrentDriveName(site.name);
      }
      setCurrentDrive(driveId);
      // Reset navigation and reload folders from root
      setNavigationStack([]);
      setSelectedFolder(null);
      setBreadcrumbs([]);
      await loadFolders(null);
    } catch (err) {
      console.error("Failed to switch drive:", err);
      setError(err instanceof Error ? err.message : "Failed to switch drive");
    } finally {
      setSwitchingDrive(false);
    }
  }, [sites, loadFolders]);

  React.useEffect(() => {
    loadSites();
    loadFolders();
  }, [loadSites, loadFolders]);

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

  if (error && !switchingDrive) {
    const isNotConnected = error.toLowerCase().includes("not connected") || error.toLowerCase().includes("unauthorized");
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <AlertCircle className={cn("h-8 w-8 mb-2", isNotConnected ? "text-amber-500" : "text-destructive")} />
        <p className={cn("text-sm mb-2", isNotConnected ? "text-amber-600" : "text-destructive")}>
          {isNotConnected ? "OneDrive not connected" : error}
        </p>
        {isNotConnected ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Connect your OneDrive/SharePoint in Settings to browse folders
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/integrations/microsoft" target="_blank">
                  <Cloud className="h-4 w-4 mr-2" />
                  Connect OneDrive
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => loadFolders(currentFolderId)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => loadFolders(currentFolderId)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Drive/Site Selector */}
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-t-md border-b">
        <span className="text-xs text-muted-foreground shrink-0">Location:</span>
        <Select
          value={currentDrive}
          onValueChange={switchDrive}
          disabled={loadingSites || switchingDrive}
        >
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue>
              <div className="flex items-center gap-2">
                {switchingDrive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentDrive === "personal" ? (
                  <Cloud className="h-4 w-4 text-blue-500" />
                ) : (
                  <Building2 className="h-4 w-4 text-green-600" />
                )}
                <span className="truncate">{currentDriveName}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500" />
                <span>My OneDrive</span>
              </div>
            </SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  <span>{site.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 p-2 bg-muted/50 border-b text-sm overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => handleBreadcrumbClick(-1)}
          disabled={switchingDrive}
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
              disabled={!crumb.id || switchingDrive}
            >
              {crumb.name}
            </Button>
          </React.Fragment>
        ))}
        {(loading || switchingDrive) && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      {/* Folder List */}
      <ScrollArea className="h-[200px] rounded-b-md border border-t-0">
        {loading || switchingDrive ? (
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
