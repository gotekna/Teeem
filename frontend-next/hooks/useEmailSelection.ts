"use client";

import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { selectedEmailIdsAtom } from "@/lib/email-atoms";

export interface EmailForSelection {
  id: number;
}

export interface UseEmailSelectionReturn {
  /** Set of currently selected email IDs */
  selectedIds: Set<number>;
  /** Check if a specific email is selected */
  isSelected: (id: number) => boolean;
  /** Toggle selection of a single email */
  toggle: (id: number) => void;
  /** Select a range of emails (for shift+click) */
  selectRange: (fromId: number, toId: number, emails: EmailForSelection[]) => void;
  /** Select all emails in the provided list */
  selectAll: (emails: EmailForSelection[]) => void;
  /** Clear all selections */
  clear: () => void;
  /** Number of selected emails */
  count: number;
  /** Whether any emails are selected */
  hasSelection: boolean;
}

/**
 * Hook for managing email multi-selection state
 *
 * SSoT: Uses selectedEmailIdsAtom from lib/email-atoms.ts
 *
 * Usage:
 * const { selectedIds, toggle, selectRange, selectAll, clear, count } = useEmailSelection();
 *
 * // Toggle selection on checkbox click
 * <Checkbox onClick={() => toggle(email.id)} checked={isSelected(email.id)} />
 *
 * // Shift+click for range selection
 * onClick={(e) => {
 *   if (e.shiftKey && lastClickedId) {
 *     selectRange(lastClickedId, email.id, emails);
 *   } else {
 *     toggle(email.id);
 *   }
 *   setLastClickedId(email.id);
 * }}
 */
export function useEmailSelection(): UseEmailSelectionReturn {
  // SSoT: Use atom instead of local useState
  const [selectedIds, setSelectedIds] = useAtom(selectedEmailIdsAtom);

  const isSelected = useCallback(
    (id: number): boolean => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setSelectedIds]);

  const selectRange = useCallback(
    (fromId: number, toId: number, emails: EmailForSelection[]) => {
      const ids = emails.map((e) => e.id);
      const fromIndex = ids.indexOf(fromId);
      const toIndex = ids.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = ids.slice(start, end + 1);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [setSelectedIds]
  );

  const selectAll = useCallback((emails: EmailForSelection[]) => {
    setSelectedIds(new Set(emails.map((e) => e.id)));
  }, [setSelectedIds]);

  const clear = useCallback(() => {
    setSelectedIds(new Set<number>());
  }, [setSelectedIds]);

  const count = useMemo(() => selectedIds.size, [selectedIds]);
  const hasSelection = useMemo(() => selectedIds.size > 0, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    selectRange,
    selectAll,
    clear,
    count,
    hasSelection,
  };
}

export default useEmailSelection;
