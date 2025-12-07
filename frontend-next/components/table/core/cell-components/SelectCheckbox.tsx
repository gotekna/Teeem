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
          e.stopPropagation();
          // Immediately toggle - don't wait for onCheckedChange event
          onCheckedChange(!checked);
        }}
        onMouseDown={(e) => {
          // Stop mousedown from reaching parent to prevent drag detection
          e.stopPropagation();
        }}
      />
    </div>
  );
});
