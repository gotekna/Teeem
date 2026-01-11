"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Trash2,
  Pencil,
  Zap,
  Clock,
  MousePointer,
  RefreshCw,
  Webhook,
  FileEdit,
} from "lucide-react";
import { api } from "@/lib/api";
import { COMPANY_TIMEZONE } from "@/lib/timezone-utils";
import { toast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Trigger types from backend
const TRIGGER_TYPES = [
  { value: "manual", label: "Manual", icon: MousePointer, description: "Started manually by user" },
  { value: "status_change", label: "Status Change", icon: RefreshCw, description: "When a record status changes" },
  { value: "scheduled", label: "Scheduled", icon: Clock, description: "Runs on a schedule (cron)" },
  { value: "field_change", label: "Field Change", icon: FileEdit, description: "When a field value changes" },
  { value: "webhook", label: "Webhook", icon: Webhook, description: "Triggered via external webhook" },
] as const;

// Entity types that can trigger workflows
const ENTITY_TYPES = [
  { value: "Job", label: "Job" },
  { value: "Quote", label: "Quote" },
  { value: "Contact", label: "Contact" },
  { value: "Supplier", label: "Supplier" },
  { value: "PurchaseOrder", label: "Purchase Order" },
  { value: "Invoice", label: "Invoice" },
];

interface Trigger {
  id: number;
  bpmn_process_id: number;
  trigger_type: string;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface TriggersPanelProps {
  processId?: number;
}

export function TriggersPanel({ processId }: TriggersPanelProps) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);
  const [triggerToDelete, setTriggerToDelete] = useState<Trigger | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    trigger_type: "manual",
    is_active: true,
    config: {} as Record<string, unknown>,
  });

  // Fetch triggers
  const fetchTriggers = useCallback(async () => {
    if (!processId) return;

    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; triggers: Trigger[] }>(
        `/api/v1/bpmn_processes/${processId}/bpmn_triggers`
      );
      if (response?.success) {
        setTriggers(response.triggers);
      }
    } catch (error) {
      console.error("Failed to fetch triggers:", error);
      toast({
        title: "Error",
        description: "Failed to load triggers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  // Open dialog for new trigger
  const handleAddTrigger = () => {
    setEditingTrigger(null);
    setFormData({
      name: "",
      trigger_type: "manual",
      is_active: true,
      config: {},
    });
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEditTrigger = (trigger: Trigger) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      trigger_type: trigger.trigger_type,
      is_active: trigger.is_active,
      config: trigger.config || {},
    });
    setDialogOpen(true);
  };

  // Save trigger (create or update)
  const handleSaveTrigger = async () => {
    if (!processId) return;
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        bpmn_trigger: {
          name: formData.name,
          trigger_type: formData.trigger_type,
          is_active: formData.is_active,
          config: formData.config,
        },
      };

      let response;
      if (editingTrigger) {
        response = await api.patch<{ success: boolean; trigger: Trigger; errors?: string[] }>(
          `/api/v1/bpmn_processes/${processId}/bpmn_triggers/${editingTrigger.id}`,
          payload
        );
      } else {
        response = await api.post<{ success: boolean; trigger: Trigger; errors?: string[] }>(
          `/api/v1/bpmn_processes/${processId}/bpmn_triggers`,
          payload
        );
      }

      if (response?.success) {
        toast({
          title: "Success",
          description: editingTrigger ? "Trigger updated" : "Trigger created",
        });
        setDialogOpen(false);
        fetchTriggers();
      } else {
        toast({
          title: "Error",
          description: response?.errors?.join(", ") || "Failed to save trigger",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save trigger:", error);
      toast({
        title: "Error",
        description: "Failed to save trigger",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete trigger
  const handleDeleteTrigger = async () => {
    if (!processId || !triggerToDelete) return;

    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/bpmn_processes/${processId}/bpmn_triggers/${triggerToDelete.id}`
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "Trigger deleted",
        });
        setDeleteDialogOpen(false);
        setTriggerToDelete(null);
        fetchTriggers();
      }
    } catch (error) {
      console.error("Failed to delete trigger:", error);
      toast({
        title: "Error",
        description: "Failed to delete trigger",
        variant: "destructive",
      });
    }
  };

  // Toggle trigger active state
  const handleToggleActive = async (trigger: Trigger) => {
    if (!processId) return;

    try {
      const endpoint = trigger.is_active ? "deactivate" : "activate";
      const response = await api.post<{ success: boolean; trigger: Trigger }>(
        `/api/v1/bpmn_processes/${processId}/bpmn_triggers/${trigger.id}/${endpoint}`
      );

      if (response?.success) {
        setTriggers((prev) =>
          prev.map((t) =>
            t.id === trigger.id ? { ...t, is_active: response.trigger.is_active } : t
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle trigger:", error);
      toast({
        title: "Error",
        description: "Failed to update trigger",
        variant: "destructive",
      });
    }
  };

  // Update config field
  const updateConfig = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  // Get icon for trigger type
  const getTriggerIcon = (type: string) => {
    const found = TRIGGER_TYPES.find((t) => t.value === type);
    return found?.icon || Zap;
  };

  if (!processId) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Save the workflow first to add triggers
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground dark:text-muted-foreground">
          Triggers
        </h3>
        <Button size="sm" onClick={handleAddTrigger}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} className="text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && triggers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center dark:border-border">
          <Zap className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No triggers configured</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a trigger to start this workflow automatically
          </p>
        </div>
      )}

      {/* Triggers list */}
      {!loading && triggers.length > 0 && (
        <div className="space-y-2">
          {triggers.map((trigger) => {
            const Icon = getTriggerIcon(trigger.trigger_type);
            return (
              <div
                key={trigger.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  trigger.is_active
                    ? "border-border bg-white dark:border-border dark:bg-slate-800"
                    : "border-border bg-muted opacity-60 dark:border-border dark:bg-slate-900"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    trigger.is_active
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-muted text-muted-foreground dark:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground dark:text-muted-foreground">
                    {trigger.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {trigger.description || trigger.trigger_type}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={trigger.is_active}
                    onCheckedChange={() => handleToggleActive(trigger)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEditTrigger(trigger)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => {
                      setTriggerToDelete(trigger);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTrigger ? "Edit Trigger" : "Add Trigger"}
            </DialogTitle>
            <DialogDescription>
              Configure when this workflow should start automatically
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., When job is approved"
              />
            </div>

            {/* Trigger Type */}
            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    trigger_type: value,
                    config: {},
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_TYPES.find((t) => t.value === formData.trigger_type)?.description}
              </p>
            </div>

            {/* Config fields based on trigger type */}
            {formData.trigger_type === "status_change" && (
              <>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={(formData.config.entity_type as string) || ""}
                    onValueChange={(value) => updateConfig("entity_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((entity) => (
                        <SelectItem key={entity.value} value={entity.value}>
                          {entity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Field Name</Label>
                  <Input
                    value={(formData.config.field_name as string) || ""}
                    onChange={(e) => updateConfig("field_name", e.target.value)}
                    placeholder="e.g., status"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Value (optional)</Label>
                  <Input
                    value={(formData.config.to_values as string) || ""}
                    onChange={(e) => updateConfig("to_values", e.target.value.split(",").map(s => s.trim()))}
                    placeholder="e.g., approved, confirmed"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated values</p>
                </div>
              </>
            )}

            {formData.trigger_type === "field_change" && (
              <>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={(formData.config.entity_type as string) || ""}
                    onValueChange={(value) => updateConfig("entity_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((entity) => (
                        <SelectItem key={entity.value} value={entity.value}>
                          {entity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Field Name</Label>
                  <Input
                    value={(formData.config.field_name as string) || ""}
                    onChange={(e) => updateConfig("field_name", e.target.value)}
                    placeholder="e.g., amount"
                  />
                </div>
              </>
            )}

            {formData.trigger_type === "scheduled" && (
              <>
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Input
                    value={(formData.config.cron as string) || ""}
                    onChange={(e) => updateConfig("cron", e.target.value)}
                    placeholder="e.g., 0 9 * * 1-5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: 0 9 * * 1-5 = 9am weekdays
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  {/* SSoT: Uses COMPANY_TIMEZONE from timezone-utils.ts */}
                  <Input
                    value={(formData.config.timezone as string) || COMPANY_TIMEZONE}
                    onChange={(e) => updateConfig("timezone", e.target.value)}
                  />
                </div>
              </>
            )}

            {formData.trigger_type === "webhook" && (
              <div className="space-y-2">
                <Label>Secret (optional)</Label>
                <Input
                  value={(formData.config.secret as string) || ""}
                  onChange={(e) => updateConfig("secret", e.target.value)}
                  placeholder="Webhook secret for validation"
                />
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTrigger} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{triggerToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTrigger}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
