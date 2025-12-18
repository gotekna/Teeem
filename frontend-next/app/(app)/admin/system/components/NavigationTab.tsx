"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { IconPicker } from "@/components/ui/icon-picker";
import { getIcon } from "@/lib/icon-map";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Loader2,
  FolderPlus,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// User roles (matching backend)
const USER_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "product_owner", label: "Product Owner" },
  { value: "estimator", label: "Estimator" },
  { value: "supervisor", label: "Supervisor" },
  { value: "builder", label: "Builder" },
  { value: "user", label: "User" },
];

interface NavigationItem {
  id: number;
  name: string;
  href: string;
  icon: string;
  badge_key: string | null;
  position: number;
  navigation_group_id: number | null;
  is_active: boolean;
  visible_to_roles: string[];
}

interface NavigationGroup {
  id: number;
  name: string;
  icon: string;
  position: number;
  is_active: boolean;
  is_collapsible: boolean;
  visible_to_roles: string[];
  items: NavigationItem[];
}

interface SortableItemProps {
  item: NavigationItem;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
}

function SortableNavItem({ item, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `item-${item.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getIcon(item.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-background border rounded-md",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-sm">{item.name}</span>
      <span className="text-xs text-muted-foreground">{item.href}</span>
      {!item.is_active && (
        <Badge variant="secondary" className="text-xs">
          Hidden
        </Badge>
      )}
      {item.visible_to_roles.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {item.visible_to_roles.length} roles
        </Badge>
      )}
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(item)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SortableGroupProps {
  group: NavigationGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (group: NavigationGroup) => void;
  onDelete: (group: NavigationGroup) => void;
  onEditItem: (item: NavigationItem) => void;
  onDeleteItem: (item: NavigationItem) => void;
  onReorderItems: (groupId: number, itemIds: number[]) => void;
}

function SortableNavGroup({
  group,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onEditItem,
  onDeleteItem,
  onReorderItems,
}: SortableGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getIcon(group.icon);
  const sortedItems = [...group.items].sort((a, b) => a.position - b.position);

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = parseInt(String(active.id).replace("item-", ""));
    const overId = parseInt(String(over.id).replace("item-", ""));

    const oldIndex = sortedItems.findIndex((i) => i.id === activeId);
    const newIndex = sortedItems.findIndex((i) => i.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
      onReorderItems(
        group.id,
        newOrder.map((i) => i.id)
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={onToggle} className="p-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 font-medium">{group.name}</span>
        <Badge variant="secondary" className="text-xs">
          {group.items.length} items
        </Badge>
        {!group.is_active && (
          <Badge variant="secondary" className="text-xs">
            Hidden
          </Badge>
        )}
        {group.visible_to_roles.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {group.visible_to_roles.length} roles
          </Badge>
        )}
        <Button variant="ghost" size="icon" onClick={() => onEdit(group)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(group)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {isExpanded && (
        <div className="p-2 space-y-1 bg-muted/30">
          <DndContext
            sensors={useSensors(
              useSensor(PointerSensor, {
                activationConstraint: { distance: 5 },
              }),
              useSensor(KeyboardSensor, {
                coordinateGetter: sortableKeyboardCoordinates,
              })
            )}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={sortedItems.map((i) => `item-${i.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {sortedItems.map((item) => (
                <SortableNavItem
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                />
              ))}
            </SortableContext>
          </DndContext>
          {sortedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items in this group. Drag items here to add them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function NavigationTab() {
  const [groups, setGroups] = React.useState<NavigationGroup[]>([]);
  const [ungroupedItems, setUngroupedItems] = React.useState<NavigationItem[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(
    new Set()
  );

  // Dialog states
  const [editingItem, setEditingItem] = React.useState<NavigationItem | null>(
    null
  );
  const [editingGroup, setEditingGroup] = React.useState<NavigationGroup | null>(
    null
  );
  const [showNewGroup, setShowNewGroup] = React.useState(false);
  const [showNewItem, setShowNewItem] = React.useState(false);

  // Form states
  const [itemForm, setItemForm] = React.useState({
    name: "",
    href: "",
    icon: "Folder",
    badge_key: "",
    is_active: true,
    visible_to_roles: [] as string[],
  });
  const [groupForm, setGroupForm] = React.useState({
    name: "",
    icon: "Folder",
    is_active: true,
    is_collapsible: true,
    visible_to_roles: [] as string[],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load navigation data
  const loadNavigation = React.useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, itemsRes] = await Promise.all([
        api.get<{ navigation_groups: NavigationGroup[] }>(
          "/api/v1/navigation_groups"
        ),
        api.get<{ navigation_items: NavigationItem[] }>(
          "/api/v1/navigation_items"
        ),
      ]);

      setGroups(groupsRes.navigation_groups || []);

      // Filter ungrouped items
      const allItems = itemsRes.navigation_items || [];
      setUngroupedItems(
        allItems
          .filter((i) => !i.navigation_group_id)
          .sort((a, b) => a.position - b.position)
      );
    } catch (error) {
      console.error("Failed to load navigation:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNavigation();
  }, [loadNavigation]);

  // Toggle group expansion
  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Reorder groups
  const handleGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = parseInt(String(active.id).replace("group-", ""));
    const overId = parseInt(String(over.id).replace("group-", ""));

    const sortedGroups = [...groups].sort((a, b) => a.position - b.position);
    const oldIndex = sortedGroups.findIndex((g) => g.id === activeId);
    const newIndex = sortedGroups.findIndex((g) => g.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sortedGroups, oldIndex, newIndex);
      setGroups(newOrder.map((g, i) => ({ ...g, position: i })));

      try {
        await api.post("/api/v1/navigation_groups/reorder", {
          group_ids: newOrder.map((g) => g.id),
        });
      } catch (error) {
        console.error("Failed to reorder groups:", error);
        loadNavigation();
      }
    }
  };

  // Reorder ungrouped items
  const handleUngroupedDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = parseInt(String(active.id).replace("item-", ""));
    const overId = parseInt(String(over.id).replace("item-", ""));

    const oldIndex = ungroupedItems.findIndex((i) => i.id === activeId);
    const newIndex = ungroupedItems.findIndex((i) => i.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(ungroupedItems, oldIndex, newIndex);
      setUngroupedItems(newOrder.map((i, idx) => ({ ...i, position: idx })));

      try {
        await api.post("/api/v1/navigation_items/reorder", {
          item_ids: newOrder.map((i) => i.id),
        });
      } catch (error) {
        console.error("Failed to reorder items:", error);
        loadNavigation();
      }
    }
  };

  // Reorder items within a group
  const handleGroupItemsReorder = async (groupId: number, itemIds: number[]) => {
    // Update local state
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const reorderedItems = itemIds.map((id, idx) => {
          const item = g.items.find((i) => i.id === id);
          return item ? { ...item, position: idx } : null;
        }).filter(Boolean) as NavigationItem[];
        return { ...g, items: reorderedItems };
      })
    );

    try {
      await api.post("/api/v1/navigation_items/reorder", { item_ids: itemIds });
    } catch (error) {
      console.error("Failed to reorder items:", error);
      loadNavigation();
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    try {
      setSaving(true);
      await api.post("/api/v1/navigation_groups", {
        navigation_group: groupForm,
      });
      setShowNewGroup(false);
      setGroupForm({
        name: "",
        icon: "Folder",
        is_active: true,
        is_collapsible: true,
        visible_to_roles: [],
      });
      loadNavigation();
    } catch (error) {
      console.error("Failed to create group:", error);
    } finally {
      setSaving(false);
    }
  };

  // Update group
  const handleUpdateGroup = async () => {
    if (!editingGroup) return;
    try {
      setSaving(true);
      await api.patch(`/api/v1/navigation_groups/${editingGroup.id}`, {
        navigation_group: groupForm,
      });
      setEditingGroup(null);
      loadNavigation();
    } catch (error) {
      console.error("Failed to update group:", error);
    } finally {
      setSaving(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async (group: NavigationGroup) => {
    if (!confirm(`Delete group "${group.name}"? Items will become ungrouped.`))
      return;
    try {
      await api.delete(`/api/v1/navigation_groups/${group.id}`);
      loadNavigation();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  // Create item
  const handleCreateItem = async () => {
    try {
      setSaving(true);
      await api.post("/api/v1/navigation_items", {
        navigation_item: {
          ...itemForm,
          badge_key: itemForm.badge_key || null,
        },
      });
      setShowNewItem(false);
      setItemForm({
        name: "",
        href: "",
        icon: "Folder",
        badge_key: "",
        is_active: true,
        visible_to_roles: [],
      });
      loadNavigation();
    } catch (error) {
      console.error("Failed to create item:", error);
    } finally {
      setSaving(false);
    }
  };

  // Update item
  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      setSaving(true);
      await api.patch(`/api/v1/navigation_items/${editingItem.id}`, {
        navigation_item: {
          ...itemForm,
          badge_key: itemForm.badge_key || null,
        },
      });
      setEditingItem(null);
      loadNavigation();
    } catch (error) {
      console.error("Failed to update item:", error);
    } finally {
      setSaving(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (item: NavigationItem) => {
    if (!confirm(`Delete navigation item "${item.name}"?`)) return;
    try {
      await api.delete(`/api/v1/navigation_items/${item.id}`);
      loadNavigation();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  // Open edit dialogs
  const openEditGroup = (group: NavigationGroup) => {
    setGroupForm({
      name: group.name,
      icon: group.icon,
      is_active: group.is_active,
      is_collapsible: group.is_collapsible,
      visible_to_roles: group.visible_to_roles || [],
    });
    setEditingGroup(group);
  };

  const openEditItem = (item: NavigationItem) => {
    setItemForm({
      name: item.name,
      href: item.href,
      icon: item.icon,
      badge_key: item.badge_key || "",
      is_active: item.is_active,
      visible_to_roles: item.visible_to_roles || [],
    });
    setEditingItem(item);
  };

  const sortedGroups = [...groups].sort((a, b) => a.position - b.position);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Navigation Manager</h2>
          <p className="text-sm text-muted-foreground">
            Manage sidebar navigation items and groups. Drag to reorder.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNewGroup(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            New Group
          </Button>
          <Button onClick={() => setShowNewItem(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
        </div>
      </div>

      {/* Groups */}
      {sortedGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGroupDragEnd}
            >
              <SortableContext
                items={sortedGroups.map((g) => `group-${g.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {sortedGroups.map((group) => (
                  <SortableNavGroup
                    key={group.id}
                    group={group}
                    isExpanded={expandedGroups.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    onEdit={openEditGroup}
                    onDelete={handleDeleteGroup}
                    onEditItem={openEditItem}
                    onDeleteItem={handleDeleteItem}
                    onReorderItems={handleGroupItemsReorder}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}

      {/* Ungrouped Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ungrouped Items ({ungroupedItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleUngroupedDragEnd}
          >
            <SortableContext
              items={ungroupedItems.map((i) => `item-${i.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {ungroupedItems.map((item) => (
                <SortableNavItem
                  key={item.id}
                  item={item}
                  onEdit={openEditItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </SortableContext>
          </DndContext>
          {ungroupedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ungrouped items. All items are in groups.
            </p>
          )}
        </CardContent>
      </Card>

      {/* New Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Navigation Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g., Operations"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={groupForm.icon}
                onChange={(icon) => setGroupForm((f) => ({ ...f, icon }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="group-active"
                  checked={groupForm.is_active}
                  onCheckedChange={(checked) =>
                    setGroupForm((f) => ({ ...f, is_active: !!checked }))
                  }
                />
                <Label htmlFor="group-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="group-collapsible"
                  checked={groupForm.is_collapsible}
                  onCheckedChange={(checked) =>
                    setGroupForm((f) => ({ ...f, is_collapsible: !!checked }))
                  }
                />
                <Label htmlFor="group-collapsible">Collapsible</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Visible to Roles (empty = all roles)</Label>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`group-role-${role.value}`}
                      checked={groupForm.visible_to_roles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        setGroupForm((f) => ({
                          ...f,
                          visible_to_roles: checked
                            ? [...f.visible_to_roles, role.value]
                            : f.visible_to_roles.filter((r) => r !== role.value),
                        }));
                      }}
                    />
                    <Label
                      htmlFor={`group-role-${role.value}`}
                      className="text-sm"
                    >
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={saving || !groupForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={groupForm.icon}
                onChange={(icon) => setGroupForm((f) => ({ ...f, icon }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-group-active"
                  checked={groupForm.is_active}
                  onCheckedChange={(checked) =>
                    setGroupForm((f) => ({ ...f, is_active: !!checked }))
                  }
                />
                <Label htmlFor="edit-group-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-group-collapsible"
                  checked={groupForm.is_collapsible}
                  onCheckedChange={(checked) =>
                    setGroupForm((f) => ({ ...f, is_collapsible: !!checked }))
                  }
                />
                <Label htmlFor="edit-group-collapsible">Collapsible</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Visible to Roles (empty = all roles)</Label>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`edit-group-role-${role.value}`}
                      checked={groupForm.visible_to_roles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        setGroupForm((f) => ({
                          ...f,
                          visible_to_roles: checked
                            ? [...f.visible_to_roles, role.value]
                            : f.visible_to_roles.filter((r) => r !== role.value),
                        }));
                      }}
                    />
                    <Label
                      htmlFor={`edit-group-role-${role.value}`}
                      className="text-sm"
                    >
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={saving || !groupForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Item Dialog */}
      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Navigation Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g., Dashboard"
                />
              </div>
              <div className="space-y-2">
                <Label>URL Path</Label>
                <Input
                  value={itemForm.href}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, href: e.target.value }))
                  }
                  placeholder="e.g., /dashboard"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker
                  value={itemForm.icon}
                  onChange={(icon) => setItemForm((f) => ({ ...f, icon }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Badge Key (optional)</Label>
                <Input
                  value={itemForm.badge_key}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, badge_key: e.target.value }))
                  }
                  placeholder="e.g., pendingProposals"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="item-active"
                checked={itemForm.is_active}
                onCheckedChange={(checked) =>
                  setItemForm((f) => ({ ...f, is_active: !!checked }))
                }
              />
              <Label htmlFor="item-active">Active (visible in sidebar)</Label>
            </div>
            <div className="space-y-2">
              <Label>Visible to Roles (empty = all roles)</Label>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`item-role-${role.value}`}
                      checked={itemForm.visible_to_roles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        setItemForm((f) => ({
                          ...f,
                          visible_to_roles: checked
                            ? [...f.visible_to_roles, role.value]
                            : f.visible_to_roles.filter((r) => r !== role.value),
                        }));
                      }}
                    />
                    <Label htmlFor={`item-role-${role.value}`} className="text-sm">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItem(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={saving || !itemForm.name || !itemForm.href}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Navigation Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>URL Path</Label>
                <Input
                  value={itemForm.href}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, href: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker
                  value={itemForm.icon}
                  onChange={(icon) => setItemForm((f) => ({ ...f, icon }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Badge Key (optional)</Label>
                <Input
                  value={itemForm.badge_key}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, badge_key: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-item-active"
                checked={itemForm.is_active}
                onCheckedChange={(checked) =>
                  setItemForm((f) => ({ ...f, is_active: !!checked }))
                }
              />
              <Label htmlFor="edit-item-active">
                Active (visible in sidebar)
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Visible to Roles (empty = all roles)</Label>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-1">
                    <Checkbox
                      id={`edit-item-role-${role.value}`}
                      checked={itemForm.visible_to_roles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        setItemForm((f) => ({
                          ...f,
                          visible_to_roles: checked
                            ? [...f.visible_to_roles, role.value]
                            : f.visible_to_roles.filter((r) => r !== role.value),
                        }));
                      }}
                    />
                    <Label
                      htmlFor={`edit-item-role-${role.value}`}
                      className="text-sm"
                    >
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateItem}
              disabled={saving || !itemForm.name || !itemForm.href}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
