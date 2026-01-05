"use client";

import * as React from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  AlertOctagon,
  Folder,
  FolderOpen,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { Spinner } from "@/components/ui/spinner";
import {
  FolderTreeItem,
  FolderType,
  buildFolderHierarchy,
  sortFolders,
  loadExpandedFolders,
  saveExpandedFolders,
} from "@/lib/email-folder-utils";

// Folder type to icon mapping
const FOLDER_TYPE_ICONS: Record<FolderType, React.ElementType> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  archive: Archive,
  junk: AlertOctagon,
  custom: Folder,
};

export interface FolderTreeProps {
  /** Flat list of folders (will be converted to tree structure) */
  items: Array<{
    id: string;
    name: string;
    type?: string;
    parent_id?: string | null;
    parentId?: string | null;
    child_folder_count?: number;
    childFolderCount?: number;
    unread_count?: number;
    unreadCount?: number;
    total_items?: number;
    totalItems?: number;
    depth?: number;
  }>;
  /** Currently selected folder ID */
  selectedId?: string;
  /** Callback when folder is selected */
  onSelect: (item: FolderTreeItem) => void;
  /** Callback when folders are reordered (receives new order of root folder IDs) */
  onReorder?: (folderIds: string[]) => void;
  /** Key for persisting expanded state (e.g., account ID) */
  persistKey?: string;
  /** Wrapper component for each item (e.g., for email drag-drop) */
  renderWrapper?: (
    item: FolderTreeItem,
    children: React.ReactNode
  ) => React.ReactNode;
  /** Additional className */
  className?: string;
  /** Show loading state for specific folder IDs */
  loadingFolderIds?: Set<string>;
  /** Default to collapsed (true) or expanded (false) for new folders */
  defaultCollapsed?: boolean;
  /** Enable drag-to-reorder folders */
  enableReorder?: boolean;
  /** Custom folder order (array of folder IDs) */
  customOrder?: string[];
}

interface TreeNodeProps {
  item: FolderTreeItem;
  children: FolderTreeItem[];
  allItems: FolderTreeItem[];
  level: number;
  selectedId?: string;
  expandedIds: Set<string>;
  onSelect: (item: FolderTreeItem) => void;
  onToggle: (item: FolderTreeItem) => void;
  renderWrapper?: FolderTreeProps["renderWrapper"];
  loadingFolderIds?: Set<string>;
  isDragging?: boolean;
  enableReorder?: boolean;
}

/**
 * Sortable tree node component (for root level only)
 * IMPORTANT: Only the folder row itself is sortable - children are rendered
 * outside the transform container to prevent collision detection issues
 */
