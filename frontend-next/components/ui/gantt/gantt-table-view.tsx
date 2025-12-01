"use client";

import * as React from "react";
import { format, differenceInDays, parse } from "date-fns";
import { ArrowUpDown, ChevronDown, ChevronRight, Check, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { GanttContextMenu } from "./gantt-context-menu";
import {
  CascadePreviewModal,
  calculateCascadeEffects,
  type CascadeAffectedTask,
  type CascadeResolution,
} from "./gantt-cascade-modal";
import { defaultStatuses } from "./types";
import type { GanttFeature, GanttGroup } from "./types";

type SortField = "name" | "startAt" | "endAt" | "status" | "progress" | "duration";
type SortDirection = "asc" | "desc";
type EditField = "name" | "startAt" | "endAt" | "status" | "progress";
type EditingCell = {
  featureId: string;
  field: EditField;
} | null;

type GanttTableViewProps = {
  features: GanttFeature[];
  groups: GanttGroup[];
  allFeatures: GanttFeature[];
  onFeatureUpdate?: (feature: GanttFeature) => void;
  onFeatureDelete?: (featureId: string) => void;
  onCascadeUpdate?: (
    sourceFeature: GanttFeature,
    resolutions: CascadeResolution[]
  ) => void;
  getDependentTasks?: (taskId: string) => string[];
};

export function GanttTableView({
  features,
  groups,
  allFeatures,
  onFeatureUpdate,
  onFeatureDelete,
  onCascadeUpdate,
  getDependentTasks,
}: GanttTableViewProps) {
  const [sortField, setSortField] = React.useState<SortField>("startAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = React.useState<EditingCell>(null);
  const [editValue, setEditValue] = React.useState<string>("");

  // Cascade modal state
  const [cascadeModalOpen, setCascadeModalOpen] = React.useState(false);
  const [pendingUpdate, setPendingUpdate] = React.useState<{
    feature: GanttFeature;
    newStart: Date;
    originalStart: Date;
  } | null>(null);
  const [affectedTasks, setAffectedTasks] = React.useState<CascadeAffectedTask[]>([]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const sortFeatures = (items: GanttFeature[]): GanttFeature[] => {
    return [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "startAt":
          comparison = a.startAt.getTime() - b.startAt.getTime();
          break;
        case "endAt":
          comparison = a.endAt.getTime() - b.endAt.getTime();
          break;
        case "status":
          comparison = a.status.name.localeCompare(b.status.name);
          break;
        case "progress":
          comparison = (a.progress ?? 0) - (b.progress ?? 0);
          break;
        case "duration":
          const durationA = differenceInDays(a.endAt, a.startAt) + 1;
          const durationB = differenceInDays(b.endAt, b.startAt) + 1;
          comparison = durationA - durationB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const getStatusVariant = (statusId: string) => {
    switch (statusId) {
      case "completed":
        return "success";
      case "in-progress":
        return "info";
      case "on-hold":
        return "warning";
      case "at-risk":
        return "error";
      default:
        return "secondary";
    }
  };

  const startEditing = (feature: GanttFeature, field: EditField) => {
    if (!onFeatureUpdate) return;

    setEditingCell({ featureId: feature.id, field });

    switch (field) {
      case "name":
        setEditValue(feature.name);
        break;
      case "startAt":
        setEditValue(format(feature.startAt, "yyyy-MM-dd"));
        break;
      case "endAt":
        setEditValue(format(feature.endAt, "yyyy-MM-dd"));
        break;
      case "status":
        setEditValue(feature.status.id);
        break;
      case "progress":
        setEditValue(String(feature.progress ?? 0));
        break;
    }
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEditing = (feature: GanttFeature) => {
    if (!editingCell || !onFeatureUpdate) return;

    let updatedFeature = { ...feature };

    switch (editingCell.field) {
      case "name":
        if (editValue.trim()) {
          updatedFeature.name = editValue.trim();
        }
        onFeatureUpdate(updatedFeature);
        cancelEditing();
        break;

      case "startAt":
        const newStartAt = parse(editValue, "yyyy-MM-dd", new Date());
        if (!isNaN(newStartAt.getTime())) {
          // If new start is after end, adjust end
          if (newStartAt > feature.endAt) {
            const duration = differenceInDays(feature.endAt, feature.startAt);
            updatedFeature.startAt = newStartAt;
            updatedFeature.endAt = new Date(newStartAt.getTime() + duration * 24 * 60 * 60 * 1000);
          } else {
            updatedFeature.startAt = newStartAt;
          }

          // Check for cascade effects if we have the dependent tasks function
          if (getDependentTasks && onCascadeUpdate) {
            const affected = calculateCascadeEffects(
              feature,
              newStartAt,
              allFeatures,
              getDependentTasks
            );

            // If there are affected tasks with locks, show the cascade modal
            const hasBlockedTasks = affected.some((t) => t.isBlocked);
            if (affected.length > 0 && hasBlockedTasks) {
              setPendingUpdate({
                feature: updatedFeature,
                newStart: newStartAt,
                originalStart: feature.startAt,
              });
              setAffectedTasks(affected);
              setCascadeModalOpen(true);
              cancelEditing();
              return;
            }
          }

          onFeatureUpdate(updatedFeature);
        }
        cancelEditing();
        break;

      case "endAt":
        const newEndAt = parse(editValue, "yyyy-MM-dd", new Date());
        if (!isNaN(newEndAt.getTime()) && newEndAt >= feature.startAt) {
          updatedFeature.endAt = newEndAt;
        }
        onFeatureUpdate(updatedFeature);
        cancelEditing();
        break;

      case "status":
        const newStatus = defaultStatuses.find((s) => s.id === editValue);
        if (newStatus) {
          updatedFeature.status = newStatus;
        }
        onFeatureUpdate(updatedFeature);
        cancelEditing();
        break;

      case "progress":
        const progress = parseInt(editValue, 10);
        if (!isNaN(progress) && progress >= 0 && progress <= 100) {
          updatedFeature.progress = progress;
        }
        onFeatureUpdate(updatedFeature);
        cancelEditing();
        break;
    }
  };

  // Handle cascade modal apply
  const handleCascadeApply = (resolutions: CascadeResolution[]) => {
    if (!pendingUpdate || !onCascadeUpdate) return;

    onCascadeUpdate(pendingUpdate.feature, resolutions);
    setCascadeModalOpen(false);
    setPendingUpdate(null);
    setAffectedTasks([]);
  };

  // Handle cascade modal cancel
  const handleCascadeCancel = () => {
    setCascadeModalOpen(false);
    setPendingUpdate(null);
    setAffectedTasks([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent, feature: GanttFeature) => {
    if (e.key === "Enter") {
      saveEditing(feature);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "ml-1 h-3 w-3",
          sortField === field ? "opacity-100" : "opacity-40"
        )}
      />
    </Button>
  );

  const EditableCell = ({
    feature,
    field,
    children,
    className,
  }: {
    feature: GanttFeature;
    field: EditField;
    children: React.ReactNode;
    className?: string;
  }) => {
    const isEditing = editingCell?.featureId === feature.id && editingCell?.field === field;
    const canEdit = !!onFeatureUpdate;

    if (!canEdit) {
      return <td className={cn("py-2 px-3", className)}>{children}</td>;
    }

    if (isEditing) {
      return (
        <td className={cn("py-1 px-2", className)}>
          <div className="flex items-center gap-1">
            {field === "name" && (
              <Input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, feature)}
                className="h-7 text-sm"
              />
            )}
            {(field === "startAt" || field === "endAt") && (
              <Input
                autoFocus
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, feature)}
                className="h-7 text-[11px] font-mono"
              />
            )}
            {field === "status" && (
              <Select
                value={editValue}
                onValueChange={(value) => {
                  setEditValue(value);
                  // Auto-save on status change
                  const newStatus = defaultStatuses.find((s) => s.id === value);
                  if (newStatus && onFeatureUpdate) {
                    onFeatureUpdate({ ...feature, status: newStatus });
                    cancelEditing();
                  }
                }}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defaultStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {field === "progress" && (
              <div className="flex items-center gap-2 w-full">
                <Slider
                  value={[parseInt(editValue, 10) || 0]}
                  onValueChange={([value]) => setEditValue(String(value))}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="font-mono text-[11px] w-8">{editValue}%</span>
              </div>
            )}
            {field !== "status" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => saveEditing(feature)}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={cancelEditing}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </td>
      );
    }

    return (
      <td
        className={cn(
          "py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors",
          className
        )}
        onClick={() => startEditing(feature, field)}
      >
        {children}
      </td>
    );
  };

  const FeatureRow = ({ feature, indent = false }: { feature: GanttFeature; indent?: boolean }) => {
    const duration = differenceInDays(feature.endAt, feature.startAt) + 1;
    const dependencyNames = (feature.dependencies || [])
      .map((depId) => allFeatures.find((f) => f.id === depId)?.name)
      .filter(Boolean);

    const getLockLabel = (lock: string) => {
      switch (lock) {
        case "supplierConfirmed":
          return "Supplier";
        case "started":
          return "Started";
        case "manuallyPositioned":
          return "Locked";
        default:
          return "Locked";
      }
    };

    return (
      <GanttContextMenu
        feature={feature}
        allFeatures={allFeatures}
        onUpdate={onFeatureUpdate}
        onDelete={onFeatureDelete}
      >
        <tr className="border-b border-border hover:bg-muted/30">
          <EditableCell feature={feature} field="name" className={indent ? "pl-8" : ""}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13px]">{feature.name}</span>
              {feature.lock && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-secondary text-muted-foreground text-[9px] uppercase tracking-wider">
                  <Lock className="h-2.5 w-2.5" />
                  {getLockLabel(feature.lock)}
                </span>
              )}
            </div>
            {dependencyNames.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Depends on: {dependencyNames.join(", ")}
              </p>
            )}
          </EditableCell>
          <EditableCell feature={feature} field="startAt">
            <span className="font-mono text-[11px] text-muted-foreground">
              {format(feature.startAt, "MMM d, yyyy")}
            </span>
          </EditableCell>
          <EditableCell feature={feature} field="endAt">
            <span className="font-mono text-[11px] text-muted-foreground">
              {format(feature.endAt, "MMM d, yyyy")}
            </span>
          </EditableCell>
          <td className="py-2 px-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {duration} {duration === 1 ? "day" : "days"}
            </span>
          </td>
          <EditableCell feature={feature} field="status">
            <Pill variant={getStatusVariant(feature.status.id)}>
              {feature.status.name}
            </Pill>
          </EditableCell>
          <EditableCell feature={feature} field="progress">
            {feature.progress !== undefined ? (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${feature.progress}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground w-8">
                  {feature.progress}%
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </EditableCell>
        </tr>
      </GanttContextMenu>
    );
  };

  const sortedFeatures = sortFeatures(features);

  return (
    <>
      <div className="overflow-auto flex-1">
        <table className="w-full min-w-[700px]">
        <thead className="sticky top-0 bg-background border-b border-border z-10">
          <tr>
            <th className="text-left py-2 px-3 w-[30%]">
              <SortHeader field="name">Task</SortHeader>
            </th>
            <th className="text-left py-2 px-3 w-[14%]">
              <SortHeader field="startAt">Start</SortHeader>
            </th>
            <th className="text-left py-2 px-3 w-[14%]">
              <SortHeader field="endAt">End</SortHeader>
            </th>
            <th className="text-left py-2 px-3 w-[10%]">
              <SortHeader field="duration">Duration</SortHeader>
            </th>
            <th className="text-left py-2 px-3 w-[14%]">
              <SortHeader field="status">Status</SortHeader>
            </th>
            <th className="text-left py-2 px-3 w-[18%]">
              <SortHeader field="progress">Progress</SortHeader>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Ungrouped features */}
          {sortedFeatures.map((feature) => (
            <FeatureRow key={feature.id} feature={feature} />
          ))}

          {/* Grouped features */}
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.id);
            const sortedGroupFeatures = sortFeatures(group.features);

            return (
              <React.Fragment key={group.id}>
                {/* Group header */}
                <tr
                  className="border-b border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50"
                  onClick={() => toggleGroup(group.id)}
                >
                  <td colSpan={6} className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-[13px]">{group.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ({group.features.length} {group.features.length === 1 ? "task" : "tasks"})
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Group features */}
                {!isCollapsed &&
                  sortedGroupFeatures.map((feature) => (
                    <FeatureRow key={feature.id} feature={feature} indent />
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Cascade Preview Modal */}
      {pendingUpdate && (
        <CascadePreviewModal
          open={cascadeModalOpen}
          onOpenChange={setCascadeModalOpen}
          sourceFeature={pendingUpdate.feature}
          originalStart={pendingUpdate.originalStart}
          newStart={pendingUpdate.newStart}
          affectedTasks={affectedTasks}
          onApply={handleCascadeApply}
          onCancel={handleCascadeCancel}
        />
      )}
    </>
  );
}
