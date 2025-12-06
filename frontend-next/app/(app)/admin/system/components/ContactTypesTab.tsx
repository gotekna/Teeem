"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

interface ContactType {
  id: number;
  name: string;
  display_name: string;
  tab_label: string | null;
  description: string | null;
  active: boolean;
  position: number;
}

export function ContactTypesTab() {
  const { toast } = useToast();

  const [contactTypes, setContactTypes] = React.useState<ContactType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingType, setEditingType] = React.useState<ContactType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    display_name: "",
    tab_label: "",
    description: "",
    active: true,
  });

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get<ContactType[]>("/api/v1/contact_types");
      setContactTypes(data);
    } catch (error) {
      console.error("Failed to load contact types:", error);
      toast({
        title: "Error",
        description: "Failed to load contact types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      display_name: "",
      tab_label: "",
      description: "",
      active: true,
    });
    setEditingType(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (type: ContactType) => {
    setFormData({
      name: type.name,
      display_name: type.display_name,
      tab_label: type.tab_label || "",
      description: type.description || "",
      active: type.active,
    });
    setEditingType(type);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast({
        title: "Error",
        description: "Name and Display Name are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingType) {
        await api.patch(`/api/v1/contact_types/${editingType.id}`, {
          contact_type: formData,
        });
        toast({ title: "Success", description: "Contact type updated" });
      } else {
        await api.post("/api/v1/contact_types", {
          contact_type: formData,
        });
        toast({ title: "Success", description: "Contact type created" });
      }
      setShowAddDialog(false);
      loadData();
    } catch (error: unknown) {
      console.error("Failed to save contact type:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.errors?.join(", ") || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact type?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/contact_types/${id}`);
      toast({ title: "Success", description: "Contact type deleted" });
      loadData();
    } catch (error: unknown) {
      console.error("Failed to delete contact type:", error);
      toast({
        title: "Cannot Delete",
        description: error?.response?.data?.error || "Failed to delete contact type",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (type: ContactType) => {
    try {
      await api.patch(`/api/v1/contact_types/${type.id}`, {
        contact_type: { active: !type.active },
      });
      loadData();
    } catch (error) {
      console.error("Failed to toggle active:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contact Types</h2>
          <p className="text-sm text-muted-foreground">
            Manage the types of contacts (Customer, Supplier, etc.) used throughout the system.
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Tab Label</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No contact types found. Click "Add Type" to create one.
                </TableCell>
              </TableRow>
            ) : (
              contactTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {type.name}
                    </div>
                  </TableCell>
                  <TableCell>{type.display_name}</TableCell>
                  <TableCell>{type.tab_label || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={type.active ? "default" : "secondary"}>
                      {type.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleting === type.id}
                        >
                          {deleting === type.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(type)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(type)}>
                          {type.active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(type.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Contact Type" : "Add Contact Type"}</DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update the contact type details."
                : "Create a new contact type for categorizing contacts."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Internal)</Label>
              <Input
                id="name"
                placeholder="e.g., customer"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used internally. Lowercase, no spaces.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                placeholder="e.g., Customer"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tab_label">Tab Label (Optional)</Label>
              <Input
                id="tab_label"
                placeholder="e.g., Customers"
                value={formData.tab_label}
                onChange={(e) => setFormData({ ...formData, tab_label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Label shown on tabs in the Contacts page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Customer contacts"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingType ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
