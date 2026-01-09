"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Edit2,
  Mail,
  Globe,
  User,
  FileText,
  Ban,
  CheckCircle,
  XCircle,
  TestTube,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type PatternType = "from_email" | "subject" | "domain" | "sender_name";

export interface BlacklistItem {
  id: number;
  pattern: string;
  pattern_type: PatternType;
  description: string | null;
  active: boolean;
  match_count: number;
  warehouse_match_count: number;
  created_at: string;
  updated_at: string;
}

const PATTERN_TYPE_CONFIG: Record<
  PatternType,
  { label: string; icon: typeof Mail; description: string; placeholder: string }
> = {
  from_email: {
    label: "Email Address",
    icon: Mail,
    description: "Block emails from a specific sender",
    placeholder: "spam@example.com",
  },
  domain: {
    label: "Domain",
    icon: Globe,
    description: "Block all emails from a domain",
    placeholder: "spammer.com",
  },
  sender_name: {
    label: "Sender Name",
    icon: User,
    description: "Block by sender display name",
    placeholder: "Marketing Bot",
  },
  subject: {
    label: "Subject Keyword",
    icon: FileText,
    description: "Block emails with specific subject text",
    placeholder: "Unsubscribe",
  },
};

interface BlacklistManagerProps {
  className?: string;
}

export function BlacklistManager({ className }: BlacklistManagerProps) {
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BlacklistItem | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    would_filter: boolean;
    matched_pattern: BlacklistItem | null;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [pattern, setPattern] = useState("");
  const [patternType, setPatternType] = useState<PatternType>("from_email");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  // Test form state
  const [testFromEmail, setTestFromEmail] = useState("");
  const [testFromName, setTestFromName] = useState("");
  const [testSubject, setTestSubject] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; items: BlacklistItem[] }>(
        "/api/v1/email_blacklist"
      );
      if (response.success) {
        setItems(response.items);
      }
    } catch (error) {
      console.error("Failed to fetch blacklist items:", error);
      toast({
        title: "Error",
        description: "Failed to load blacklist items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetForm = () => {
    setPattern("");
    setPatternType("from_email");
    setDescription("");
    setActive(true);
    setEditingItem(null);
  };

  const openEditDialog = (item: BlacklistItem) => {
    setEditingItem(item);
    setPattern(item.pattern);
    setPatternType(item.pattern_type);
    setDescription(item.description || "");
    setActive(item.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!pattern.trim()) {
      toast({
        title: "Error",
        description: "Pattern is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email_blacklist_item: {
          pattern: pattern.trim(),
          pattern_type: patternType,
          description: description.trim() || null,
          active,
        },
      };

      if (editingItem) {
        await api.patch(`/api/v1/email_blacklist/${editingItem.id}`, payload);
        toast({ title: "Success", description: "Blacklist pattern updated" });
      } else {
        await api.post("/api/v1/email_blacklist", payload);
        toast({ title: "Success", description: "Blacklist pattern added" });
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { errors?: string[] } } };
      toast({
        title: "Error",
        description: err?.response?.data?.errors?.join(", ") || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/email_blacklist/${id}`);
      toast({ title: "Success", description: "Blacklist pattern deleted" });
      fetchItems();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete pattern",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (item: BlacklistItem) => {
    try {
      await api.patch(`/api/v1/email_blacklist/${item.id}`, {
        email_blacklist_item: { active: !item.active },
      });
      fetchItems();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update pattern",
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    if (!testFromEmail && !testFromName && !testSubject) {
      toast({
        title: "Error",
        description: "Enter at least one field to test",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const response = await api.post<{
        success: boolean;
        would_filter: boolean;
        matched_pattern: BlacklistItem | null;
      }>("/api/v1/email_blacklist/test", {
        from_email: testFromEmail,
        from_name: testFromName,
        subject: testSubject,
      });

      if (response) {
        setTestResult({
          would_filter: response.would_filter,
          matched_pattern: response.matched_pattern,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Test failed",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Email Blacklist
          </h2>
          <p className="text-sm text-muted-foreground">
            Block unwanted emails by pattern matching
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Test Button */}
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <TestTube className="h-4 w-4 mr-1" />
                Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Test Blacklist</DialogTitle>
                <DialogDescription>
                  Check if an email would be filtered by the blacklist
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    value={testFromEmail}
                    onChange={(e) => setTestFromEmail(e.target.value)}
                    placeholder="sender@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={testFromName}
                    onChange={(e) => setTestFromName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>
                {testResult && (
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      testResult.would_filter
                        ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                        : "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.would_filter ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <span className="font-medium">
                        {testResult.would_filter ? "Would be filtered" : "Would NOT be filtered"}
                      </span>
                    </div>
                    {testResult.matched_pattern && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        Matched: {testResult.matched_pattern.pattern_type} = "
                        {testResult.matched_pattern.pattern}"
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleTest} disabled={testing}>
                  {testing ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  Run Test
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Button */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Pattern
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Blacklist Pattern" : "Add Blacklist Pattern"}
                </DialogTitle>
                <DialogDescription>
                  Add a pattern to filter unwanted emails
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Pattern Type</Label>
                  <Select
                    value={patternType}
                    onValueChange={(v) => setPatternType(v as PatternType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PATTERN_TYPE_CONFIG) as PatternType[]).map((type) => {
                        const config = PATTERN_TYPE_CONFIG[type];
                        const Icon = config.icon;
                        return (
                          <SelectItem key={type} value={type}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {config.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {PATTERN_TYPE_CONFIG[patternType].description}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Pattern</Label>
                  <Input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder={PATTERN_TYPE_CONFIG[patternType].placeholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Why is this blocked?"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={active} onCheckedChange={setActive} id="active" />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  {editingItem ? "Update" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Refresh Button */}
          <Button variant="ghost" size="icon" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Ban className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No blacklist patterns defined</p>
          <p className="text-sm mt-1">Add a pattern to start filtering unwanted emails</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const config = PATTERN_TYPE_CONFIG[item.pattern_type];
                const Icon = config?.icon || Mail;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config?.label || item.pattern_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.pattern}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {item.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.active}
                        onCheckedChange={() => handleToggleActive(item)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{item.match_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Pattern?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the pattern "{item.pattern}"? This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default BlacklistManager;
