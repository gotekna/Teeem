'use client';

/**
 * GanttOverlay - React Overlay Container for Interactive Elements
 *
 * This component renders React elements (checkboxes, inputs, dropdowns)
 * positioned absolutely over the canvas. The canvas provides position
 * coordinates, and this component renders the interactive elements.
 *
 * Key concept: Canvas draws visual representations, overlays handle interaction.
 * This is the "DOM Overlay on Canvas" pattern (Google Sheets/Figma).
 *
 * @see TEEEM_DOCS/GANTT_FEATURE_INVENTORY.md - Checkbox toggle features
 * @see TEEEM_DOCS/GANTT_USABILITY_INVENTORY.md - Visual feedback patterns
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// =============================================================================
// Types (imported from UnifiedGanttCanvas)
// =============================================================================

interface OverlayPosition {
  taskId: string;
  rowIndex: number;
  y: number;
  checkboxes: Array<{
    x: number;      // Column left position
    width: number;  // Column width
    field: string;
    checked: boolean;
  }>;
}

interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

interface GanttOverlayProps {
  /** Overlay positions calculated by canvas */
  overlayPositions: OverlayPosition[];
  /** Visible row range for virtualization */
  visibleRange: { start: number; end: number };
  /** Current viewport state */
  viewport: ViewportState;
  /** Row height for positioning */
  rowHeight: number;
  /** Checkbox toggle callback */
  onCheckboxToggle?: (taskId: string, field: string, checked: boolean) => void;
  /** Input change callback */
  onInputChange?: (taskId: string, field: string, value: string) => void;
  /** Optional class name */
  className?: string;
}

// =============================================================================
// Checkbox field configuration
// =============================================================================

interface CheckboxConfig {
  field: string;
  label: string;
  color: {
    checked: string;
    unchecked: string;
  };
}

const CHECKBOX_CONFIGS: Record<string, CheckboxConfig> = {
  started: {
    field: 'started',
    label: 'Started',
    color: {
      checked: 'bg-emerald-500 border-emerald-500',
      unchecked: 'border-border',
    },
  },
  hold: {
    field: 'hold',
    label: 'Hold',
    color: {
      checked: 'bg-amber-500 border-amber-500',
      unchecked: 'border-border',
    },
  },
  confirm: {
    field: 'confirm',
    label: 'Confirm',
    color: {
      checked: 'bg-orange-500 border-orange-500',
      unchecked: 'border-border',
    },
  },
  supplier_confirm: {
    field: 'supplier_confirm',
    label: 'Supplier Confirm',
    color: {
      checked: 'bg-purple-500 border-purple-500',
      unchecked: 'border-border',
    },
  },
  is_completed: {
    field: 'is_completed',
    label: 'Complete',
    color: {
      checked: 'bg-gray-700 border-border',
      unchecked: 'border-border',
    },
  },
};

// =============================================================================
// Component
// =============================================================================

