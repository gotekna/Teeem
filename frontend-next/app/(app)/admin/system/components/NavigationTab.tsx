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
import { Spinner } from "@/components/ui/spinner";
import { getIcon } from "@/lib/icon-map";
import {
  SortableList,
  SortableItem,
  reorderByPosition,
} from "@/components/ui/dnd";
import {
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
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
  parent_id: number | null;
  is_active: boolean;
  is_collapsed_default: boolean;
  visible_to_roles: string[];
  has_children: boolean;
  children_count: number;
}

export function NavigationTab() {
  const [items, setItems] = React.useState<NavigationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());

  // Dialog states
  const [editingItem, setEditingItem] = React.useState<NavigationItem | null>(null);
  const [showNewItem, setShowNewItem] = React.useState(false);
  const [parentForNewItem, setParentForNewItem] = React.useState<number | null>(null);

  // Form state
  const [itemForm, setItemForm] = React.useState({
    name: "",
    href: "",
    icon: "Folder",
    badge_key: "",
    is_active: true,
    is_collapsed_default: true,
    visible_to_roles: [] as string[],
  });

  // Load navigation items
  const loadNavigation = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ navigation_items: NavigationItem[] }>(
        "/api/v1/navigation_items"
      );
      setItems(res.navigation_items || []);
    } catch (error) {
      console.error("Failed to load navigation:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNavigation();
  }, [loadNavigation]);

  // Get top-level items (no parent)
  const topLevelItems = React.useMemo(() => {
    return items
      .filter((i) => !i.parent_id)
      .sort((a, b) => a.position - b.position);
  }, [items]);

  // Get children for a parent
  const getChildren = React.useCallback(
    (parentId: number) => {
      return items
        .filter((i) => i.parent_id === parentId)
        .sort((a, b) => a.position - b.position);
    },
    [items]
  );

  // Toggle item expansion
  const toggleExpanded = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Reorder top-level items
  const handleReorderTopLevel = async (newItems: NavigationItem[]) => {
    // Update local state with new positions
    const updatedItems = items.map((item) => {
      if (!item.parent_id) {
        const newIndex = newItems.findIndex((i) => i.id === item.id);
        return { ...item, position: newIndex };
      }
      return item;
    });
    setItems(updatedItems);

    // Persist to backend
    try {
      await api.post("/api/v1/navigation_items/reorder", {
        item_ids: newItems.map((i) => i.id),
      });
    } catch (error) {
      console.error("Failed to reorder items:", error);
      loadNavigation();
    }
  };

  // Reorder children within a parent
  const handleReorderChildren = async (parentId: number, newChildren: NavigationItem[]) => {
    // Update local state
    const updatedItems = items.map((item) => {
      if (item.parent_id === parentId) {
        const newIndex = newChildren.findIndex((i) => i.id === item.id);
        return { ...item, position: newIndex };
      }
      return item;
    });
    setItems(updatedItems);

    // Persist to backend
    try {
      await api.post("/api/v1/navigation_items/reorder", {
        item_ids: newChildren.map((i) => i.id),
      });
    } catch (error) {
      console.error("Failed to reorder children:", error);
      loadNavigation();
    }
  };

  // Handle position badge click (manual position entry)
  const handlePositionChange = async (item: NavigationItem, newPosition: number) => {
    const siblings = item.parent_id ? getChildren(item.parent_id) : topLevelItems;
    const reordered = reorderByPosition(siblings, item.id, newPosition);

    if (item.parent_id) {
      handleReorderChildren(item.parent_id, reordered);
    } else {
      handleReorderTopLevel(reordered);
    }
  };

  // Set item as child of another
  const handleSetParent = async (itemId: number, parentId: number | null) => {
    try {
      await api.patch(`/api/v1/navigation_items/${itemId}/set_parent`, {
        parent_id: parentId,
      });
      loadNavigation();
    } catch (error) {
      console.error("Failed to set parent:", error);
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
          parent_id: parentForNewItem,
        },
      });
      setShowNewItem(false);
      setParentForNewItem(null);
      setItemForm({
        name: "",
        href: "",
        icon: "Folder",
        badge_key: "",
        is_active: true,
        is_collapsed_default: true,
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
    const hasChildren = getChildren(item.id).length > 0;
    const message = hasChildren
      ? `Delete "${item.name}"? Its ${getChildren(item.id).length} child items will become top-level.`
      : `Delete navigation item "${item.name}"?`;

    if (!confirm(message)) return;
    try {
      await api.delete(`/api/v1/navigation_items/${item.id}`);
      loadNavigation();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  // Open edit dialog
  const openEditItem = (item: NavigationItem) => {
    setItemForm({
      name: item.name,
      href: item.href,
      icon: item.icon,
      badge_key: item.badge_key || "",
      is_active: item.is_active,
      is_collapsed_default: item.is_collapsed_default,
      visible_to_roles: item.visible_to_roles || [],
    });
    setEditingItem(item);
  };

  // Open new item dialog (optionally with a parent)
  const openNewItem = (parentId: number | null = null) => {
    setParentForNewItem(parentId);
    setItemForm({
      name: "",
      href: "",
      icon: "Folder",
      badge_key: "",
      is_active: true,
      is_collapsed_default: true,
      visible_to_roles: [],
    });
    setShowNewItem(true);
  };

  // Render a navigation item with its children
  // depth: 0 = top-level, 1 = child, 2 = grandchild (max depth)
  const MAX_NESTING_DEPTH = 2;
  const renderItem = (item: NavigationItem, index: number, total: number, depth = 0) => {
    const Icon = getIcon(item.icon);
    const children = getChildren(item.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    // Level 0 and 1 can have children (creates level 1 and 2)
    // Level 2 (grandchildren) cannot have children
    const canHaveChildren = depth < MAX_NESTING_DEPTH;
    const canExpand = depth < MAX_NESTING_DEPTH;

    return (
      <div key={item.id} className={cn(depth > 0 && "ml-6")}>
        <SortableItem
          id={item.id}
          position={index + 1}
          editablePosition
          onPositionChange={(pos) => handlePositionChange(item, pos)}
          maxPosition={total}
          variant="card"
          className={cn(!item.is_active && "opacity-50")}
          actions={
            <div className="flex items-center gap-1">
              {canHaveChildren && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openNewItem(item.id)}
                  title="Add child item"
                  className="h-7 w-7"
                >
                  <CornerDownRight className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditItem(item)}
                className="h-7 w-7"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteItem(item)}
                className="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Expand/Collapse button for items with children */}
            {canExpand && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleExpanded(item.id);
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-accent shrink-0",
                  !hasChildren && "invisible"
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{item.name}</span>
            <span className="text-xs text-muted-foreground truncate">{item.href}</span>
            {!item.is_active && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1">
                Hidden
              </Badge>
            )}
            {item.visible_to_roles.length > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 px-1">
                {item.visible_to_roles.length} roles
              </Badge>
            )}
            {hasChildren && (
              <Badge variant="outline" className="text-[10px] py-0 px-1">
                {children.length} children
              </Badge>
            )}
          </div>
        </SortableItem>

        {/* Children (expanded) - supports 2 levels of nesting */}
        {canExpand && hasChildren && isExpanded && (
          <div className="mt-1">
            <SortableList
              items={children}
              onReorder={(newOrder) => handleReorderChildren(item.id, newOrder)}
              className="space-y-1"
            >
              {children.map((child, childIndex) =>
                renderItem(child, childIndex, children.length, depth + 1)
              )}
            </SortableList>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
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
            Manage sidebar navigation items. Drag to reorder. Click position numbers to jump.
          </p>
        </div>
        <Button onClick={() => openNewItem(null)}>
          <Plus className="h-4 w-4 mr-2" />
          New Item
        </Button>
      </div>

      {/* Navigation Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Navigation Items ({items.length})</span>
            <span className="text-xs text-muted-foreground font-normal">
              Top-level: {topLevelItems.length} | Nested: {items.length - topLevelItems.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topLevelItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No navigation items yet. Click "New Item" to create one.
            </p>
          ) : (
            <SortableList
              items={topLevelItems}
              onReorder={handleReorderTopLevel}
              className="space-y-1"
            >
              {topLevelItems.map((item, index) =>
                renderItem(item, index, topLevelItems.length, 0)
              )}
            </SortableList>
          )}
        </CardContent>
      </Card>

      {/* New Item Dialog */}
      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {parentForNewItem
                ? `New Child Item (under ${items.find((i) => i.id === parentForNewItem)?.name})`
                : "New Navigation Item"}
            </DialogTitle>
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
                  onChange={(icon) => setItemForm((f) => ({ ...f, icon: icon || "" }))}
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="item-active"
                  checked={itemForm.is_active}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, is_active: !!checked }))
                  }
                />
                <Label htmlFor="item-active">Active (visible)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="item-collapsed"
                  checked={itemForm.is_collapsed_default}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, is_collapsed_default: !!checked }))
                  }
                />
                <Label htmlFor="item-collapsed">Collapsed by default</Label>
              </div>
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
              {saving && <Spinner size={16} className="mr-2" />}
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
                  onChange={(icon) => setItemForm((f) => ({ ...f, icon: icon || "" }))}
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-item-active"
                  checked={itemForm.is_active}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, is_active: !!checked }))
                  }
                />
                <Label htmlFor="edit-item-active">Active (visible)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-item-collapsed"
                  checked={itemForm.is_collapsed_default}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, is_collapsed_default: !!checked }))
                  }
                />
                <Label htmlFor="edit-item-collapsed">Collapsed by default</Label>
              </div>
            </div>
            {/* Parent selection for existing items */}
            {editingItem && !editingItem.parent_id && (
              <div className="space-y-2">
                <Label>Make this a child of</Label>
                <div className="flex flex-wrap gap-2">
                  {topLevelItems
                    .filter((i) => i.id !== editingItem.id)
                    .map((parent) => (
                      <Button
                        key={parent.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetParent(editingItem.id, parent.id)}
                        className="text-xs"
                      >
                        {parent.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}
            {editingItem?.parent_id && (
              <div className="space-y-2">
                <Label>Currently a child of</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {items.find((i) => i.id === editingItem.parent_id)?.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetParent(editingItem.id, null)}
                    className="text-xs"
                  >
                    Make top-level
                  </Button>
                </div>
              </div>
            )}
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
              {saving && <Spinner size={16} className="mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
