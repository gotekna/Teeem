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
 * - PositionBadge: Editable/read-only position number
 * - SortableItem: Base item with handle, position, content, and actions
 * - SortableList: DnD context wrapper with standard configuration
 *
 * Usage:
 * ```tsx
 * import {
 *   SortableList,
 *   SortableItem,
 *   DragHandle,
 *   PositionBadge,
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
 *           editablePosition
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
 * ```
 */

// Components
export { DragHandle, type DragHandleProps } from "./DragHandle";
export { PositionBadge, type PositionBadgeProps } from "./PositionBadge";
export { SortableItem, type SortableItemProps } from "./SortableItem";
export {
  SortableList,
  type SortableListProps,
  reorderItems,
  reorderByPosition,
} from "./SortableList";

// Configuration
export {
  createDndSensors,
  defaultCollisionDetection,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  POINTER_ACTIVATION_CONSTRAINT,
  DRAG_HANDLE_CLASSES,
  DRAGGING_CLASSES,
  DROP_TARGET_CLASSES,
} from "./dnd-config";