export function GanttOverlay({
  overlayPositions,
  visibleRange,
  viewport,
  rowHeight,
  onCheckboxToggle,
  onInputChange,
  className,
}: GanttOverlayProps) {
  // Filter to only visible positions
  const visiblePositions = overlayPositions.filter(
    (pos) => pos.rowIndex >= visibleRange.start && pos.rowIndex <= visibleRange.end
  );

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
      style={{ top: 0, left: 0 }}
    >
      {/* Render overlay elements for each visible row */}
      {visiblePositions.map((position) => (
        <RowOverlay
          key={position.taskId}
          position={position}
          rowHeight={rowHeight}
          onCheckboxToggle={onCheckboxToggle}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Row Overlay Component
// =============================================================================

interface RowOverlayProps {
  position: OverlayPosition;
  rowHeight: number;
  onCheckboxToggle?: (taskId: string, field: string, checked: boolean) => void;
}

function RowOverlay({ position, rowHeight, onCheckboxToggle }: RowOverlayProps) {
  return (
    <>
      {/* Render checkboxes */}
      {position.checkboxes.map((checkbox) => (
        <CheckboxOverlay
          key={`${position.taskId}-${checkbox.field}`}
          taskId={position.taskId}
          field={checkbox.field}
          checked={checkbox.checked}
          x={checkbox.x}
          width={checkbox.width}
          y={position.y}
          rowHeight={rowHeight}
          onToggle={onCheckboxToggle}
        />
      ))}
    </>
  );
}

// =============================================================================
// Checkbox Overlay Component
// =============================================================================

interface CheckboxOverlayProps {
  taskId: string;
  field: string;
  checked: boolean;
  x: number;
  width: number;
  y: number;
  rowHeight: number;
  onToggle?: (taskId: string, field: string, checked: boolean) => void;
}

function CheckboxOverlay({
  taskId,
  field,
  checked,
  x,
  width,
  y,
  rowHeight,
  onToggle,
}: CheckboxOverlayProps) {
  const config = CHECKBOX_CONFIGS[field];

  const handleChange = (newChecked: boolean) => {
    onToggle?.(taskId, field, newChecked);
  };

  return (
    <div
      className="absolute pointer-events-none flex items-center justify-center"
      style={{
        left: x,
        top: y,
        width: width,
        height: rowHeight,
      }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={handleChange}
        className={cn(
          'w-[14px] h-[14px] rounded-sm pointer-events-auto',
          checked && config?.color.checked,
          !checked && 'border-border bg-transparent'
        )}
        style={checked ? {
          backgroundColor: config?.color.checked.includes('emerald') ? '#10b981' :
                          config?.color.checked.includes('amber') ? '#f59e0b' :
                          config?.color.checked.includes('orange') ? '#f97316' :
                          config?.color.checked.includes('purple') ? '#a855f7' :
                          config?.color.checked.includes('gray') ? '#374151' : '#3b82f6',
          borderColor: config?.color.checked.includes('emerald') ? '#10b981' :
                       config?.color.checked.includes('amber') ? '#f59e0b' :
                       config?.color.checked.includes('orange') ? '#f97316' :
                       config?.color.checked.includes('purple') ? '#a855f7' :
                       config?.color.checked.includes('gray') ? '#374151' : '#3b82f6',
        } : undefined}
        title={config?.label}
      />
    </div>
  );
}

// =============================================================================
// Input Overlay Component (for future use)
// =============================================================================

interface InputOverlayProps {
  taskId: string;
  field: string;
  value: string;
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  onSubmit?: (taskId: string, field: string, value: string) => void;
}

export function InputOverlay({
  taskId,
  field,
  value: initialValue,
  x,
  y,
  width,
  rowHeight,
  onSubmit,
}: InputOverlayProps) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleBlur = () => {
    if (value !== initialValue) {
      onSubmit?.(taskId, field, value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setValue(initialValue);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: x,
        top: y + 2,
        width: width - 4,
        height: rowHeight - 4,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

// =============================================================================
// Dependency Popup Overlay (for future use)
// =============================================================================

interface DependencyPopupProps {
  x: number;
  y: number;
  fromTaskId: string;
  onSelectType: (type: 'FS' | 'SS' | 'FF' | 'SF') => void;
  onCancel: () => void;
}

export function DependencyPopup({
  x,
  y,
  fromTaskId,
  onSelectType,
  onCancel,
}: DependencyPopupProps) {
  return (
    <div
      className="absolute pointer-events-auto bg-white rounded-lg shadow-lg border p-2 z-50"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="text-xs font-medium mb-2 text-muted-foreground">
        Link from task
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onSelectType('FS')}
          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          title="Finish to Start"
        >
          FS
        </button>
        <button
          onClick={() => onSelectType('SS')}
          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          title="Start to Start"
        >
          SS
        </button>
        <button
          onClick={() => onSelectType('FF')}
          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          title="Finish to Finish"
        >
          FF
        </button>
        <button
          onClick={() => onSelectType('SF')}
          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          title="Start to Finish"
        >
          SF
        </button>
      </div>
      <button
        onClick={onCancel}
        className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

export default GanttOverlay;
