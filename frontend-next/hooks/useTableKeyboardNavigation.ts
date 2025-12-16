"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keyboard shortcuts for table navigation:
 *
 * Navigation:
 * - ArrowUp/k     - Move to previous row
 * - ArrowDown/j   - Move to next row
 * - Home/gg       - Go to first row
 * - End/G         - Go to last row
 * - PageUp        - Move up 10 rows
 * - PageDown      - Move down 10 rows
 *
 * Actions:
 * - Enter         - Open/view focused row
 * - Space         - Toggle row selection
 * - Escape        - Clear focus / close panels
 * - /             - Focus search input
 *
 * Selection:
 * - Shift+ArrowUp/Down - Extend selection
 * - Cmd/Ctrl+A    - Select all visible rows
 */

interface UseTableKeyboardNavigationOptions {
  /** Total number of rows */
  rowCount: number;
  /** Callback when row is "opened" (Enter pressed) */
  onRowOpen?: (index: number) => void;
  /** Callback to toggle row selection */
  onToggleSelection?: (index: number) => void;
  /** Callback to select range of rows */
  onSelectRange?: (startIndex: number, endIndex: number) => void;
  /** Callback to select all rows */
  onSelectAll?: () => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
  /** Callback to focus search input */
  onFocusSearch?: () => void;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
  /** Ref to the table container for scroll management */
  containerRef?: React.RefObject<HTMLElement>;
}

interface UseTableKeyboardNavigationReturn {
  /** Currently focused row index (-1 if none) */
  focusedRowIndex: number;
  /** Set focused row index */
  setFocusedRowIndex: (index: number) => void;
  /** Props to spread on the table container */
  tableProps: {
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  /** Whether the table currently has keyboard focus */
  hasFocus: boolean;
}

export function useTableKeyboardNavigation({
  rowCount,
  onRowOpen,
  onToggleSelection,
  onSelectRange,
  onSelectAll,
  onClearSelection,
  onFocusSearch,
  onEscape,
  enabled = true,
  containerRef,
}: UseTableKeyboardNavigationOptions): UseTableKeyboardNavigationReturn {
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [hasFocus, setHasFocus] = useState(false);
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Clamp index to valid range
  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(rowCount - 1, index)),
    [rowCount]
  );

  // Scroll focused row into view
  const scrollToRow = useCallback(
    (index: number) => {
      if (!containerRef?.current) return;

      const container = containerRef.current;
      const rowHeight = 33; // Match virtualization row height
      const targetTop = index * rowHeight;
      const containerHeight = container.clientHeight;
      const scrollTop = container.scrollTop;

      // Check if row is outside visible area
      if (targetTop < scrollTop) {
        // Row is above viewport - scroll up
        container.scrollTop = targetTop;
      } else if (targetTop + rowHeight > scrollTop + containerHeight) {
        // Row is below viewport - scroll down
        container.scrollTop = targetTop - containerHeight + rowHeight;
      }
    },
    [containerRef]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const key = e.key;

      // Check for vim-style double-key commands (gg)
      if (key === "g" && lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        e.preventDefault();
        setFocusedRowIndex(0);
        scrollToRow(0);
        lastKeyRef.current = "";
        return;
      }

      lastKeyRef.current = key;
      lastKeyTimeRef.current = now;

      switch (key) {
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (e.shiftKey && onSelectRange && focusedRowIndex > 0) {
            onSelectRange(focusedRowIndex - 1, focusedRowIndex);
          }
          setFocusedRowIndex((prev) => {
            const next = clampIndex(prev - 1);
            scrollToRow(next);
            return next;
          });
          break;

        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (e.shiftKey && onSelectRange && focusedRowIndex < rowCount - 1) {
            onSelectRange(focusedRowIndex, focusedRowIndex + 1);
          }
          setFocusedRowIndex((prev) => {
            const next = clampIndex(prev + 1);
            scrollToRow(next);
            return next;
          });
          break;

        case "Home":
          e.preventDefault();
          setFocusedRowIndex(0);
          scrollToRow(0);
          break;

        case "End":
        case "G":
          if (key === "G" && !e.shiftKey) break; // Only Shift+G or End
          e.preventDefault();
          setFocusedRowIndex(rowCount - 1);
          scrollToRow(rowCount - 1);
          break;

        case "PageUp":
          e.preventDefault();
          setFocusedRowIndex((prev) => {
            const next = clampIndex(prev - 10);
            scrollToRow(next);
            return next;
          });
          break;

        case "PageDown":
          e.preventDefault();
          setFocusedRowIndex((prev) => {
            const next = clampIndex(prev + 10);
            scrollToRow(next);
            return next;
          });
          break;

        case "Enter":
          e.preventDefault();
          if (focusedRowIndex >= 0 && onRowOpen) {
            onRowOpen(focusedRowIndex);
          }
          break;

        case " ":
          e.preventDefault();
          if (focusedRowIndex >= 0 && onToggleSelection) {
            onToggleSelection(focusedRowIndex);
          }
          break;

        case "Escape":
          e.preventDefault();
          if (onEscape) {
            onEscape();
          } else {
            setFocusedRowIndex(-1);
            onClearSelection?.();
          }
          break;

        case "/":
          e.preventDefault();
          if (onFocusSearch) {
            onFocusSearch();
          }
          break;

        case "a":
          if ((e.metaKey || e.ctrlKey) && onSelectAll) {
            e.preventDefault();
            onSelectAll();
          }
          break;
      }
    },
    [
      enabled,
      focusedRowIndex,
      rowCount,
      clampIndex,
      scrollToRow,
      onRowOpen,
      onToggleSelection,
      onSelectRange,
      onSelectAll,
      onClearSelection,
      onFocusSearch,
      onEscape,
    ]
  );

  // Reset focused index when row count changes
  useEffect(() => {
    if (focusedRowIndex >= rowCount) {
      setFocusedRowIndex(rowCount > 0 ? rowCount - 1 : -1);
    }
  }, [rowCount, focusedRowIndex]);

  return {
    focusedRowIndex,
    setFocusedRowIndex,
    tableProps: {
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      onFocus: () => setHasFocus(true),
      onBlur: () => setHasFocus(false),
    },
    hasFocus,
  };
}

export default useTableKeyboardNavigation;
