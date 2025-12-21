/**
 * DnD Components - SSoT for drag-and-drop primitives
 *
 * This module provides standardized drag-and-drop components for the TEEEM application.
 * All sortable/reorderable lists should use these components.
 *
 * See: frontend-next/lib/component-registry.ts
 *
 * Components:
 * - DragHandle: 6-dot grip icon for drag operations
 * - ItemBadge: Flexible badge (position, label, icon, or custom) - THE ONE
 * - PositionBadge: DEPRECATED - use ItemBadge instead
 * - SortableItem: Base item with handle, badge, content, and actions
 * - SortableList: DnD context wrapper with standard configuration
 *
 * Usage:
 * ```tsx
 * import {
 *   SortableList,
 *   SortableItem,
 *   DragHandle,
 *   ItemBadge,
 *   reorderByPosition,
 * } from "@/components/ui/dnd";
 *
 * function MyList({ items, setItems }) {
 *   return (
 *     <SortableList items={items} onReorder={setItems}>
 *       {items.map((item, index) => (
 *         <SortableItem
 *           key={item.id}
 *           id={item.id}
 *           position={index + 1}
 *           editableBadge
 *           onPositionChange={(pos) => {
 *             setItems(reorderByPosition(items, item.id, pos));
 *           }}
 *         >
 *           {item.name}
 *         </SortableItem>
 *       ))}
 *     </SortableList>
 *   );
 * }
 *
 * // With custom badge:
 * <SortableItem id="1" badgeLabel="02a" badgeColor="purple">
 *   Custom labeled item
 * </SortableItem>
 *
 * // With icon badge:
 * <SortableItem id="1" badgeIcon={Star} badgeColor="orange">
 *   Starred item
 * </SortableItem>
 * ```
 */

// Components
export { DragHandle, type DragHandleProps } from "./DragHandle";
export {
  ItemBadge,
  type ItemBadgeProps,
  type ItemBadgeColor,
  // Backwards compatibility - deprecated aliases
  PositionBadge,
  type PositionBadgeProps,
} from "./ItemBadge";
export { SortableItem, type SortableItemProps } from "./SortableItem";
export {
  SortableList,
  type SortableListProps,
  type NestedSortableItem,
  reorderItems,
  reorderByPosition,
} from "./SortableList";

// Configuration - Core
export {
  createDndSensors,
  type SensorConfig,
  defaultCollisionDetection,
  POINTER_ACTIVATION_CONSTRAINT,
} from "./dnd-config";

// Configuration - Sorting Strategies
export {
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "./dnd-config";

// Configuration - Style Classes
export {
  DRAG_HANDLE_CLASSES,
  DRAGGING_CLASSES,
  DROP_TARGET_CLASSES,
} from "./dnd-config";

// Configuration - Color System
export {
  DND_COLOR_CLASSES,
  type DndColor,
} from "./dnd-config";

// Configuration - Animation Presets
export {
  ANIMATION_PRESETS,
  type AnimationPreset,
} from "./dnd-config";

// Configuration - Collision Strategies
export {
  COLLISION_STRATEGIES,
  type CollisionStrategy,
} from "./dnd-config";
