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

  // PDF edge snap lock — once locked to a tick mark, hold it steady until cursor
  // moves beyond the snap threshold (prevents jitter from pixel-level recalculation)
  const pdfSnapLockRef = useRef<{ x: number; y: number } | null>(null);
  // All junction candidates from last PDF edge scan (for magnifier disambiguation)
  const lastPdfCandidatesRef = useRef<Array<{ x: number; y: number }>>([]);

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
    (x: number, y: number): { snapped: Point; isSnapped: boolean; snapType: SnapPoint["type"] | null; pdfCandidates?: Array<{ x: number; y: number }> } => {
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
      // Uses snap-lock: once locked to a tick mark, hold it steady until cursor leaves range
      if (config.snapToPdfEdges && pdfCanvas) {
        const locked = pdfSnapLockRef.current;
        if (locked) {
          const distToLocked = Math.sqrt((locked.x - x) ** 2 + (locked.y - y) ** 2);
          if (distToLocked < threshold) {
            // Still within range of locked tick mark — hold steady
            const candidates = lastPdfCandidatesRef.current;
            return {
              snapped: locked,
              isSnapped: true,
              snapType: "pdf-edge",
              pdfCandidates: candidates.length > 0 ? candidates : undefined,
            };
          }
          // Cursor moved away — release lock
          pdfSnapLockRef.current = null;
          lastPdfCandidatesRef.current = [];
        }

        const junctions = findPdfJunctions(x, y, pdfCanvas, threshold);
        lastPdfCandidatesRef.current = junctions;
        if (junctions.length > 0) {
          pdfSnapLockRef.current = junctions[0]; // Lock to nearest junction
          return {
            snapped: junctions[0],
            isSnapped: true,
            snapType: "pdf-edge",
            pdfCandidates: junctions.length > 0 ? junctions : undefined,
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

  // Override the PDF snap lock — used by magnifier to select a specific candidate
  const overridePdfSnap = useCallback((point: { x: number; y: number }) => {
    pdfSnapLockRef.current = point;
  }, []);

  return {
    findSnapPoint,
    getVisibleSnapPoints,
    snapToNearestEdge,
    overridePdfSnap,
    config,
  };
}

// =============================================================================
// PDF Edge Detection
// =============================================================================

// Detect ALL tick mark / line junctions on the PDF canvas within threshold range.
// Returns an array of distinct junction points sorted by distance to cursor.
// Nearby junctions are clustered so each tick mark appears only once.
// When multiple junctions exist, the magnifier can show them for disambiguation.
function findPdfJunctions(
  x: number,
  y: number,
  pdfCanvas: HTMLCanvasElement,
  thresholdPx: number
): Array<{ x: number; y: number }> {
  const dpr = window.devicePixelRatio || 1;
  const ctx = pdfCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const cx = Math.round(x * dpr);
  const cy = Math.round(y * dpr);
  const radius = Math.round(thresholdPx * dpr);

  const sx = Math.max(0, cx - radius);
  const sy = Math.max(0, cy - radius);
  const sw = Math.min(pdfCanvas.width - sx, radius * 2);
  const sh = Math.min(pdfCanvas.height - sy, radius * 2);
  if (sw <= 0 || sh <= 0) return [];

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const { data, width } = imageData;
  const brightThreshold = 128;

  const getBrightness = (canvasX: number, canvasY: number): number => {
    const lx = canvasX - sx;
    const ly = canvasY - sy;
    if (lx < 0 || lx >= sw || ly < 0 || ly >= sh) return 255;
    const idx = (ly * width + lx) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  };

  // Measure contiguous dark run from a pixel in an arbitrary direction (dx, dy)
  const measureDirectionalRun = (
    startX: number, startY: number, dx: number, dy: number
  ): number => {
    let count = 1; // include start pixel
    const limit = radius * 2;
    for (let d = 1; d <= limit; d++) {
      if (getBrightness(startX + dx * d, startY + dy * d) < brightThreshold) count++;
      else break;
    }
    for (let d = 1; d <= limit; d++) {
      if (getBrightness(startX - dx * d, startY - dy * d) < brightThreshold) count++;
      else break;
    }
    return count;
  };

  // Thresholds:
  // - Main line: long contiguous run (dimension line, wall edge)
  // - Tick mark: shorter run (the little dash at 45°/90°)
  const minLineRun = Math.max(8, Math.round(4 * dpr));
  const minTickRun = Math.max(4, Math.round(2 * dpr));

  // Collect dark pixel candidates sorted by distance to cursor
  const candidates: Array<{ canvasX: number; canvasY: number; dist: number }> = [];
  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const i = (py * width + px) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness < brightThreshold) {
        const canvasX = sx + px;
        const canvasY = sy + py;
        const dist = (canvasX - cx) ** 2 + (canvasY - cy) ** 2;
        candidates.push({ canvasX, canvasY, dist });
      }
    }
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.dist - b.dist);

  // Spread checks across the search area by skipping pixels too close to
  // already-checked ones. This avoids wasting budget on thick line interiors
  // and reaches junctions farther from the cursor.
  const skipRadius = Math.round(2 * dpr); // canvas pixels — skip nearby pixels already checked
  const checked: Array<{ x: number; y: number }> = [];
  const toCheck: typeof candidates = [];
  for (const c of candidates) {
    if (toCheck.length >= 200) break;
    const tooClose = checked.some(p =>
      Math.abs(p.x - c.canvasX) <= skipRadius && Math.abs(p.y - c.canvasY) <= skipRadius
    );
    if (!tooClose) {
      toCheck.push(c);
      checked.push({ x: c.canvasX, y: c.canvasY });
    }
  }
  const checkLimit = toCheck.length;

  const clusterRadius = 3; // page pixels — nearby junction pixels belong to same tick mark
  const junctions: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < checkLimit; i++) {
    const c = toCheck[i];

    // Measure dark runs in 4 directions from this pixel:
    // horizontal, vertical, 45° (NE-SW), 135° (NW-SE)
    const hRun  = measureDirectionalRun(c.canvasX, c.canvasY, 1, 0);
    const vRun  = measureDirectionalRun(c.canvasX, c.canvasY, 0, 1);
    const d45   = measureDirectionalRun(c.canvasX, c.canvasY, 1, -1);
    const d135  = measureDirectionalRun(c.canvasX, c.canvasY, 1, 1);

    const runs = [hRun, vRun, d45, d135];
    const hasMainLine = runs.some(r => r >= minLineRun);
    const tickDirs = runs.filter(r => r >= minTickRun).length;

    // Junction = at least one main line direction + at least one additional direction
    // This catches: tick marks (line + diagonal), line crossings, T-junctions, corners
    // Plain lines (only 1 direction) and noise (no direction) are filtered out
    if (hasMainLine && tickDirs >= 2) {
      const pageX = c.canvasX / dpr;
      const pageY = c.canvasY / dpr;

      // Cluster: skip if too close to an existing junction (same tick mark)
      const tooClose = junctions.some(j =>
        Math.sqrt((j.x - pageX) ** 2 + (j.y - pageY) ** 2) < clusterRadius
      );
      if (!tooClose) {
        junctions.push({ x: pageX, y: pageY });
      }
    }
  }

  return junctions;
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
