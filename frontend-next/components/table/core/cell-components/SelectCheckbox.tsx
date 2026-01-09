"use client";

/**
 * SelectCheckbox Component
 *
 * Renders the selection checkbox for row selection in TeeemTableView.
 * Handles row selection toggle with proper event propagation control.
 */

import React, { memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export interface SelectCheckboxProps {
  /** Whether this row is selected */
  checked: boolean;

  /** Callback when selection state changes */
  onCheckedChange: (checked: boolean) => void;
}

export const SelectCheckbox = memo(function SelectCheckbox({
  checked,
  onCheckedChange,
}: SelectCheckboxProps) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        onClick={(e) => {
          // Stop propagation to prevent row click
          e.stopPropagation();
        }}
        // NOTE: Do NOT stopPropagation on mousedown - we need it to bubble up
        // to the parent div for drag-to-select functionality
      />
    </div>
  );
});
