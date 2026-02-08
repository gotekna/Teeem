"use client";

import * as React from "react";
import type { SnapPoint } from "./useSnapPoints";
import { findPdfJunctions } from "./useSnapPoints";

// =============================================================================
// Helpers
// =============================================================================

/** Convert a mouse/pointer event position within a magnifier to PDF page coordinates */
function magEventToPdf(
  e: React.MouseEvent | MouseEvent,
  containerEl: HTMLElement,
  magSize: number,
  centerX: number,
  centerY: number,
  cropSize: number,
): { x: number; y: number } | null {
  const rect = containerEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Only accept clicks inside the circular magnifier
  const dx = mx - magSize / 2;
  const dy = my - magSize / 2;
  if (dx * dx + dy * dy > (magSize / 2) * (magSize / 2)) return null;
  return {
    x: centerX + (mx / magSize - 0.5) * cropSize,
    y: centerY + (my / magSize - 0.5) * cropSize,
  };
}

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

// =============================================================================
// Pinned Magnifier — fixed zoomed PDF view at a calibration endpoint
// =============================================================================

const PINNED_MAG_SIZE = 140;

interface PinnedMagnifierProps {
  point: { x: number; y: number };
  pdfCanvas: HTMLCanvasElement;
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  label: string;
  color: string;
  /** Preferred side to position relative to endpoint: "left" or "right" */
  preferSide?: "left" | "right";
  /** Called when user clicks a different candidate to adjust this endpoint */
  onSelect?: (candidate: { x: number; y: number }) => void;
}

