"use client";

import * as React from "react";
import { useGantt } from "./context";
import type { GanttFeature, GanttDependency, DependencyType } from "./types";

type DependencyLineProps = {
  from: GanttFeature;
  to: GanttFeature;
  fromIndex: number;
  toIndex: number;
  type?: DependencyType;
  lag?: number;
};

function DependencyLine({ from, to, fromIndex, toIndex, type = "FS", lag = 0 }: DependencyLineProps) {
  const { getDatePosition, rowHeight, sidebarWidth } = useGantt();

  // Calculate positions based on dependency type
  let fromX: number;
  let toX: number;

  switch (type) {
    case "SS": // Start-to-Start
      fromX = getDatePosition(from.startAt);
      toX = getDatePosition(to.startAt);
      break;
    case "FF": // Finish-to-Finish
      fromX = getDatePosition(from.endAt);
      toX = getDatePosition(to.endAt);
      break;
    case "SF": // Start-to-Finish
      fromX = getDatePosition(from.startAt);
      toX = getDatePosition(to.endAt);
      break;
    case "FS": // Finish-to-Start (default)
    default:
      fromX = getDatePosition(from.endAt);
      toX = getDatePosition(to.startAt);
      break;
  }

  // Y positions (center of each row)
  const fromY = fromIndex * rowHeight + rowHeight / 2;
  const toY = toIndex * rowHeight + rowHeight / 2;

  // Calculate path with rounded corners
  const isGoingDown = toY > fromY;
  const isGoingRight = toX > fromX;

  // Offset for the horizontal line coming out of the task
  const horizontalOffset = 12;
  // Radius for curved corners
  const radius = 6;
  // Arrow size
  const arrowSize = 5;

  // Build the path
  let path: string;

  if (type === "FS" || type === "SF") {
    // For FS/SF: exit right from source, enter left to target
    if (Math.abs(toY - fromY) < radius * 2) {
      // Same row or very close - simple horizontal line
      path = `M ${fromX} ${fromY} L ${toX - arrowSize} ${toY}`;
    } else if (isGoingRight && toX > fromX + horizontalOffset * 2) {
      // Going right with enough space - simple L-shape with curves
      // Midpoint X between the two tasks
      const midX = fromX + horizontalOffset + radius;
      path = `
        M ${fromX} ${fromY}
        L ${fromX + horizontalOffset} ${fromY}
        Q ${midX} ${fromY} ${midX} ${fromY + (isGoingDown ? radius : -radius)}
        L ${midX} ${toY + (isGoingDown ? -radius : radius)}
        Q ${midX} ${toY} ${midX + radius} ${toY}
        L ${toX - arrowSize} ${toY}
      `;
    } else {
      // Going left or not enough horizontal space - need to go around/down first
      // Calculate where to place the vertical line
      const verticalX = Math.min(fromX, toX) - horizontalOffset;
      path = `
        M ${fromX} ${fromY}
        L ${fromX + horizontalOffset} ${fromY}
        Q ${fromX + horizontalOffset + radius} ${fromY} ${fromX + horizontalOffset + radius} ${fromY + (isGoingDown ? radius : -radius)}
        L ${fromX + horizontalOffset + radius} ${(fromY + toY) / 2 - (isGoingDown ? radius : -radius)}
        Q ${fromX + horizontalOffset + radius} ${(fromY + toY) / 2} ${fromX + horizontalOffset} ${(fromY + toY) / 2}
        L ${verticalX + radius} ${(fromY + toY) / 2}
        Q ${verticalX} ${(fromY + toY) / 2} ${verticalX} ${(fromY + toY) / 2 + (isGoingDown ? radius : -radius)}
        L ${verticalX} ${toY + (isGoingDown ? -radius : radius)}
        Q ${verticalX} ${toY} ${verticalX + radius} ${toY}
        L ${toX - arrowSize} ${toY}
      `;
    }
  } else {
    // For SS/FF: simpler paths - exit left from source
    path = `
      M ${fromX} ${fromY}
      L ${fromX - horizontalOffset} ${fromY}
      Q ${fromX - horizontalOffset - radius} ${fromY} ${fromX - horizontalOffset - radius} ${fromY + (isGoingDown ? radius : -radius)}
      L ${fromX - horizontalOffset - radius} ${toY + (isGoingDown ? -radius : radius)}
      Q ${fromX - horizontalOffset - radius} ${toY} ${fromX - horizontalOffset} ${toY}
      L ${toX - (type === "SS" ? arrowSize : -arrowSize)} ${toY}
    `;
  }

  // Arrow head pointing to the target
  const arrowDirection = type === "FF" || type === "SF" ? "right" : "left";
  const arrowPath = arrowDirection === "left"
    ? `M ${toX} ${toY} L ${toX - arrowSize} ${toY - arrowSize / 2} L ${toX - arrowSize} ${toY + arrowSize / 2} Z`
    : `M ${toX} ${toY} L ${toX + arrowSize} ${toY - arrowSize / 2} L ${toX + arrowSize} ${toY + arrowSize / 2} Z`;

  // Label position (midpoint of path)
  const labelX = (fromX + toX) / 2;
  const labelY = (fromY + toY) / 2;

  // Format lag label
  const lagLabel = lag !== 0
    ? `${type}${lag > 0 ? "+" : ""}${lag}`
    : type !== "FS" ? type : null;

  return (
    <g className="gantt-dependency">
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-border"
      />
      {/* Arrow head */}
      <path
        d={arrowPath}
        fill="currentColor"
        className="text-border"
      />
      {/* Lag/type label */}
      {lagLabel && (
        <g>
          <rect
            x={labelX - 12}
            y={labelY - 7}
            width={24}
            height={14}
            rx={2}
            className="fill-background stroke-border"
          />
          <text
            x={labelX}
            y={labelY + 3}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px] font-mono"
          >
            {lagLabel}
          </text>
        </g>
      )}
    </g>
  );
}

