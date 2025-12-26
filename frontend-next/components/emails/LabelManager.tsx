"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Tag,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Star,
  AlertCircle,
} from "lucide-react";

// Types
export interface EmailLabel {
  id: number;
  name: string;
  color: string;
  is_system: boolean;
  position: number;
  email_count: number;
  assigned?: boolean;
}

export interface LabelColor {
  name: string;
  hex: string;
}

// API Response Types
interface LabelsResponse {
  success: boolean;
  data: { labels: EmailLabel[] };
}

interface LabelForEmailResponse {
  success: boolean;
  data: { all_labels: EmailLabel[]; assigned_labels: EmailLabel[] };
}

interface ColorsResponse {
  success: boolean;
  data: { colors: LabelColor[] };
}

interface LabelResponse {
  success: boolean;
  data: { label: EmailLabel };
}

// API Functions
async function fetchLabels(): Promise<EmailLabel[]> {
  const response = await api.get<LabelsResponse>("/api/v1/email_labels");
  return response.data.labels || [];
}

async function fetchLabelsForEmail(
  emailId: number
): Promise<{ all_labels: EmailLabel[]; assigned_labels: EmailLabel[] }> {
  const response = await api.get<LabelForEmailResponse>(`/api/v1/email_labels/for_email/${emailId}`);
  return response.data;
}

async function fetchLabelColors(): Promise<LabelColor[]> {
  const response = await api.get<ColorsResponse>("/api/v1/email_labels/colors");
  return response.data.colors || [];
}

async function createLabel(
  name: string,
  color: string
): Promise<EmailLabel> {
  const response = await api.post<LabelResponse>("/api/v1/email_labels", {
    label: { name, color },
  });
  return response!.data.label;
}

async function updateLabel(
  id: number,
  updates: { name?: string; color?: string }
): Promise<EmailLabel> {
  const response = await api.patch<LabelResponse>(`/api/v1/email_labels/${id}`, {
    label: updates,
  });
  return response!.data.label;
}

async function deleteLabel(id: number): Promise<void> {
  await api.delete(`/api/v1/email_labels/${id}`);
}

async function toggleLabelForEmail(
  labelId: number,
  emailId: number
): Promise<{ assigned: boolean }> {
  const response = await api.post<{ success: boolean; data: { assigned: boolean } }>(
    `/api/v1/email_labels/${labelId}/toggle_email`,
    { email_id: emailId }
  );
  return response!.data;
}

// Label Badge Component
interface LabelBadgeProps {
  label: EmailLabel;
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function LabelBadge({
  label,
  onRemove,
  size = "md",
  className,
}: LabelBadgeProps) {
  const isStarred = label.name === "Starred";
  const isImportant = label.name === "Important";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-0",
        size === "sm" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
      }}
    >
      {isStarred && <Star className="h-3 w-3 fill-current" />}
      {isImportant && <AlertCircle className="h-3 w-3" />}
      {!isStarred && !isImportant && <Tag className="h-3 w-3" />}
      <span>{label.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          <span className="sr-only">Remove</span>
          &times;
        </button>
      )}
    </Badge>
  );
}

// Color Picker Component
interface ColorPickerProps {
  colors: LabelColor[];
  selectedColor: string;
  onSelect: (color: string) => void;
}

function ColorPicker({ colors, selectedColor, onSelect }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {colors.map((color) => (
        <button
          key={color.name}
          type="button"
          className={cn(
            "w-6 h-6 rounded-full border-2 transition-all",
            selectedColor === color.hex
              ? "border-foreground scale-110"
              : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: color.hex }}
          onClick={() => onSelect(color.hex)}
          title={color.name}
        />
      ))}
    </div>
  );
}

// Create/Edit Label Dialog
interface LabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: EmailLabel | null;
  colors: LabelColor[];
  onSave: (name: string, color: string) => Promise<void>;
}

