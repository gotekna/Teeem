import { useCallback, useEffect, useRef, useState } from "react";

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
  onZoomChange: (zoom: number) => void;
  onFitToView: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isPanning: boolean;
  isSpaceHeld: boolean;
}

export function usePdfPanZoom({
  pageWidth,
  pageHeight,
  minZoom = 0.1,
  maxZoom = 3,
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

  const clamp = (val: number) => Math.max(minZoom, Math.min(val, maxZoom));

  // ── Fit-to-page calculation ──────────────────────────────────────────────
  const calcFitZoom = useCallback(() => {
    if (!pageWidth || !pageHeight || !containerRef.current) return null;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w <= 0 || h <= 0) return null;
    // 4px padding so ring-1 border isn't clipped by overflow
    const fitZoom = Math.min((w - 4) / pageWidth, (h - 4) / pageHeight);
    return clamp(fitZoom);
  }, [pageWidth, pageHeight, minZoom, maxZoom]);

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
  }, [minZoom, maxZoom]);

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

  // ── Pan via pointer drag (pan tool, middle-click, or space+drag) ─────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      const shouldPan = panToolActiveRef.current || e.button === 1 || isSpaceHeldRef.current;
      if (!shouldPan) return;

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
      container.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current || !panStartRef.current) return;
      e.preventDefault();
      container.scrollLeft = panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
      container.scrollTop = panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      setIsPanning(false);
      panStartRef.current = null;
      onCursorChangeRef.current?.(isSpaceHeldRef.current ? "grab" : null);
      container.releasePointerCapture(e.pointerId);
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("auxclick", handleAuxClick);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
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
      const newZoom = Math.min(Math.max(currentZoom + delta, minZoom), maxZoom);

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
  }, [minZoom, maxZoom]);

  return {
    zoom,
    onZoomChange,
    onFitToView,
    containerRef,
    isPanning,
    isSpaceHeld,
  };
}
