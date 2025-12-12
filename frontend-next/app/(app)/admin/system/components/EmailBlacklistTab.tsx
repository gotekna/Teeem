"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  Ban,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface BlacklistItem {
  id: number;
  pattern: string;
  pattern_type: "from_email" | "subject" | "domain" | "sender_name";
  description: string | null;
  active: boolean;
  match_count: number;
  warehouse_match_count: number;
  created_at: string;
  updated_at: string;
}

interface EmailBlacklistResponse {
  success: boolean;
  items: BlacklistItem[];
  pattern_types: string[];
}

const PATTERN_TYPE_LABELS = {
  from_email: "From Email",
  subject: "Subject",
  domain: "Domain",
  sender_name: "Sender Name",
};

const PATTERN_TYPE_DESCRIPTIONS = {
  from_email: "Matches part of sender email (e.g., 'marketing@', 'noreply@')",
  subject: "Matches part of email subject (e.g., 'unsubscribe', 'opt out')",
  domain: "Matches exact sender domain (e.g., 'mailchimp.com', 'facebook.com')",
  sender_name: "Matches part of sender display name (e.g., 'LinkedIn', 'Facebook')",
};

export function EmailBlacklistTab() {
  const { toast } = useToast();
  const [items, setItems] = React.useState<BlacklistItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showTestDialog, setShowTestDialog] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<BlacklistItem | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [pattern, setPattern] = React.useState("");
  const [patternType, setPatternType] = React.useState<string>("from_email");
  const [description, setDescription] = React.useState("");
  const [active, setActive] = React.useState(true);

  // Test form state
  const [testFromEmail, setTestFromEmail] = React.useState("");
  const [testFromName, setTestFromName] = React.useState("");
  const [testSubject, setTestSubject] = React.useState("");
  const [testResult, setTestResult] = React.useState<{
    would_filter: boolean;
    matched_pattern: BlacklistItem | null;
  } | null>(null);

  React.useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.get<EmailBlacklistResponse>("/api/v1/email_blacklist");
      if (response.success) {
        setItems(response.items);
      }
    } catch (error) {
      console.error("Failed to load blacklist items:", error);
      toast({
        title: "Error",
        description: "Failed to load blacklist items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!pattern.trim()) {
      toast({
        title: "Validation Error",
        description: "Pattern is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post<{ success: boolean }>("/api/v1/email_blacklist", {
        email_blacklist_item: {
          pattern: pattern.trim(),
          pattern_type: patternType,
          description: description.trim() || null,
          active,
        },
      });

      if (response?.success) {
        toast({
          title: "Success",
          description: "Blacklist pattern added successfully",
        });
        setShowAddDialog(false);
        resetForm();
        loadItems();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add blacklist pattern",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingItem) return;

    try {
      setSubmitting(true);
      const response = await api.patch<{ success: boolean }>(`/api/v1/email_blacklist/${editingItem.id}`, {
        email_blacklist_item: {
          pattern: pattern.trim(),
          pattern_type: patternType,
          description: description.trim() || null,
          active,
        },
      });

      if (response?.success) {
        toast({
          title: "Success",
          description: "Blacklist pattern updated successfully",
        });
        setShowEditDialog(false);
        setEditingItem(null);
        resetForm();
        loadItems();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update blacklist pattern",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: BlacklistItem) => {
    if (!confirm(`Are you sure you want to delete the pattern "${item.pattern}"?`)) {
      return;
    }

    try {
      const response = await api.delete<{ success: boolean }>(`/api/v1/email_blacklist/${item.id}`);
      if (response?.success) {
        toast({
          title: "Success",
          description: "Blacklist pattern deleted successfully",
        });
        loadItems();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blacklist pattern",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (item: BlacklistItem) => {
    try {
      const response = await api.patch<{ success: boolean }>(`/api/v1/email_blacklist/${item.id}`, {
        email_blacklist_item: {
          active: !item.active,
        },
      });

      if (response?.success) {
        toast({
          title: "Success",
          description: item.active ? "Pattern disabled" : "Pattern enabled",
        });
        loadItems();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle pattern",
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    try {
      setSubmitting(true);
      const response = await api.post<{
        success: boolean;
        would_filter: boolean;
        matched_pattern: BlacklistItem | null;
      }>("/api/v1/email_blacklist/test", {
        from_email: testFromEmail,
        from_name: testFromName,
        subject: testSubject,
      });

      if (response?.success) {
        setTestResult({
          would_filter: response.would_filter,
          matched_pattern: response.matched_pattern,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to test email",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (item: BlacklistItem) => {
    setEditingItem(item);
    setPattern(item.pattern);
    setPatternType(item.pattern_type);
    setDescription(item.description || "");
    setActive(item.active);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setPattern("");
    setPatternType("from_email");
    setDescription("");
    setActive(true);
  };

  const resetTestForm = () => {
    setTestFromEmail("");
    setTestFromName("");
    setTestSubject("");
    setTestResult(null);
  };

  const sortedItems = [...items].sort((a, b) => b.match_count - a.match_count);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Blacklist</h3>
          <p className="text-sm text-muted-foreground">
            Filter out unwanted emails during sync (marketing, spam, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetTestForm();
              setShowTestDialog(true);
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Test Email
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Pattern
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {items.filter((i) => i.active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactive Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-400">
              {items.filter((i) => !i.active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Historical Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {items.reduce((sum, i) => sum + i.match_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warehouse Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {items.reduce((sum, i) => sum + i.warehouse_match_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Ban className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No blacklist patterns configured</p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                Add Your First Pattern
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Historical</TableHead>
                  <TableHead className="text-center">Warehouse</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.pattern}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PATTERN_TYPE_LABELS[item.pattern_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{item.match_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {item.warehouse_match_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.active}
                        onCheckedChange={() => handleToggleActive(item)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blacklist Pattern</DialogTitle>
            <DialogDescription>
              Add a pattern to filter unwanted emails during sync
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pattern Type</Label>
              <Select value={patternType} onValueChange={setPatternType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PATTERN_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {PATTERN_TYPE_DESCRIPTIONS[patternType as keyof typeof PATTERN_TYPE_DESCRIPTIONS]}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pattern *</Label>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={
                  patternType === "from_email"
                    ? "e.g., marketing@"
                    : patternType === "subject"
                    ? "e.g., unsubscribe"
                    : patternType === "domain"
                    ? "e.g., mailchimp.com"
                    : "e.g., LinkedIn"
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Blacklist Pattern</DialogTitle>
            <DialogDescription>Update the blacklist pattern settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pattern Type</Label>
              <Select value={patternType} onValueChange={setPatternType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PATTERN_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pattern *</Label>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter pattern"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Email Against Blacklist</DialogTitle>
            <DialogDescription>
              Check if an email would be filtered by the current blacklist patterns
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={testFromEmail}
                onChange={(e) => setTestFromEmail(e.target.value)}
                placeholder="e.g., no-reply@marketing.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={testFromName}
                onChange={(e) => setTestFromName(e.target.value)}
                placeholder="e.g., Example Marketing"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="e.g., Special Offer - Unsubscribe at bottom"
              />
            </div>
            <Button onClick={handleTest} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Email
            </Button>

            {testResult && (
              <Card className={cn(
                "border-2",
                testResult.would_filter ? "border-red-500 bg-red-50" : "border-green-500 bg-green-50"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    {testResult.would_filter ? (
                      <>
                        <XCircle className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">Email Would Be Filtered</p>
                          <p className="text-sm text-red-700">This email would NOT be synced</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">Email Would Be Synced</p>
                          <p className="text-sm text-green-700">This email passes all filters</p>
                        </div>
                      </>
                    )}
                  </div>

                  {testResult.matched_pattern && (
                    <div className="mt-4 p-3 bg-white rounded-md border">
                      <p className="text-sm font-medium mb-2">Matched Pattern:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pattern:</span>{" "}
                          <code className="font-mono">{testResult.matched_pattern.pattern}</code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>{" "}
                          <Badge variant="outline">
                            {PATTERN_TYPE_LABELS[testResult.matched_pattern.pattern_type]}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Description:</span>{" "}
                          {testResult.matched_pattern.description || "-"}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
