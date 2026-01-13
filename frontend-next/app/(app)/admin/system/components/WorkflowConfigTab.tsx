"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GripVertical,
  X,
  Briefcase,
  ListChecks,
  Layers,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface JobType {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface JobStatus {
  id: number;
  name: string;
  color: string;
}

interface JobStage {
  id: number;
  name: string;
  color: string;
}

// Backend returns flattened status with job_type_status_id
interface TypeStatus {
  id: number;  // This is the job_status.id
  name: string;
  color: string;
  position: number;
  job_type_status_id: number;  // This is the join table id for deletion
}

// Backend returns flattened stage with job_status_stage_id
interface StatusStage {
  id: number;  // This is the job_stage.id
  name: string;
  color: string;
  position: number;
  is_required: boolean;
  job_status_stage_id: number;  // This is the join table id for deletion
}

// API response types
interface TypeStatusesResponse {
  success: boolean;
  job_type: { id: number; name: string };
  statuses: TypeStatus[];
}

interface StatusStagesResponse {
  success: boolean;
  job_type_id: string;
  job_status_id: string;
  stages: StatusStage[];
}

// Sortable Status Item Component
function SortableStatusItem({
  status,
  isSelected,
  onSelect,
  onRemove,
}: {
  status: TypeStatus;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.job_type_status_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border",
        isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50",
        isDragging && "shadow-lg"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 text-left"
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-sm">{status.name}</span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Sortable Stage Item Component
function SortableStageItem({
  stage,
  onRemove,
}: {
  stage: StatusStage;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.job_status_stage_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50",
        isDragging && "shadow-lg"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: stage.color }}
      />
      <span className="flex-1 text-sm">{stage.name}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function WorkflowConfigTab() {
  const { toast } = useToast();
  const [allTypes, setAllTypes] = React.useState<JobType[]>([]);
  const [allStatuses, setAllStatuses] = React.useState<JobStatus[]>([]);
  const [allStages, setAllStages] = React.useState<JobStage[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [selectedType, setSelectedType] = React.useState<JobType | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<TypeStatus | null>(null);

  const [typeStatuses, setTypeStatuses] = React.useState<TypeStatus[]>([]);
  const [statusStages, setStatusStages] = React.useState<StatusStage[]>([]);

  const [loadingStatuses, setLoadingStatuses] = React.useState(false);
  const [loadingStages, setLoadingStages] = React.useState(false);

  // Job Type description editing
  const [editingDescription, setEditingDescription] = React.useState("");
  const [savingDescription, setSavingDescription] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ success: boolean; job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ success: boolean; job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ success: boolean; job_stages: JobStage[] }>("/api/v1/job_stages"),
      ]);
      const types = typesRes.job_types || [];
      const statuses = statusesRes.job_statuses || [];
      const stages = stagesRes.job_stages || [];

      setAllTypes(types);
      setAllStatuses(statuses);
      setAllStages(stages);

      if (types.length > 0) {
        setSelectedType(types[0]);
        loadTypeStatuses(types[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({ title: "Error", description: "Failed to load workflow data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadTypeStatuses = async (typeId: number) => {
    setLoadingStatuses(true);
    setSelectedStatus(null);
    setStatusStages([]);
    try {
      const response = await api.get<TypeStatusesResponse>(`/api/v1/job_types/${typeId}/statuses`);
      setTypeStatuses(response.statuses || []);
    } catch (error) {
      console.error("Failed to load type statuses:", error);
      setTypeStatuses([]);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadStatusStages = async (typeId: number, statusId: number) => {
    setLoadingStages(true);
    try {
      const response = await api.get<StatusStagesResponse>(
        `/api/v1/job_types/${typeId}/statuses/${statusId}/stages`
      );
      setStatusStages(response.stages || []);
    } catch (error) {
      console.error("Failed to load status stages:", error);
      setStatusStages([]);
    } finally {
      setLoadingStages(false);
    }
  };

  const handleSelectType = (type: JobType) => {
    setSelectedType(type);
    setEditingDescription(type.description || "");
    loadTypeStatuses(type.id);
  };

  const handleSaveDescription = async () => {
    if (!selectedType) return;
    setSavingDescription(true);
    try {
      await api.patch(`/api/v1/job_types/${selectedType.id}`, {
        job_type: { description: editingDescription },
      });
      // Update local state
      setAllTypes((prev) =>
        prev.map((t) =>
          t.id === selectedType.id ? { ...t, description: editingDescription } : t
        )
      );
      setSelectedType((prev) =>
        prev ? { ...prev, description: editingDescription } : prev
      );
      toast({ title: "Success", description: "Description saved" });
    } catch (error) {
      console.error("Failed to save description:", error);
      toast({ title: "Error", description: "Failed to save description", variant: "destructive" });
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSelectStatus = (status: TypeStatus) => {
    setSelectedStatus(status);
    if (selectedType) {
      loadStatusStages(selectedType.id, status.id);
    }
  };

  const handleAddStatusToType = async (statusId: string) => {
    if (!selectedType) return;
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses`, {
        job_status_id: Number(statusId),
      });
      toast({ title: "Success", description: "Status added to type" });
      loadTypeStatuses(selectedType.id);
    } catch (error) {
      console.error("Failed to add status:", error);
      toast({ title: "Error", description: "Failed to add status", variant: "destructive" });
    }
  };

  const handleRemoveStatusFromType = async (jobTypeStatusId: number) => {
    try {
      await api.delete(`/api/v1/job_type_statuses/${jobTypeStatusId}`);
      toast({ title: "Success", description: "Status removed from type" });
      if (selectedType) {
        loadTypeStatuses(selectedType.id);
      }
      if (selectedStatus?.job_type_status_id === jobTypeStatusId) {
        setSelectedStatus(null);
        setStatusStages([]);
      }
    } catch (error) {
      console.error("Failed to remove status:", error);
      toast({ title: "Error", description: "Failed to remove status", variant: "destructive" });
    }
  };

  const handleAddStageToStatus = async (stageId: string) => {
    if (!selectedType || !selectedStatus) return;
    try {
      await api.post(
        `/api/v1/job_types/${selectedType.id}/statuses/${selectedStatus.id}/stages`,
        { job_stage_id: Number(stageId) }
      );
      toast({ title: "Success", description: "Stage added to status" });
      loadStatusStages(selectedType.id, selectedStatus.id);
    } catch (error) {
      console.error("Failed to add stage:", error);
      toast({ title: "Error", description: "Failed to add stage", variant: "destructive" });
    }
  };

  const handleRemoveStageFromStatus = async (jobStatusStageId: number) => {
    try {
      await api.delete(`/api/v1/job_status_stages/${jobStatusStageId}`);
      toast({ title: "Success", description: "Stage removed from status" });
      if (selectedType && selectedStatus) {
        loadStatusStages(selectedType.id, selectedStatus.id);
      }
    } catch (error) {
      console.error("Failed to remove stage:", error);
      toast({ title: "Error", description: "Failed to remove stage", variant: "destructive" });
    }
  };

  // Handle status reorder
  const handleStatusDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedType) return;

    const oldIndex = typeStatuses.findIndex((s) => s.job_type_status_id === active.id);
    const newIndex = typeStatuses.findIndex((s) => s.job_type_status_id === over.id);

    const newStatuses = arrayMove(typeStatuses, oldIndex, newIndex);
    setTypeStatuses(newStatuses);

    // Send reorder to backend
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses/reorder`, {
        job_type_status_ids: newStatuses.map((s) => s.job_type_status_id),
      });
    } catch (error) {
      console.error("Failed to reorder statuses:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      // Reload to get correct order
      loadTypeStatuses(selectedType.id);
    }
  };

  // Handle stage reorder
  const handleStageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedType || !selectedStatus) return;

    const oldIndex = statusStages.findIndex((s) => s.job_status_stage_id === active.id);
    const newIndex = statusStages.findIndex((s) => s.job_status_stage_id === over.id);

    const newStages = arrayMove(statusStages, oldIndex, newIndex);
    setStatusStages(newStages);

    // Send reorder to backend
    try {
      await api.post(
        `/api/v1/job_types/${selectedType.id}/statuses/${selectedStatus.id}/stages/reorder`,
        { job_status_stage_ids: newStages.map((s) => s.job_status_stage_id) }
      );
    } catch (error) {
      console.error("Failed to reorder stages:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      // Reload to get correct order
      loadStatusStages(selectedType.id, selectedStatus.id);
    }
  };

  const availableStatuses = allStatuses.filter(
    (status) => !typeStatuses.some((ts) => ts.id === status.id)
  );

  const availableStages = allStages.filter(
    (stage) => !statusStages.some((ss) => ss.id === stage.id)
  );

  const sortedStatuses = [...typeStatuses].sort((a, b) => a.position - b.position);
  const sortedStages = [...statusStages].sort((a, b) => a.position - b.position);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure which statuses are available for each job type, and which stages are available for each status.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Job Types Column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Job Types</CardTitle>
            </div>
            <CardDescription>Select a type to configure its statuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {allTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className={cn(
                      "w-full flex items-center gap-2 p-3 rounded-md text-left transition-colors",
                      selectedType?.id === type.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm">{type.name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Description for QBCC Contract Item 3 */}
            {selectedType && (
              <div className="space-y-2 pt-4 mt-2 border-t bg-muted/30 -mx-6 px-6 pb-4 rounded-b-lg">
                <Label htmlFor="job-type-description" className="text-sm font-medium">
                  Item 3: Description of Works
                </Label>
                <p className="text-xs text-muted-foreground">
                  This will appear on the QBCC Contract for &quot;{selectedType.name}&quot; jobs
                </p>
                <Textarea
                  id="job-type-description"
                  placeholder="e.g., Construction of a new single-storey dwelling including all associated site works..."
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="text-sm min-h-[80px]"
                />
                <Button
                  size="sm"
                  onClick={handleSaveDescription}
                  disabled={savingDescription || editingDescription === (selectedType.description || "")}
                >
                  {savingDescription ? (
                    <>
                      <Spinner size={12} className="mr-1" />
                      Saving...
                    </>
                  ) : (
                    "Save Description"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statuses Column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Statuses for {selectedType?.name || "..."}
              </CardTitle>
            </div>
            <CardDescription>Drag to reorder, select to configure stages</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedType ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select a job type first
              </div>
            ) : loadingStatuses ? (
              <div className="flex items-center justify-center h-[400px]">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <Select onValueChange={handleAddStatusToType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status.id} value={String(status.id)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ScrollArea className="h-[340px]">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleStatusDragEnd}
                  >
                    <SortableContext
                      items={sortedStatuses.map((s) => s.job_type_status_id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {sortedStatuses.map((ts) => (
                          <SortableStatusItem
                            key={ts.job_type_status_id}
                            status={ts}
                            isSelected={selectedStatus?.id === ts.id}
                            onSelect={() => handleSelectStatus(ts)}
                            onRemove={() => handleRemoveStatusFromType(ts.job_type_status_id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stages Column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Stages for {selectedStatus?.name || "..."}
              </CardTitle>
            </div>
            <CardDescription>Drag to reorder stages</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedStatus ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select a status first
              </div>
            ) : loadingStages ? (
              <div className="flex items-center justify-center h-[400px]">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <Select onValueChange={handleAddStageToStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStages.map((stage) => (
                      <SelectItem key={stage.id} value={String(stage.id)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ScrollArea className="h-[340px]">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleStageDragEnd}
                  >
                    <SortableContext
                      items={sortedStages.map((s) => s.job_status_stage_id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {sortedStages.map((ss) => (
                          <SortableStageItem
                            key={ss.job_status_stage_id}
                            stage={ss}
                            onRemove={() => handleRemoveStageFromStatus(ss.job_status_stage_id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visual Flow */}
      {selectedType && typeStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Overview</CardTitle>
            <CardDescription>
              Visual representation of the {selectedType.name} workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {sortedStatuses.map((ts, index) => (
                <React.Fragment key={ts.job_type_status_id}>
                  <Badge
                    variant="outline"
                    className="py-2 px-3"
                    style={{
                      borderColor: ts.color,
                      backgroundColor: `${ts.color}20`,
                    }}
                  >
                    {ts.name}
                  </Badge>
                  {index < sortedStatuses.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
