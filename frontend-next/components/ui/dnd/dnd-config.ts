/**
 * DnD Configuration - SSoT for drag-and-drop settings
 *
 * This file contains the standard configuration for all drag-and-drop
 * implementations in the TEEEM application.
 *
 * Usage:
 * ```tsx
 * import {
 *   createDndSensors,
 *   defaultCollisionDetection,
 *   ANIMATION_PRESETS,
 *   DND_COLOR_CLASSES
 * } from "@/components/ui/dnd";
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
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  rectIntersection,
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

// =============================================================================
// COLOR SYSTEM
// =============================================================================

/**
 * Color classes for DnD badges and highlights.
 * Aligned with ItemBadge color prop for consistency.
 */
export const DND_COLOR_CLASSES = {
  default: {
    badge: "bg-transparent border-border text-foreground",
    highlight: "ring-2 ring-border",
  },
  primary: {
    badge: "bg-primary/10 border-primary/30 text-primary",
    highlight: "ring-2 ring-primary",
  },
  purple: {
    badge: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300",
    highlight: "ring-2 ring-purple-500",
  },
  orange: {
    badge: "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300",
    highlight: "ring-2 ring-orange-500",
  },
  blue: {
    badge: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
    highlight: "ring-2 ring-blue-500",
  },
  green: {
    badge: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
    highlight: "ring-2 ring-green-500",
  },
  gray: {
    badge: "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300",
    highlight: "ring-2 ring-gray-500",
  },
  red: {
    badge: "bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
    highlight: "ring-2 ring-red-500",
  },
} as const;

export type DndColor = keyof typeof DND_COLOR_CLASSES;

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

/**
 * Animation presets for drag-and-drop transitions.
 * Use with DragOverlay or custom implementations.
 */
export const ANIMATION_PRESETS = {
  /** Default animation - balanced feel */
  default: {
    duration: 200,
    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  },
  /** Smooth animation - slower, more fluid */
  smooth: {
    duration: 350,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  /** Snappy animation - quick, responsive */
  snappy: {
    duration: 100,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
  /** No animation */
  none: {
    duration: 0,
    easing: "linear",
  },
} as const;

export type AnimationPreset = keyof typeof ANIMATION_PRESETS;

// =============================================================================
// COLLISION STRATEGIES
// =============================================================================

/**
 * Available collision detection strategies.
 * Use with DndContext collisionDetection prop.
 */
export const COLLISION_STRATEGIES = {
  /** Default - finds closest center point */
  closestCenter,
  /** Finds closest corner - good for grids */
  closestCorners,
  /** Uses pointer position - most precise */
  pointerWithin,
  /** Uses rectangle intersection - good for large items */
  rectIntersection,
} as const;

export type CollisionStrategy = keyof typeof COLLISION_STRATEGIES;

// =============================================================================
// ENHANCED SENSOR FACTORY
// =============================================================================

export interface SensorConfig {
  /** Pointer activation distance in pixels (default: 5) */
  activationDistance?: number;
  /** Touch activation delay in ms (default: 150) */
  touchDelay?: number;
  /** Include keyboard sensor (default: true) */
  includeKeyboard?: boolean;
  /** Include touch sensor (default: true) */
  includeTouch?: boolean;
}

/**
 * Creates configurable sensors for drag-and-drop.
 * For custom configurations, pass a config object.
 *
 * @example
 * // Default sensors
 * const sensors = createDndSensors();
 *
 * // Custom configuration
 * const sensors = createDndSensors({
 *   activationDistance: 10,
 *   touchDelay: 250,
 *   includeKeyboard: false,
 * });
 */
export function createDndSensors(config: SensorConfig = {}) {
  const {
    activationDistance = 5,
    touchDelay = 150,
    includeKeyboard = true,
    includeTouch = true,
  } = config;

  const sensors = [];

  // Pointer sensor (always included)
  sensors.push(
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    })
  );

  // Touch sensor (optional, for mobile)
  if (includeTouch) {
    sensors.push(
      useSensor(TouchSensor, {
        activationConstraint: {
          delay: touchDelay,
          tolerance: activationDistance,
        },
      })
    );
  }

  // Keyboard sensor (optional, for accessibility)
  if (includeKeyboard) {
    sensors.push(
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );
  }

  return useSensors(...sensors);
}
