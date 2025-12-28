"use client";

import { useState, useEffect, useCallback, ElementType } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface SmResource {
  id: number;
  name: string;
  code?: string;
  resource_type: "person" | "equipment" | "material";
  trade?: string;
  email?: string;
  phone?: string;
  hourly_rate?: number;
  availability_hours_per_day: number;
  color?: string;
  active: boolean;
}

interface Allocation {
  id: number;
  resource_id: number;
  task_id: number;
  start_date: string;
  end_date: string;
  hours: number;
}

interface TimeEntry {
  id: number;
  resource_id: number;
  task_id: number;
  entry_date: string;
  hours: number;
  status: string;
}

interface SmTask {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

interface ResourcesResponse {
  resources: SmResource[];
}

interface TasksResponse {
  tasks: SmTask[];
}

interface AllocationsResponse {
  allocations: Allocation[];
}

interface TimesheetDay {
  date: string;
  entries: Omit<TimeEntry, "entry_date">[];
}

interface TimesheetResponse {
  timesheet: TimesheetDay[];
}

interface ResourceFormData {
  name: string;
  code: string;
  resource_type: "person" | "equipment" | "material";
  trade: string;
  email: string;
  phone: string;
  hourly_rate: string;
  availability_hours_per_day: number;
  color: string;
  active: boolean;
}

interface TabConfig {
  id: string;
  name: string;
  icon: ElementType;
}

// ============================================
// Sub Components
// ============================================

interface ResourceTypeBadgeProps {
  type: "person" | "equipment" | "material";
}

function ResourceTypeBadge({ type }: ResourceTypeBadgeProps) {
  const styles = {
    person: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    equipment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    material: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <Badge variant="secondary" className={styles[type] || ""}>
      {type}
    </Badge>
  );
}

interface ResourceListItemProps {
  resource: SmResource;
  selected: boolean;
  onClick: (resource: SmResource) => void;
}

function ResourceListItem({ resource, selected, onClick }: ResourceListItemProps) {
  const avatarStyles = {
    person: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    equipment: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    material: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
  };

  return (
    <div
      className={`flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50 ${
        selected ? "border-l-2 border-l-primary bg-primary/5" : "border-border"
      }`}
      onClick={() => onClick(resource)}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          avatarStyles[resource.resource_type]
        }`}
      >
        {resource.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{resource.name}</div>
        <div className="text-xs text-muted-foreground">
          {resource.trade || resource.resource_type} •{" "}
          {resource.availability_hours_per_day || 8}h/day
        </div>
      </div>
      <ResourceTypeBadge type={resource.resource_type} />
    </div>
  );
}

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: SmResource | null;
  onSave: (data: ResourceFormData) => void;
}

function ResourceModal({ isOpen, onClose, resource, onSave }: ResourceModalProps) {
  // Initialize form data from resource prop
  // Fix for PATTERN-005: Use key prop on component instead of useEffect
  // The parent component sets key={resource?.id} which remounts this component
  // when editing a different resource, automatically resetting all state
  const getInitialFormData = (): ResourceFormData => {
    if (resource) {
      return {
        name: resource.name || "",
        code: resource.code || "",
        resource_type: resource.resource_type || "person",
        trade: resource.trade || "",
        email: resource.email || "",
        phone: resource.phone || "",
        hourly_rate: resource.hourly_rate?.toString() || "",
        availability_hours_per_day: resource.availability_hours_per_day || 8,
        color: resource.color || "#3b82f6",
        active: resource.active !== false,
      };
    }
    return {
      name: "",
      code: "",
      resource_type: "person",
      trade: "",
      email: "",
      phone: "",
      hourly_rate: "",
      availability_hours_per_day: 8,
      color: "#3b82f6",
      active: true,
    };
  };

  const [formData, setFormData] = useState<ResourceFormData>(getInitialFormData());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{resource?.id ? "Edit" : "Add"} Resource</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., JD001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource_type">Type *</Label>
              <Select
                value={formData.resource_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    resource_type: value as "person" | "equipment" | "material",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade">Trade</Label>
              <Input
                id="trade"
                value={formData.trade}
                onChange={(e) => setFormData((prev) => ({ ...prev, trade: e.target.value }))}
                placeholder="e.g., Electrician"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData((prev) => ({ ...prev, hourly_rate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours_per_day">Hours/Day</Label>
              <Input
                id="hours_per_day"
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={formData.availability_hours_per_day}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    availability_hours_per_day: parseFloat(e.target.value) || 8,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                className="h-10 cursor-pointer"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, active: checked === true }))
                }
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{resource?.id ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tab definitions
const TABS: TabConfig[] = [
  { id: "schedule", name: "Resource Schedule", icon: CalendarDaysIcon },
  { id: "timesheet", name: "Timesheet", icon: ClockIcon },
  { id: "utilization", name: "Utilization", icon: ChartBarIcon },
];

// ============================================
// Main Page Component
// ============================================

export default function SmResourcesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const constructionId = params.id as string;

  // URL-synced tab state
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl || "schedule";

  const handleTabChange = useCallback((tabId: string) => {
    const url = tabId === "schedule"
      ? `/jobs/${constructionId}/resources`
      : `/jobs/${constructionId}/resources?tab=${tabId}`;
    router.push(url, { scroll: false });
  }, [constructionId, router]);

  // State
  const [resources, setResources] = useState<SmResource[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");

  // Selected resource
  const [selectedResource, setSelectedResource] = useState<SmResource | null>(null);

  // Modals
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<SmResource | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch resources
      const params: Record<string, string> = { active: "true" };
      if (typeFilter) params.type = typeFilter;
      const resourcesRes = await api.get<ResourcesResponse>("/api/v1/sm_resources", {
        params,
      });
      setResources(resourcesRes.resources || []);

      // Fetch allocations for current date range
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 28);

      // If we have a construction context, fetch task-related data
      if (constructionId) {
        await api.get<TasksResponse>(`/api/v1/jobs/${constructionId}/sm_tasks`);
      }

      // Fetch allocations
      const allocationsRes = await api.get<AllocationsResponse>(
        "/api/v1/sm_resource_allocations/gantt_data",
        {
          params: {
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
          },
        }
      );
      setAllocations(allocationsRes.allocations || []);

      // Fetch time entries
      await api.get<TimesheetResponse>("/api/v1/sm_time_entries/timesheet", {
        params: {
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
        },
      });
    } catch (err) {
      console.error("Error fetching resource data:", err);
      setError((err as Error).message || "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, [constructionId, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter resources
  const filteredResources = resources.filter((r) => {
    if (typeFilter && r.resource_type !== typeFilter) return false;
    if (tradeFilter && r.trade !== tradeFilter) return false;
    return true;
  });

  // Get unique trades for filter
  const trades = [...new Set(resources.map((r) => r.trade).filter(Boolean))];

  // Handle resource save
  const handleResourceSave = async (data: ResourceFormData) => {
    try {
      if (editingResource?.id) {
        await api.patch(`/api/v1/sm_resources/${editingResource.id}`, { sm_resource: data });
        toast({ title: "Resource updated" });
      } else {
        await api.post("/api/v1/sm_resources", { sm_resource: data });
        toast({ title: "Resource created" });
      }
      fetchData();
    } catch (err) {
      console.error("Error saving resource:", err);
      toast({ title: "Failed to save resource", variant: "destructive" });
    }
  };

  if (loading && resources.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">Resource Management</h1>
              <p className="text-sm text-muted-foreground">
                {filteredResources.length} resources • {allocations.length} allocations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Type filter */}
            <Select value={typeFilter || "__all__"} onValueChange={(v) => setTypeFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                <SelectItem value="person">People</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="material">Materials</SelectItem>
              </SelectContent>
            </Select>

            {/* Trade filter */}
            {trades.length > 0 && (
              <Select value={tradeFilter || "__all__"} onValueChange={(v) => setTradeFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Trades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Trades</SelectItem>
                  {trades.map((trade) => (
                    <SelectItem key={trade} value={trade!}>
                      {trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <ArrowPathIcon className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <Button
              onClick={() => {
                setEditingResource(null);
                setShowResourceModal(true);
              }}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Resource
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary bg-background text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Main content */}
        <div className="flex h-full flex-1 gap-6 overflow-hidden p-6">
          {/* Resource list sidebar */}
          <Card className="flex w-72 flex-shrink-0 flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 py-3">
              <CardTitle className="text-sm">Resources</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              {filteredResources.map((resource) => (
                <ResourceListItem
                  key={resource.id}
                  resource={resource}
                  selected={selectedResource?.id === resource.id}
                  onClick={(r) => {
                    setSelectedResource(r);
                    setEditingResource(r);
                  }}
                />
              ))}
              {filteredResources.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No resources found
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Tab content */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="flex h-full items-center justify-center p-6">
              {activeTab === "schedule" && (
                <div className="text-center text-muted-foreground">
                  <CalendarDaysIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>Resource Schedule View</p>
                  <p className="mt-2 text-sm">Coming soon</p>
                </div>
              )}

              {activeTab === "timesheet" && (
                <div className="text-center text-muted-foreground">
                  <ClockIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>Timesheet View</p>
                  <p className="mt-2 text-sm">Coming soon</p>
                </div>
              )}

              {activeTab === "utilization" && (
                <div className="text-center text-muted-foreground">
                  <ChartBarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>Utilization View</p>
                  <p className="mt-2 text-sm">Coming soon</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resource Modal */}
      <ResourceModal
        key={`resource-modal-${editingResource?.id ?? "new"}`}
        isOpen={showResourceModal}
        onClose={() => {
          setShowResourceModal(false);
          setEditingResource(null);
        }}
        resource={editingResource}
        onSave={handleResourceSave}
      />
    </div>
  );
}
