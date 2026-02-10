"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Trash2, Crown, Shield, Eye } from "lucide-react";
import { api } from "@/lib/api";
import {
  notebookActions,
  type Notebook,
  type NotebookShare,
} from "./hooks/useNotebooks";

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface NotebookShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebook: Notebook;
  onUpdated?: () => void;
}

const PERMISSION_LABELS = {
  view: { label: "Can view", icon: Eye, description: "Read-only access" },
  edit: { label: "Can edit", icon: Shield, description: "Can edit pages" },
  admin: { label: "Admin", icon: Crown, description: "Full control" },
};

export function NotebookShareModal({
  open,
  onOpenChange,
  notebook,
  onUpdated,
}: NotebookShareModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shares, setShares] = useState<NotebookShare[]>(notebook.shares ?? []);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  // Update shares when notebook changes
  useEffect(() => {
    setShares(notebook.shares ?? []);
  }, [notebook.shares]);

  // Search for users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.get<{ users: User[] }>("/users/search", {
        params: { q: query, limit: 10 },
      });
      // Filter out users who already have access
      const existingUserIds = new Set([
        notebook.owner.id,
        ...shares.map((s) => s.user.id),
      ]);
      setSearchResults(
        (response?.users ?? []).filter((u) => !existingUserIds.has(u.id))
      );
    } catch (err) {
      console.error("Failed to search users:", err);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // Add a new share
  const handleAddShare = async (user: User, permission: "view" | "edit" | "admin") => {
    try {
      const share = await notebookActions.share(notebook.id, {
        user_id: user.id,
        permission,
      });
      setShares((prev) => [...prev, share]);
      setSearchQuery("");
      setSearchResults([]);
      onUpdated?.();
    } catch (err) {
      console.error("Failed to add share:", err);
    }
  };

  // Update permission level
  const handleUpdatePermission = async (
    shareId: number,
    userId: number,
    permission: "view" | "edit" | "admin"
  ) => {
    setIsUpdating(shareId);
    try {
      await notebookActions.share(notebook.id, { user_id: userId, permission });
      setShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, permission } : s))
      );
      onUpdated?.();
    } catch (err) {
      console.error("Failed to update permission:", err);
    }
    setIsUpdating(null);
  };

  // Remove a share
  const handleRemoveShare = async (userId: number) => {
    try {
      await notebookActions.unshare(notebook.id, userId);
      setShares((prev) => prev.filter((s) => s.user.id !== userId));
      onUpdated?.();
    } catch (err) {
      console.error("Failed to remove share:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{notebook.name}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search for users */}
          <div className="space-y-2">
            <Label>Add people</Label>
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by name or email..."
            />

            {/* Search results */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="border rounded-md max-h-48 overflow-auto">
                {isSearching ? (
                  <div className="p-4 text-center">
                    <Spinner className="mx-auto" />
                  </div>
                ) : (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.display_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{user.display_name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          defaultValue="view"
                          onValueChange={(value) =>
                            handleAddShare(user, value as "view" | "edit" | "admin")
                          }
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Can view</SelectItem>
                            <SelectItem value="edit">Can edit</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => handleAddShare(user, "view")}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <Label>People with access</Label>
            <div className="border rounded-md divide-y">
              {/* Owner */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {notebook.owner.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{notebook.owner.name}</div>
                    <div className="text-xs text-muted-foreground">Owner</div>
                  </div>
                </div>
                <Badge variant="secondary">
                  <Crown className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              </div>

              {/* Shared users */}
              {shares.map((share) => {
                const PermIcon = PERMISSION_LABELS[share.permission].icon;
                return (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {share.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{share.user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {share.user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(value) =>
                          handleUpdatePermission(
                            share.id,
                            share.user.id,
                            value as "view" | "edit" | "admin"
                          )
                        }
                        disabled={isUpdating === share.id}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue>
                            <span className="flex items-center gap-1">
                              <PermIcon className="h-3 w-3" />
                              {PERMISSION_LABELS[share.permission].label}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <span className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Can view
                            </span>
                          </SelectItem>
                          <SelectItem value="edit">
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Can edit
                            </span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <Crown className="h-4 w-4" />
                              Admin
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveShare(share.user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {shares.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Only you have access to this notebook
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
