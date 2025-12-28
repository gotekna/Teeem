"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Edit,
  Play,
  GripVertical,
  Mail,
  Folder,
  Tag,
  Check,
  X,
  Forward,
  AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EmailRule {
  id: number;
  name: string;
  priority: number;
  is_active: boolean;
  stop_processing: boolean;
  imap_credential_id: number | null;
  conditions: Record<string, string | boolean>;
  actions: Record<string, string | boolean>;
  emails_matched: number;
  last_matched_at: string | null;
  created_at: string;
}

interface EmailAccount {
  id: number | string;
  name: string;
  email_address: string | null;
  type: string;
}

interface ConditionType {
  value: string;
  label: string;
  description: string;
}

interface ActionType {
  value: string;
  label: string;
  description: string;
}

const CONDITION_TYPES: ConditionType[] = [
  { value: "from_contains", label: "From Contains", description: "Matches if sender email contains this text" },
  { value: "from_exact", label: "From Exact", description: "Matches if sender email exactly equals this value" },
  { value: "from_domain", label: "From Domain", description: "Matches if sender domain equals this value" },
  { value: "to_contains", label: "To Contains", description: "Matches if any recipient contains this text" },
  { value: "subject_contains", label: "Subject Contains", description: "Matches if subject contains this text" },
  { value: "subject_not_contains", label: "Subject Not Contains", description: "Matches if subject does NOT contain this text" },
  { value: "body_contains", label: "Body Contains", description: "Matches if body contains this text" },
  { value: "has_attachments", label: "Has Attachments", description: "Matches based on attachment presence" },
];

const ACTION_TYPES: ActionType[] = [
  { value: "move_to_folder", label: "Move to Folder", description: "Move email to specified folder" },
  { value: "add_label", label: "Add Label", description: "Add a label/tag to the email" },
  { value: "mark_as_read", label: "Mark as Read", description: "Mark email as read" },
  { value: "mark_as_spam", label: "Mark as Spam", description: "Mark email as spam" },
  { value: "delete", label: "Delete", description: "Delete the email permanently" },
  { value: "forward_to", label: "Forward To", description: "Forward email to specified address" },
];

