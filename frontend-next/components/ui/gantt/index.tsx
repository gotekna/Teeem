"use client";

import * as React from "react";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { GanttProvider, useGantt } from "./context";
import { GanttHeader } from "./gantt-header";
import { GanttSidebar, GanttSidebarGroup, GanttSidebarItem } from "./gantt-sidebar";
import { GanttTimeline, GanttTimelineRow } from "./gantt-timeline";
import { GanttFeatureItem } from "./gantt-feature";
import { GanttToday } from "./gantt-today";
import { GanttMarkers } from "./gantt-marker";
import { GanttControls, type GanttViewMode } from "./gantt-controls";
import { GanttDependencies } from "./gantt-dependencies";
import { GanttTableView } from "./gantt-table-view";
import { DependencyConnectorProvider } from "./gantt-dependency-connector";
import type { GanttRange, GanttFeature, GanttMarker as GanttMarkerType, GanttGroup, GanttDependency, HoldState } from "./types";
import type { CascadeResolution } from "./gantt-cascade-modal";

// Re-export all components and types
export { GanttProvider, useGantt } from "./context";
export { GanttHeader } from "./gantt-header";
export { GanttSidebar, GanttSidebarGroup, GanttSidebarItem } from "./gantt-sidebar";
export { GanttTimeline, GanttTimelineRow } from "./gantt-timeline";
export { GanttFeatureItem, GanttFeatureList } from "./gantt-feature";
export { GanttToday } from "./gantt-today";
export { GanttMarker, GanttMarkers } from "./gantt-marker";
export { GanttControls, type GanttViewMode } from "./gantt-controls";
export { GanttDependencies } from "./gantt-dependencies";
export { GanttTableView } from "./gantt-table-view";
export { GanttContextMenu } from "./gantt-context-menu";
export {
  CascadePreviewModal,
  calculateCascadeEffects,
  type CascadeAffectedTask,
  type CascadeResolution,
} from "./gantt-cascade-modal";
export {
  DependencyConnectorProvider,
  DependencyConnectorHandle,
  DependencyDropTarget,
  useDependencyConnector,
} from "./gantt-dependency-connector";
export { defaultStatuses, holdReasons } from "./types";
export type { GanttRange, GanttStatus, GanttFeature, GanttMarker as GanttMarkerType, GanttGroup, GanttDependency, DependencyType, LockType, HoldReason, HoldState } from "./types";

// Dashboard & Analytics components (migrated from sm-gantt)
export * from "./SmDashboardCharts";
export * from "./SmAnalyticsComponents";

// Filter, View, and Column components
export { GanttFilterPanel, type GanttFilters } from "./gantt-filter-panel";
export { GanttViewSelector, type GanttGroupMode } from "./gantt-view-selector";
export { GanttColumnConfig, defaultColumnConfig, type ColumnConfig } from "./gantt-column-config";

// Composed Gantt Chart component for easy use
type GanttChartProps = {
  features?: GanttFeature[];
  groups?: GanttGroup[];
  markers?: GanttMarkerType[];
  dependencies?: GanttDependency[];
  defaultRange?: GanttRange;
  showControls?: boolean;
  showSidebar?: boolean;
  showToday?: boolean;
  showDependencies?: boolean;
  showConnectors?: boolean;
  title?: string;
  className?: string;
  holdState?: HoldState;
  onFeatureUpdate?: (feature: GanttFeature) => void;
  onFeatureDelete?: (featureId: string) => void;
  onCreateDependency?: (fromId: string, toId: string) => void;
  onCascadeUpdate?: (sourceFeature: GanttFeature, resolutions: CascadeResolution[]) => void;
  getDependentTasks?: (taskId: string) => string[];
};

