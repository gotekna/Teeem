"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import {
  Cog6ToothIcon,
  PauseIcon,
  ClockIcon,
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface HoldReason {
  id: number;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  sequence_order: number;
}

interface HoldReasonsResponse {
  hold_reasons: HoldReason[];
}

interface Settings {
  rollover_enabled: boolean;
  rollover_time: string;
  rollover_timezone: string;
}

interface SettingsResponse {
  settings: Settings;
}

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  row_count?: number;
}

interface TemplatesResponse {
  sm_schedule_master_templates: SmScheduleMasterTemplate[];
}

// ============================================
// Hold Reasons Tab
// ============================================

function HoldReasonsTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [holdReasons, setHoldReasons] = useState<HoldReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<HoldReason>>({});

  useEffect(() => {
    loadHoldReasons();
  }, []);

  const loadHoldReasons = async () => {
    try {
      const response = await api.get<HoldReasonsResponse>("/api/v1/sm_hold_reasons");
      setHoldReasons(response.hold_reasons || []);
    } catch (error) {
      console.error("Failed to load hold reasons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reason: HoldReason) => {
    setEditingId(reason.id);
    setEditForm({ ...reason });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await api.patch(`/api/v1/sm_hold_reasons/${editingId}`, { sm_hold_reason: editForm });
      toast({ title: "Hold reason updated" });
      setEditingId(null);
      loadHoldReasons();
    } catch {
      toast({ title: "Failed to update hold reason", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    const newReason = {
      name: "New Hold Reason",
      description: "Description",
      color: "#6B7280",
      is_active: true,
      sequence_order: holdReasons.length + 1,
    };
    try {
      const response = await api.post<{ hold_reason: HoldReason }>("/api/v1/sm_hold_reasons", {
        sm_hold_reason: newReason,
      });
      toast({ title: "Hold reason created" });
      loadHoldReasons();
      if (response?.hold_reason) {
        handleEdit(response.hold_reason);
      }
    } catch {
      toast({ title: "Failed to create hold reason", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Delete this hold reason?"))) return;
    try {
      await api.delete(`/api/v1/sm_hold_reasons/${id}`);
      toast({ title: "Hold reason deleted" });
      loadHoldReasons();
    } catch {
      toast({ title: "Failed to delete hold reason", variant: "destructive" });
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await api.post("/api/v1/sm_hold_reasons/seed_defaults");
      toast({ title: "Default hold reasons seeded" });
      loadHoldReasons();
    } catch {
      toast({ title: "Failed to seed defaults", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define reasons for placing jobs on hold</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults}>
            <ArrowPathIcon className="mr-1.5 h-4 w-4" />
            Seed Defaults
          </Button>
          <Button onClick={handleCreate}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Add Reason
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdReasons.map((reason) => (
              <TableRow key={reason.id}>
                <TableCell>
                  {editingId === reason.id ? (
                    <Input
                      type="color"
                      value={editForm.color || "#6B7280"}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="h-8 w-8 cursor-pointer p-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded" style={{ backgroundColor: reason.color }} />
                  )}
                </TableCell>
                <TableCell>
                  {editingId === reason.id ? (
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  ) : (
                    <span className="font-medium">{reason.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === reason.id ? (
                    <Input
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  ) : (
                    <span className="text-muted-foreground">{reason.description}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === reason.id ? (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={editForm.is_active}
                        onCheckedChange={(checked) =>
                          setEditForm({ ...editForm, is_active: checked === true })
                        }
                      />
                      <Label>Active</Label>
                    </div>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={
                        reason.is_active
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400"
                          : ""
                      }
                    >
                      {reason.is_active ? "Active" : "Inactive"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === reason.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={handleSave}>
                        <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                        <XMarkIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(reason)}>
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(reason.id)}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================
// Rollover Settings Tab
// ============================================

function RolloverSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get<SettingsResponse>("/api/v1/sm_settings");
      setSettings(
        response.settings || {
          rollover_enabled: false,
          rollover_time: "00:00",
          rollover_timezone: "Australia/Sydney",
        }
      );
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/api/v1/sm_settings", { sm_setting: settings });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
      <p className="text-sm text-muted-foreground">
        Configure automatic rollover of past-due tasks
      </p>

      <Card>
        <CardContent className="space-y-6 p-6">
          {/* Enable Rollover */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Enable Rollover</h4>
              <p className="text-sm text-muted-foreground">
                Automatically move past-due tasks to today at midnight
              </p>
            </div>
            <Switch
              checked={settings?.rollover_enabled || false}
              onCheckedChange={(checked) =>
                setSettings((prev) => (prev ? { ...prev, rollover_enabled: checked } : null))
              }
            />
          </div>

          {/* Rollover Time */}
          <div className="space-y-2">
            <Label>Rollover Time</Label>
            <Input
              type="time"
              value={settings?.rollover_time || "00:00"}
              onChange={(e) =>
                setSettings((prev) => (prev ? { ...prev, rollover_time: e.target.value } : null))
              }
              className="w-36"
            />
            <p className="text-xs text-muted-foreground">Time when rollover job runs daily</p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={settings?.rollover_timezone || "Australia/Sydney"}
              onValueChange={(value) =>
                setSettings((prev) => (prev ? { ...prev, rollover_timezone: value } : null))
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Australia/Sydney">Australia/Sydney (AEST)</SelectItem>
                <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEST)</SelectItem>
                <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST)</SelectItem>
                <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACST)</SelectItem>
                <SelectItem value="Pacific/Auckland">New Zealand (NZST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Save */}
          <div className="border-t pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Templates Tab
// ============================================

function TemplatesTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [templates, setTemplates] = useState<SmScheduleMasterTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get<TemplatesResponse>("/api/v1/sm_schedule_master_templates");
      setTemplates(response.sm_schedule_master_templates || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (templateId: number) => {
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${templateId}/set_default`);
      toast({ title: "Default template updated" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to set default template", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    const name = prompt("Enter template name:");
    if (!name) return;

    try {
      await api.post("/api/v1/sm_schedule_master_templates", {
        sm_schedule_master_template: { name, description: "" },
      });
      toast({ title: "Template created" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  };

  const handleDelete = async (templateId: number) => {
    if (!(await confirm("Archive this template?"))) return;

    try {
      await api.delete(`/api/v1/sm_schedule_master_templates/${templateId}`);
      toast({ title: "Template archived" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to archive template", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage schedule templates. The default template is used when creating new jobs.
        </p>
        <Button onClick={handleCreate}>
          <PlusIcon className="mr-1.5 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No templates yet</p>
              <Button variant="link" onClick={handleCreate} className="mt-4">
                Create your first template
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card
              key={template.id}
              className={template.is_default ? "border-primary ring-1 ring-primary" : ""}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSetDefault(template.id)}
                    className={template.is_default ? "text-yellow-500 dark:text-yellow-400" : "text-muted-foreground"}
                    title={template.is_default ? "Default template" : "Set as default"}
                  >
                    {template.is_default ? (
                      <StarIconSolid className="h-6 w-6" />
                    ) : (
                      <StarIcon className="h-6 w-6" />
                    )}
                  </Button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{template.name}</h4>
                      {template.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.row_count || 0} tasks
                      {template.description && ` • ${template.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/designer/tables/${template.id}?type=sm_schedule_master_template`}>
                      Edit Tasks
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(template.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// Working Days Tab
// ============================================

interface WorkingDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

function WorkingDaysTab() {
  const { toast } = useToast();
  const [workingDays, setWorkingDays] = useState<WorkingDays>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [saving, setSaving] = useState(false);

  const days: (keyof WorkingDays)[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const handleToggle = (day: keyof WorkingDays) => {
    setWorkingDays({ ...workingDays, [day]: !workingDays[day] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/api/v1/company_settings", {
        company_setting: { working_days: workingDays },
      });
      toast({ title: "Working days saved" });
    } catch {
      toast({ title: "Failed to save working days", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Define which days are working days for schedule calculations
      </p>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-4">
            {days.map((day) => (
              <button
                key={day}
                onClick={() => handleToggle(day)}
                className={`rounded-lg border-2 p-4 text-center transition-colors ${
                  workingDays[day]
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-muted text-muted-foreground"
                }`}
              >
                <p className="text-sm font-medium capitalize">{day.slice(0, 3)}</p>
                <p className="mt-1 text-xs">{workingDays[day] ? "Working" : "Off"}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 border-t pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Working Days"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function SmSetupPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const jobId = params.id as string;

  // Path-based tab: /jobs/123/setup/hold-reasons, /jobs/123/setup/settings
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace(`/jobs/${jobId}/setup`, "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname, jobId]);

  // Redirect to default tab if none specified
  useEffect(() => {
    if (activeTab === null) {
      router.replace(`/jobs/${jobId}/setup/hold-reasons`, { scroll: false });
    }
  }, [activeTab, router, jobId]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/jobs/${jobId}/setup/${tab}`, { scroll: false });
  }, [router, jobId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <Cog6ToothIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">SM Gantt Setup</h1>
              <p className="text-sm text-muted-foreground">Configure Schedule Master settings</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab || "hold-reasons"} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="hold-reasons" className="gap-2">
                <PauseIcon className="h-4 w-4" />
                Hold Reasons
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <DocumentDuplicateIcon className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="rollover" className="gap-2">
                <ClockIcon className="h-4 w-4" />
                Rollover
              </TabsTrigger>
              <TabsTrigger value="working-days" className="gap-2">
                <CalendarDaysIcon className="h-4 w-4" />
                Working Days
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="hold-reasons">
                <HoldReasonsTab />
              </TabsContent>
              <TabsContent value="templates">
                <TemplatesTab />
              </TabsContent>
              <TabsContent value="rollover">
                <RolloverSettingsTab />
              </TabsContent>
              <TabsContent value="working-days">
                <WorkingDaysTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
