"use client";

import { useCallback, useRef, useMemo } from "react";
import type { Point } from "./types";

// =============================================================================
// Types
// =============================================================================

interface SnapPoint {
  x: number;
  y: number;
  type: "endpoint" | "intersection" | "midpoint" | "perpendicular" | "edge" | "pdf-edge";
  sourceIndex?: number;
}

interface SnapConfig {
  enabled: boolean;
  threshold: number; // Pixels
  snapToEndpoints: boolean;
  snapToIntersections: boolean;
  snapToMidpoints: boolean;
  snapToEdges: boolean;
  snapToPdfEdges: boolean;
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
  pdfCanvas?: HTMLCanvasElement | null;
}

const DEFAULT_CONFIG: SnapConfig = {
  enabled: true,
  threshold: 10,
  snapToEndpoints: true,
  snapToIntersections: true,
  snapToMidpoints: true,
  snapToEdges: true,
  snapToPdfEdges: true,
  snapToGrid: false,
  gridSize: 50,
};

// =============================================================================
// Hook
// =============================================================================

export function useSnapPoints(options: UseSnapPointsOptions) {
  const { measurements, pageWidth, pageHeight, zoom, config: userConfig, pdfCanvas } = options;

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

      // If measurement snap found, use it (highest priority)
      if (nearestPoint) {
        return {
          snapped: { x: nearestPoint.x, y: nearestPoint.y },
          isSnapped: true,
          snapType: nearestPoint.type,
        };
      }

      // Try PDF edge snap (lower priority than measurement snaps, higher than grid)
      if (config.snapToPdfEdges && pdfCanvas) {
        const edgePoint = findNearestPdfEdge(x, y, pdfCanvas, threshold);
        if (edgePoint) {
          return {
            snapped: edgePoint,
            isSnapped: true,
            snapType: "pdf-edge",
          };
        }
      }

      // Check grid snap (lowest priority)
      if (config.snapToGrid) {
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

      return { snapped: { x, y }, isSnapped: false, snapType: null };
    },
    [config, zoom, extractSnapPoints, pdfCanvas]
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
// PDF Edge Detection
// =============================================================================

// Detect the nearest dark pixel (line/edge) on the PDF canvas near a given point.
// Samples a small region of pixels, finds the closest dark pixel cluster, then
// refines to the center of the line by scanning outward from the nearest hit.
function findNearestPdfEdge(
  x: number,
  y: number,
  pdfCanvas: HTMLCanvasElement,
  thresholdPx: number
): { x: number; y: number } | null {
  const dpr = window.devicePixelRatio || 1;
  const ctx = pdfCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  // Page coords → canvas pixels (pdfCanvas is rendered at scale=2*dpr, page dims are at scale=2)
  const cx = Math.round(x * dpr);
  const cy = Math.round(y * dpr);
  const radius = Math.round(thresholdPx * dpr);

  // Sample a square region around cursor
  const sx = Math.max(0, cx - radius);
  const sy = Math.max(0, cy - radius);
  const sw = Math.min(pdfCanvas.width - sx, radius * 2);
  const sh = Math.min(pdfCanvas.height - sy, radius * 2);
  if (sw <= 0 || sh <= 0) return null;

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const { data, width } = imageData;

  // Find nearest dark pixel (brightness below threshold = line/edge)
  let bestDist = Infinity;
  let bestX = cx;
  let bestY = cy;
  const brightThreshold = 128;

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const i = (py * width + px) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness < brightThreshold) {
        const canvasX = sx + px;
        const canvasY = sy + py;
        const dist = (canvasX - cx) ** 2 + (canvasY - cy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestX = canvasX;
          bestY = canvasY;
        }
      }
    }
  }

  // No dark pixels found in range
  if (bestDist === Infinity) return null;

  // Refine: scan outward from the nearest dark pixel in 4 cardinal directions
  // to find the full width of the line, then return the centroid for sub-pixel accuracy
  const refineAxis = (startPos: number, isHorizontal: boolean): number => {
    const getPixelBrightness = (pos: number): number => {
      const px = isHorizontal ? pos : bestX;
      const py = isHorizontal ? bestY : pos;
      if (px < 0 || py < 0 || px >= pdfCanvas.width || py >= pdfCanvas.height) return 255;
      // Read from the already-fetched imageData if in range, else return white
      const localX = px - sx;
      const localY = py - sy;
      if (localX < 0 || localX >= sw || localY < 0 || localY >= sh) return 255;
      const idx = (localY * width + localX) * 4;
      return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    };

    let lo = startPos;
    let hi = startPos;
    // Scan negative direction
    for (let d = 1; d <= radius; d++) {
      if (getPixelBrightness(startPos - d) < brightThreshold) {
        lo = startPos - d;
      } else break;
    }
    // Scan positive direction
    for (let d = 1; d <= radius; d++) {
      if (getPixelBrightness(startPos + d) < brightThreshold) {
        hi = startPos + d;
      } else break;
    }
    return (lo + hi) / 2;
  };

  const refinedX = refineAxis(bestX, true);
  const refinedY = refineAxis(bestY, false);

  // Convert back to page coords
  return { x: refinedX / dpr, y: refinedY / dpr };
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
