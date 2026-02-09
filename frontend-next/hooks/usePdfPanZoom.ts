import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface UsePdfPanZoomOptions {
  pageWidth: number;
  pageHeight: number;
  minZoom?: number;
  maxZoom?: number;
  fitOnMount?: boolean;
  panToolActive?: boolean;
  onCursorChange?: (cursor: string | null) => void;
}

interface UsePdfPanZoomReturn {
  zoom: number;
  effectiveMaxZoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToView: () => void;
  zoomToRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isPanning: boolean;
  isSpaceHeld: boolean;
}

// Fabric.js canvas must stay under browser limits to avoid blank white screen.
// Chrome limit: ~16384px per dimension, but GPU memory varies.
// 8192 is safe across all GPUs and still allows generous zoom.
const MAX_CANVAS_DIM = 8192;

export function usePdfPanZoom({
  pageWidth,
  pageHeight,
  minZoom = 0.1,
  maxZoom = 5,
  fitOnMount = true,
  panToolActive = false,
  onCursorChange,
}: UsePdfPanZoomOptions): UsePdfPanZoomReturn {
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomModeRef = useRef<"fit" | "manual">(fitOnMount ? "fit" : "manual");
  const lastContainerSize = useRef({ w: 0, h: 0 });
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Keep latest values in refs for event handlers
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panToolActiveRef = useRef(panToolActive);
  panToolActiveRef.current = panToolActive;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const isSpaceHeldRef = useRef(false);
  const isPanningRef = useRef(false);

  // Dynamic max zoom: prevent canvas from exceeding browser limits
  const effectiveMaxZoom = Math.min(
    maxZoom,
    pageWidth > 0 ? MAX_CANVAS_DIM / pageWidth : maxZoom,
    pageHeight > 0 ? MAX_CANVAS_DIM / pageHeight : maxZoom,
  );

  const clamp = useCallback(
    (val: number) => Math.max(minZoom, Math.min(val, effectiveMaxZoom)),
    [minZoom, effectiveMaxZoom],
  );

  // ── Fit-to-page calculation ──────────────────────────────────────────────
  const calcFitZoom = useCallback(() => {
    if (!pageWidth || !pageHeight || !containerRef.current) return null;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w <= 0 || h <= 0) return null;
    // 4px padding so ring-1 border isn't clipped by overflow
    const fitZoom = Math.min((w - 4) / pageWidth, (h - 4) / pageHeight);
    return clamp(fitZoom);
  }, [pageWidth, pageHeight, clamp]);

  // ── Auto fit on page change + ResizeObserver ─────────────────────────────
  useEffect(() => {
    if (!pageWidth || !pageHeight || !containerRef.current) return;

    const container = containerRef.current;
    let rafId: number;

    const applyFitZoom = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      if (Math.abs(w - lastContainerSize.current.w) < 2 && Math.abs(h - lastContainerSize.current.h) < 2) return;
      lastContainerSize.current = { w, h };
      const fit = calcFitZoom();
      if (fit !== null) {
        setZoom(fit);
        container.scrollTop = 0;
        container.scrollLeft = 0;
      }
    };

    // Always fit on page dimension change
    zoomModeRef.current = "fit";
    lastContainerSize.current = { w: 0, h: 0 };
    applyFitZoom();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (zoomModeRef.current === "fit") applyFitZoom();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [pageWidth, pageHeight, calcFitZoom]);

  // ── Manual zoom (switches out of fit mode) ──────────────────────────────
  const onZoomChange = useCallback((newZoom: number) => {
    zoomModeRef.current = "manual";
    setZoom(clamp(newZoom));
  }, [clamp]);

  // ── Fit to view ──────────────────────────────────────────────────────────
  const onFitToView = useCallback(() => {
    zoomModeRef.current = "fit";
    lastContainerSize.current = { w: 0, h: 0 };
    const fit = calcFitZoom();
    if (fit !== null) {
      setZoom(fit);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
    }
  }, [calcFitZoom]);

  // ── Space key for temporary pan mode ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" && !isSpaceHeldRef.current) {
        isSpaceHeldRef.current = true;
        setIsSpaceHeld(true);
        e.preventDefault();
        onCursorChangeRef.current?.("grab");
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceHeldRef.current = false;
        isPanningRef.current = false;
        panStartRef.current = null;
        setIsSpaceHeld(false);
        setIsPanning(false);
        onCursorChangeRef.current?.(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ── Pan via pointer drag ────────────────────────────────────────────────
  // Pan tool, middle-click, or space+drag all initiate panning.
  // Left-click drag is handled by Fabric.js (zoom-to-rect in TakeoffCanvas).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      const shouldPanImmediate = panToolActiveRef.current || e.button === 1 || isSpaceHeldRef.current;

      if (shouldPanImmediate) {
        e.preventDefault();
        isPanningRef.current = true;
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
        onCursorChangeRef.current?.("grabbing");
        return;
      }
    };

    // Listen on window so Fabric.js canvas can't block event bubbling
    const handlePointerMove = (e: PointerEvent) => {
      // Already panning: scroll the container
      if (isPanningRef.current && panStartRef.current) {
        e.preventDefault();
        container.scrollLeft = panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
        container.scrollTop = panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
        return;
      }
    };

    const handlePointerUp = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      setIsPanning(false);
      panStartRef.current = null;
      onCursorChangeRef.current?.(isSpaceHeldRef.current ? "grab" : null);
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("auxclick", handleAuxClick);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("auxclick", handleAuxClick);
    };
  }, []);

  // ── Ctrl/Cmd + scroll wheel zoom toward cursor ──────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const currentZoom = zoomRef.current;
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.min(Math.max(currentZoom + delta, minZoom), effectiveMaxZoom);

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + container.scrollLeft;
      const mouseY = e.clientY - rect.top + container.scrollTop;
      const scale = newZoom / currentZoom;
      const newScrollLeft = mouseX * scale - (e.clientX - rect.left);
      const newScrollTop = mouseY * scale - (e.clientY - rect.top);

      zoomModeRef.current = "manual";
      setZoom(newZoom);

      requestAnimationFrame(() => {
        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [minZoom, effectiveMaxZoom]);

  // ── Zoom to rectangle (marquee zoom) ──────────────────────────────────
  // Three-phase scroll positioning for reliability:
  // 1. useLayoutEffect: after DOM commit, before paint (fastest)
  // 2. rAF inside layoutEffect: catches canvas resize reflows
  // 3. setTimeout in zoomToRect: catches async effects (PDF image loading)
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !containerRef.current) return;
    const container = containerRef.current;
    void container.scrollHeight; // Force layout recalculation
    container.scrollLeft = pending.left;
    container.scrollTop = pending.top;
  }, [zoom]);

  const zoomToRect = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const container = containerRef.current;
    if (!container || rect.width < 10 || rect.height < 10) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const newZoom = clamp(Math.min(containerW / rect.width, containerH / rect.height) * 0.95);
    const scaledW = rect.width * newZoom;
    const scaledH = rect.height * newZoom;
    const scrollLeft = Math.max(0, rect.x * newZoom - (containerW - scaledW) / 2);
    const scrollTop = Math.max(0, rect.y * newZoom - (containerH - scaledH) / 2);

    zoomModeRef.current = "manual";
    pendingScrollRef.current = { left: scrollLeft, top: scrollTop };
    setZoom(newZoom);

    // Backup: apply scroll after all effects complete (catches canvas resize reflows)
    setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = scrollLeft;
      containerRef.current.scrollTop = scrollTop;
      pendingScrollRef.current = null;
    }, 50);
  }, [clamp]);

  return {
    zoom,
    effectiveMaxZoom,
    onZoomChange,
    onFitToView,
    zoomToRect,
    containerRef,
    isPanning,
    isSpaceHeld,
  };
}
