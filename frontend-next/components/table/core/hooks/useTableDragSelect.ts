"use client";

/**
 * useTableDragSelect - Hook for drag-to-select functionality in tables
 *
 * Extracted from TeeemTableView.tsx as part of Phase 2 refactoring.
 * Handles mouse-based drag selection of multiple table rows.
 */

import { useRef, useState, useCallback, useEffect } from "react";

interface DragState {
  isDragging: boolean;
  startRowId: number | string | null;
  startRowIndex: number | null;
  currentRowId?: number | string;
  startX: number;
  startY: number;
}

interface DragRange {
  startId: number | string;
  endId: number | string;
}

interface UseTableDragSelectOptions {
  /** Function to get array of visible row IDs in display order */
  getVisibleRowIds: () => (number | string)[];
  /** Function to update selected rows */
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<number | string>>>;
}

interface UseTableDragSelectReturn {
  /** Current drag range for visual highlighting */
  dragRange: DragRange | null;
  /** Handler for mousedown on select checkbox/cell */
  handleSelectMouseDown: (rowId: number | string, rowIndex: number, e: React.MouseEvent) => void;
  /** Handler for mouse entering a row during drag */
  handleRowMouseEnter: (rowId: number | string, rowIndex: number) => void;
  /** Check if a row is in the current drag range (for highlighting) */
  isRowInDragRange: (rowId: number | string) => boolean;
}

// Distance threshold to start drag (in pixels)
const DRAG_THRESHOLD = 5;

/**
 * Hook for handling drag-to-select behavior in tables
 */
export function useTableDragSelect({
  getVisibleRowIds,
  setSelectedRows,
}: UseTableDragSelectOptions): UseTableDragSelectReturn {
  // Drag state using ref to avoid re-renders during mouse tracking
  const dragStateRef = useRef<DragState | null>(null);

  // Drag range state for visual feedback (triggers re-renders to show highlight)
  const [dragRange, setDragRange] = useState<DragRange | null>(null);

  // Store reference to getVisibleRowIds so handleMouseUp can access latest version
  const getVisibleRowIdsRef = useRef<() => (number | string)[]>(getVisibleRowIds);

  // Keep ref updated
  useEffect(() => {
    getVisibleRowIdsRef.current = getVisibleRowIds;
  }, [getVisibleRowIds]);

  // Handler for mousedown on select checkbox/cell - starts potential drag
  const handleSelectMouseDown = useCallback(
    (rowId: number | string, rowIndex: number, e: React.MouseEvent) => {
      // Don't start drag immediately - wait to see if mouse moves
      // This allows single clicks to work normally
      dragStateRef.current = {
        isDragging: false, // Will become true only if mouse moves
        startRowId: rowId,
        startRowIndex: rowIndex,
        currentRowId: rowId,
        startX: e.clientX,
        startY: e.clientY,
      };
    },
    []
  );

  // Handler for mouse move - tracks drag progress
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;

    // If not yet dragging, check if mouse has moved enough to start
    if (!dragStateRef.current.isDragging) {
      const deltaX = Math.abs(e.clientX - dragStateRef.current.startX);
      const deltaY = Math.abs(e.clientY - dragStateRef.current.startY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Start dragging if moved more than threshold
      if (distance > DRAG_THRESHOLD) {
        dragStateRef.current.isDragging = true;
        // Initialize drag range with start row
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: dragStateRef.current.startRowId,
          });
        }
      }
      return;
    }

    // During drag, find which row the mouse is over using elementFromPoint
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    // Find the closest TR element
    const row = element.closest("tr[data-row-id]");
    if (row) {
      const rowIdAttr = row.getAttribute("data-row-id");
      if (rowIdAttr) {
        const parsedId = isNaN(Number(rowIdAttr)) ? rowIdAttr : Number(rowIdAttr);
        dragStateRef.current.currentRowId = parsedId;
        // Update drag range for visual feedback
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: parsedId,
          });
        }
      }
    }
  }, []);

  // Handler for mouse up - completes drag and selects rows
  const handleMouseUp = useCallback(() => {
    // Clear drag range visual feedback
    setDragRange(null);

    if (!dragStateRef.current?.isDragging) {
      dragStateRef.current = null;
      return;
    }

    // Process the drag selection now that drag is complete
    const { startRowId, currentRowId } = dragStateRef.current;

    if (startRowId && currentRowId && getVisibleRowIdsRef.current) {
      const visibleRowIds = getVisibleRowIdsRef.current();
      const startIndex = visibleRowIds.indexOf(startRowId);
      const endIndex = visibleRowIds.indexOf(currentRowId);

      if (startIndex !== -1 && endIndex !== -1) {
        // Select ALL rows in the range
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        const rowsInRange = visibleRowIds.slice(minIndex, maxIndex + 1);

        setSelectedRows((prev) => {
          const next = new Set(prev);
          rowsInRange.forEach((id) => next.add(id));
          return next;
        });
      }
    }

    dragStateRef.current = null;
  }, [setSelectedRows]);

  // Handler for mouse entering a row during drag
  const handleRowMouseEnter = useCallback(
    (rowId: number | string, _rowIndex: number) => {
      if (!dragStateRef.current?.isDragging) return;

      // Just store the current row ID - don't update selection state yet
      // This prevents multiple expensive re-renders during drag
      dragStateRef.current.currentRowId = rowId;
    },
    []
  );

  // Check if a row is in the current drag range (for visual highlighting)
  const isRowInDragRange = useCallback(
    (rowId: number | string): boolean => {
      if (!dragRange) return false;
      const visibleRowIds = getVisibleRowIdsRef.current();
      const startIndex = visibleRowIds.indexOf(dragRange.startId);
      const endIndex = visibleRowIds.indexOf(dragRange.endId);
      const rowIndex = visibleRowIds.indexOf(rowId);
      if (startIndex === -1 || endIndex === -1 || rowIndex === -1) return false;
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      return rowIndex >= minIndex && rowIndex <= maxIndex;
    },
    [dragRange]
  );

  // Attach global mouse listeners for drag
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    dragRange,
    handleSelectMouseDown,
    handleRowMouseEnter,
    isRowInDragRange,
  };
}

export default useTableDragSelect;
