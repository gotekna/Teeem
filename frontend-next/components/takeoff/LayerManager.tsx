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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Layers,
  Plus,
  MoreVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import type { TakeoffLayer } from "./types";
import { DEFAULT_LAYER_COLORS } from "./types";

// =============================================================================
// Types
// =============================================================================

interface LayerManagerProps {
  layers: TakeoffLayer[];
  activeLayer: TakeoffLayer | null;  // null = "All" view
  onLayerChange: (layer: TakeoffLayer | null) => void;
  onCreateLayer: (name: string, color: string) => Promise<void>;
  onUpdateLayer: (id: number, updates: Partial<TakeoffLayer>) => Promise<void>;
  onDeleteLayer: (id: number) => Promise<void>;
  onToggleVisibility: (id: number, visible: boolean) => Promise<void>;
  onToggleLock: (id: number, locked: boolean) => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

export function LayerManager({
  layers,
  activeLayer,
  onLayerChange,
  onCreateLayer,
  onUpdateLayer,
  onDeleteLayer,
  onToggleVisibility,
  onToggleLock,
}: LayerManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLayer, setEditingLayer] = useState<TakeoffLayer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_LAYER_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Open create dialog
  const handleOpenCreate = () => {
    setName("");
    // Pick a color not already used
    const usedColors = new Set(layers.map((l) => l.color));
    const availableColor = DEFAULT_LAYER_COLORS.find((c) => !usedColors.has(c)) || DEFAULT_LAYER_COLORS[0];
    setColor(availableColor);
    setIsCreateOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (layer: TakeoffLayer) => {
    setEditingLayer(layer);
    setName(layer.name);
    setColor(layer.color);
    setIsEditOpen(true);
  };

  // Create layer
  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onCreateLayer(name.trim(), color);
      setIsCreateOpen(false);
    } catch (err) {
      console.error("Failed to create layer:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update layer
  const handleUpdate = async () => {
    if (!editingLayer || !name.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateLayer(editingLayer.id, { name: name.trim(), color });
      setIsEditOpen(false);
      setEditingLayer(null);
    } catch (err) {
      console.error("Failed to update layer:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete layer
  const handleDelete = async (layer: TakeoffLayer) => {
    if (layers.length <= 1) return; // Don't delete last layer
    setIsDeleting(true);
    try {
      await onDeleteLayer(layer.id);
      // If active layer was deleted, switch to first available
      if (activeLayer?.id === layer.id && layers.length > 1) {
        const remaining = layers.filter((l) => l.id !== layer.id);
        if (remaining.length > 0) {
          onLayerChange(remaining[0]);
        }
      }
    } catch (err) {
      console.error("Failed to delete layer:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Layer Selector Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Layers className="h-4 w-4" />
            {activeLayer ? (
              <>
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeLayer.color }}
                />
                <span className="max-w-[100px] truncate">
                  {activeLayer.name}
                </span>
              </>
            ) : (
              <span className="max-w-[100px] truncate">All</span>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* "All" option — shows all layers */}
          <button
            onClick={() => onLayerChange(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm ${
              activeLayer === null ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <Layers className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-left">All</span>
          </button>
          <DropdownMenuSeparator />

          {/* Layer list */}
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm ${
                activeLayer?.id === layer.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              {/* Color dot - click to select */}
              <button
                onClick={() => onLayerChange(layer)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="truncate flex-1">{layer.name}</span>
                {layer.measurement_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {layer.measurement_count}
                  </span>
                )}
              </button>

              {/* Visibility toggle */}
              <button
                onClick={() => onToggleVisibility(layer.id, !layer.visible)}
                className="p-1 hover:bg-muted rounded"
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {/* Lock toggle */}
              <button
                onClick={() => onToggleLock(layer.id, !layer.locked)}
                className="p-1 hover:bg-muted rounded"
                title={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-muted rounded">
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenEdit(layer)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Layer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(layer)}
                    disabled={layers.length <= 1 || isDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Layer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {layers.length === 0 && (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No layers
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Add layer button */}
          <DropdownMenuItem onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Layer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Layer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Layer</DialogTitle>
            <DialogDescription>
              Add a new layer to organize your measurements
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layer-name">Name</Label>
              <Input
                id="layer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Flooring, Walls, Electrical"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_LAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? "border-primary scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
              {isSaving ? "Creating..." : "Create Layer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Layer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Layer</DialogTitle>
            <DialogDescription>
              Update layer name and color
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-layer-name">Name</Label>
              <Input
                id="edit-layer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_LAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? "border-primary scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!name.trim() || isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
