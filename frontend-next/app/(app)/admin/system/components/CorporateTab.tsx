"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMPANY_GROUPS = [
  { value: "all", label: "All Groups" },
  { value: "tekna", label: "Tekna" },
  { value: "team_harder", label: "Team Harder" },
  { value: "promise", label: "Promise" },
  { value: "charity", label: "Charity" },
  { value: "other", label: "Other" },
];

const COMPANY_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "struck_off", label: "Struck Off" },
  { value: "in_liquidation", label: "In Liquidation" },
  { value: "dormant", label: "Dormant" },
];

interface Company {
  id: number;
  name: string;
  abn: string;
  acn: string;
  group: string;
  status: string;
  type: string;
  address: string;
  email: string;
  phone: string;
  sharepoint_url?: string;
}

export function CorporateTab() {
  const { toast } = useToast();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGroup, setSelectedGroup] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState<Company | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    abn: "",
    acn: "",
    group: "other",
    status: "active",
    type: "",
    address: "",
    email: "",
    phone: "",
  });

  React.useEffect(() => {
    loadCompanies();
  }, [selectedGroup, selectedStatus]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroup !== "all") params.append("group", selectedGroup);
      if (selectedStatus !== "all") params.append("status", selectedStatus);

      const data = await api.get<Company[]>(`/api/v1/companies?${params}`);
      setCompanies(data);
    } catch (error) {
      console.error("Failed to load companies:", error);
      // Mock data for development
      setCompanies([
        {
          id: 1,
          name: "Tekna Homes Pty Ltd",
          abn: "12 345 678 901",
          acn: "123 456 789",
          group: "tekna",
          status: "active",
          type: "Builder",
          address: "123 Main St, Brisbane QLD 4000",
          email: "info@teknahomes.com.au",
          phone: "07 1234 5678",
        },
        {
          id: 2,
          name: "Promise Developments",
          abn: "98 765 432 109",
          acn: "987 654 321",
          group: "promise",
          status: "active",
          type: "Developer",
          address: "456 Queen St, Brisbane QLD 4000",
          email: "info@promise.com.au",
          phone: "07 9876 5432",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      abn: "",
      acn: "",
      group: "other",
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
      group: company.group || "other",
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
      if (editingCompany) {
        await api.patch(`/api/v1/companies/${editingCompany.id}`, { company: formData });
        toast({ title: "Success", description: "Company updated successfully" });
      } else {
        await api.post("/api/v1/companies", { company: formData });
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
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_GROUPS.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
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
                        {company.group?.replace("_", " ") || "Other"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", getStatusColor(company.status))}>
                        {company.status?.replace("_", " ") || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{company.type || "-"}</TableCell>
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
                <Label htmlFor="group">Group</Label>
                <Select
                  value={formData.group}
                  onValueChange={(value) => setFormData({ ...formData, group: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_GROUPS.filter((g) => g.value !== "all").map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
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
