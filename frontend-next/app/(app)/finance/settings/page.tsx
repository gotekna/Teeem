"use client";

import { useEffect, useState, useCallback } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Settings,
  Building2,
  DollarSign,
  Percent,
  Edit,
  Trash2,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

interface CompanyApprovalRule {
  id: number;
  company_id: number;
  corporate?: {
    id: number;
    name: string;
    code: string;
  };
  rule_type: string;
  name: string;
  min_amount: number | null;
  max_amount: number | null;
  variance_threshold_percent: number | null;
  approver_type: string;
  approver_id: number | null;
  bpmn_process_id: number | null;
  priority: number;
  is_active: boolean;
}

interface Corporate {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const ruleTypeLabels: Record<string, string> = {
  bill_approval: "Bill Approval",
  payment_batch: "Payment Batch",
  variance_override: "Variance Override",
  workflow_config: "Workflow Config",
};

const approverTypeLabels: Record<string, string> = {
  user: "Specific User",
  role: "Role-based",
  group: "User Group",
};

export default function FinanceSettingsPage() {
  const { confirm } = useConfirm();
  const [rules, setRules] = useState<CompanyApprovalRule[]>([]);
  const [companies, setCompanies] = useState<Corporate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CompanyApprovalRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    company_id: "",
    rule_type: "bill_approval",
    name: "",
    min_amount: "",
    max_amount: "",
    variance_threshold_percent: "",
    approver_type: "role",
    approver_id: "",
    priority: "1",
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, companiesRes, usersRes] = await Promise.all([
        api.get<CompanyApprovalRule[] | { rules: CompanyApprovalRule[] }>("/api/v1/company_approval_rules"),
        api.get<Corporate[] | { companies: Corporate[] }>("/api/v1/companies"),
        api.get<User[] | { users: User[] }>("/api/v1/users"),
      ]);
      setRules(Array.isArray(rulesRes) ? rulesRes : (rulesRes.rules || []));
      setCompanies(Array.isArray(companiesRes) ? companiesRes : (companiesRes.companies || []));
      setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.users || []));
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRules = rules.filter((rule) =>
    companyFilter === "all" || rule.company_id.toString() === companyFilter
  );

  const handleOpenDialog = (rule?: CompanyApprovalRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        company_id: rule.company_id.toString(),
        rule_type: rule.rule_type,
        name: rule.name,
        min_amount: rule.min_amount?.toString() || "",
        max_amount: rule.max_amount?.toString() || "",
        variance_threshold_percent: rule.variance_threshold_percent?.toString() || "",
        approver_type: rule.approver_type,
        approver_id: rule.approver_id?.toString() || "",
        priority: rule.priority.toString(),
        is_active: rule.is_active,
      });
    } else {
      setEditingRule(null);
      setFormData({
        company_id: "",
        rule_type: "bill_approval",
        name: "",
        min_amount: "",
        max_amount: "",
        variance_threshold_percent: "",
        approver_type: "role",
        approver_id: "",
        priority: "1",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_id: parseInt(formData.company_id),
        rule_type: formData.rule_type,
        name: formData.name,
        min_amount: formData.min_amount ? parseFloat(formData.min_amount) : null,
        max_amount: formData.max_amount ? parseFloat(formData.max_amount) : null,
        variance_threshold_percent: formData.variance_threshold_percent
          ? parseFloat(formData.variance_threshold_percent)
          : null,
        approver_type: formData.approver_type,
        approver_id: formData.approver_id ? parseInt(formData.approver_id) : null,
        priority: parseInt(formData.priority),
        is_active: formData.is_active,
      };

      if (editingRule) {
        await api.patch(`/api/v1/company_approval_rules/${editingRule.id}`, payload);
      } else {
        await api.post("/api/v1/company_approval_rules", payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to save rule:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!(await confirm("Are you sure you want to delete this rule?"))) return;
    try {
      await api.delete(`/api/v1/company_approval_rules/${ruleId}`);
      await loadData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
    }
  };

  const handleToggleActive = async (rule: CompanyApprovalRule) => {
    try {
      await api.patch(`/api/v1/company_approval_rules/${rule.id}`, {
        is_active: !rule.is_active,
      });
      await loadData();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
<BackButton fallbackHref="/finance" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Finance Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure approval rules and thresholds per company
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Company Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[300px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.code} - {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner />
        </div>
      ) : filteredRules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No approval rules configured</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add rules to define approval thresholds for each company.
            </p>
            <Button className="mt-4" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Rule Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount Range</TableHead>
                <TableHead>Variance Threshold</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    {rule.corporate?.code || "-"}
                  </TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ruleTypeLabels[rule.rule_type] || rule.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {rule.min_amount != null || rule.max_amount != null ? (
                      <>
                        ${(rule.min_amount || 0).toLocaleString()} -{" "}
                        {rule.max_amount ? `$${rule.max_amount.toLocaleString()}` : "unlimited"}
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.variance_threshold_percent != null
                      ? `${rule.variance_threshold_percent}%`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {approverTypeLabels[rule.approver_type] || rule.approver_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{rule.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Approval Rule"}</DialogTitle>
            <DialogDescription>
              Configure approval thresholds and routing for bills.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={formData.company_id}
                onValueChange={(v) => setFormData({ ...formData, company_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.code} - {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., Finance Manager Approval"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(v) => setFormData({ ...formData, rule_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bill_approval">Bill Approval</SelectItem>
                  <SelectItem value="payment_batch">Payment Batch</SelectItem>
                  <SelectItem value="variance_override">Variance Override</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variance Threshold (%)</Label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={formData.variance_threshold_percent}
                onChange={(e) =>
                  setFormData({ ...formData, variance_threshold_percent: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Approver Type</Label>
              <Select
                value={formData.approver_type}
                onValueChange={(v) => setFormData({ ...formData, approver_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Role-based</SelectItem>
                  <SelectItem value="user">Specific User</SelectItem>
                  <SelectItem value="group">User Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.approver_type === "user" && (
              <div className="space-y-2">
                <Label>Approver</Label>
                <Select
                  value={formData.approver_id}
                  onValueChange={(v) => setFormData({ ...formData, approver_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers are evaluated first.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.company_id || !formData.name}
            >
              {saving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
