"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderInput,
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  Star,
  AlertCircle,
  Folder,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface EmailFolder {
  id: string;
  name: string;
  type: string;
  unread_count?: number;
  total_items?: number;
  depth?: number;
  parent_id?: string;
}

// Folder icon mapping
const folderIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  junk: AlertCircle,
  archive: Archive,
  important: Star,
  folder: Folder,
};

interface MoveToFolderMenuProps {
  emailId: number;
  accountId: string;
  accountType: "outlook" | "imap" | "ms365";
  currentFolder?: string;
  sourceFolder?: string;
  uid?: number;
  onMove?: () => void;
  onCreateFolder?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function MoveToFolderMenu({
  emailId,
  accountId,
  accountType,
  currentFolder,
  sourceFolder = "INBOX",
  uid,
  onMove,
  onCreateFolder,
  size = "md",
  className,
}: MoveToFolderMenuProps) {
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch folders when dropdown opens
  useEffect(() => {
    if (open && folders.length === 0) {
      fetchFolders();
    }
  }, [open]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: { folders: EmailFolder[] } }>(
        `/api/v1/imap_credentials/folders?account_id=${accountId}`
      );
      if (response.success) {
        setFolders(response.data.folders || []);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToFolder = async (folder: EmailFolder) => {
    if (!uid && accountType === "imap") {
      console.error("UID required for IMAP move");
      return;
    }

    setMoving(true);
    try {
      if (accountType === "imap") {
        await api.post(`/api/v1/imap_credentials/${accountId}/move_email`, {
          uid,
          destination_folder: folder.name,
          source_folder: sourceFolder,
        });
      } else {
        // For Outlook/MS365, use email warehouse endpoint
        await api.post(`/api/v1/synced_email/${emailId}/move_to_folder`, {
          folder_id: folder.id,
          folder_name: folder.name,
        });
      }
      setOpen(false);
      onMove?.();
    } catch (error) {
      console.error("Failed to move email:", error);
    } finally {
      setMoving(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  // Filter out current folder
  const availableFolders = folders.filter(
    (f) => f.name.toLowerCase() !== currentFolder?.toLowerCase()
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(buttonSize, className)}
                disabled={moving}
              >
                {moving ? (
                  <Spinner className={iconSize} />
                ) : (
                  <FolderInput className={iconSize} />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Move to folder (m)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-48">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-4 w-4" />
          </div>
        ) : availableFolders.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            No folders available
          </div>
        ) : (
          <>
            {availableFolders.map((folder) => {
              const Icon = folderIcons[folder.type] || folderIcons.folder;
              return (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => handleMoveToFolder(folder)}
                  className="cursor-pointer"
                  style={{ paddingLeft: `${(folder.depth || 0) * 12 + 8}px` }}
                >
                  <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{folder.name}</span>
                </DropdownMenuItem>
              );
            })}
            {onCreateFolder && accountType === "imap" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCreateFolder} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                  Create folder...
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MoveToFolderMenu;
