"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  ChevronDown,
  Home,
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
  rootFolder?: string; // Restrict to this folder (e.g., "Teeem")
}

// Tree node with children state
interface TreeNode extends SharePointFolder {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  path: string;
}

// Recursive tree folder component
function TreeFolder({
  node,
  level,
  selectedFolderId,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  level: number;
  selectedFolderId?: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (node: TreeNode) => void;
}) {
  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.child_count > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors",
          isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/Collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node);
            }}
          >
            {node.isLoading ? (
              <Spinner size={16} className="text-muted-foreground" />
            ) : node.isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Folder icon */}
        {isSelected || node.isExpanded ? (
          <FolderOpen className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-amber-500")} />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        )}

        {/* Name and Path */}
        <div className="flex-1 flex flex-col min-w-0">
          <span className="truncate text-sm">{node.name}</span>
          <span className="truncate text-[10px] text-muted-foreground/60 font-mono">{node.path}</span>
        </div>

        {/* Child count */}
        {hasChildren && !node.isExpanded && (
          <span className="text-xs text-muted-foreground">{node.child_count}</span>
        )}
      </div>

      {/* Render children if expanded */}
      {node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeFolder
              key={child.id}
              node={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
          {node.children.length === 0 && !node.isLoading && (
            <div
              className="text-xs text-muted-foreground italic py-1"
              style={{ paddingLeft: `${(level + 1) * 16 + 28}px` }}
            >
              No subfolders
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SharePointFolderBrowser({
  onSelect,
  selectedFolderId,
  className,
  rootFolder = "Teeem", // Default to Teeem folder
}: SharePointFolderBrowserProps) {
  const [treeNodes, setTreeNodes] = React.useState<TreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<TreeNode | null>(null);
  const [rootFolderId, setRootFolderId] = React.useState<string | null>(null);

  // Drive/Site selection state
  const [sites, setSites] = React.useState<SharePointSite[]>([]);
  const [currentDrive, setCurrentDrive] = React.useState<string>("personal");
  const [currentDriveName, setCurrentDriveName] = React.useState<string>("Cloud Storage");
  const [loadingSites, setLoadingSites] = React.useState(true);
  const [switchingDrive, setSwitchingDrive] = React.useState(false);
  const [creatingFolder, setCreatingFolder] = React.useState(false);

  // Create root folder (e.g., "Teeem") - Note: loadRootFolders defined below
  const createRootFolder = React.useCallback(async () => {
    if (!rootFolder) return;

    setCreatingFolder(true);
    try {
      await api.post("/api/v1/documents/create_root_folder", {
        folder_name: rootFolder,
      }, { skipAuthRedirect: true });

      // Reload folders after creation - loadRootFolders is defined later in the file
      setError(null);
      // Note: We manually reload here rather than call loadRootFolders to avoid circular dependency
      window.location.reload();
    } catch (err: any) {
      console.error("Failed to create root folder:", err);
      setError(err.response?.data?.error || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }, [rootFolder]);

  // Load available SharePoint sites
  const loadSites = React.useCallback(async () => {
    setLoadingSites(true);
    try {
      // Use Promise.allSettled to prevent one failure from crashing everything
      // skipAuthRedirect prevents 401s from redirecting to login (SharePoint may not be connected)
      const results = await Promise.allSettled([
        api.get<SharePointSitesResponse>("/api/v1/documents/sharepoint_sites", { skipAuthRedirect: true }),
        api.get<DriveStatusResponse>("/api/v1/documents/status", { skipAuthRedirect: true }),
      ]);

      // Check if both succeeded
      const sitesResult = results[0];
      const statusResult = results[1];

      if (sitesResult.status === 'rejected' || statusResult.status === 'rejected') {
        // One or both failed - show not connected state
        setError("Cloud storage not connected");
        setLoadingSites(false);
        return;
      }

      const sitesResponse = sitesResult.value;
      const statusResponse = statusResult.value;

      setSites(sitesResponse?.sites || []);

      // Prefer SharePoint over personal OneDrive
      if (sitesResponse.sites && sitesResponse.sites.length > 0) {
        // Prioritize TEEEM site if it exists, otherwise use first site
        const teeemSite = sitesResponse.sites.find((site) =>
          site.name.toLowerCase().includes("teeem") ||
          site.display_name?.toLowerCase().includes("teeem")
        );
        const targetSite = teeemSite || sitesResponse.sites[0];

        setCurrentDrive(targetSite.id);
        setCurrentDriveName(targetSite.name);

        // Switch to SharePoint if not already there
        if (statusResponse.drive_type !== "sharepoint" || statusResponse.site_name !== targetSite.name) {
          try {
            await api.post("/api/v1/documents/use_sharepoint_site", { site_name: targetSite.name }, { skipAuthRedirect: true });
          } catch (err) {
            console.error("Failed to auto-switch storage site:", err);
          }
        }
      } else if (statusResponse.drive_type === "sharepoint" && statusResponse.site_name) {
        // Already on cloud storage but no sites list - use current
        setCurrentDrive("sharepoint");
        setCurrentDriveName(statusResponse.site_name || "Cloud Storage");
      } else {
        // Fallback to personal drive only if no cloud storage available
        setCurrentDrive("personal");
        setCurrentDriveName(statusResponse.drive_name || "Cloud Storage");
      }
    } catch (err) {
      console.error("Failed to load storage sites:", err);
    } finally {
      setLoadingSites(false);
    }
  }, []);

  // Load root folders (or restricted folder)
  const loadRootFolders = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (rootFolder) {
        // Load all folders first to find the root folder
        const response = await api.get<BrowseFoldersResponse>("/api/v1/documents/browse_folders", { skipAuthRedirect: true });
        const rootFolderNode = response.folders?.find((f) => f.name === rootFolder);

        if (rootFolderNode) {
          // Found the root folder - load its children
          setRootFolderId(rootFolderNode.id);
          const childrenResponse = await api.get<BrowseFoldersResponse>(
            `/api/v1/documents/browse_folders?folder_id=${rootFolderNode.id}`,
            { skipAuthRedirect: true }
          );
          const nodes: TreeNode[] = (childrenResponse.folders || []).map((f) => ({
            ...f,
            path: `/${rootFolder}/${f.name}`,
            isExpanded: false,
            children: undefined,
          }));
          setTreeNodes(nodes);
        } else {
          // Root folder not found - show error or create it
          setError(`Folder "${rootFolder}" not found. Please create it in cloud storage first.`);
          setTreeNodes([]);
        }
      } else {
        // No restriction - load all root folders
        const response = await api.get<BrowseFoldersResponse>("/api/v1/documents/browse_folders", { skipAuthRedirect: true });
        const nodes: TreeNode[] = (response.folders || []).map((f) => ({
          ...f,
          path: `/${f.name}`,
          isExpanded: false,
          children: undefined,
        }));
        setTreeNodes(nodes);
      }
    } catch (err: any) {
      // Check for auth errors - cloud storage not connected (don't spam console)
      const isAuthError = err?.status === 401 || err?.status === 403 ||
        err?.message?.includes("Session expired") || err?.message?.includes("Unauthorized");
      if (isAuthError) {
        setError("Cloud storage not connected");
      } else {
        console.error("Failed to load folders:", err);
        setError(err instanceof Error ? err.message : "Failed to load folders");
      }
    } finally {
      setLoading(false);
    }
  }, [rootFolder]);

  // Load children for a specific folder
  const loadChildren = React.useCallback(async (parentNode: TreeNode): Promise<TreeNode[]> => {
    try {
      const response = await api.get<BrowseFoldersResponse>(
        `/api/v1/documents/browse_folders?folder_id=${parentNode.id}`,
        { skipAuthRedirect: true }
      );
      return (response.folders || []).map((f) => ({
        ...f,
        path: `${parentNode.path}/${f.name}`,
        isExpanded: false,
        children: undefined,
      }));
    } catch (err) {
      console.error("Failed to load children:", err);
      return [];
    }
  }, []);

  // Toggle expand/collapse
  const handleToggle = React.useCallback(async (node: TreeNode) => {
    if (node.isExpanded) {
      // Collapse
      setTreeNodes((prev) => updateNodeInTree(prev, node.id, { isExpanded: false }));
    } else {
      // Expand - load children if not loaded
      if (!node.children) {
        setTreeNodes((prev) => updateNodeInTree(prev, node.id, { isLoading: true }));
        const children = await loadChildren(node);
        setTreeNodes((prev) => updateNodeInTree(prev, node.id, { children, isExpanded: true, isLoading: false }));
      } else {
        setTreeNodes((prev) => updateNodeInTree(prev, node.id, { isExpanded: true }));
      }
    }
     
  }, [loadChildren]);

  // Helper to update a node in the tree
  const updateNodeInTree = (nodes: TreeNode[], nodeId: string, updates: Partial<TreeNode>): TreeNode[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return { ...node, children: updateNodeInTree(node.children, nodeId, updates) };
      }
      return node;
    });
  };

  // Handle folder selection
  const handleSelect = React.useCallback((node: TreeNode) => {
    setSelectedNode(node);
    onSelect(node, node.path);
  }, [onSelect]);

  // Switch drive
  const switchDrive = React.useCallback(async (driveId: string) => {
    setSwitchingDrive(true);
    setError(null);
    try {
      if (driveId === "personal") {
        await api.post("/api/v1/documents/use_personal_drive", undefined, { skipAuthRedirect: true });
        setCurrentDriveName("Personal Drive");
      } else {
        const site = sites.find((s) => s.id === driveId);
        if (!site?.name) throw new Error("Site not found");
        await api.post("/api/v1/documents/use_sharepoint_site", { site_name: site.name }, { skipAuthRedirect: true });
        setCurrentDriveName(site.name);
      }
      setCurrentDrive(driveId);
      setSelectedNode(null);
      setTreeNodes([]);
      await loadRootFolders();
    } catch (err) {
      console.error("Failed to switch drive:", err);
      setError(err instanceof Error ? err.message : "Failed to switch drive");
    } finally {
      setSwitchingDrive(false);
    }
  }, [sites, loadRootFolders]);

  React.useEffect(() => {
    loadSites();
    loadRootFolders();
  }, [loadSites, loadRootFolders]);

  if (error && !switchingDrive) {
    const isNotConnected = error.toLowerCase().includes("not connected") || error.toLowerCase().includes("unauthorized");
    const isFolderNotFound = error.toLowerCase().includes("not found");
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <AlertCircle className={cn("h-8 w-8 mb-2", isNotConnected ? "text-amber-500" : "text-destructive")} />
        <p className={cn("text-sm mb-2", isNotConnected ? "text-amber-600" : "text-destructive")}>
          {isNotConnected ? "Cloud storage not connected" : error}
        </p>
        {isNotConnected ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Connect your cloud storage in Settings to browse folders
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/integrations/storage" target="_blank">
                  <Cloud className="h-4 w-4 mr-2" />
                  Connect Storage
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={loadRootFolders}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </>
        ) : isFolderNotFound ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              The &quot;{rootFolder}&quot; folder doesn&apos;t exist yet in your cloud storage
            </p>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={createRootFolder}
                disabled={creatingFolder}
              >
                {creatingFolder ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Folder className="h-4 w-4 mr-2" />
                    Create &quot;{rootFolder}&quot; Folder
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={loadRootFolders} disabled={creatingFolder}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={loadRootFolders}>
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
                  <Spinner size={16} />
                ) : currentDrive === "personal" ? (
                  <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                ) : (
                  <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
                <span className="truncate">{currentDriveName}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span>Personal Drive</span>
              </div>
            </SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span>{site.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tree View - fixed height with overflow scroll */}
      <div className="h-[250px] overflow-y-auto border rounded-b-md bg-background">
        {loading || switchingDrive ? (
          <div className="p-2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : treeNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No folders found</p>
          </div>
        ) : (
          <div className="p-1">
            {/* Root/Home */}
            <div
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
                "hover:bg-muted"
              )}
              onClick={() => {
                setSelectedNode(null);
                onSelect(null, rootFolder ? `/${rootFolder}` : "");
              }}
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {rootFolder ? `/${rootFolder}` : "Root"}
              </span>
            </div>
            {/* Tree folders */}
            {treeNodes.map((node) => (
              <TreeFolder
                key={node.id}
                node={node}
                level={0}
                selectedFolderId={selectedNode?.id || selectedFolderId}
                onSelect={handleSelect}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help Text and Selected Path */}
      <div className="mt-2 px-1 space-y-1">
        {selectedNode && (
          <div className="p-2 bg-muted/50 rounded text-xs">
            <span className="font-medium">Selected: </span>
            <code className="font-mono text-primary">{selectedNode.path}</code>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {rootFolder && `Browsing folders in /${rootFolder}. `}
          Click to select a folder. Click the arrow to expand/collapse.
        </p>
      </div>
    </div>
  );
}