type GanttDependenciesProps = {
  features: GanttFeature[];
  dependencies?: GanttDependency[];
  // Map of feature ID to visual row index (accounting for group headers)
  featureRowMap?: Map<string, number>;
};

export function GanttDependencies({ features, dependencies, featureRowMap }: GanttDependenciesProps) {
  const { rowHeight } = useGantt();

  // Build a map of feature ID to index for quick lookup
  // Use provided featureRowMap if available, otherwise calculate from flat array
  const featureIndexMap = React.useMemo(() => {
    if (featureRowMap) return featureRowMap;
    const map = new Map<string, number>();
    features.forEach((f, i) => map.set(f.id, i));
    return map;
  }, [features, featureRowMap]);

  // Build a map of feature ID to feature
  const featureMap = React.useMemo(() => {
    const map = new Map<string, GanttFeature>();
    features.forEach((f) => map.set(f.id, f));
    return map;
  }, [features]);

  // Collect all dependencies (both from explicit dependencies array and feature.dependencies)
  const allDependencies = React.useMemo(() => {
    const deps: { from: GanttFeature; to: GanttFeature; fromIndex: number; toIndex: number; type: DependencyType; lag: number }[] = [];

    // From explicit dependencies prop
    if (dependencies) {
      dependencies.forEach((dep) => {
        const from = featureMap.get(dep.fromId);
        const to = featureMap.get(dep.toId);
        const fromIndex = featureIndexMap.get(dep.fromId);
        const toIndex = featureIndexMap.get(dep.toId);

        if (from && to && fromIndex !== undefined && toIndex !== undefined) {
          deps.push({ from, to, fromIndex, toIndex, type: dep.type, lag: dep.lag || 0 });
        }
      });
    }

    // From feature.dependencies (simple array of IDs, assumes FS type with no lag)
    features.forEach((feature) => {
      if (feature.dependencies) {
        const toIndex = featureIndexMap.get(feature.id);
        if (toIndex === undefined) return;

        feature.dependencies.forEach((fromId) => {
          const from = featureMap.get(fromId);
          const fromIndex = featureIndexMap.get(fromId);

          if (from && fromIndex !== undefined) {
            deps.push({ from, to: feature, fromIndex, toIndex, type: "FS", lag: 0 });
          }
        });
      }
    });

    return deps;
  }, [features, dependencies, featureMap, featureIndexMap]);

  if (allDependencies.length === 0) return null;

  // Calculate SVG height based on actual row count (accounting for group headers if present)
  const maxRowIndex = featureRowMap
    ? Math.max(...Array.from(featureRowMap.values())) + 1
    : features.length;
  const svgHeight = maxRowIndex * rowHeight;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ height: svgHeight }}
    >
      {allDependencies.map((dep, i) => (
        <DependencyLine
          key={`${dep.from.id}-${dep.to.id}-${i}`}
          from={dep.from}
          to={dep.to}
          fromIndex={dep.fromIndex}
          toIndex={dep.toIndex}
          type={dep.type}
          lag={dep.lag}
        />
      ))}
    </svg>
  );
}
