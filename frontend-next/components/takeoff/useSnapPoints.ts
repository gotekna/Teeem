"use client";

import { useCallback, useRef, useMemo } from "react";
import type { Point } from "./types";

// =============================================================================
// Types
// =============================================================================

interface SnapPoint {
  x: number;
  y: number;
  type: "endpoint" | "intersection" | "midpoint" | "perpendicular" | "edge";
  sourceIndex?: number;
}

interface SnapConfig {
  enabled: boolean;
  threshold: number; // Pixels
  snapToEndpoints: boolean;
  snapToIntersections: boolean;
  snapToMidpoints: boolean;
  snapToEdges: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

interface UseSnapPointsOptions {
  measurements: Array<{
    id: number;
    geometry_data: {
      points: Point[];
    };
  }>;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  config?: Partial<SnapConfig>;
}

const DEFAULT_CONFIG: SnapConfig = {
  enabled: true,
  threshold: 10,
  snapToEndpoints: true,
  snapToIntersections: true,
  snapToMidpoints: true,
  snapToEdges: true,
  snapToGrid: false,
  gridSize: 50,
};

// =============================================================================
// Hook
// =============================================================================

export function useSnapPoints(options: UseSnapPointsOptions) {
  const { measurements, pageWidth, pageHeight, zoom, config: userConfig } = options;

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...userConfig }),
    [userConfig]
  );

  // Cache for extracted snap points
  const snapPointsRef = useRef<SnapPoint[]>([]);
  const measurementsCacheRef = useRef<string>("");

  // Extract snap points from existing measurements
  const extractSnapPoints = useCallback(() => {
    // Check if measurements changed
    const cacheKey = JSON.stringify(measurements.map((m) => m.id));
    if (cacheKey === measurementsCacheRef.current) {
      return snapPointsRef.current;
    }

    const points: SnapPoint[] = [];

    measurements.forEach((measurement, idx) => {
      const geomPoints = measurement.geometry_data?.points || [];

      // Add endpoints
      if (config.snapToEndpoints) {
        geomPoints.forEach((p) => {
          points.push({
            x: p.x,
            y: p.y,
            type: "endpoint",
            sourceIndex: idx,
          });
        });
      }

      // Add midpoints
      if (config.snapToMidpoints && geomPoints.length >= 2) {
        for (let i = 0; i < geomPoints.length - 1; i++) {
          const p1 = geomPoints[i];
          const p2 = geomPoints[i + 1];
          points.push({
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
            type: "midpoint",
            sourceIndex: idx,
          });
        }
      }
    });

    // Add intersections between measurements
    if (config.snapToIntersections) {
      const lines: Array<{ p1: Point; p2: Point; idx: number }> = [];

      measurements.forEach((m, idx) => {
        const pts = m.geometry_data?.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          lines.push({ p1: pts[i], p2: pts[i + 1], idx });
        }
      });

      // Check all pairs of lines for intersections
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[i].idx === lines[j].idx) continue; // Same measurement

          const intersection = lineIntersection(
            lines[i].p1,
            lines[i].p2,
            lines[j].p1,
            lines[j].p2
          );

          if (intersection) {
            points.push({
              ...intersection,
              type: "intersection",
            });
          }
        }
      }
    }

    // Cache the results
    snapPointsRef.current = points;
    measurementsCacheRef.current = cacheKey;

    return points;
  }, [measurements, config.snapToEndpoints, config.snapToMidpoints, config.snapToIntersections]);

  // Find the nearest snap point to a given position
  const findSnapPoint = useCallback(
    (x: number, y: number): { snapped: Point; isSnapped: boolean; snapType: SnapPoint["type"] | null } => {
      if (!config.enabled) {
        return { snapped: { x, y }, isSnapped: false, snapType: null };
      }

      const threshold = config.threshold / zoom;
      const snapPoints = extractSnapPoints();

      let nearestPoint: SnapPoint | null = null;
      let nearestDistance = Infinity;

      // Check measurement snap points
      for (const point of snapPoints) {
        const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
        if (distance < threshold && distance < nearestDistance) {
          nearestDistance = distance;
          nearestPoint = point;
        }
      }

      // Check grid snap
      if (config.snapToGrid && !nearestPoint) {
        const gridX = Math.round(x / config.gridSize) * config.gridSize;
        const gridY = Math.round(y / config.gridSize) * config.gridSize;
        const gridDistance = Math.sqrt((gridX - x) ** 2 + (gridY - y) ** 2);

        if (gridDistance < threshold) {
          return {
            snapped: { x: gridX, y: gridY },
            isSnapped: true,
            snapType: "edge", // Use edge as grid snap indicator
          };
        }
      }

      if (nearestPoint) {
        return {
          snapped: { x: nearestPoint.x, y: nearestPoint.y },
          isSnapped: true,
          snapType: nearestPoint.type,
        };
      }

      return { snapped: { x, y }, isSnapped: false, snapType: null };
    },
    [config, zoom, extractSnapPoints]
  );

  // Get all visible snap points for rendering snap indicators
  const getVisibleSnapPoints = useCallback(
    (viewport: { x: number; y: number; width: number; height: number }) => {
      if (!config.enabled) return [];

      const snapPoints = extractSnapPoints();
      const margin = config.threshold * 2;

      return snapPoints.filter(
        (p) =>
          p.x >= viewport.x - margin &&
          p.x <= viewport.x + viewport.width + margin &&
          p.y >= viewport.y - margin &&
          p.y <= viewport.y + viewport.height + margin
      );
    },
    [config, extractSnapPoints]
  );

  // Snap a point to the nearest edge of existing measurements
  const snapToNearestEdge = useCallback(
    (x: number, y: number): { snapped: Point; isSnapped: boolean } => {
      if (!config.enabled || !config.snapToEdges) {
        return { snapped: { x, y }, isSnapped: false };
      }

      const threshold = config.threshold / zoom;
      let nearestPoint: Point | null = null;
      let nearestDistance = Infinity;

      measurements.forEach((m) => {
        const points = m.geometry_data?.points || [];
        for (let i = 0; i < points.length - 1; i++) {
          const projected = projectPointOntoLine(
            { x, y },
            points[i],
            points[i + 1]
          );
          if (projected) {
            const distance = Math.sqrt(
              (projected.x - x) ** 2 + (projected.y - y) ** 2
            );
            if (distance < threshold && distance < nearestDistance) {
              nearestDistance = distance;
              nearestPoint = projected;
            }
          }
        }
      });

      if (nearestPoint) {
        return { snapped: nearestPoint, isSnapped: true };
      }

      return { snapped: { x, y }, isSnapped: false };
    },
    [config, zoom, measurements]
  );

  return {
    findSnapPoint,
    getVisibleSnapPoints,
    snapToNearestEdge,
    config,
  };
}

// =============================================================================
// Geometry Utilities
// =============================================================================

// Calculate intersection point of two line segments
function lineIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null; // Parallel lines

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

// Project a point onto a line segment, returning the closest point on the segment
function projectPointOntoLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): Point | null {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 0.0001) return null; // Line segment is too short

  // Calculate projection parameter
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
    )
  );

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
}

// =============================================================================
// Export
// =============================================================================

export type { SnapPoint, SnapConfig };
