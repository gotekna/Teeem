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
 */

import React, { useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Pencil, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

export function EditModeToggle({
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

  // Edit mode active - show "Done" button
  if (isEditMode) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggle}
              disabled={isSaving}
              className={cn(
                'bg-green-600 hover:bg-green-700 text-white',
                hasErrors && 'bg-amber-600 hover:bg-amber-700',
                className
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
          </TooltipTrigger>
          <TooltipContent>
            {isSaving
              ? 'Saving changes...'
              : hasErrors
              ? 'Some cells have validation errors. Click to exit edit mode anyway.'
              : 'Click to exit edit mode and save all changes (Esc)'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Edit mode inactive - show "Edit" button
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            className={className}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Enter edit mode to modify cells directly
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version of the toggle for tight spaces
 */
export function EditModeToggleCompact({
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="icon"
            onClick={handleToggle}
            disabled={isSaving}
            className={cn(
              isEditMode && 'bg-green-600 hover:bg-green-700 text-white',
              hasErrors && isEditMode && 'bg-amber-600 hover:bg-amber-700',
              className
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
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
        </TooltipTrigger>
        <TooltipContent>
          {isEditMode
            ? isSaving
              ? 'Saving...'
              : hasErrors
              ? 'Exit edit mode (has errors)'
              : 'Exit edit mode'
            : 'Enter edit mode'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default EditModeToggle;
