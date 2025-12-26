"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { FolderPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onFolderCreated?: () => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  accountId,
  onFolderCreated,
}: CreateFolderDialogProps) {
  const { toast } = useToast();
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!folderName.trim()) return;

    setCreating(true);
    try {
      await api.post(`/api/v1/imap_credentials/${accountId}/create_folder`, {
        folder_name: folderName.trim(),
      });
      toast({
        title: "Folder created",
        description: `"${folderName}" has been created successfully`,
      });
      setFolderName("");
      onOpenChange(false);
      onFolderCreated?.();
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Enter a name for your new email folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g., Projects, Clients, Archive 2024"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !folderName.trim()}>
            {creating ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Creating...
              </>
            ) : (
              "Create Folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folderName: string;
  onFolderDeleted?: () => void;
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  accountId,
  folderName,
  onFolderDeleted,
}: DeleteFolderDialogProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  // System folders that cannot be deleted
  const systemFolders = ["INBOX", "Sent", "Sent Items", "Drafts", "Trash", "Junk", "Spam", "Archive"];
  const isSystemFolder = systemFolders.some(
    (sf) => sf.toLowerCase() === folderName.toLowerCase()
  );

  const handleDelete = async () => {
    if (isSystemFolder) {
      toast({
        title: "Cannot delete",
        description: "System folders cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/api/v1/imap_credentials/${accountId}/delete_folder`, {
        data: { folder_name: folderName },
      });
      toast({
        title: "Folder deleted",
        description: `"${folderName}" has been deleted`,
      });
      onOpenChange(false);
      onFolderDeleted?.();
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast({
        title: "Error",
        description: "Failed to delete folder. It may contain emails.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Folder
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSystemFolder ? (
              <>
                <strong>&quot;{folderName}&quot;</strong> is a system folder and cannot be deleted.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>&quot;{folderName}&quot;</strong>?
                <br />
                <span className="text-red-500 font-medium">
                  This action cannot be undone. Emails in this folder may be permanently deleted.
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!isSystemFolder && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Folder"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CreateFolderDialog;
