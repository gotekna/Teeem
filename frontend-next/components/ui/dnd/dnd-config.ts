/**
 * DnD Configuration - SSoT for drag-and-drop settings
 *
 * This file contains the standard configuration for all drag-and-drop
 * implementations in the TEEEM application.
 *
 * Usage:
 * ```tsx
 * import { createDndSensors, defaultCollisionDetection } from "@/components/ui/dnd";
 *
 * const sensors = createDndSensors();
 * <DndContext sensors={sensors} collisionDetection={defaultCollisionDetection}>
 * ```
 */

import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// =============================================================================
// SENSOR CONFIGURATION
// =============================================================================

/**
 * Standard activation constraint for pointer sensor.
 * Requires 5px of movement before drag starts to prevent accidental drags.
 */
export const POINTER_ACTIVATION_CONSTRAINT = {
  distance: 5,
};

/**
 * Creates the standard set of sensors for drag-and-drop.
 * Includes pointer sensor with 5px distance and keyboard support.
 */
export function createDndSensors() {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: POINTER_ACTIVATION_CONSTRAINT,
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  return useSensors(pointerSensor, keyboardSensor);
}

// =============================================================================
// COLLISION DETECTION
// =============================================================================

/**
 * Default collision detection strategy.
 * Uses closest center for most intuitive drop behavior.
 */
export const defaultCollisionDetection: CollisionDetection = closestCenter;

// =============================================================================
// SORTING STRATEGIES
// =============================================================================

export {
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

// =============================================================================
// STYLE UTILITIES
// =============================================================================

/**
 * Standard drag handle cursor classes
 */
export const DRAG_HANDLE_CLASSES = "cursor-grab active:cursor-grabbing touch-none";

/**
 * Standard dragging state classes
 */
export const DRAGGING_CLASSES = "opacity-50 shadow-lg scale-105 z-50";

/**
 * Standard drop target classes (when item is hovered over)
 */
export const DROP_TARGET_CLASSES = "border-t-4 border-t-primary";
