"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar,
  Link2,
  Unlink,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  Circle,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GanttFeature, GanttStatus } from "./types";
import { defaultStatuses } from "./types";
import {
  CascadePreviewModal,
  calculateCascadeEffects,
  type CascadeAffectedTask,
  type CascadeResolution,
} from "./gantt-cascade-modal";

type GanttContextMenuProps = {
  feature: GanttFeature;
  allFeatures: GanttFeature[];
  onUpdate?: (feature: GanttFeature) => void;
  onDelete?: (featureId: string) => void;
  onCascadeUpdate?: (sourceFeature: GanttFeature, resolutions: CascadeResolution[]) => void;
  getDependentTasks?: (taskId: string) => string[];
  children: React.ReactNode;
};

export function GanttContextMenu({
  feature,
  allFeatures,
  onUpdate,
  onDelete,
  onCascadeUpdate,
  getDependentTasks,
  children,
}: GanttContextMenuProps) {
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editedFeature, setEditedFeature] = React.useState<GanttFeature>(feature);
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);

  // Cascade modal state
  const [cascadeModalOpen, setCascadeModalOpen] = React.useState(false);
  const [affectedTasks, setAffectedTasks] = React.useState<CascadeAffectedTask[]>([]);
  const [pendingUpdate, setPendingUpdate] = React.useState<GanttFeature | null>(null);
  const [originalStart, setOriginalStart] = React.useState<Date | null>(null);

  // Reset edited feature when dialog opens
  React.useEffect(() => {
    if (editDialogOpen) {
      setEditedFeature(feature);
    }
  }, [editDialogOpen, feature]);

  const handleStatusChange = (status: GanttStatus) => {
    if (onUpdate) {
      onUpdate({ ...feature, status });
    }
  };

  const handleAddDependency = (dependencyId: string) => {
    if (onUpdate) {
      const currentDeps = feature.dependencies || [];
      if (!currentDeps.includes(dependencyId)) {
        onUpdate({
          ...feature,
          dependencies: [...currentDeps, dependencyId],
        });
      }
    }
  };

  const handleRemoveDependency = (dependencyId: string) => {
    if (onUpdate) {
      const currentDeps = feature.dependencies || [];
      onUpdate({
        ...feature,
        dependencies: currentDeps.filter((d) => d !== dependencyId),
      });
    }
  };

  const handleSaveEdit = () => {
    if (!onUpdate) return;

    // Check if start date changed and if there are cascade effects
    const startDateChanged = editedFeature.startAt.getTime() !== feature.startAt.getTime();

    if (startDateChanged && getDependentTasks && onCascadeUpdate) {
      const effects = calculateCascadeEffects(
        editedFeature,
        feature.startAt,
        allFeatures,
        getDependentTasks
      );

      if (effects.length > 0) {
        // Show cascade modal
        setAffectedTasks(effects);
        setPendingUpdate(editedFeature);
        setOriginalStart(feature.startAt);
        setCascadeModalOpen(true);
        setEditDialogOpen(false);
        return;
      }
    }

    // No cascade effects, update directly
    onUpdate(editedFeature);
    setEditDialogOpen(false);
  };

  const handleCascadeConfirm = (resolutions: CascadeResolution[]) => {
    if (pendingUpdate && onCascadeUpdate) {
      onCascadeUpdate(pendingUpdate, resolutions);
    }
    setCascadeModalOpen(false);
    setPendingUpdate(null);
    setAffectedTasks([]);
  };

  const handleCascadeCancel = () => {
    setCascadeModalOpen(false);
    setPendingUpdate(null);
    setOriginalStart(null);
    setAffectedTasks([]);
  };

  // Get available features for dependencies (exclude self and existing dependencies)
  const availableDependencies = allFeatures.filter(
    (f) =>
      f.id !== feature.id &&
      !(feature.dependencies || []).includes(f.id)
  );

  // Get current dependencies
  const currentDependencies = allFeatures.filter((f) =>
    (feature.dependencies || []).includes(f.id)
  );

  const getStatusIcon = (statusId: string) => {
    switch (statusId) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 mr-2" />;
      case "in-progress":
        return <Clock className="h-4 w-4 mr-2" />;
      case "on-hold":
        return <PauseCircle className="h-4 w-4 mr-2" />;
      case "at-risk":
        return <AlertTriangle className="h-4 w-4 mr-2" />;
      default:
        return <Circle className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span style={{ display: "contents" }}>{children}</span>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="font-normal">
            <span className="font-medium">{feature.name}</span>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {format(feature.startAt, "MMM d")} – {format(feature.endAt, "MMM d")}
            </p>
          </ContextMenuLabel>
          <ContextMenuSeparator />

          {/* Edit Task */}
          <ContextMenuItem
            onClick={() => setEditDialogOpen(true)}
            disabled={!onUpdate}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Task
          </ContextMenuItem>

          {/* Change Status */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <div
                className={cn(
                  "h-3 w-3 mr-2",
                  feature.status.color.split(" ")[0]
                )}
              />
              Change Status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {defaultStatuses.map((status) => (
                <ContextMenuItem
                  key={status.id}
                  onClick={() => handleStatusChange(status)}
                  disabled={!onUpdate}
                >
                  {getStatusIcon(status.id)}
                  {status.name}
                  {feature.status.id === status.id && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      Current
                    </span>
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Add Dependency */}
          {availableDependencies.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Link2 className="h-4 w-4 mr-2" />
                Add Dependency
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-60 overflow-y-auto">
                {availableDependencies.map((dep) => (
                  <ContextMenuItem
                    key={dep.id}
                    onClick={() => handleAddDependency(dep.id)}
                    disabled={!onUpdate}
                  >
                    <div
                      className={cn(
                        "h-2 w-2 mr-2",
                        dep.status.color.split(" ")[0]
                      )}
                    />
                    {dep.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {/* Remove Dependency */}
          {currentDependencies.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Unlink className="h-4 w-4 mr-2" />
                Remove Dependency
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {currentDependencies.map((dep) => (
                  <ContextMenuItem
                    key={dep.id}
                    onClick={() => handleRemoveDependency(dep.id)}
                    disabled={!onUpdate}
                  >
                    <div
                      className={cn(
                        "h-2 w-2 mr-2",
                        dep.status.color.split(" ")[0]
                      )}
                    />
                    {dep.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {/* Delete */}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onDelete(feature.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Task Name */}
            <div className="grid gap-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                value={editedFeature.name}
                onChange={(e) =>
                  setEditedFeature({ ...editedFeature, name: e.target.value })
                }
              />
            </div>

            {/* Start Date */}
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(editedFeature.startAt, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editedFeature.startAt}
                    onSelect={(date) => {
                      if (date) {
                        setEditedFeature({ ...editedFeature, startAt: date });
                        setStartDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(editedFeature.endAt, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editedFeature.endAt}
                    onSelect={(date) => {
                      if (date) {
                        setEditedFeature({ ...editedFeature, endAt: date });
                        setEndDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={editedFeature.status.id}
                onValueChange={(value) => {
                  const status = defaultStatuses.find((s) => s.id === value);
                  if (status) {
                    setEditedFeature({ ...editedFeature, status });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defaultStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center">
                        <div
                          className={cn(
                            "h-2 w-2 mr-2",
                            status.color.split(" ")[0]
                          )}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            <div className="grid gap-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={editedFeature.progress ?? 0}
                onChange={(e) =>
                  setEditedFeature({
                    ...editedFeature,
                    progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                  })
                }
              />
            </div>

            {/* Dependencies */}
            <div className="grid gap-2">
              <Label>Dependencies</Label>
              <div className="text-[11px] text-muted-foreground mb-1">
                This task depends on:
              </div>
              <div className="flex flex-wrap gap-1">
                {currentDependencies.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">
                    No dependencies
                  </span>
                ) : (
                  currentDependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 bg-secondary"
                    >
                      <div
                        className={cn(
                          "h-2 w-2",
                          dep.status.color.split(" ")[0]
                        )}
                      />
                      {dep.name}
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFeature({
                            ...editedFeature,
                            dependencies: (editedFeature.dependencies || []).filter(
                              (d) => d !== dep.id
                            ),
                          });
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              {availableDependencies.length > 0 && (
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value) {
                      setEditedFeature({
                        ...editedFeature,
                        dependencies: [
                          ...(editedFeature.dependencies || []),
                          value,
                        ],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="text-[11px]">
                    <SelectValue placeholder="Add dependency..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDependencies
                      .filter(
                        (f) => !(editedFeature.dependencies || []).includes(f.id)
                      )
                      .map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          <div className="flex items-center">
                            <div
                              className={cn(
                                "h-2 w-2 mr-2",
                                dep.status.color.split(" ")[0]
                              )}
                            />
                            {dep.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade Preview Modal */}
      {pendingUpdate && originalStart && (
        <CascadePreviewModal
          open={cascadeModalOpen}
          onOpenChange={setCascadeModalOpen}
          sourceFeature={pendingUpdate}
          originalStart={originalStart}
          newStart={pendingUpdate.startAt}
          affectedTasks={affectedTasks}
          onApply={handleCascadeConfirm}
          onCancel={handleCascadeCancel}
        />
      )}
    </>
  );
}
