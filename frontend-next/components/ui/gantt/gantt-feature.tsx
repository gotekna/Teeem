"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, differenceInDays } from "date-fns";
import { Pin, CheckCircle2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";
import { GanttContextMenu } from "./gantt-context-menu";
import {
  DependencyConnectorHandle,
  DependencyDropTarget,
  useDependencyConnector,
} from "./gantt-dependency-connector";
import type { GanttFeature, LockType } from "./types";
import type { CascadeResolution } from "./gantt-cascade-modal";

type GanttFeatureItemProps = {
  feature: GanttFeature;
  allFeatures?: GanttFeature[];
  onUpdate?: (feature: GanttFeature) => void;
  onDelete?: (featureId: string) => void;
  onCascadeUpdate?: (sourceFeature: GanttFeature, resolutions: CascadeResolution[]) => void;
  getDependentTasks?: (taskId: string) => string[];
  draggable?: boolean;
  showConnectors?: boolean;
};

export function GanttFeatureItem({
  feature,
  allFeatures = [],
  onUpdate,
  onDelete,
  onCascadeUpdate,
  getDependentTasks,
  draggable = true,
  showConnectors = true,
}: GanttFeatureItemProps) {
  // Try to get dependency connector context - it's optional
  let connectorContext: ReturnType<typeof useDependencyConnector> | null = null;
  try {
    connectorContext = useDependencyConnector();
  } catch {
    // Not wrapped in DependencyConnectorProvider, that's ok
  }
  const isDependencyDragging = connectorContext?.state.isDragging ?? false;
  const { getDatePosition, getDateFromPosition, rowHeight, columnWidth } = useGantt();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState<"left" | "right" | null>(null);
  const [resizeStartX, setResizeStartX] = React.useState(0);
  const [resizeStartDate, setResizeStartDate] = React.useState<Date | null>(null);

  const left = getDatePosition(feature.startAt);
  const right = getDatePosition(feature.endAt);
  const width = Math.max(right - left, 20);
  const duration = differenceInDays(feature.endAt, feature.startAt) + 1;

  // Lock type styling - uses Lucide icons from design system
  const getLockStyles = (lock?: LockType): { border: string; icon: React.ReactNode; label: string } | null => {
    if (!lock) return null;
    switch (lock) {
      case "supplierConfirmed":
        return {
          border: "ring-2 ring-status-success ring-offset-1",
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: "Supplier Confirmed",
        };
      case "started":
        return {
          border: "ring-2 ring-status-info ring-offset-1",
          icon: <Play className="h-3 w-3" />,
          label: "Started",
        };
      case "manuallyPositioned":
        return {
          border: "ring-2 ring-muted-foreground ring-offset-1",
          icon: <Pin className="h-3 w-3" />,
          label: "Manually Positioned",
        };
      default:
        return null;
    }
  };

  const lockStyles = getLockStyles(feature.lock);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
    data: { feature },
    disabled: !draggable || isResizing !== null,
  });

  // Handle resize start
  const handleResizeStart = (edge: "left" | "right") => (e: React.MouseEvent) => {
    if (!onUpdate) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(edge);
    setResizeStartX(e.clientX);
    setResizeStartDate(edge === "left" ? feature.startAt : feature.endAt);
  };

  // Handle resize move
  React.useEffect(() => {
    if (!isResizing || !resizeStartDate || !onUpdate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX;
      const newPosition = getDatePosition(resizeStartDate) + deltaX;
      const newDate = getDateFromPosition(newPosition);

      if (isResizing === "left") {
        // Don't let start go past end
        if (newDate < feature.endAt) {
          onUpdate({
            ...feature,
            startAt: newDate,
          });
        }
      } else {
        // Don't let end go before start
        if (newDate > feature.startAt) {
          onUpdate({
            ...feature,
            endAt: newDate,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      setResizeStartX(0);
      setResizeStartDate(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStartX, resizeStartDate, feature, onUpdate, getDatePosition, getDateFromPosition]);

  const style: React.CSSProperties = {
    position: "absolute",
    left,
    top: 6,
    width,
    height: rowHeight - 12,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging || isResizing ? 50 : isHovered ? 10 : 1,
    cursor: isResizing ? "ew-resize" : draggable ? "grab" : "default",
  };

  const featureContent = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center px-2 border border-transparent",
        "transition-[box-shadow,border-color,opacity]", // Only transition visual effects, not position/size
        feature.status.color,
        (isDragging || isResizing) && "shadow-lg opacity-90 border-primary",
        isHovered && !isDragging && !isResizing && "shadow-sm",
        isDependencyDragging && "ring-1 ring-primary/30",
        // Lock type styling
        lockStyles?.border
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...(isResizing ? {} : { ...attributes, ...listeners })}
    >
      {/* Progress bar */}
      {feature.progress !== undefined && (
        <div
          className="absolute inset-y-0 left-0 bg-black/15"
          style={{ width: `${feature.progress}%` }}
        />
      )}

      {/* Content */}
      <span className="relative text-[10px] font-medium truncate">
        {feature.name}
      </span>

      {/* Tooltip */}
      {isHovered && !isDragging && !isResizing && !isDependencyDragging && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50">
          <div className="bg-popover text-popover-foreground text-[11px] px-3 py-2 shadow-lg border border-border whitespace-nowrap">
            <p className="font-medium">{feature.name}</p>
            <p className="text-muted-foreground font-mono">
              {format(feature.startAt, "MMM d")} – {format(feature.endAt, "MMM d, yyyy")}
            </p>
            <p className="text-muted-foreground">
              {duration} {duration === 1 ? "day" : "days"}
              {feature.progress !== undefined && ` • ${feature.progress}% complete`}
            </p>
            {lockStyles && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1 border-t border-border pt-1">
                {lockStyles.icon}
                <span>{lockStyles.label}</span>
              </p>
            )}
            {showConnectors && connectorContext && (
              <p className="text-muted-foreground text-[10px] mt-1 border-t border-border pt-1">
                Drag from dot to link • Resize from left edge
              </p>
            )}
          </div>
        </div>
      )}

      {/* Left side: Resize handle (stretch) */}
      {onUpdate && (isHovered || isResizing) && !isDependencyDragging && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center",
            "hover:bg-primary/20 transition-colors",
            isResizing === "left" && "bg-primary/20"
          )}
          onMouseDown={handleResizeStart("left")}
        >
          <div className="w-0.5 h-3 bg-current opacity-40" />
        </div>
      )}

      {/* Right side: Dependency connector dot */}
      {showConnectors && connectorContext && onUpdate && (isHovered || isDependencyDragging) && (
        <DependencyConnectorHandle feature={feature} position="end" />
      )}
    </div>
  );

  // Wrap with drop target if connector context is available
  const wrappedContent = connectorContext ? (
    <DependencyDropTarget feature={feature}>
      {featureContent}
    </DependencyDropTarget>
  ) : (
    featureContent
  );

  return (
    <GanttContextMenu
      feature={feature}
      allFeatures={allFeatures}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onCascadeUpdate={onCascadeUpdate}
      getDependentTasks={getDependentTasks}
    >
      {wrappedContent}
    </GanttContextMenu>
  );
}

type GanttFeatureListProps = {
  features: GanttFeature[];
  allFeatures?: GanttFeature[];
  onUpdate?: (feature: GanttFeature) => void;
  onDelete?: (featureId: string) => void;
  draggable?: boolean;
};

export function GanttFeatureList({
  features,
  allFeatures,
  onUpdate,
  onDelete,
  draggable = true,
}: GanttFeatureListProps) {
  const { rowHeight } = useGantt();

  return (
    <>
      {features.map((feature) => (
        <div
          key={feature.id}
          className="relative border-b border-border"
          style={{ height: rowHeight }}
        >
          <GanttFeatureItem
            feature={feature}
            allFeatures={allFeatures || features}
            onUpdate={onUpdate}
            onDelete={onDelete}
            draggable={draggable}
          />
        </div>
      ))}
    </>
  );
}
