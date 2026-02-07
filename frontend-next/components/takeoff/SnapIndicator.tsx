"use client";

import * as React from "react";
import type { SnapPoint } from "./useSnapPoints";

// =============================================================================
// Types
// =============================================================================

interface SnapIndicatorProps {
  point: { x: number; y: number } | null;
  snapType: SnapPoint["type"] | null;
  zoom: number;
  isSnapped: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function SnapIndicator({ point, snapType, zoom, isSnapped }: SnapIndicatorProps) {
  if (!point || !isSnapped) return null;

  const size = 8 / zoom;
  const strokeWidth = 1.5 / zoom;

  // Get color based on snap type
  const getColor = () => {
    switch (snapType) {
      case "endpoint":
        return "#22c55e"; // Green
      case "midpoint":
        return "#3b82f6"; // Blue
      case "intersection":
        return "#f97316"; // Orange
      case "perpendicular":
        return "#a855f7"; // Purple
      case "edge":
        return "#06b6d4"; // Cyan
      case "pdf-edge":
        return "#ec4899"; // Magenta/pink — visually distinct from all other snap types
      default:
        return "#6b7280"; // Gray
    }
  };

  const color = getColor();

  return (
    <g className="snap-indicator" style={{ pointerEvents: "none" }}>
      {/* Outer circle */}
      <circle
        cx={point.x}
        cy={point.y}
        r={size}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={0.8}
      />

      {/* Inner indicator based on type */}
      {snapType === "endpoint" && (
        // Square for endpoints
        <rect
          x={point.x - size / 2}
          y={point.y - size / 2}
          width={size}
          height={size}
          fill={color}
          opacity={0.3}
          stroke={color}
          strokeWidth={strokeWidth / 2}
        />
      )}

      {snapType === "midpoint" && (
        // Triangle for midpoints
        <polygon
          points={`${point.x},${point.y - size / 2} ${point.x - size / 2},${point.y + size / 2} ${point.x + size / 2},${point.y + size / 2}`}
          fill={color}
          opacity={0.3}
          stroke={color}
          strokeWidth={strokeWidth / 2}
        />
      )}

      {snapType === "intersection" && (
        // X for intersections
        <>
          <line
            x1={point.x - size / 2}
            y1={point.y - size / 2}
            x2={point.x + size / 2}
            y2={point.y + size / 2}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <line
            x1={point.x + size / 2}
            y1={point.y - size / 2}
            x2={point.x - size / 2}
            y2={point.y + size / 2}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </>
      )}

      {(snapType === "perpendicular" || snapType === "edge") && (
        // Plus for perpendicular/edge
        <>
          <line
            x1={point.x - size / 2}
            y1={point.y}
            x2={point.x + size / 2}
            y2={point.y}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <line
            x1={point.x}
            y1={point.y - size / 2}
            x2={point.x}
            y2={point.y + size / 2}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </>
      )}

      {snapType === "pdf-edge" && (
        // Crosshair with center dot for PDF edge snap
        <>
          <line
            x1={point.x - size}
            y1={point.y}
            x2={point.x + size}
            y2={point.y}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <line
            x1={point.x}
            y1={point.y - size}
            x2={point.x}
            y2={point.y + size}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={point.x}
            cy={point.y}
            r={size / 3}
            fill={color}
            opacity={0.5}
          />
        </>
      )}

      {/* Tooltip showing snap type */}
      <text
        x={point.x + size * 1.5}
        y={point.y - size}
        fontSize={10 / zoom}
        fill={color}
        fontFamily="system-ui"
      >
        {snapType}
      </text>
    </g>
  );
}

// =============================================================================
// Snap Points Layer - Renders all visible snap points as subtle indicators
// =============================================================================

interface SnapPointsLayerProps {
  snapPoints: SnapPoint[];
  zoom: number;
  showAll?: boolean;
}

export function SnapPointsLayer({ snapPoints, zoom, showAll = false }: SnapPointsLayerProps) {
  if (!showAll || snapPoints.length === 0) return null;

  const size = 3 / zoom;

  return (
    <g className="snap-points-layer" style={{ pointerEvents: "none" }}>
      {snapPoints.map((point, idx) => (
        <circle
          key={`${point.x}-${point.y}-${idx}`}
          cx={point.x}
          cy={point.y}
          r={size}
          fill={getSnapPointColor(point.type)}
          opacity={0.3}
        />
      ))}
    </g>
  );
}

function getSnapPointColor(type: SnapPoint["type"]): string {
  switch (type) {
    case "endpoint":
      return "#22c55e";
    case "midpoint":
      return "#3b82f6";
    case "intersection":
      return "#f97316";
    case "perpendicular":
      return "#a855f7";
    case "edge":
      return "#06b6d4";
    case "pdf-edge":
      return "#ec4899";
    default:
      return "#6b7280";
  }
}
