"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  CheckCircle2,
  Circle,
  List,
  MoreVertical,
} from "lucide-react";
import type { TakeoffRoomInstance } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface TakeoffTemplate {
  id: number;
  name: string;
  category: string | null;
  step_count: number;
}

interface RoomManagerProps {
  rooms: TakeoffRoomInstance[];
  activeRoom: TakeoffRoomInstance | null;
  onRoomChange: (room: TakeoffRoomInstance | null) => void;
  onCreateRoom: (templateId: number, name?: string) => Promise<void>;
  onUpdateRoom: (id: number, updates: { name?: string; status?: string; notes?: string }) => Promise<void>;
  onDeleteRoom: (id: number) => Promise<void>;
  templates: TakeoffTemplate[];
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function RoomManager({
  rooms,
  activeRoom,
  onRoomChange,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
  templates,
  disabled,
}: RoomManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renamingRoom, setRenamingRoom] = useState<TakeoffRoomInstance | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenCreate = () => {
    setSelectedTemplateId(templates.length > 0 ? String(templates[0].id) : "");
    setCustomName("");
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplateId) return;
    setIsSaving(true);
    try {
      await onCreateRoom(
        parseInt(selectedTemplateId, 10),
        customName.trim() || undefined
      );
      setIsCreateOpen(false);
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenRename = (room: TakeoffRoomInstance) => {
    setRenamingRoom(room);
    setRenameName(room.name);
    setIsRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renamingRoom || !renameName.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateRoom(renamingRoom.id, { name: renameName.trim() });
      setIsRenameOpen(false);
      setRenamingRoom(null);
    } catch (err) {
      console.error("Failed to rename room:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (room: TakeoffRoomInstance) => {
    try {
      await onDeleteRoom(room.id);
      if (activeRoom?.id === room.id) {
        onRoomChange(null);
      }
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  };

  return (
    <>
      {/* Room Selector Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
            <LayoutGrid className="h-4 w-4" />
            {activeRoom ? (
              <>
                <span className="max-w-[120px] truncate">{activeRoom.name}</span>
                <Badge variant="secondary" className="text-xs px-1">
                  {activeRoom.filled}/{activeRoom.total}
                </Badge>
              </>
            ) : (
              <span className="max-w-[120px] truncate">
                {rooms.length > 0 ? "Rooms" : "Add Room"}
              </span>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {/* "All Measurements" option — exits room mode */}
          <button
            onClick={() => onRoomChange(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm ${
              activeRoom === null ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <List className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-left">All Measurements</span>
          </button>

          {rooms.length > 0 && <DropdownMenuSeparator />}

          {/* Room list */}
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm ${
                activeRoom?.id === room.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => onRoomChange(room)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                {room.status === "complete" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-left">{room.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {room.template_name}
                </span>
                <Badge
                  variant={room.filled === room.total ? "default" : "secondary"}
                  className="text-xs px-1 flex-shrink-0"
                >
                  {room.filled}/{room.total}
                </Badge>
              </button>

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-muted rounded flex-shrink-0">
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenRename(room)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  {room.status === "in_progress" ? (
                    <DropdownMenuItem onClick={() => onUpdateRoom(room.id, { status: "complete" })}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onUpdateRoom(room.id, { status: "in_progress" })}>
                      <Circle className="h-4 w-4 mr-2" />
                      Mark In Progress
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(room)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {rooms.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No rooms yet. Add one from a template.
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Add room button */}
          <DropdownMenuItem onClick={handleOpenCreate} disabled={templates.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Room Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Room</DialogTitle>
            <DialogDescription>
              Choose a template and optionally name the room instance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.step_count} slots
                        </span>
                        {t.category && (
                          <Badge variant="outline" className="text-xs">
                            {t.category}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-name">Name (optional)</Label>
              <Input
                id="room-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Auto-generated if blank (e.g., Bathroom 1)"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-name based on template and count
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!selectedTemplateId || isSaving}>
              {isSaving ? "Creating..." : "Add Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Room Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Room</DialogTitle>
            <DialogDescription>
              Update the room name
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-room">Name</Label>
              <Input
                id="rename-room"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
