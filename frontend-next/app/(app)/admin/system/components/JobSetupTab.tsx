"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Briefcase,
  ListChecks,
  Layers,
  MapPin,
  Search,
  Filter,
  Building,
  Percent,
  Receipt,
} from "lucide-react";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, ItemBadge } from "@/components/ui/dnd";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface JobType {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface JobStatus {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface JobStage {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface Suburb {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
  position: number;
  is_active: boolean;
}

interface ClaimStageTemplate {
  id: number;
  job_type_id: number;
  name: string;
  percentage: number;
  sequence_order: number;
  description: string | null;
  invoice_match_pattern: string | null;
  is_active: boolean;
}

const STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

const SEQ_COUNCILS = [
  "Brisbane City Council",
  "Gold Coast City Council",
  "Logan City Council",
  "Moreton Bay Regional Council",
  "Redland City Council",
  "Ipswich City Council",
  "Sunshine Coast Council",
  "Noosa Shire Council",
  "Scenic Rim Regional Council",
  "Lockyer Valley Regional Council",
  "Somerset Regional Council",
  "Toowoomba Regional Council",
];

// Individual sortable item component - uses standard DnD primitives
function SortableItem<T extends { id: number; name: string; color?: string; position: number }>({
  item,
  index,
  totalItems,
  onEdit,
  onDelete,
  onPositionChange,
}: {
  item: T;
  index: number;
  totalItems: number;
  onEdit: (item: T) => void;
  onDelete: (id: number) => void;
  onPositionChange: (newPosition: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border bg-background transition-all relative",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50 border-primary bg-primary/5",
        isOver && !isDragging && "border-t-4 border-t-primary pt-4 mt-1"
      )}
    >
      {/* DnD Primitives: DragHandle + ItemBadge */}
      <DragHandle {...attributes} {...listeners} size="sm" />
      <ItemBadge
        position={index + 1}
        editable
        onPositionChange={onPositionChange}
        maxPosition={totalItems}
        size="sm"
      />

      {/* Color indicator */}
      {item.color && (
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}

      {/* Item name */}
      <span className="flex-1 text-sm truncate">{item.name}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Main sortable list with DndContext
function SortableList<T extends { id: number; name: string; color?: string; position: number }>({
  items,
  title,
  icon: Icon,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  loading,
}: {
  items: T[];
  title: string;
  icon: typeof Briefcase;
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: number) => void;
  onReorder: (items: T[]) => void;
  loading: boolean;
}) {
  const [activeId, setActiveId] = React.useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items]
  );

  const activeItem = activeId ? sortedItems.find((item) => item.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(sortedItems, oldIndex, newIndex);
      // Update positions
      newItems.forEach((item, i) => {
        item.position = i + 1;
      });
      onReorder(newItems);
    }
  };

  const handlePositionChange = (itemId: number, newPosition: number) => {
    const currentIndex = sortedItems.findIndex((item) => item.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = newPosition - 1;
    if (newIndex < 0 || newIndex >= sortedItems.length) return;

    const newItems = arrayMove(sortedItems, currentIndex, newIndex);
    newItems.forEach((item, i) => {
      item.position = i + 1;
    });
    onReorder(newItems);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !Array.isArray(items) || items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items yet. Click Add to create one.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {sortedItems.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    totalItems={sortedItems.length}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPositionChange={(newPos) => handlePositionChange(item.id, newPos)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-2 p-2 rounded-md border bg-background shadow-lg scale-[1.02] border-primary">
                  <DragHandle size="sm" />
                  <ItemBadge
                    position={sortedItems.findIndex((i) => i.id === activeItem.id) + 1}
                    size="sm"
                    color="primary"
                  />
                  {activeItem.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeItem.color }}
                    />
                  )}
                  <span className="flex-1 text-sm">{activeItem.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

// Claim Stage Item (sortable)
function ClaimStageItem({
  stage,
  index,
  onEdit,
  onDelete,
}: {
  stage: ClaimStageTemplate;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md border bg-background transition-all",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50 border-primary"
      )}
    >
      {/* DnD Primitives: DragHandle + ItemBadge */}
      <DragHandle {...attributes} {...listeners} size="sm" />
      <ItemBadge position={index + 1} size="sm" />

      {/* Stage name */}
      <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>

      {/* Percentage */}
      <Badge variant="secondary" className="shrink-0">
        {stage.percentage}%
      </Badge>

      {/* Match pattern indicator */}
      {stage.invoice_match_pattern && (
        <Badge variant="outline" className="text-xs shrink-0 max-w-[100px] truncate" title={stage.invoice_match_pattern}>
          {stage.invoice_match_pattern}
        </Badge>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function JobSetupTab() {
  const { toast } = useToast();
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<"type" | "status" | "stage">("type");
  const [editingItem, setEditingItem] = React.useState<JobType | JobStatus | JobStage | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    color: "#3B82F6",
  });

  // Suburbs state
  const [suburbs, setSuburbs] = React.useState<Suburb[]>([]);
  const [suburbsLoading, setSuburbsLoading] = React.useState(true);
  const [suburbSearch, setSuburbSearch] = React.useState("");
  const [suburbStateFilter, setSuburbStateFilter] = React.useState<string>("all");
  const [suburbCouncilFilter, setSuburbCouncilFilter] = React.useState<string>("all");
  const [showSuburbDialog, setShowSuburbDialog] = React.useState(false);
  const [editingSuburb, setEditingSuburb] = React.useState<Suburb | null>(null);
  const [suburbSaving, setSuburbSaving] = React.useState(false);
  const [suburbFormData, setSuburbFormData] = React.useState({
    name: "",
    postcode: "",
    state: "QLD",
    council: "",
  });

  // Claim Stages state
  const [claimStages, setClaimStages] = React.useState<ClaimStageTemplate[]>([]);
  const [claimStagesLoading, setClaimStagesLoading] = React.useState(false);
  const [selectedJobTypeId, setSelectedJobTypeId] = React.useState<number | null>(null);
  const [showClaimStageDialog, setShowClaimStageDialog] = React.useState(false);
  const [editingClaimStage, setEditingClaimStage] = React.useState<ClaimStageTemplate | null>(null);
  const [claimStageSaving, setClaimStageSaving] = React.useState(false);
  const [claimStageFormData, setClaimStageFormData] = React.useState({
    name: "",
    percentage: "",
    invoice_match_pattern: "",
    description: "",
  });

  const COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#6366F1", // Indigo
    "#84CC16", // Lime
  ];

  React.useEffect(() => {
    loadData();
    loadSuburbs();
  }, []);

  const loadData = async () => {
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ job_stages: JobStage[] }>("/api/v1/job_stages"),
      ]);
      setJobTypes(typesRes.job_types || []);
      setJobStatuses(statusesRes.job_statuses || []);
      setJobStages(stagesRes.job_stages || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data
      setJobTypes([
        { id: 1, name: "New Build", color: "#3B82F6", position: 1, active: true },
        { id: 2, name: "Renovation", color: "#10B981", position: 2, active: true },
        { id: 3, name: "Extension", color: "#F59E0B", position: 3, active: true },
      ]);
      setJobStatuses([
        { id: 1, name: "Quote", color: "#8B5CF6", position: 1, active: true },
        { id: 2, name: "Won", color: "#10B981", position: 2, active: true },
        { id: 3, name: "In Progress", color: "#3B82F6", position: 3, active: true },
        { id: 4, name: "Complete", color: "#84CC16", position: 4, active: true },
        { id: 5, name: "Lost", color: "#EF4444", position: 5, active: true },
      ]);
      setJobStages([
        { id: 1, name: "Pre-Construction", color: "#F59E0B", position: 1, active: true },
        { id: 2, name: "Foundation", color: "#6366F1", position: 2, active: true },
        { id: 3, name: "Frame", color: "#06B6D4", position: 3, active: true },
        { id: 4, name: "Lock Up", color: "#8B5CF6", position: 4, active: true },
        { id: 5, name: "Fit Out", color: "#EC4899", position: 5, active: true },
        { id: 6, name: "Handover", color: "#10B981", position: 6, active: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuburbs = async () => {
    try {
      const response = await api.get<{ suburbs: Suburb[] }>("/api/v1/suburbs");
      setSuburbs(response.suburbs || []);
    } catch (error) {
      console.error("Failed to load suburbs:", error);
    } finally {
      setSuburbsLoading(false);
    }
  };

  const loadClaimStages = async (jobTypeId: number) => {
    setClaimStagesLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: { templates: ClaimStageTemplate[]; total_percentage: number }
      }>(`/api/v1/job_types/${jobTypeId}/claim_stage_templates`);
      if (response.success && response.data) {
        setClaimStages(response.data.templates || []);
      }
    } catch (error) {
      console.error("Failed to load claim stages:", error);
      setClaimStages([]);
    } finally {
      setClaimStagesLoading(false);
    }
  };

  const handleJobTypeSelect = (jobTypeId: string) => {
    const id = parseInt(jobTypeId, 10);
    setSelectedJobTypeId(id);
    loadClaimStages(id);
  };

  const handleAddClaimStage = () => {
    setEditingClaimStage(null);
    setClaimStageFormData({
      name: "",
      percentage: "",
      invoice_match_pattern: "",
      description: "",
    });
    setShowClaimStageDialog(true);
  };

  const handleEditClaimStage = (stage: ClaimStageTemplate) => {
    setEditingClaimStage(stage);
    setClaimStageFormData({
      name: stage.name,
      percentage: String(stage.percentage),
      invoice_match_pattern: stage.invoice_match_pattern || "",
      description: stage.description || "",
    });
    setShowClaimStageDialog(true);
  };

  const handleSaveClaimStage = async () => {
    if (!claimStageFormData.name || !claimStageFormData.percentage) {
      toast({ title: "Error", description: "Name and percentage are required", variant: "destructive" });
      return;
    }

    const percentage = parseFloat(claimStageFormData.percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      toast({ title: "Error", description: "Percentage must be between 0 and 100", variant: "destructive" });
      return;
    }

    setClaimStageSaving(true);
    try {
      const payload = {
        claim_stage_template: {
          name: claimStageFormData.name,
          percentage: percentage,
          invoice_match_pattern: claimStageFormData.invoice_match_pattern || null,
          description: claimStageFormData.description || null,
        },
      };

      if (editingClaimStage) {
        await api.patch(`/api/v1/claim_stage_templates/${editingClaimStage.id}`, payload);
        toast({ title: "Success", description: "Claim stage updated" });
      } else if (selectedJobTypeId) {
        await api.post(`/api/v1/job_types/${selectedJobTypeId}/claim_stage_templates`, payload);
        toast({ title: "Success", description: "Claim stage created" });
      }

      setShowClaimStageDialog(false);
      if (selectedJobTypeId) {
        loadClaimStages(selectedJobTypeId);
      }
    } catch (error) {
      console.error("Failed to save claim stage:", error);
      toast({ title: "Error", description: "Failed to save claim stage", variant: "destructive" });
    } finally {
      setClaimStageSaving(false);
    }
  };

  const handleDeleteClaimStage = async (id: number) => {
    if (!confirm("Are you sure you want to delete this claim stage?")) return;

    try {
      await api.delete(`/api/v1/claim_stage_templates/${id}`);
      toast({ title: "Success", description: "Claim stage deleted" });
      if (selectedJobTypeId) {
        loadClaimStages(selectedJobTypeId);
      }
    } catch (error) {
      console.error("Failed to delete claim stage:", error);
      toast({ title: "Error", description: "Failed to delete claim stage", variant: "destructive" });
    }
  };

  const handleReorderClaimStages = async (newOrder: ClaimStageTemplate[]) => {
    // Optimistic update
    setClaimStages(newOrder);

    try {
      await api.post(`/api/v1/job_types/${selectedJobTypeId}/claim_stage_templates/reorder`, {
        order_ids: newOrder.map((s) => s.id),
      });
      toast({ title: "Order saved" });
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      if (selectedJobTypeId) {
        loadClaimStages(selectedJobTypeId);
      }
    }
  };

  const totalClaimPercentage = React.useMemo(() => {
    return claimStages.reduce((sum, s) => sum + (s.percentage || 0), 0);
  }, [claimStages]);

  // Suburb stats
  const suburbStats = React.useMemo(() => {
    const byState: Record<string, number> = {};
    suburbs.forEach((s) => {
      byState[s.state] = (byState[s.state] || 0) + 1;
    });
    return {
      total: suburbs.length,
      withCouncil: suburbs.filter((s) => s.council).length,
      byState,
    };
  }, [suburbs]);

  // Filter suburbs
  const filteredSuburbs = React.useMemo(() => {
    return suburbs.filter((suburb) => {
      if (suburbSearch) {
        const query = suburbSearch.toLowerCase();
        if (
          !suburb.name.toLowerCase().includes(query) &&
          !suburb.postcode.includes(query)
        ) {
          return false;
        }
      }
      if (suburbStateFilter !== "all" && suburb.state !== suburbStateFilter) {
        return false;
      }
      if (suburbCouncilFilter === "with-council" && !suburb.council) {
        return false;
      }
      if (suburbCouncilFilter === "without-council" && suburb.council) {
        return false;
      }
      if (
        suburbCouncilFilter !== "all" &&
        suburbCouncilFilter !== "with-council" &&
        suburbCouncilFilter !== "without-council" &&
        suburb.council !== suburbCouncilFilter
      ) {
        return false;
      }
      return true;
    });
  }, [suburbs, suburbSearch, suburbStateFilter, suburbCouncilFilter]);

  // Get unique councils for filter
  const uniqueCouncils = React.useMemo(() => {
    const councils = new Set<string>();
    suburbs.forEach((s) => {
      if (s.council) councils.add(s.council);
    });
    return Array.from(councils).sort();
  }, [suburbs]);

  const handleEditSuburbClick = (suburb: Suburb) => {
    setEditingSuburb(suburb);
    setSuburbFormData({
      name: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      council: suburb.council || "",
    });
    setShowSuburbDialog(true);
  };

  const handleSaveSuburb = async () => {
    if (!editingSuburb) return;

    setSuburbSaving(true);
    try {
      await api.patch(`/api/v1/suburbs/${editingSuburb.id}`, {
        suburb: suburbFormData,
      });
      toast({ title: "Success", description: "Suburb updated successfully" });
      setShowSuburbDialog(false);
      loadSuburbs();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save suburb", variant: "destructive" });
    } finally {
      setSuburbSaving(false);
    }
  };

  const handleOpenAddDialog = (type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(null);
    setFormData({ name: "", color: COLORS[0] });
    setShowDialog(true);
  };

  const handleOpenEditDialog = (item: JobType | JobStatus | JobStage, type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(item);
    setFormData({ name: item.name, color: item.color || COLORS[0] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    try {
      if (editingItem) {
        await api.patch(`${endpoints[dialogType]}/${editingItem.id}`, {
          [dialogType === "type" ? "job_type" : dialogType === "status" ? "job_status" : "job_stage"]: formData,
        });
        toast({ title: "Success", description: "Item updated successfully" });
      } else {
        await api.post(endpoints[dialogType], {
          [dialogType === "type" ? "job_type" : dialogType === "status" ? "job_status" : "job_stage"]: formData,
        });
        toast({ title: "Success", description: "Item created successfully" });
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, type: "type" | "status" | "stage") => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    try {
      await api.delete(`${endpoints[type]}/${id}`);
      toast({ title: "Success", description: "Item deleted successfully" });
      loadData();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleReorder = async (items: (JobType | JobStatus | JobStage)[], type: "type" | "status" | "stage") => {
    const endpoints = {
      type: "/api/v1/job_types/reorder",
      status: "/api/v1/job_status/reorder",
      stage: "/api/v1/job_stages/reorder",
    };

    // Backend expects different param names for each type
    const paramKeys = {
      type: "job_type_ids",
      status: "job_status_ids",
      stage: "job_stage_ids",
    };

    // Update local state immediately (optimistic update)
    if (type === "type") setJobTypes(items as JobType[]);
    if (type === "status") setJobStatuses(items as JobStatus[]);
    if (type === "stage") setJobStages(items as JobStage[]);

    try {
      await api.post(endpoints[type], {
        [paramKeys[type]]: items.map((item) => item.id),
      });
      toast({ title: "Order saved", description: "Position order has been updated" });
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      // Reload on error to restore correct state
      loadData();
    }
  };

  const getDialogTitle = () => {
    const action = editingItem ? "Edit" : "Add";
    switch (dialogType) {
      case "type":
        return `${action} Job Type`;
      case "status":
        return `${action} Job Status`;
      case "stage":
        return `${action} Job Stage`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <SortableList
          items={jobTypes}
          title="Job Types"
          icon={Briefcase}
          onAdd={() => handleOpenAddDialog("type")}
          onEdit={(item) => handleOpenEditDialog(item, "type")}
          onDelete={(id) => handleDelete(id, "type")}
          onReorder={(items) => handleReorder(items, "type")}
          loading={loading}
        />
        <SortableList
          items={jobStatuses}
          title="Job Statuses"
          icon={ListChecks}
          onAdd={() => handleOpenAddDialog("status")}
          onEdit={(item) => handleOpenEditDialog(item, "status")}
          onDelete={(id) => handleDelete(id, "status")}
          onReorder={(items) => handleReorder(items, "status")}
          loading={loading}
        />
        <SortableList
          items={jobStages}
          title="Job Stages"
          icon={Layers}
          onAdd={() => handleOpenAddDialog("stage")}
          onEdit={(item) => handleOpenEditDialog(item, "stage")}
          onDelete={(id) => handleDelete(id, "stage")}
          onReorder={(items) => handleReorder(items, "stage")}
          loading={loading}
        />
      </div>

      {/* Suburbs Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Suburbs Lookup</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {suburbStats.total} suburbs
              </Badge>
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                {suburbStats.withCouncil} with council
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage suburb data for auto-fill on job addresses
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suburb or postcode..."
                  value={suburbSearch}
                  onChange={(e) => setSuburbSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-32">
              <Select value={suburbStateFilter} onValueChange={setSuburbStateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state} ({suburbStats.byState[state] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={suburbCouncilFilter} onValueChange={setSuburbCouncilFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with-council">With Council</SelectItem>
                  <SelectItem value="without-council">Without Council</SelectItem>
                  {uniqueCouncils.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Suburbs Table */}
          {suburbsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSuburbs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suburbs found matching your filters.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <table className="w-full">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2 font-medium">Suburb</th>
                    <th className="p-2 font-medium">Postcode</th>
                    <th className="p-2 font-medium">State</th>
                    <th className="p-2 font-medium">Council</th>
                    <th className="p-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSuburbs.slice(0, 100).map((suburb) => (
                    <tr key={suburb.id} className="hover:bg-muted/50">
                      <td className="p-2 text-sm font-medium">{suburb.name}</td>
                      <td className="p-2 text-sm text-muted-foreground">{suburb.postcode}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {suburb.state}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {suburb.council ? (
                          <span className="text-green-600 dark:text-green-400">{suburb.council}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditSuburbClick(suburb)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSuburbs.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Showing first 100 of {filteredSuburbs.length} results. Use search to narrow down.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Stages Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Claim Stage Templates</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedJobTypeId?.toString() || ""}
                onValueChange={handleJobTypeSelect}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select job type..." />
                </SelectTrigger>
                <SelectContent>
                  {jobTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedJobTypeId && (
                <Button size="sm" onClick={handleAddClaimStage}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Stage
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure claim stages for each job type. These define progress payment milestones.
          </p>
        </CardHeader>
        <CardContent>
          {!selectedJobTypeId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a job type to view and manage claim stages.
            </div>
          ) : claimStagesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : claimStages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No claim stages configured for this job type. Click Add Stage to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total:</span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      Math.abs(totalClaimPercentage - 100) < 0.01
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {totalClaimPercentage.toFixed(1)}%
                  </span>
                  {Math.abs(totalClaimPercentage - 100) >= 0.01 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600">
                      Should be 100%
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {claimStages.length} stages
                </Badge>
              </div>

              {/* Stages List */}
              <DndContext
                sensors={useSensors(
                  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
                  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
                )}
                collisionDetection={closestCenter}
                onDragEnd={(event) => {
                  const { active, over } = event;
                  if (over && active.id !== over.id) {
                    const oldIndex = claimStages.findIndex((s) => s.id === active.id);
                    const newIndex = claimStages.findIndex((s) => s.id === over.id);
                    const newOrder = arrayMove(claimStages, oldIndex, newIndex);
                    newOrder.forEach((s, i) => (s.sequence_order = i));
                    handleReorderClaimStages(newOrder);
                  }
                }}
              >
                <SortableContext
                  items={claimStages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {claimStages.map((stage, index) => (
                      <ClaimStageItem
                        key={stage.id}
                        stage={stage}
                        index={index}
                        onEdit={() => handleEditClaimStage(stage)}
                        onDelete={() => handleDeleteClaimStage(stage.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Stage Dialog */}
      <Dialog open={showClaimStageDialog} onOpenChange={setShowClaimStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClaimStage ? "Edit Claim Stage" : "Add Claim Stage"}
            </DialogTitle>
            <DialogDescription>
              Configure the claim stage template. Match pattern helps auto-match Xero invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stage-name">Stage Name *</Label>
                <Input
                  id="stage-name"
                  placeholder="e.g., Deposit, Slab, Frame"
                  value={claimStageFormData.name}
                  onChange={(e) => setClaimStageFormData({ ...claimStageFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage-percentage">Percentage *</Label>
                <div className="relative">
                  <Input
                    id="stage-percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="15.00"
                    value={claimStageFormData.percentage}
                    onChange={(e) => setClaimStageFormData({ ...claimStageFormData, percentage: e.target.value })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-pattern">Invoice Match Pattern</Label>
              <Input
                id="stage-pattern"
                placeholder="e.g., deposit|dep (regex pattern)"
                value={claimStageFormData.invoice_match_pattern}
                onChange={(e) => setClaimStageFormData({ ...claimStageFormData, invoice_match_pattern: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Regex pattern to auto-match Xero invoices. Use | for OR (e.g., &quot;deposit|dep&quot;).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-description">Description</Label>
              <Input
                id="stage-description"
                placeholder="Optional description"
                value={claimStageFormData.description}
                onChange={(e) => setClaimStageFormData({ ...claimStageFormData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimStageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClaimStage} disabled={claimStageSaving}>
              {claimStageSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingClaimStage ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Suburb Dialog */}
      <Dialog open={showSuburbDialog} onOpenChange={setShowSuburbDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Suburb</DialogTitle>
            <DialogDescription>
              Update suburb details. Council is used for auto-fill on job addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suburb-name">Suburb Name</Label>
                <Input
                  id="suburb-name"
                  value={suburbFormData.name}
                  onChange={(e) => setSuburbFormData({ ...suburbFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suburb-postcode">Postcode</Label>
                <Input
                  id="suburb-postcode"
                  value={suburbFormData.postcode}
                  onChange={(e) => setSuburbFormData({ ...suburbFormData, postcode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb-state">State</Label>
              <Select
                value={suburbFormData.state}
                onValueChange={(value) => setSuburbFormData({ ...suburbFormData, state: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb-council">Council</Label>
              <Select
                value={suburbFormData.council || "none"}
                onValueChange={(value) => setSuburbFormData({ ...suburbFormData, council: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Council</SelectItem>
                  {SEQ_COUNCILS.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Or type a custom council name:
              </p>
              <Input
                placeholder="Custom council name"
                value={suburbFormData.council}
                onChange={(e) => setSuburbFormData({ ...suburbFormData, council: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuburbDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSuburb} disabled={suburbSaving}>
              {suburbSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              Configure the name and color for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform",
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-8 p-0 border-0"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                  className="w-24 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingItem ? (
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