function SortableTreeNode(props: TreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { item, children, allItems, expandedIds } = props;
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = children.length > 0;

  return (
    <div ref={setNodeRef} style={style}>
      {/* Only the folder row is inside the sortable transform */}
      <TreeNodeRow
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {/* Children are rendered outside the sortable transform to fix upward drag */}
      {isExpanded && hasChildren && (
        <div role="group">
          {children.map((child) => {
            const childChildren = allItems.filter(
              (f) => f.parentId === child.id
            );
            return (
              <TreeNodeContent
                key={child.id}
                item={child}
                children={childChildren}
                allItems={allItems}
                level={1}
                selectedId={props.selectedId}
                expandedIds={expandedIds}
                onSelect={props.onSelect}
                onToggle={props.onToggle}
                renderWrapper={props.renderWrapper}
                loadingFolderIds={props.loadingFolderIds}
                enableReorder={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TreeNodeContentProps extends TreeNodeProps {
  dragHandleProps?: Record<string, unknown>;
}

/**
 * Tree node row - renders just the folder row (no children)
 * Used by SortableTreeNode to keep only the row in the sortable container
 */
const TreeNodeRow = memo(function TreeNodeRow({
  item,
  children,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  renderWrapper,
  loadingFolderIds,
  isDragging,
  enableReorder,
  dragHandleProps,
}: TreeNodeContentProps) {
  const isSelected = selectedId === item.id;
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = children.length > 0;
  const isLoading = loadingFolderIds?.has(item.id);
  const hasUnread = (item.unreadCount ?? 0) > 0;

  const Icon = FOLDER_TYPE_ICONS[item.type] || Folder;
  const DisplayIcon =
    item.type === "custom" && (isExpanded || isSelected) ? FolderOpen : Icon;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(item);
    },
    [item, onToggle]
  );

  const handleSelect = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  const content = (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      className={cn(
        "flex items-center gap-0.5 py-1 px-0 rounded-sm cursor-pointer transition-colors group",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 text-primary",
        isDragging && "bg-muted"
      )}
      style={{ paddingLeft: `${level * 10}px` }}
      onClick={handleSelect}
    >
      {enableReorder && level === 0 && dragHandleProps && (
        <div
          {...dragHandleProps}
          className="shrink-0 w-3 h-3 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}

      {hasChildren ? (
        <div
          className="shrink-0 w-3.5 h-3.5 flex items-center justify-center"
          onClick={handleToggle}
        >
          {isLoading ? (
            <Spinner size={12} className="text-muted-foreground" />
          ) : (
            <ExpandChevron expanded={isExpanded} size={12} />
          )}
        </div>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      <DisplayIcon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isSelected
            ? "text-primary"
            : item.type === "custom"
              ? "text-amber-500 dark:text-amber-400"
              : "text-muted-foreground"
        )}
      />

      <span className="flex-1 truncate text-xs">{item.name}</span>

      {hasUnread && (
        <Badge
          variant="secondary"
          className={cn(
            "text-xs px-1.5 py-0.5 min-w-[20px] text-center shrink-0",
            isSelected && "bg-primary/20"
          )}
        >
          {item.unreadCount}
        </Badge>
      )}
    </div>
  );

  return renderWrapper ? renderWrapper(item, content) : content;
});

/**
 * Tree node content (used by both sortable and non-sortable nodes)
 * Renders the folder row AND its children recursively
 */
const TreeNodeContent = memo(function TreeNodeContent({
  item,
  children,
  allItems,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  renderWrapper,
  loadingFolderIds,
  isDragging,
  enableReorder,
  dragHandleProps,
}: TreeNodeContentProps) {
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = children.length > 0;

  return (
    <div>
      <TreeNodeRow
        item={item}
        children={children}
        allItems={allItems}
        level={level}
        selectedId={selectedId}
        expandedIds={expandedIds}
        onSelect={onSelect}
        onToggle={onToggle}
        renderWrapper={renderWrapper}
        loadingFolderIds={loadingFolderIds}
        isDragging={isDragging}
        enableReorder={enableReorder}
        dragHandleProps={dragHandleProps}
      />

      {isExpanded && hasChildren && (
        <div role="group">
          {children.map((child) => {
            const childChildren = allItems.filter(
              (f) => f.parentId === child.id
            );
            return (
              <TreeNodeContent
                key={child.id}
                item={child}
                children={childChildren}
                allItems={allItems}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
                renderWrapper={renderWrapper}
                loadingFolderIds={loadingFolderIds}
                enableReorder={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

/**
 * Drag overlay component (shown while dragging)
 */
function DragOverlayContent({ item }: { item: FolderTreeItem }) {
  const Icon = FOLDER_TYPE_ICONS[item.type] || Folder;
  const hasUnread = (item.unreadCount ?? 0) > 0;

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-3 rounded-sm bg-background border shadow-lg"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <Icon className="h-4 w-4 text-amber-500" />
      <span className="text-xs">{item.name}</span>
      {hasUnread && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
          {item.unreadCount}
        </Badge>
      )}
    </div>
  );
}

/**
 * FolderTree - SSoT component for hierarchical folder display
 *
 * Features:
 * - Individual folder expand/collapse
 * - Drag-to-reorder folders (root level)
 * - Persisted expand state via localStorage
 * - Bold text for folders with unread items
 * - Smooth animations
 * - Dark mode compatible
 * - Keyboard accessible
 *
 * Usage:
 * ```tsx
 * <FolderTree
 *   items={folders}
 *   selectedId={selectedFolderId}
 *   onSelect={(folder) => selectFolder(folder.id)}
 *   onReorder={(ids) => saveFolderOrder(ids)}
 *   persistKey={accountId}
 *   enableReorder={true}
 * />
 * ```
 */
export function FolderTree({
  items,
  selectedId,
  onSelect,
  onReorder,
  persistKey,
  renderWrapper,
  className,
  loadingFolderIds,
  defaultCollapsed = true,
  enableReorder = false,
  customOrder,
}: FolderTreeProps) {
  // Build hierarchical structure from flat items
  const folderItems = useMemo(() => {
    const hierarchy = buildFolderHierarchy(items);
    return sortFolders(hierarchy);
  }, [items]);

  // Root folders (no parent), with custom ordering if provided
  const rootFolders = useMemo(() => {
    let roots = folderItems.filter((f) => !f.parentId);

    // Apply custom order if provided
    if (customOrder && customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((id, idx) => [id, idx]));
      roots = roots.sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? Infinity;
        const orderB = orderMap.get(b.id) ?? Infinity;
        return orderA - orderB;
      });
    }

    return roots;
  }, [folderItems, customOrder]);

  // Local state for folder order (for immediate UI feedback)
  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    rootFolders.map(f => f.id)
  );

  // Track root folder IDs to detect when folders are added/removed (not just reordered)
  const rootFolderIds = useMemo(() =>
    new Set(rootFolders.map(f => f.id)),
    [rootFolders]
  );

  // Update local order only when folders are added/removed, not when reordered
  useEffect(() => {
    setLocalOrder(prev => {
      // Check if the set of folders has changed (added/removed)
      const prevSet = new Set(prev);
      const currentIds = Array.from(rootFolderIds);

      const added = currentIds.filter(id => !prevSet.has(id));
      const removed = prev.filter(id => !rootFolderIds.has(id));

      // If no changes to the set of folders, keep current order
      if (added.length === 0 && removed.length === 0) {
        return prev;
      }

      // Otherwise, sync with rootFolders order (respects customOrder)
      return rootFolders.map(f => f.id);
    });
  }, [rootFolderIds, rootFolders]);

  // Ordered root folders based on local state
  const orderedRootFolders = useMemo(() => {
    const folderMap = new Map(rootFolders.map(f => [f.id, f]));
    return localOrder
      .map(id => folderMap.get(id))
      .filter((f): f is FolderTreeItem => f !== undefined);
  }, [rootFolders, localOrder]);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeItem = useMemo(() =>
    folderItems.find(f => f.id === activeId),
    [folderItems, activeId]
  );

  // Expanded state with persistence
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (persistKey) {
      return loadExpandedFolders(persistKey);
    }
    if (!defaultCollapsed) {
      const foldersWithChildren = folderItems.filter(
        (f) => (f.childFolderCount ?? 0) > 0
      );
      return new Set(foldersWithChildren.map((f) => f.id));
    }
    return new Set();
  });

  // Load persisted state on mount
  useEffect(() => {
    if (persistKey) {
      const stored = loadExpandedFolders(persistKey);
      if (stored.size > 0) {
        setExpandedIds(stored);
      }
    }
  }, [persistKey]);

  // Save expanded state when it changes
  useEffect(() => {
    if (persistKey) {
      saveExpandedFolders(persistKey, expandedIds);
    }
  }, [persistKey, expandedIds]);

  const handleToggle = useCallback((item: FolderTreeItem) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      // Calculate new order
      const oldIndex = localOrder.indexOf(active.id as string);
      const newIndex = localOrder.indexOf(over.id as string);
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);

      // Update local state
      setLocalOrder(newOrder);

      // Notify parent of reorder (outside of setState to avoid React warning)
      onReorder?.(newOrder);
    }
  }, [onReorder, localOrder]);

  if (folderItems.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-2 px-3", className)}>
        No folders found
      </div>
    );
  }

  // Render tree content
  const treeContent = (
    <>
      {orderedRootFolders.map((folder) => {
        const children = folderItems.filter((f) => f.parentId === folder.id);

        if (enableReorder) {
          return (
            <SortableTreeNode
              key={folder.id}
              item={folder}
              children={children}
              allItems={folderItems}
              level={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={handleToggle}
              renderWrapper={renderWrapper}
              loadingFolderIds={loadingFolderIds}
              enableReorder={true}
            />
          );
        }

        return (
          <TreeNodeContent
            key={folder.id}
            item={folder}
            children={children}
            allItems={folderItems}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={handleToggle}
            renderWrapper={renderWrapper}
            loadingFolderIds={loadingFolderIds}
            enableReorder={false}
          />
        );
      })}
    </>
  );

  // Wrap with DnD context if reordering is enabled
  if (enableReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <SortableContext
          items={localOrder}
          strategy={verticalListSortingStrategy}
        >
          <div role="tree" aria-label="Folder tree" className={className}>
            {treeContent}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem && <DragOverlayContent item={activeItem} />}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <div role="tree" aria-label="Folder tree" className={className}>
      {treeContent}
    </div>
  );
}

export default FolderTree;
export type { FolderTreeItem };
