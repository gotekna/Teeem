"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
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
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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

        {/* Name */}
        <span className="flex-1 truncate text-sm">{node.name}</span>

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
}: SharePointFolderBrowserProps) {
  const [treeNodes, setTreeNodes] = React.useState<TreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<TreeNode | null>(null);

  // Drive/Site selection state
  const [sites, setSites] = React.useState<SharePointSite[]>([]);
  const [currentDrive, setCurrentDrive] = React.useState<string>("personal");
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

      if (statusResponse.drive_type === "sharepoint" && statusResponse.site_name) {
        const site = sitesResponse.sites?.find((s) => s.name === statusResponse.site_name);
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
    } finally {
      setLoadingSites(false);
    }
  }, []);

  // Load root folders
  const loadRootFolders = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<BrowseFoldersResponse>("/api/v1/organization_onedrive/browse_folders");
      const nodes: TreeNode[] = (response.folders || []).map((f) => ({
        ...f,
        path: `/${f.name}`,
        isExpanded: false,
        children: undefined,
      }));
      setTreeNodes(nodes);
    } catch (err) {
      console.error("Failed to load folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load children for a specific folder
  const loadChildren = React.useCallback(async (parentNode: TreeNode): Promise<TreeNode[]> => {
    try {
      const response = await api.get<BrowseFoldersResponse>(
        `/api/v1/organization_onedrive/browse_folders?folder_id=${parentNode.id}`
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
        await api.post("/api/v1/organization_onedrive/use_personal_drive");
        setCurrentDriveName("My OneDrive");
      } else {
        const site = sites.find((s) => s.id === driveId);
        if (!site?.name) throw new Error("Site not found");
        await api.post("/api/v1/organization_onedrive/use_sharepoint_site", { site_name: site.name });
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
              <Button variant="ghost" size="sm" onClick={loadRootFolders}>
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
                onSelect(null, "");
              }}
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Root</span>
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

      {/* Help Text */}
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Click to select a folder. Click the arrow to expand/collapse.
      </p>
    </div>
  );
}
