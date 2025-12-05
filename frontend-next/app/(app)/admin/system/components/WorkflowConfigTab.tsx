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
  Loader2,
  GripVertical,
  Plus,
  X,
  Briefcase,
  ListChecks,
  Layers,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface JobType {
  id: number;
  name: string;
  color: string;
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

interface TypeStatus {
  id: number;
  job_type_id: number;
  job_status_id: number;
  position: number;
  job_status: JobStatus;
}

interface StatusStage {
  id: number;
  job_type_id: number;
  job_status_id: number;
  job_stage_id: number;
  position: number;
  job_stage: JobStage;
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

  React.useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadInitialData = async () => {
    try {
      const [types, statuses, stages] = await Promise.all([
        api.get<JobType[]>("/api/v1/job_types"),
        api.get<JobStatus[]>("/api/v1/job_status"),
        api.get<JobStage[]>("/api/v1/job_stages"),
      ]);
      setAllTypes(types);
      setAllStatuses(statuses);
      setAllStages(stages);

      if (types.length > 0) {
        setSelectedType(types[0]);
        loadTypeStatuses(types[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data
      const mockTypes = [
        { id: 1, name: "New Build", color: "#3B82F6" },
        { id: 2, name: "Renovation", color: "#10B981" },
      ];
      const mockStatuses = [
        { id: 1, name: "Quote", color: "#8B5CF6" },
        { id: 2, name: "Won", color: "#10B981" },
        { id: 3, name: "In Progress", color: "#3B82F6" },
        { id: 4, name: "Complete", color: "#84CC16" },
      ];
      const mockStages = [
        { id: 1, name: "Pre-Construction", color: "#F59E0B" },
        { id: 2, name: "Foundation", color: "#6366F1" },
        { id: 3, name: "Frame", color: "#06B6D4" },
        { id: 4, name: "Lock Up", color: "#8B5CF6" },
      ];
      setAllTypes(mockTypes);
      setAllStatuses(mockStatuses);
      setAllStages(mockStages);

      if (mockTypes.length > 0) {
        setSelectedType(mockTypes[0]);
        // Mock type statuses
        setTypeStatuses([
          { id: 1, job_type_id: 1, job_status_id: 1, position: 1, job_status: mockStatuses[0] },
          { id: 2, job_type_id: 1, job_status_id: 2, position: 2, job_status: mockStatuses[1] },
          { id: 3, job_type_id: 1, job_status_id: 3, position: 3, job_status: mockStatuses[2] },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTypeStatuses = async (typeId: number) => {
    setLoadingStatuses(true);
    setSelectedStatus(null);
    setStatusStages([]);
    try {
      const data = await api.get<TypeStatus[]>(`/api/v1/job_types/${typeId}/statuses`);
      setTypeStatuses(data);
    } catch (error) {
      console.error("Failed to load type statuses:", error);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadStatusStages = async (typeId: number, statusId: number) => {
    setLoadingStages(true);
    try {
      const data = await api.get<StatusStage[]>(
        `/api/v1/job_types/${typeId}/statuses/${statusId}/stages`
      );
      setStatusStages(data);
    } catch (error) {
      console.error("Failed to load status stages:", error);
      // Mock data
      setStatusStages([
        { id: 1, job_type_id: typeId, job_status_id: statusId, job_stage_id: 1, position: 1, job_stage: allStages[0] },
        { id: 2, job_type_id: typeId, job_status_id: statusId, job_stage_id: 2, position: 2, job_stage: allStages[1] },
      ]);
    } finally {
      setLoadingStages(false);
    }
  };

  const handleSelectType = (type: JobType) => {
    setSelectedType(type);
    loadTypeStatuses(type.id);
  };

  const handleSelectStatus = (status: TypeStatus) => {
    setSelectedStatus(status);
    if (selectedType) {
      loadStatusStages(selectedType.id, status.job_status_id);
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

  const handleRemoveStatusFromType = async (typeStatusId: number) => {
    try {
      await api.delete(`/api/v1/job_type_statuses/${typeStatusId}`);
      toast({ title: "Success", description: "Status removed from type" });
      if (selectedType) {
        loadTypeStatuses(selectedType.id);
      }
      if (selectedStatus?.id === typeStatusId) {
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
        `/api/v1/job_types/${selectedType.id}/statuses/${selectedStatus.job_status_id}/stages`,
        { job_stage_id: Number(stageId) }
      );
      toast({ title: "Success", description: "Stage added to status" });
      loadStatusStages(selectedType.id, selectedStatus.job_status_id);
    } catch (error) {
      console.error("Failed to add stage:", error);
      toast({ title: "Error", description: "Failed to add stage", variant: "destructive" });
    }
  };

  const handleRemoveStageFromStatus = async (statusStageId: number) => {
    try {
      await api.delete(`/api/v1/job_status_stages/${statusStageId}`);
      toast({ title: "Success", description: "Stage removed from status" });
      if (selectedType && selectedStatus) {
        loadStatusStages(selectedType.id, selectedStatus.job_status_id);
      }
    } catch (error) {
      console.error("Failed to remove stage:", error);
      toast({ title: "Error", description: "Failed to remove stage", variant: "destructive" });
    }
  };

  const availableStatuses = allStatuses.filter(
    (status) => !typeStatuses.some((ts) => ts.job_status_id === status.id)
  );

  const availableStages = allStages.filter(
    (stage) => !statusStages.some((ss) => ss.job_stage_id === stage.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workflow Dependencies</h2>
        <p className="text-sm text-muted-foreground">
          Configure which statuses are available for each job type, and which stages are available for each status.
        </p>
      </div>

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
          <CardContent>
            <ScrollArea className="h-[400px]">
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
            <CardDescription>Select a status to configure its stages</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedType ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select a job type first
              </div>
            ) : loadingStatuses ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  <div className="space-y-1">
                    {typeStatuses
                      .sort((a, b) => a.position - b.position)
                      .map((ts) => (
                        <div
                          key={ts.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md border",
                            selectedStatus?.id === ts.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <button
                            onClick={() => handleSelectStatus(ts)}
                            className="flex-1 flex items-center gap-2 text-left"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: ts.job_status.color }}
                            />
                            <span className="text-sm">{ts.job_status.name}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemoveStatusFromType(ts.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
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
                Stages for {selectedStatus?.job_status.name || "..."}
              </CardTitle>
            </div>
            <CardDescription>Configure stages available for this status</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedStatus ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select a status first
              </div>
            ) : loadingStages ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  <div className="space-y-1">
                    {statusStages
                      .sort((a, b) => a.position - b.position)
                      .map((ss) => (
                        <div
                          key={ss.id}
                          className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ss.job_stage.color }}
                          />
                          <span className="flex-1 text-sm">{ss.job_stage.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemoveStageFromStatus(ss.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
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
              {typeStatuses
                .sort((a, b) => a.position - b.position)
                .map((ts, index) => (
                  <React.Fragment key={ts.id}>
                    <Badge
                      variant="outline"
                      className="py-2 px-3"
                      style={{
                        borderColor: ts.job_status.color,
                        backgroundColor: `${ts.job_status.color}20`,
                      }}
                    >
                      {ts.job_status.name}
                    </Badge>
                    {index < typeStatuses.length - 1 && (
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
