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
  const handleChange = (newChecked: boolean) => {
    const startTime = performance.now();
    console.log('[PERF] SelectCheckbox CLICKED - Current state:', checked, '-> New state:', newChecked);

    onCheckedChange(newChecked);

    const endTime = performance.now();
    console.log('[PERF] SelectCheckbox - onCheckedChange callback time:', (endTime - startTime).toFixed(2), 'ms');
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <Checkbox
        checked={checked}
        onCheckedChange={handleChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});
