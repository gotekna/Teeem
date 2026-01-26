"use client";

/**
 * EditingActionsButtons Component
 *
 * Renders Save and Cancel buttons when a row is in inline editing mode.
 */

import React, { memo } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EditingActionsButtonsProps {
  /** Callback to save the current edit */
  onSave: () => void;

  /** Callback to cancel the current edit */
  onCancel: () => void;
}

export const EditingActionsButtons = memo(function EditingActionsButtons({
  onSave,
  onCancel,
}: EditingActionsButtonsProps) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onSave();
        }}
      >
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
      </Button>
    </div>
  );
});
