"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Building2,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface CompanyGroup {
  id: number;
  name: string;
  description?: string;
  default_registered_office?: string;
  default_principal_place?: string;
  default_accountant?: string;
  default_accountant_contact?: string;
  active?: boolean;
  companies_count?: number;
}

const COMPANY_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "struck_off", label: "Struck Off" },
  { value: "in_liquidation", label: "In Liquidation" },
  { value: "dormant", label: "Dormant" },
];

const ENTITY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "Company", label: "Company" },
  { value: "Trust", label: "Trust" },
  { value: "Superfund", label: "Superfund" },
];

interface Company {
  id: number;
  name: string;
  abn: string;
  acn: string;
  company_group_id?: number;
  group?: string;
  status: string;
  type: string;
  entity_type?: string;
  address: string;
  email: string;
  phone: string;
  sharepoint_url?: string;
}

// ===== GROUPS SUB-TAB =====
function GroupsSubTab() {
  const { toast } = useToast();
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<CompanyGroup | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    default_registered_office: "",
    default_principal_place: "",
    default_accountant: "",
    default_accountant_contact: "",
  });

  React.useEffect(() => {
    loadGroups();
     
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
      setGroups(response.data || []);
    } catch (error) {
      console.error("Failed to load groups:", error);
      toast({ title: "Error", description: "Failed to load company groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      default_registered_office: "",
      default_principal_place: "",
      default_accountant: "",
      default_accountant_contact: "",
    });
    setEditingGroup(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleOpenEditDialog = (group: CompanyGroup) => {
    setFormData({
      name: group.name,
      description: group.description || "",
      default_registered_office: group.default_registered_office || "",
      default_principal_place: group.default_principal_place || "",
      default_accountant: group.default_accountant || "",
      default_accountant_contact: group.default_accountant_contact || "",
    });
    setEditingGroup(group);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Group name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        await api.patch(`/api/v1/company_groups/${editingGroup.id}`, { company_group: formData });
        toast({ title: "Success", description: "Group updated successfully" });
      } else {
        await api.post("/api/v1/company_groups", { company_group: formData });
        toast({ title: "Success", description: "Group created successfully" });
      }
      setShowDialog(false);
      resetForm();
      loadGroups();
    } catch (error) {
      console.error("Failed to save group:", error);
      toast({ title: "Error", description: "Failed to save group", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: CompanyGroup) => {
    if (group.companies_count && group.companies_count > 0) {
      toast({
        title: "Cannot Delete",
        description: `This group has ${group.companies_count} companies. Reassign them first.`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;

    setDeleting(group.id);
    try {
      await api.delete(`/api/v1/company_groups/${group.id}`);
      toast({ title: "Success", description: "Group deleted successfully" });
      loadGroups();
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast({ title: "Error", description: "Failed to delete group", variant: "destructive" });
    } finally {
      setDeleting(null);
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
          <h3 className="text-lg font-medium">Company Groups</h3>
          <p className="text-sm text-muted-foreground">
            Manage company groups to organize related entities
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No groups yet</p>
              <p className="text-sm mt-1">Create your first company group to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Default Accountant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <FolderOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="font-medium">{group.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {group.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{group.companies_count || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.default_accountant || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        group.active !== false
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                      )}
                    >
                      {group.active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={deleting === group.id}>
                          {deleting === group.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(group)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/corporate?tab=groups`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View in Corporate
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(group)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Group Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Create New Group"}</DialogTitle>
            <DialogDescription>
              {editingGroup
                ? "Update the group details below."
                : "Create a new company group to organize related companies and trusts."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g., Smith Family Group"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                placeholder="Optional description of this group"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-registered-office">Default Registered Office</Label>
              <Input
                id="group-registered-office"
                placeholder="Address for registered office"
                value={formData.default_registered_office}
                onChange={(e) => setFormData({ ...formData, default_registered_office: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-principal-place">Default Principal Place of Business</Label>
              <Input
                id="group-principal-place"
                placeholder="Address for principal place"
                value={formData.default_principal_place}
                onChange={(e) => setFormData({ ...formData, default_principal_place: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="group-accountant">Default Accountant</Label>
                <Input
                  id="group-accountant"
                  placeholder="Accountant name"
                  value={formData.default_accountant}
                  onChange={(e) => setFormData({ ...formData, default_accountant: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="group-accountant-contact">Accountant Contact</Label>
                <Input
                  id="group-accountant-contact"
                  placeholder="Contact details"
                  value={formData.default_accountant_contact}
                  onChange={(e) => setFormData({ ...formData, default_accountant_contact: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingGroup ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== COMPANIES SUB-TAB =====
function CompaniesSubTab() {
  const { toast } = useToast();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGroupId, setSelectedGroupId] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedEntityType, setSelectedEntityType] = React.useState("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState<Company | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    abn: "",
    acn: "",
    company_group_id: "",
    status: "active",
    type: "",
    address: "",
    email: "",
    phone: "",
  });

  const loadGroups = async () => {
    try {
      const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
      setGroups(response.data || []);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const loadCompanies = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroupId !== "all") params.append("company_group_id", selectedGroupId);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedEntityType !== "all") params.append("entity_type", selectedEntityType);

      const response = await api.get<{ companies: Company[] }>(`/api/v1/companies?${params}`);
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, selectedStatus, selectedEntityType]);

  React.useEffect(() => {
    loadGroups();
  }, []);

  React.useEffect(() => {
    loadCompanies();
  }, [selectedGroupId, selectedStatus, selectedEntityType, loadCompanies]);

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      abn: "",
      acn: "",
      company_group_id: "",
      status: "active",
      type: "",
      address: "",
      email: "",
      phone: "",
    });
    setEditingCompany(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (company: Company) => {
    setFormData({
      name: company.name,
      abn: company.abn || "",
      acn: company.acn || "",
      company_group_id: company.company_group_id?.toString() || "",
      status: company.status || "active",
      type: company.type || "",
      address: company.address || "",
      email: company.email || "",
      phone: company.phone || "",
    });
    setEditingCompany(company);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Company name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        company_group_id: formData.company_group_id ? parseInt(formData.company_group_id) : null,
      };

      if (editingCompany) {
        await api.patch(`/api/v1/companies/${editingCompany.id}`, { company: payload });
        toast({ title: "Success", description: "Company updated successfully" });
      } else {
        await api.post("/api/v1/companies", { company: payload });
        toast({ title: "Success", description: "Company created successfully" });
      }
      setShowAddDialog(false);
      loadCompanies();
    } catch (error) {
      console.error("Failed to save company:", error);
      toast({ title: "Error", description: "Failed to save company", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/companies/${id}`);
      toast({ title: "Success", description: "Company deleted successfully" });
      loadCompanies();
    } catch (error) {
      console.error("Failed to delete company:", error);
      toast({ title: "Error", description: "Failed to delete company", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filteredCompanies = companies.filter((company) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      company.name?.toLowerCase().includes(search) ||
      company.abn?.toLowerCase().includes(search) ||
      company.acn?.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "dormant":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "struck_off":
      case "in_liquidation":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "";
    }
  };

  const getGroupName = (company: Company) => {
    if (company.company_group_id) {
      const group = groups.find(g => g.id === company.company_group_id);
      return group?.name || "Unknown";
    }
    return company.group || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>ABN/ACN</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No companies found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <Link
                            href={`/corporate/companies/${company.id}`}
                            className="font-medium hover:underline"
                          >
                            {company.name}
                          </Link>
                          {company.email && (
                            <p className="text-xs text-muted-foreground">{company.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {company.abn && <p>ABN: {company.abn}</p>}
                        {company.acn && <p className="text-muted-foreground">ACN: {company.acn}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {getGroupName(company)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", getStatusColor(company.status))}>
                        {company.status?.replace("_", " ") || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        company.entity_type === "Company" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
                        company.entity_type === "Trust" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
                        company.entity_type === "Superfund" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                      )}>
                        {company.entity_type || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deleting === company.id}>
                            {deleting === company.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/corporate/companies/${company.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(company)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {company.sharepoint_url && (
                            <DropdownMenuItem asChild>
                              <a
                                href={company.sharepoint_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                SharePoint
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(company.id)}
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
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company details below."
                : "Add a new company to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  placeholder="e.g., Builder, Developer"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  placeholder="XX XXX XXX XXX"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acn">ACN</Label>
                <Input
                  id="acn"
                  placeholder="XXX XXX XXX"
                  value={formData.acn}
                  onChange={(e) => setFormData({ ...formData, acn: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_group_id">Company Group</Label>
                <Select
                  value={formData.company_group_id}
                  onValueChange={(value) => setFormData({ ...formData, company_group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Group</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STATUSES.filter((s) => s.value !== "all").map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
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
              ) : editingCompany ? (
                "Update Company"
              ) : (
                "Add Company"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== COMPANY TABS CONFIG SUB-TAB =====

// Overview sub-tabs - these are pure UI structure, not database-driven
// They define the sections within the Overview tab on company pages
const OVERVIEW_UI_TABS = [
  { id: "info", name: "Information" },
  { id: "corporate", name: "Corporate" },
  { id: "bank-accounts", name: "Bank Accounts" },
  { id: "directors", name: "Directors" },
  { id: "shareholdings", name: "Shareholdings" },
  { id: "consolidation", name: "Consolidation" },
];

// Special UI tabs that are always shown (not document folders)
const SPECIAL_UI_TABS = [
  { id: "documents", name: "Documents" },
  { id: "data", name: "Data" },
  { id: "activity", name: "Activity" },
];

// SSoT: Xero tabs loaded from API - minimal fallback only
const XERO_TABS_FALLBACK = [
  { id: "connection", name: "Connection", type: "functional", enabled: true },
];

function CompanyTabsSubTab() {
  // SSoT: Document folder tabs from API
  const [documentFolderTabs, setDocumentFolderTabs] = React.useState<Array<{
    id: string;
    name: string;
    type: 'folder' | 'ui';
  }>>([]);
  const [loadingDocTabs, setLoadingDocTabs] = React.useState(true);

  // SSoT: Xero tabs from API
  const [xeroTabs, setXeroTabs] = React.useState<Array<{
    id: string;
    name: string;
    type: string;
    group?: string;
    enabled?: boolean;
  }>>([]);
  const [loadingXeroTabs, setLoadingXeroTabs] = React.useState(true);

  // SSoT: Load document folder tabs from same API as company page
  React.useEffect(() => {
    const loadDocumentFolderTabs = async () => {
      try {
        const data = await api.get<{ success: boolean; data: Array<{
          id: number;
          name: string;
          children?: Array<{ id: number; name: string }>;
        }> }>("/api/v1/document_folders?parent=CORPORATE");
        if (data.success && data.data) {
          // Filter to top-level folders (not XERO children, those are separate)
          const folderTabs = data.data
            .filter((f: { name: string }) => f.name !== 'XERO') // XERO has its own SSoT
            .map((folder: { name: string }) => ({
              id: folder.name.toLowerCase().replace(/\s+/g, '-'),
              name: folder.name,
              type: 'folder' as const
            }));
          setDocumentFolderTabs(folderTabs);
        }
      } catch (error) {
        console.error("Failed to load document folder tabs:", error);
        setDocumentFolderTabs([]);
      } finally {
        setLoadingDocTabs(false);
      }
    };
    loadDocumentFolderTabs();
  }, []);

  // SSoT: Load Xero tabs from API
  React.useEffect(() => {
    const loadXeroTabs = async () => {
      try {
        const response = await api.get<{ success: boolean; data: Array<{
          id: string;
          name: string;
          type: string;
          group?: string;
          enabled?: boolean;
        }> }>("/api/v1/xero/tabs");
        if (response.success && response.data) {
          setXeroTabs(response.data);
        }
      } catch (error) {
        console.error("Failed to load Xero tabs from API:", error);
        // SSoT: Minimal fallback
        setXeroTabs(XERO_TABS_FALLBACK);
      } finally {
        setLoadingXeroTabs(false);
      }
    };
    loadXeroTabs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Company Page Tabs</h3>
          <p className="text-sm text-muted-foreground">
            Configure which tabs appear on company detail pages
          </p>
        </div>
      </div>

      {/* Main Document Tabs - SSoT: Loaded from API */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Main Navigation Tabs</h4>
              <p className="text-sm text-muted-foreground">
                Document folder tabs loaded from database. Manage in Admin &gt; Documents.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              SSoT: API
            </Badge>
          </div>
          {loadingDocTabs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Document Folder Tabs */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Document Folders ({documentFolderTabs.length})
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {documentFolderTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20"
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium">{tab.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/40">
                        SharePoint
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special UI Tabs */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Special UI Tabs ({SPECIAL_UI_TABS.length})
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {SPECIAL_UI_TABS.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{tab.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        UI
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Overview Sub-Tabs - UI Structure */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Overview Sub-Tabs</h4>
              <p className="text-sm text-muted-foreground">
                UI structure tabs within the Overview section.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              UI Structure
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {OVERVIEW_UI_TABS.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tab.name}</span>
                </div>
                <Eye className="h-4 w-4 text-green-600" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Xero Sub-Tabs - SSoT: Loaded from API */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Xero Sub-Tabs</h4>
              <p className="text-sm text-muted-foreground">
                These tabs appear under the Xero section. Loaded from database (SSoT).
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              SSoT: API
            </Badge>
          </div>
          {loadingXeroTabs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Functional Tabs */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Functional Tabs ({xeroTabs.filter(t => t.type === 'functional').length})
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {xeroTabs.filter(t => t.type === 'functional').map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-indigo-50 dark:bg-indigo-900/20"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        <span className="text-sm font-medium">{tab.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tab.group || 'setup'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Tabs */}
              {xeroTabs.filter(t => t.type === 'document').length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Document Folders ({xeroTabs.filter(t => t.type === 'document').length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {xeroTabs.filter(t => t.type === 'document').map((tab) => (
                      <div
                        key={tab.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium">{tab.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/40">
                          SharePoint
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* SSoT Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-3">SSoT Architecture</h4>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Document Folder Tabs</p>
              <p>
                <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">GET /api/v1/document_folders?parent=CORPORATE</code>
              </p>
              <p className="mt-1 text-xs">Manage via Admin &gt; Documents. Each folder becomes a main tab on company pages.</p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <p className="font-medium text-indigo-900 dark:text-indigo-100 mb-1">Xero Tabs</p>
              <p>
                <code className="font-mono bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">GET /api/v1/xero/tabs</code>
              </p>
              <p className="mt-1 text-xs">
                Backend: <code className="font-mono">XeroFeatureTab.all_tabs_ordered</code> - combines functional tabs + XERO document folders, auto-filters duplicates.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">UI Structure Tabs</p>
              <p className="text-xs">Overview sub-tabs and special tabs (Documents, Data, Activity) are pure UI structure - not database-driven.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== MAIN CORPORATE TAB =====
export function CorporateTab() {
  const [activeSubTab, setActiveSubTab] = React.useState("groups");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Corporate Administration</h2>
          <p className="text-sm text-muted-foreground">
            Manage company groups and corporate entities
          </p>
        </div>
        <Link
          href="/corporate"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Go to Corporate Dashboard
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="company-tabs" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Company Tabs
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="groups">
            <GroupsSubTab />
          </TabsContent>
          <TabsContent value="companies">
            <CompaniesSubTab />
          </TabsContent>
          <TabsContent value="company-tabs">
            <CompanyTabsSubTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