type GanttChartInnerProps = Omit<GanttChartProps, "defaultRange"> & {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

function GanttChartInner({
  features = [],
  groups = [],
  markers = [],
  dependencies = [],
  showControls = true,
  showSidebar = true,
  showToday = true,
  showDependencies = true,
  showConnectors = true,
  title,
  className,
  holdState,
  onFeatureUpdate,
  onFeatureDelete,
  onCreateDependency,
  onCascadeUpdate,
  getDependentTasks,
  isFullscreen,
  onToggleFullscreen,
}: GanttChartInnerProps) {
  const { getDateFromPosition, getDatePosition } = useGantt();
  const [viewMode, setViewMode] = React.useState<GanttViewMode>("timeline");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (!delta.x || !onFeatureUpdate) return;

    const feature = active.data.current?.feature as GanttFeature;
    if (!feature) return;

    // Calculate new dates based on drag delta
    const currentLeft = getDatePosition(feature.startAt);
    const newLeft = currentLeft + delta.x;
    const newStartAt = getDateFromPosition(newLeft);

    const duration = feature.endAt.getTime() - feature.startAt.getTime();
    const newEndAt = new Date(newStartAt.getTime() + duration);

    onFeatureUpdate({
      ...feature,
      startAt: newStartAt,
      endAt: newEndAt,
    });
  };

  // Flatten all features for dependency tracking
  const allFeatures = React.useMemo(() => {
    const flat: GanttFeature[] = [...features];
    groups.forEach((group) => {
      flat.push(...group.features);
    });
    return flat;
  }, [features, groups]);

  // Build a map of feature ID to visual row index (accounting for group headers)
  const featureRowMap = React.useMemo(() => {
    const map = new Map<string, number>();
    let rowIndex = 0;

    // Ungrouped features first
    features.forEach((f) => {
      map.set(f.id, rowIndex);
      rowIndex++;
    });

    // Then grouped features (each group has a header row)
    groups.forEach((group) => {
      rowIndex++; // Group header row
      group.features.forEach((f) => {
        map.set(f.id, rowIndex);
        rowIndex++;
      });
    });

    return map;
  }, [features, groups]);

  // Use a stable ID to prevent hydration mismatch with dnd-kit
  const dndContextId = React.useId();

  const content = (
    <DependencyConnectorProvider onCreateDependency={onCreateDependency}>
      <DndContext id={dndContextId} sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={cn(
          "flex flex-col border border-border bg-background overflow-hidden",
          isFullscreen ? "h-full" : "",
          className
        )}>
          {/* Controls */}
          {showControls && (
            <GanttControls
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              title={title}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              holdState={holdState}
            />
          )}

          {/* Table View */}
          {viewMode === "table" ? (
            <GanttTableView
              features={features}
              groups={groups}
              allFeatures={allFeatures}
              onFeatureUpdate={onFeatureUpdate}
              onFeatureDelete={onFeatureDelete}
              onCascadeUpdate={onCascadeUpdate}
              getDependentTasks={getDependentTasks}
            />
          ) : (
            /* Single scroll container for header, sidebar, and timeline */
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="flex flex-col min-w-max">
                {/* Header row - sticky top */}
                <div className="sticky top-0 z-20 bg-background">
                  <GanttHeader />
                </div>

                {/* Body row */}
                <div className="flex">
                  {/* Sidebar - sticky left */}
                  {showSidebar && (
                    <div className="sticky left-0 z-10 bg-background">
                      <GanttSidebar>
                        {/* Ungrouped features */}
                        {features.map((feature) => (
                          <GanttSidebarItem key={feature.id} feature={feature} />
                        ))}

                        {/* Grouped features */}
                        {groups.map((group) => (
                          <GanttSidebarGroup key={group.id} group={group}>
                            {group.features.map((feature) => (
                              <GanttSidebarItem key={feature.id} feature={feature} />
                            ))}
                          </GanttSidebarGroup>
                        ))}
                      </GanttSidebar>
                    </div>
                  )}

                  {/* Timeline */}
                  <GanttTimeline>
                    {/* Today marker */}
                    {showToday && <GanttToday />}

                    {/* Milestone markers */}
                    <GanttMarkers markers={markers} />

                    {/* Dependencies layer - render behind feature bars */}
                    {showDependencies && (
                      <GanttDependencies
                        features={allFeatures}
                        dependencies={dependencies}
                        featureRowMap={featureRowMap}
                      />
                    )}

                    {/* Feature bars */}
                    {features.map((feature) => (
                      <GanttTimelineRow key={feature.id}>
                        <GanttFeatureItem
                          feature={feature}
                          allFeatures={allFeatures}
                          onUpdate={onFeatureUpdate}
                          onDelete={onFeatureDelete}
                          onCascadeUpdate={onCascadeUpdate}
                          getDependentTasks={getDependentTasks}
                          draggable={!!onFeatureUpdate}
                          showConnectors={showConnectors && !!onCreateDependency}
                        />
                      </GanttTimelineRow>
                    ))}

                    {/* Grouped features */}
                    {groups.map((group) => (
                      <React.Fragment key={group.id}>
                        {/* Group header row */}
                        <div
                          className="bg-secondary/30 border-b border-border"
                          style={{ height: 40 }}
                        />
                        {/* Group features */}
                        {group.features.map((feature) => (
                          <GanttTimelineRow key={feature.id}>
                            <GanttFeatureItem
                              feature={feature}
                              allFeatures={allFeatures}
                              onUpdate={onFeatureUpdate}
                              onDelete={onFeatureDelete}
                              onCascadeUpdate={onCascadeUpdate}
                              getDependentTasks={getDependentTasks}
                              draggable={!!onFeatureUpdate}
                              showConnectors={showConnectors && !!onCreateDependency}
                            />
                          </GanttTimelineRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </GanttTimeline>
                </div>
              </div>
            </div>
          )}
        </div>
      </DndContext>
    </DependencyConnectorProvider>
  );

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {content}
      </div>
    );
  }

  return content;
}

export function GanttChart({
  defaultRange = "monthly",
  features = [],
  groups = [],
  markers = [],
  dependencies = [],
  title = "Project Timeline",
  ...props
}: GanttChartProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Handle escape key to exit fullscreen
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  return (
    <GanttProvider
      defaultRange={defaultRange}
      features={features}
      groups={groups}
      markers={markers}
    >
      <GanttChartInner
        features={features}
        groups={groups}
        markers={markers}
        dependencies={dependencies}
        title={title}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        {...props}
      />
    </GanttProvider>
  );
}
