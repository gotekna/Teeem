"use client";

/**
 * EditModeToggle Component
 *
 * Toggle button for entering/exiting table edit mode.
 * Shows different states:
 * - Default: "Edit" button
 * - Active: "Editing" with Done button
 * - Saving: Shows spinner for any pending saves
 * - Errors: Shows warning indicator if validation errors exist
 *
 * NOTE: Uses native HTML title attributes instead of Radix Tooltip to avoid
 * compose-refs infinite loop issues during rapid re-renders (view switching).
 */

import React, { useCallback, memo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Pencil, Check, AlertTriangle } from "lucide-react";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from "@/components/ui/spinner";
import {
  tableEditModeAtom,
  hasAnyValidationErrorsAtom,
  savingCellsAtom,
} from '@/lib/table-edit-atoms';

export interface EditModeToggleProps {
  /** Optional className for styling */
  className?: string;

  /** Whether to show the toggle (default true) */
  show?: boolean;

  /** Callback when edit mode changes */
  onEditModeChange?: (isEditing: boolean) => void;
}

export const EditModeToggle = memo(function EditModeToggle({
  className,
  show = true,
  onEditModeChange,
}: EditModeToggleProps) {
  const [isEditMode, setEditMode] = useAtom(tableEditModeAtom);
  const hasErrors = useAtomValue(hasAnyValidationErrorsAtom);
  const savingCells = useAtomValue(savingCellsAtom);
  const isSaving = savingCells.size > 0;

  const handleToggle = useCallback(() => {
    const newMode = !isEditMode;
    setEditMode(newMode);
    onEditModeChange?.(newMode);
  }, [isEditMode, setEditMode, onEditModeChange]);

  if (!show) return null;

  // Get tooltip text based on state
  const getTooltip = () => {
    if (isEditMode) {
      if (isSaving) return 'Saving changes...';
      if (hasErrors) return 'Some cells have validation errors. Click to exit edit mode anyway.';
      return 'Click to exit edit mode and save all changes (Esc)';
    }
    return 'Enter edit mode to modify cells directly';
  };

  // Edit mode active - show "Done" button
  if (isEditMode) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={handleToggle}
        disabled={isSaving}
        title={getTooltip()}
        className={cn(
          'bg-green-600 hover:bg-green-700 text-white',
          hasErrors && 'bg-amber-600 hover:bg-amber-700',
          className
        )}
      >
        {isSaving ? (
          <>
            <Spinner size={16} className="mr-2" />
            Saving...
          </>
        ) : hasErrors ? (
          <>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Done (with errors)
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Done Editing
          </>
        )}
      </Button>
    );
  }

  // Edit mode inactive - show "Edit" button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      title={getTooltip()}
      className={className}
    >
      <Pencil className="h-4 w-4 mr-2" />
      Edit
    </Button>
  );
});

/**
 * Compact version of the toggle for tight spaces
 * Uses native HTML title attributes to avoid compose-refs issues.
 */
export const EditModeToggleCompact = memo(function EditModeToggleCompact({
  className,
  show = true,
  onEditModeChange,
}: EditModeToggleProps) {
  const [isEditMode, setEditMode] = useAtom(tableEditModeAtom);
  const hasErrors = useAtomValue(hasAnyValidationErrorsAtom);
  const savingCells = useAtomValue(savingCellsAtom);
  const isSaving = savingCells.size > 0;

  const handleToggle = useCallback(() => {
    const newMode = !isEditMode;
    setEditMode(newMode);
    onEditModeChange?.(newMode);
  }, [isEditMode, setEditMode, onEditModeChange]);

  if (!show) return null;

  // Get tooltip text based on state
  const getTooltip = () => {
    if (isEditMode) {
      if (isSaving) return 'Saving...';
      if (hasErrors) return 'Exit edit mode (has errors)';
      return 'Exit edit mode';
    }
    return 'Enter edit mode';
  };

  return (
    <Button
      variant={isEditMode ? 'default' : 'outline'}
      size="icon"
      onClick={handleToggle}
      disabled={isSaving}
      title={getTooltip()}
      className={cn(
        isEditMode && 'bg-green-600 hover:bg-green-700 text-white',
        hasErrors && isEditMode && 'bg-amber-600 hover:bg-amber-700',
        className
      )}
    >
      {isSaving ? (
        <Spinner size={16} />
      ) : isEditMode ? (
        hasErrors ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Check className="h-4 w-4" />
        )
      ) : (
        <Pencil className="h-4 w-4" />
      )}
    </Button>
  );
});

export default EditModeToggle;