function LabelDialog({
  open,
  onOpenChange,
  label,
  colors,
  onSave,
}: LabelDialogProps) {
  const [name, setName] = useState(label?.name || "");
  const [color, setColor] = useState(label?.color || colors[0]?.hex || "#6B7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(label?.name || "");
      setColor(label?.color || colors[0]?.hex || "#6B7280");
      setError(null);
    }
  }, [open, label, colors]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(name.trim(), color);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save label");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{label ? "Edit Label" : "Create Label"}</DialogTitle>
          <DialogDescription>
            {label
              ? "Update the label name or color."
              : "Create a new label to organize your emails."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label-name">Name</Label>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work, Personal, Follow-up"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border"
                style={{ backgroundColor: color }}
              />
              <ColorPicker
                colors={colors}
                selectedColor={color}
                onSelect={setColor}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            {label ? "Save Changes" : "Create Label"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Label Selector Popover (for assigning labels to emails)
interface LabelSelectorProps {
  emailId: number;
  trigger?: React.ReactNode;
  onLabelsChange?: (labels: EmailLabel[]) => void;
}

export function LabelSelector({
  emailId,
  trigger,
  onLabelsChange,
}: LabelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [colors, setColors] = useState<LabelColor[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    try {
      const [labelData, colorData] = await Promise.all([
        fetchLabelsForEmail(emailId),
        fetchLabelColors(),
      ]);
      setLabels(labelData.all_labels);
      setColors(colorData);
    } catch (error) {
      console.error("Failed to load labels:", error);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    if (open) {
      loadLabels();
    }
  }, [open, loadLabels]);

  const handleToggle = async (label: EmailLabel) => {
    try {
      const result = await toggleLabelForEmail(label.id, emailId);

      setLabels((prev) =>
        prev.map((l) =>
          l.id === label.id ? { ...l, assigned: result.assigned } : l
        )
      );

      if (onLabelsChange) {
        const assignedLabels = labels
          .map((l) => (l.id === label.id ? { ...l, assigned: result.assigned } : l))
          .filter((l) => l.assigned);
        onLabelsChange(assignedLabels);
      }
    } catch (error) {
      console.error("Failed to toggle label:", error);
    }
  };

  const handleCreateLabel = async (name: string, color: string) => {
    await createLabel(name, color);
    await loadLabels();
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <Tag className="h-4 w-4" />
              Labels
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b">
            <p className="text-sm font-medium">Labels</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {labels.map((label) => (
                <button
                  key={label.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => handleToggle(label)}
                >
                  <Checkbox checked={label.assigned} />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-left">{label.name}</span>
                  {label.assigned && (
                    <Check className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}

              {labels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No labels yet
                </p>
              )}
            </div>
          )}

          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new label
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <LabelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        colors={colors}
        onSave={handleCreateLabel}
      />
    </>
  );
}

// Label List Component (for settings/management)
interface LabelListProps {
  onLabelClick?: (label: EmailLabel) => void;
}

export function LabelList({ onLabelClick }: LabelListProps) {
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [colors, setColors] = useState<LabelColor[]>([]);
  const [editLabel, setEditLabel] = useState<EmailLabel | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailLabel | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [labelData, colorData] = await Promise.all([
        fetchLabels(),
        fetchLabelColors(),
      ]);
      setLabels(labelData);
      setColors(colorData);
    } catch (error) {
      console.error("Failed to load labels:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateLabel = async (name: string, color: string) => {
    await createLabel(name, color);
    await loadData();
  };

  const handleUpdateLabel = async (name: string, color: string) => {
    if (!editLabel) return;
    await updateLabel(editLabel.id, { name, color });
    setEditLabel(null);
    await loadData();
  };

  const handleDeleteLabel = async () => {
    if (!deleteConfirm) return;
    await deleteLabel(deleteConfirm.id);
    setDeleteConfirm(null);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const systemLabels = labels.filter((l) => l.is_system);
  const userLabels = labels.filter((l) => !l.is_system);

  return (
    <div className="space-y-6">
      {/* System Labels */}
      {systemLabels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            System Labels
          </h3>
          <div className="space-y-1">
            {systemLabels.map((label) => (
              <div
                key={label.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md",
                  onLabelClick && "hover:bg-muted cursor-pointer"
                )}
                onClick={() => onLabelClick?.(label)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1">{label.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {label.email_count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Labels */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Your Labels
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {userLabels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom labels yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {userLabels.map((label) => (
              <div
                key={label.id}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-md",
                  onLabelClick && "hover:bg-muted cursor-pointer"
                )}
                onClick={() => onLabelClick?.(label)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1">{label.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {label.email_count}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLabel(label);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(label);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <LabelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        colors={colors}
        onSave={handleCreateLabel}
      />

      {/* Edit Dialog */}
      <LabelDialog
        open={!!editLabel}
        onOpenChange={(open) => !open && setEditLabel(null)}
        label={editLabel}
        colors={colors}
        onSave={handleUpdateLabel}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Label</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This
              will remove the label from all emails. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLabel}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Hook for using labels
export function useEmailLabels(emailId?: number) {
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [assignedLabels, setAssignedLabels] = useState<EmailLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    try {
      if (emailId) {
        const data = await fetchLabelsForEmail(emailId);
        setLabels(data.all_labels);
        setAssignedLabels(data.assigned_labels);
      } else {
        const data = await fetchLabels();
        setLabels(data);
      }
    } catch (error) {
      console.error("Failed to load labels:", error);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const toggleLabel = useCallback(
    async (labelId: number) => {
      if (!emailId) return;

      const result = await toggleLabelForEmail(labelId, emailId);

      setLabels((prev) =>
        prev.map((l) =>
          l.id === labelId ? { ...l, assigned: result.assigned } : l
        )
      );

      setAssignedLabels((prev) => {
        if (result.assigned) {
          const label = labels.find((l) => l.id === labelId);
          return label ? [...prev, label] : prev;
        }
        return prev.filter((l) => l.id !== labelId);
      });

      return result;
    },
    [emailId, labels]
  );

  return {
    labels,
    assignedLabels,
    loading,
    refresh: loadLabels,
    toggleLabel,
  };
}

export default LabelList;