export default function EmailRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [applyingRuleId, setApplyingRuleId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formStopProcessing, setFormStopProcessing] = useState(false);
  const [formConditions, setFormConditions] = useState<Array<{ type: string; value: string }>>([]);
  const [formActions, setFormActions] = useState<Array<{ type: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);

  // Load rules and accounts
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesRes, accountsRes] = await Promise.all([
        api.get<{ success: boolean; data: EmailRule[] }>("/api/v1/email_rules"),
        api.get<{ success: boolean; data: EmailAccount[] }>("/api/v1/imap_credentials/all_accounts"),
      ]);

      if (rulesRes.success) {
        setRules(rulesRes.data);
      }
      if (accountsRes.success) {
        // Filter to IMAP accounts only since rules only work for IMAP
        const imapAccounts = accountsRes.data.filter((a: EmailAccount) => a.type === "imap");
        setAccounts(imapAccounts);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load email rules");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormName("");
    setFormAccountId("");
    setFormStopProcessing(false);
    setFormConditions([{ type: "from_contains", value: "" }]);
    setFormActions([{ type: "move_to_folder", value: "" }]);
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (rule: EmailRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormAccountId(rule.imap_credential_id?.toString() || "");
    setFormStopProcessing(rule.stop_processing);

    // Convert conditions object to array
    const conditions = Object.entries(rule.conditions).map(([type, value]) => ({
      type,
      value: typeof value === "boolean" ? (value ? "true" : "false") : String(value),
    }));
    setFormConditions(conditions.length > 0 ? conditions : [{ type: "from_contains", value: "" }]);

    // Convert actions object to array
    const actions = Object.entries(rule.actions).map(([type, value]) => ({
      type,
      value: typeof value === "boolean" ? (value ? "true" : "false") : String(value),
    }));
    setFormActions(actions.length > 0 ? actions : [{ type: "move_to_folder", value: "" }]);

    setIsCreateDialogOpen(true);
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingRule(null);
  };

  const addCondition = () => {
    setFormConditions([...formConditions, { type: "subject_contains", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: "type" | "value", value: string) => {
    const updated = [...formConditions];
    updated[index][field] = value;
    setFormConditions(updated);
  };

  const addAction = () => {
    setFormActions([...formActions, { type: "add_label", value: "" }]);
  };

  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: "type" | "value", value: string) => {
    const updated = [...formActions];
    updated[index][field] = value;
    setFormActions(updated);
  };

  const saveRule = async () => {
    if (!formName.trim()) {
      toast.error("Rule name is required");
      return;
    }

    if (formConditions.length === 0 || !formConditions.some(c => c.value.trim())) {
      toast.error("At least one condition with a value is required");
      return;
    }

    if (formActions.length === 0 || !formActions.some(a => a.value.trim())) {
      toast.error("At least one action with a value is required");
      return;
    }

    // Convert arrays back to objects
    const conditions: Record<string, string | boolean> = {};
    formConditions.forEach(c => {
      if (c.value.trim()) {
        // Handle boolean values
        if (c.type === "has_attachments") {
          conditions[c.type] = c.value === "true";
        } else {
          conditions[c.type] = c.value;
        }
      }
    });

    const actions: Record<string, string | boolean> = {};
    formActions.forEach(a => {
      if (a.value.trim()) {
        // Handle boolean values
        if (["mark_as_read", "mark_as_spam", "delete"].includes(a.type)) {
          actions[a.type] = a.value === "true";
        } else {
          actions[a.type] = a.value;
        }
      }
    });

    const payload = {
      email_rule: {
        name: formName,
        imap_credential_id: formAccountId ? parseInt(formAccountId) : null,
        stop_processing: formStopProcessing,
        conditions,
        actions,
      },
    };

    try {
      setSaving(true);
      if (editingRule) {
        await api.patch(`/api/v1/email_rules/${editingRule.id}`, payload);
        toast.success("Rule updated successfully");
      } else {
        await api.post("/api/v1/email_rules", payload);
        toast.success("Rule created successfully");
      }
      closeDialog();
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (rule: EmailRule) => {
    if (!confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/v1/email_rules/${rule.id}`);
      toast.success("Rule deleted successfully");
      loadData();
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  const toggleRuleActive = async (rule: EmailRule) => {
    try {
      await api.patch(`/api/v1/email_rules/${rule.id}`, {
        email_rule: { is_active: !rule.is_active },
      });
      loadData();
    } catch (error) {
      toast.error("Failed to update rule");
    }
  };

  const applyRuleToExisting = async (rule: EmailRule) => {
    try {
      setApplyingRuleId(rule.id);
      await api.post(`/api/v1/email_rules/${rule.id}/apply`);
      toast.success("Rule is being applied to existing emails. This may take a moment.");
    } catch (error) {
      toast.error("Failed to apply rule");
    } finally {
      setApplyingRuleId(null);
    }
  };

  const formatConditions = (conditions: Record<string, string | boolean>) => {
    return Object.entries(conditions)
      .map(([type, value]) => {
        const condType = CONDITION_TYPES.find(c => c.value === type);
        const label = condType?.label || type;
        return `${label}: "${value}"`;
      })
      .join(" AND ");
  };

  const formatActions = (actions: Record<string, string | boolean>) => {
    return Object.entries(actions)
      .map(([type, value]) => {
        const actType = ACTION_TYPES.find(a => a.value === type);
        const label = actType?.label || type;
        if (typeof value === "boolean") {
          return value ? label : null;
        }
        return `${label}: ${value}`;
      })
      .filter(Boolean)
      .join(", ");
  };

  const getActionIcon = (actions: Record<string, string | boolean>) => {
    const types = Object.keys(actions);
    if (types.includes("move_to_folder")) return <Folder className="h-4 w-4" />;
    if (types.includes("add_label")) return <Tag className="h-4 w-4" />;
    if (types.includes("mark_as_read")) return <Check className="h-4 w-4" />;
    if (types.includes("mark_as_spam")) return <AlertTriangle className="h-4 w-4" />;
    if (types.includes("delete")) return <Trash2 className="h-4 w-4" />;
    if (types.includes("forward_to")) return <Forward className="h-4 w-4" />;
    return <Mail className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/email" />
          <div>
            <h1 className="text-2xl font-semibold">Email Rules</h1>
            <p className="text-sm text-muted-foreground">
              Automatically organize your emails with rules
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No email rules yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create rules to automatically organize incoming emails
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Rule
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <Card
              key={rule.id}
              className={cn(
                "transition-opacity",
                !rule.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Drag Handle */}
                  <div className="flex items-center justify-center pt-1 text-muted-foreground cursor-move">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  {/* Rule Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.is_active ? "default" : "secondary"} className="text-xs">
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {rule.stop_processing && (
                        <Badge variant="outline" className="text-xs">
                          Stop after match
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">If: </span>
                      {formatConditions(rule.conditions)}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {getActionIcon(rule.actions)}
                      <span className="font-medium">Then: </span>
                      {formatActions(rule.actions)}
                    </div>

                    {rule.emails_matched > 0 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Matched {rule.emails_matched} emails
                        {rule.last_matched_at && (
                          <span> (last: {new Date(rule.last_matched_at).toLocaleDateString()})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleRuleActive(rule)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyRuleToExisting(rule)}
                      disabled={applyingRuleId === rule.id}
                      title="Apply to existing emails"
                    >
                      {applyingRuleId === rule.id ? (
                        <Spinner size={16} />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRule(rule)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Email Rule"}
            </DialogTitle>
            <DialogDescription>
              Define conditions and actions for automatically organizing your emails
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Move newsletters to folder"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Account Selection */}
            <div className="space-y-2">
              <Label>Apply to Account</Label>
              <Select value={formAccountId || "__all__"} onValueChange={(v) => setFormAccountId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All IMAP accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All IMAP accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={String(account.id)} value={String(account.id)}>
                      {account.name} ({account.email_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (ALL must match)</Label>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Condition
                </Button>
              </div>
              {formConditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={condition.type}
                    onValueChange={(value) => updateCondition(index, "type", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {condition.type === "has_attachments" ? (
                    <Select
                      value={condition.value}
                      onValueChange={(value) => updateCondition(index, "value", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes (has attachments)</SelectItem>
                        <SelectItem value="false">No (no attachments)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Value..."
                      value={condition.value}
                      onChange={(e) => updateCondition(index, "value", e.target.value)}
                      className="flex-1"
                    />
                  )}
                  {formConditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Action
                </Button>
              </div>
              {formActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(value) => updateAction(index, "type", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {["mark_as_read", "mark_as_spam", "delete"].includes(action.type) ? (
                    <Select
                      value={action.value}
                      onValueChange={(value) => updateAction(index, "value", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={
                        action.type === "move_to_folder"
                          ? "Folder name..."
                          : action.type === "add_label"
                          ? "Label name..."
                          : action.type === "forward_to"
                          ? "Email address..."
                          : "Value..."
                      }
                      value={action.value}
                      onChange={(e) => updateAction(index, "value", e.target.value)}
                      className="flex-1"
                    />
                  )}
                  {formActions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="flex items-center space-x-2">
              <Switch
                id="stop-processing"
                checked={formStopProcessing}
                onCheckedChange={setFormStopProcessing}
              />
              <Label htmlFor="stop-processing">
                Stop processing more rules after this rule matches
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingRule ? (
                "Update Rule"
              ) : (
                "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
