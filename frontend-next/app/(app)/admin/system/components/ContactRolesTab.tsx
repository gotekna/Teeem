"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  Building2,
  Globe,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface ContactType {
  id: number;
  name: string;
  code: string;
}

interface ContactRole {
  id: number;
  name: string;
  // Backend returns string array like ["customer", "supplier"], not objects
  contact_types: string[];
  contact_types_display?: string;
}

const CONTACT_TYPE_ICONS: Record<string, typeof Users> = {
  customer: Users,
  supplier: Building2,
  universal: Globe,
};

export function ContactRolesTab() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [contactTypes, setContactTypes] = React.useState<ContactType[]>([]);
  const [roles, setRoles] = React.useState<ContactRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<ContactRole | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    contact_type_ids: [] as number[],
  });

  const selectedTab = searchParams.get("contactRoleTab") || "all";

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [typesData, rolesData] = await Promise.all([
        api.get<ContactType[]>("/api/v1/contact_types"),
        api.get<ContactRole[]>("/api/v1/contact_roles"),
      ]);
      setContactTypes(typesData);
      setRoles(rolesData);
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data - contact_types is array of strings
      setContactTypes([
        { id: 1, name: "Customer", code: "customer" },
        { id: 2, name: "Supplier", code: "supplier" },
        { id: 3, name: "Universal", code: "universal" },
      ]);
      setRoles([
        { id: 1, name: "Owner", contact_types: ["customer"] },
        { id: 2, name: "Architect", contact_types: ["customer"] },
        { id: 3, name: "Sales Rep", contact_types: ["supplier"] },
        { id: 4, name: "Account Manager", contact_types: ["supplier"] },
        { id: 5, name: "Primary Contact", contact_types: ["universal"] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("contactRoleTab", value);
    router.push(`/admin/system?${params.toString()}`);
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", contact_type_ids: [] });
    setEditingRole(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (role: ContactRole) => {
    // Map string codes to ContactType IDs
    const typeIds = (role.contact_types || [])
      .map((code) => contactTypes.find((t) => t.code === code)?.id)
      .filter((id): id is number => id !== undefined);
    setFormData({
      name: role.name,
      contact_type_ids: typeIds,
    });
    setEditingRole(role);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Role name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Convert IDs back to string codes for backend
      const contactTypeCodes = formData.contact_type_ids
        .map((id) => contactTypes.find((t) => t.id === id)?.code)
        .filter((code): code is string => code !== undefined);

      const payload = {
        contact_role: {
          name: formData.name,
          contact_types: contactTypeCodes,
        },
      };

      if (editingRole) {
        await api.patch(`/api/v1/contact_roles/${editingRole.id}`, payload);
        toast({ title: "Success", description: "Role updated successfully" });
      } else {
        await api.post("/api/v1/contact_roles", payload);
        toast({ title: "Success", description: "Role created successfully" });
      }
      setShowAddDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save role:", error);
      toast({ title: "Error", description: "Failed to save role", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/contact_roles/${id}`);
      toast({ title: "Success", description: "Role deleted successfully" });
      loadData();
    } catch (error) {
      console.error("Failed to delete role:", error);
      toast({ title: "Error", description: "Failed to delete role", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const toggleContactType = (typeId: number) => {
    if (formData.contact_type_ids.includes(typeId)) {
      setFormData({
        ...formData,
        contact_type_ids: formData.contact_type_ids.filter((id) => id !== typeId),
      });
    } else {
      setFormData({
        ...formData,
        contact_type_ids: [...formData.contact_type_ids, typeId],
      });
    }
  };

  const getFilteredRoles = (typeCode: string) => {
    if (typeCode === "all") return roles;
    // contact_types is array of strings like ["customer", "supplier"]
    return roles.filter((role) =>
      Array.isArray(role.contact_types) && role.contact_types.includes(typeCode)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs = [
    { id: "all", label: "All Roles", icon: Globe },
    ...contactTypes.map((type) => ({
      id: type.code,
      label: type.name,
      icon: CONTACT_TYPE_ICONS[type.code] || Users,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contact Roles</h2>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={handleTabChange}>
        <TabsList>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Contact Types</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredRoles(tab.id).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No roles found for this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFilteredRoles(tab.id).map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(role.contact_types) ? role.contact_types : []).map((typeCode) => {
                              const typeObj = contactTypes.find((t) => t.code === typeCode);
                              return (
                                <Badge key={typeCode} variant="outline">
                                  {typeObj?.name || typeCode}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deleting === role.id}
                              >
                                {deleting === role.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEditDialog(role)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(role.id)}
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
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the contact role details."
                : "Create a new contact role for your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                placeholder="e.g., Primary Contact"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Types</Label>
              <p className="text-sm text-muted-foreground">
                Select which contact types this role applies to.
              </p>
              <div className="space-y-2 mt-2">
                {contactTypes.map((type) => {
                  const Icon = CONTACT_TYPE_ICONS[type.code] || Users;
                  return (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={formData.contact_type_ids.includes(type.id)}
                        onCheckedChange={() => toggleContactType(type.id)}
                      />
                      <Label
                        htmlFor={`type-${type.id}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {type.name}
                      </Label>
                    </div>
                  );
                })}
              </div>
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
              ) : editingRole ? (
                "Update Role"
              ) : (
                "Add Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