export function PinnedMagnifier({
  point, pdfCanvas, zoom, pageWidth, pageHeight, label, color,
  preferSide = "left", onSelect,
}: PinnedMagnifierProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [candidates, setCandidates] = React.useState<Array<{ x: number; y: number }>>([]);
  // Local active point for immediate visual feedback (before backend save completes)
  const [activePoint, setActivePoint] = React.useState(point);

  // Sync local active point when prop changes (after backend save)
  React.useEffect(() => {
    setActivePoint(point);
  }, [point.x, point.y]);

  // Detect junction candidates near this endpoint
  React.useEffect(() => {
    const threshold = 20; // page pixels search radius
    const junctions = findPdfJunctions(activePoint.x, activePoint.y, pdfCanvas, threshold);
    // Always include the current active point as a candidate
    const hasCurrentPoint = junctions.some(j =>
      Math.sqrt((j.x - activePoint.x) ** 2 + (j.y - activePoint.y) ** 2) < 1.5
    );
    if (!hasCurrentPoint) {
      setCandidates([activePoint, ...junctions]);
    } else {
      setCandidates(junctions);
    }
  }, [activePoint, pdfCanvas]);

  // Compute crop area: center on centroid of all candidates
  const allPoints = candidates.length > 0 ? candidates : [activePoint];
  const centerX = allPoints.reduce((s, c) => s + c.x, 0) / allPoints.length;
  const centerY = allPoints.reduce((s, c) => s + c.y, 0) / allPoints.length;
  const maxSpread = allPoints.reduce((max, c) => {
    return Math.max(max, Math.abs(c.x - centerX), Math.abs(c.y - centerY));
  }, 0);
  const cropSize = Math.max(12, (maxSpread + 6) * 2);

  // Draw the zoomed PDF crop with candidate markers
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PINNED_MAG_SIZE * dpr;
    canvas.height = PINNED_MAG_SIZE * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, PINNED_MAG_SIZE, PINNED_MAG_SIZE);
    ctx.save();

    // Circular clip
    ctx.beginPath();
    ctx.arc(PINNED_MAG_SIZE / 2, PINNED_MAG_SIZE / 2, PINNED_MAG_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw zoomed PDF crop
    const pdfDpr = window.devicePixelRatio || 1;
    const srcX = (centerX - cropSize / 2) * pdfDpr;
    const srcY = (centerY - cropSize / 2) * pdfDpr;
    const srcW = cropSize * pdfDpr;
    const srcH = cropSize * pdfDpr;
    ctx.drawImage(pdfCanvas, srcX, srcY, srcW, srcH, 0, 0, PINNED_MAG_SIZE, PINNED_MAG_SIZE);

    // Draw candidate markers
    allPoints.forEach((c, i) => {
      const mx = ((c.x - centerX + cropSize / 2) / cropSize) * PINNED_MAG_SIZE;
      const my = ((c.y - centerY + cropSize / 2) / cropSize) * PINNED_MAG_SIZE;
      const isActive = Math.abs(c.x - activePoint.x) < 0.5 && Math.abs(c.y - activePoint.y) < 0.5;
      const cColor = isActive ? "#22c55e" : "#ec4899";
      const armLen = 16;

      // Crosshair
      ctx.strokeStyle = cColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx - armLen, my); ctx.lineTo(mx - 3, my);
      ctx.moveTo(mx + 3, my); ctx.lineTo(mx + armLen, my);
      ctx.moveTo(mx, my - armLen); ctx.lineTo(mx, my - 3);
      ctx.moveTo(mx, my + 3); ctx.lineTo(mx, my + armLen);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = cColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Number label
      if (allPoints.length > 1) {
        const lbX = mx + 8;
        const lbY = my - 8;
        ctx.beginPath();
        ctx.arc(lbX, lbY, 7, 0, Math.PI * 2);
        ctx.fillStyle = cColor;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), lbX, lbY);
      }
    });

    ctx.restore();

    // Border
    ctx.beginPath();
    ctx.arc(PINNED_MAG_SIZE / 2, PINNED_MAG_SIZE / 2, PINNED_MAG_SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Magnification label
    const mag = Math.round(PINNED_MAG_SIZE / cropSize);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    const lw = 36, lh = 18;
    const lx = PINNED_MAG_SIZE / 2 - lw / 2;
    const ly = PINNED_MAG_SIZE - lh - 4;
    ctx.beginPath();
    ctx.rect(lx, ly, lw, lh);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mag}x`, PINNED_MAG_SIZE / 2, ly + lh / 2);
  }, [activePoint, pdfCanvas, color, cropSize, centerX, centerY, allPoints]);

  // Position: offset to preferred side of the endpoint
  const screenX = activePoint.x * zoom;
  const screenY = activePoint.y * zoom;
  const maxRight = pageWidth * zoom;
  const maxBottom = pageHeight * zoom;

  let posLeft = preferSide === "left"
    ? screenX - PINNED_MAG_SIZE - 30
    : screenX + 30;
  let posTop = screenY - PINNED_MAG_SIZE / 2;

  // Clamp to visible area
  if (posLeft + PINNED_MAG_SIZE > maxRight) posLeft = screenX - PINNED_MAG_SIZE - 30;
  if (posLeft < 0) posLeft = screenX + 30;
  if (posTop < 0) posTop = 10;
  if (posTop + PINNED_MAG_SIZE + 20 > maxBottom) posTop = maxBottom - PINNED_MAG_SIZE - 30;

  const magCenterX = posLeft + PINNED_MAG_SIZE / 2;
  const magCenterY = posTop + PINNED_MAG_SIZE / 2;

  return (
    <>
      {/* Dashed connector line from magnifier to endpoint */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: maxRight, height: maxBottom, overflow: "visible" }}
      >
        <line
          x1={magCenterX} y1={magCenterY}
          x2={screenX} y2={screenY}
          stroke={color} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6"
        />
      </svg>
      <div
        className="absolute"
        style={{
          left: posLeft,
          top: posTop,
          width: PINNED_MAG_SIZE,
          height: PINNED_MAG_SIZE + 20,
          pointerEvents: "none",
          zIndex: 50, // Must be above Fabric.js upper canvas AND calibration overlays (z-10)
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: PINNED_MAG_SIZE,
            height: PINNED_MAG_SIZE,
            borderRadius: "50%",
          }}
        />
        {/* Interactive overlay — click anywhere or drag to fine-tune */}
        {onSelect && (
          <MagnifierInteractiveOverlay
            magSize={PINNED_MAG_SIZE}
            centerX={centerX}
            centerY={centerY}
            cropSize={cropSize}
            candidates={allPoints}
            activeCandidate={activePoint}
            onSelect={(pt) => {
              setActivePoint(pt);
              onSelect(pt);
            }}
            onPreview={(pt) => setActivePoint(pt)}
          />
        )}
        <div
          className="text-xs font-bold text-center"
          style={{ marginTop: 2, color, pointerEvents: "none" }}
        >
          {label}{allPoints.length > 1 ? ` (${allPoints.length} points)` : ""}
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Snap Magnifier — zoomed PDF crop with selectable junction candidates
// =============================================================================

// =============================================================================
// MagnifierInteractiveOverlay — click anywhere / drag to fine-tune point
// Shared between SnapMagnifier and PinnedMagnifier
// =============================================================================

interface MagnifierInteractiveOverlayProps {
  magSize: number;
  centerX: number;
  centerY: number;
  cropSize: number;
  candidates: Array<{ x: number; y: number }>;
  activeCandidate: { x: number; y: number };
  /** Called on click or drag-release with the final position */
  onSelect: (point: { x: number; y: number }) => void;
  /** Called during drag with intermediate positions (for live preview) */
  onPreview?: (point: { x: number; y: number }) => void;
}

function MagnifierInteractiveOverlay({
  magSize, centerX, centerY, cropSize, candidates, activeCandidate, onSelect, onPreview,
}: MagnifierInteractiveOverlayProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  // Store the point from pointerDown so we always have a position for onSelect
  const downPoint = React.useRef<{ x: number; y: number } | null>(null);

  const getPdfPoint = React.useCallback((e: React.MouseEvent | React.PointerEvent) => {
    const el = overlayRef.current;
    if (!el) return null;
    return magEventToPdf(e, el, magSize, centerX, centerY, cropSize);
  }, [magSize, centerX, centerY, cropSize]);

  // ⚠️ DO NOT SIMPLIFY — Fabric.js event interception (2026-02-08)
  // ════════════════════════════════════════════════════════════
  // Why: Fabric.js creates an "upper-canvas" that listens for mouse events
  // on the same area. Even though our overlay div is later in DOM order,
  // Fabric's event listeners on the upper-canvas can race with ours.
  // We call onSelect on pointerDown (not click/pointerUp) because
  // pointerDown is the FIRST event that fires — before Fabric can interfere.
  // For drag: pointerDown starts, pointerMove previews, pointerUp finalizes.
  // CRITICAL: stopPropagation/preventDefault must come AFTER getPdfPoint()
  // validation — if the click is outside the circle, we MUST let it through
  // so the Fabric canvas can process the click as a calibration point placement.
  // ❌ WRONG: onClick or onPointerUp — may never fire if Fabric captures mouse
  // ❌ WRONG: stopPropagation before circle check — eats clicks outside circle
  // ✅ CORRECT: onPointerDown for instant click, validate first, then prevent
  // ════════════════════════════════════════════════════════════
  const hasMoved = React.useRef(false);

  // ⚠️ DO NOT SIMPLIFY — Fabric.js event interception order matters (2026-02-08)
  // stopPropagation/preventDefault MUST come AFTER getPdfPoint validation.
  // If the click is outside the circular magnifier area, we let it fall through
  // so the Fabric canvas (or whatever is beneath) can process the click.
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    const pt = getPdfPoint(e);
    if (!pt) return; // Outside circle — let event pass through to canvas below
    e.stopPropagation();
    e.preventDefault(); // Prevent Fabric from also seeing this as a mousedown
    dragging.current = true;
    hasMoved.current = false;
    downPoint.current = pt;
    // For simple clicks (no drag), select immediately
    // If user drags, pointerMove sets hasMoved and pointerUp will re-select at final position
    onSelect(pt);
  }, [getPdfPoint, onSelect]);

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    hasMoved.current = true;
    const pt = getPdfPoint(e);
    if (pt) {
      downPoint.current = pt;
      if (onPreview) onPreview(pt);
    }
  }, [getPdfPoint, onPreview]);

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.stopPropagation();
    // If user dragged, update to final position
    if (hasMoved.current) {
      const pt = getPdfPoint(e) ?? downPoint.current;
      if (pt) onSelect(pt);
    }
    downPoint.current = null;
  }, [getPdfPoint, onSelect]);

  return (
    <div
      ref={overlayRef}
      className="absolute top-0 left-0"
      style={{
        width: magSize,
        height: magSize,
        borderRadius: "50%",
        cursor: "crosshair",
        pointerEvents: "auto",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Candidate hit-target badges (larger touch targets over detected points) */}
      {candidates.map((c, i) => {
        const mx = ((c.x - centerX + cropSize / 2) / cropSize) * magSize;
        const my = ((c.y - centerY + cropSize / 2) / cropSize) * magSize;
        const isActive = Math.abs(c.x - activeCandidate.x) < 0.5
          && Math.abs(c.y - activeCandidate.y) < 0.5;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: mx - 10,
              top: my - 10,
              width: 20,
              height: 20,
              border: isActive ? "2px solid #22c55e" : "1px solid rgba(236,72,153,0.4)",
              background: isActive ? "rgba(34,197,94,0.15)" : "transparent",
              pointerEvents: "none", // parent overlay handles all pointer events
            }}
          />
        );
      })}
    </div>
  );
}

const MAG_SIZE = 180;

interface SnapMagnifierProps {
  candidates: Array<{ x: number; y: number }>;
  activeCandidate: { x: number; y: number };
  pdfCanvas: HTMLCanvasElement;
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  onSelect: (candidate: { x: number; y: number }) => void;
  /** Called during drag for live preview without finalizing */
  onPreview?: (candidate: { x: number; y: number }) => void;
}

export function SnapMagnifier({
  candidates,
  activeCandidate,
  pdfCanvas,
  zoom,
  pageWidth,
  pageHeight,
  onSelect,
  onPreview,
}: SnapMagnifierProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Center the crop on the centroid of all candidates
  const centerX = candidates.reduce((s, c) => s + c.x, 0) / candidates.length;
  const centerY = candidates.reduce((s, c) => s + c.y, 0) / candidates.length;

  // Adaptive crop size: contain all candidates plus padding
  const maxSpread = candidates.reduce((max, c) => {
    return Math.max(max, Math.abs(c.x - centerX), Math.abs(c.y - centerY));
  }, 0);
  const cropSize = Math.max(15, (maxSpread + 8) * 2);

  // Draw the zoomed PDF crop with candidate markers
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAG_SIZE * dpr;
    canvas.height = MAG_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
    ctx.save();

    // Circular clip
    ctx.beginPath();
    ctx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw zoomed PDF crop
    const pdfDpr = window.devicePixelRatio || 1;
    const srcX = (centerX - cropSize / 2) * pdfDpr;
    const srcY = (centerY - cropSize / 2) * pdfDpr;
    const srcW = cropSize * pdfDpr;
    const srcH = cropSize * pdfDpr;
    ctx.drawImage(pdfCanvas, srcX, srcY, srcW, srcH, 0, 0, MAG_SIZE, MAG_SIZE);

    // Draw candidate markers with precise crosshair
    candidates.forEach((c, i) => {
      const mx = ((c.x - centerX + cropSize / 2) / cropSize) * MAG_SIZE;
      const my = ((c.y - centerY + cropSize / 2) / cropSize) * MAG_SIZE;
      const isActive = c.x === activeCandidate.x && c.y === activeCandidate.y;
      const color = isActive ? "#22c55e" : "#ec4899";
      const armLen = 18;

      // Precise crosshair lines showing exact snap point
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      // Horizontal arms (with gap in center)
      ctx.beginPath();
      ctx.moveTo(mx - armLen, my);
      ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);
      ctx.lineTo(mx + armLen, my);
      // Vertical arms (with gap in center)
      ctx.moveTo(mx, my - armLen);
      ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);
      ctx.lineTo(mx, my + armLen);
      ctx.stroke();

      // Bright center dot — the EXACT snap point
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Number label offset to upper-right
      if (candidates.length > 1) {
        const labelX = mx + 10;
        const labelY = my - 10;
        ctx.beginPath();
        ctx.arc(labelX, labelY, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), labelX, labelY);
      }
    });

    ctx.restore();

    // Border circle
    ctx.beginPath();
    ctx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Magnification label
    const mag = Math.round(MAG_SIZE / cropSize);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    const labelW = 36;
    const labelH = 18;
    const labelX = MAG_SIZE / 2 - labelW / 2;
    const labelY = MAG_SIZE - labelH - 4;
    ctx.beginPath();
    ctx.rect(labelX, labelY, labelW, labelH);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mag}x`, MAG_SIZE / 2, labelY + labelH / 2);
  }, [candidates, activeCandidate, pdfCanvas, centerX, centerY, cropSize]);

  // Position: offset to upper-right of the snap area (in screen pixels)
  const screenX = centerX * zoom;
  const screenY = centerY * zoom;
  const maxRight = pageWidth * zoom;
  const maxBottom = pageHeight * zoom;

  // Default: upper-right of snap area
  let posLeft = screenX + 40;
  let posTop = screenY - MAG_SIZE - 20;

  // Clamp to visible area
  if (posLeft + MAG_SIZE > maxRight) posLeft = screenX - MAG_SIZE - 40;
  if (posTop < 0) posTop = screenY + 40;
  if (posLeft < 0) posLeft = 10;
  if (posTop + MAG_SIZE > maxBottom) posTop = maxBottom - MAG_SIZE - 10;

  return (
    <div
      className="absolute transition-opacity duration-200"
      style={{
        left: posLeft,
        top: posTop,
        width: MAG_SIZE,
        height: MAG_SIZE + 24,
        pointerEvents: "none",
        zIndex: 50, // Must be above Fabric.js upper canvas AND calibration overlays (z-10)
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MAG_SIZE,
          height: MAG_SIZE,
          borderRadius: "50%",
        }}
      />
      {/* Interactive overlay — click anywhere or drag to fine-tune */}
      <MagnifierInteractiveOverlay
        magSize={MAG_SIZE}
        centerX={centerX}
        centerY={centerY}
        cropSize={cropSize}
        candidates={candidates}
        activeCandidate={activeCandidate}
        onSelect={onSelect}
        onPreview={onPreview}
      />
      {/* Label */}
      <div
        className="text-xs font-medium text-center"
        style={{
          marginTop: 4,
          color: "#ec4899",
          pointerEvents: "none",
        }}
      >
        Click or drag to position
      </div>
    </div>
  );
}
