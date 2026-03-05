"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Play,
  FileText,
  Plus,
  Eye,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Inspection {
  id: number;
  inspection_type: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  overall_condition: string | null;
  notes: string | null;
  inspection_number: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_percentage: number;
  action_items_count: number;
  has_report: boolean;
  inspector_contact?: { id: number; display_name: string } | null;
  property?: { id: number; name: string; property_code: string } | null;
}

interface PropertyInspectionsTabProps {
  propertyId: string;
  onScheduleInspection: () => void;
}

const CONDITION_COLORS: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  // Legacy conditions
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
  entry: "Entry",
  routine: "Routine",
  exit: "Exit",
  maintenance: "Maintenance",
  sda_compliance: "SDA Compliance",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PropertyInspectionsTab({ propertyId, onScheduleInspection }: PropertyInspectionsTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInspections = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Inspection[] }>(
        `/api/v1/property_inspections?property_id=${propertyId}`
      );
      if (res.success) {
        setInspections(res.data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load inspections", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [propertyId, toast]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleStart = useCallback(async (inspectionId: number) => {
    try {
      await api.patch(`/api/v1/property_inspections/${inspectionId}/start`);
      router.push(`/properties/${propertyId}/inspections/${inspectionId}`);
    } catch {
      toast({ title: "Error", description: "Failed to start inspection", variant: "destructive" });
    }
  }, [propertyId, router, toast]);

  const handleContinue = useCallback((inspectionId: number) => {
    router.push(`/properties/${propertyId}/inspections/${inspectionId}`);
  }, [propertyId, router]);

  const handleViewReport = useCallback((inspectionId: number) => {
    router.push(`/properties/${propertyId}/inspections/${inspectionId}`);
  }, [propertyId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Calculate summary stats
  const upcoming = inspections.filter(i => i.status === "scheduled" && new Date(i.scheduled_date) >= new Date()).length;
  const inProgress = inspections.filter(i => i.status === "in_progress").length;
  const completed = inspections.filter(i => i.status === "completed").length;
  const overdue = inspections.filter(i =>
    ["scheduled", "in_progress"].includes(i.status) && new Date(i.scheduled_date) < new Date()
  ).length;

  // Group inspections: overdue first, then by status
  const overdueInspections = inspections.filter(i =>
    ["scheduled", "in_progress"].includes(i.status) && new Date(i.scheduled_date) < new Date()
  );
  const scheduledInspections = inspections.filter(i =>
    i.status === "scheduled" && new Date(i.scheduled_date) >= new Date()
  );
  const inProgressInspections = inspections.filter(i =>
    i.status === "in_progress" && new Date(i.scheduled_date) >= new Date()
  );
  const completedInspections = inspections.filter(i => i.status === "completed");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overdue > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
              <AlertTriangle className={`h-5 w-5 ${overdue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Button */}
      <div className="flex justify-end">
        <Button onClick={onScheduleInspection}>
          <Plus className="h-4 w-4 mr-1.5" />
          Schedule Inspection
        </Button>
      </div>

      {/* Overdue Inspections */}
      {overdueInspections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Overdue ({overdueInspections.length})
          </h3>
          <div className="space-y-2">
            {overdueInspections.map(inspection => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                isOverdue
                onStart={handleStart}
                onContinue={handleContinue}
                onViewReport={handleViewReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgressInspections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">
            In Progress ({inProgressInspections.length})
          </h3>
          <div className="space-y-2">
            {inProgressInspections.map(inspection => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onStart={handleStart}
                onContinue={handleContinue}
                onViewReport={handleViewReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled */}
      {scheduledInspections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Scheduled ({scheduledInspections.length})
          </h3>
          <div className="space-y-2">
            {scheduledInspections.map(inspection => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onStart={handleStart}
                onContinue={handleContinue}
                onViewReport={handleViewReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedInspections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Completed ({completedInspections.length})
          </h3>
          <div className="space-y-2">
            {completedInspections.map(inspection => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onStart={handleStart}
                onContinue={handleContinue}
                onViewReport={handleViewReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {inspections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No Inspections Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule your first property inspection to get started.
            </p>
            <Button onClick={onScheduleInspection}>
              <Plus className="h-4 w-4 mr-1.5" />
              Schedule Inspection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InspectionCard({
  inspection,
  isOverdue,
  onStart,
  onContinue,
  onViewReport,
}: {
  inspection: Inspection;
  isOverdue?: boolean;
  onStart: (id: number) => void;
  onContinue: (id: number) => void;
  onViewReport: (id: number) => void;
}) {
  const effectiveStatus = isOverdue ? "overdue" : inspection.status;

  return (
    <Card className={isOverdue ? "border-red-200 dark:border-red-800" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs shrink-0">
                  {TYPE_LABELS[inspection.inspection_type] || inspection.inspection_type}
                </Badge>
                <Badge className={`text-xs ${STATUS_COLORS[effectiveStatus] || ""}`}>
                  {effectiveStatus === "in_progress" ? "In Progress" : effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                </Badge>
                {inspection.overall_condition && (
                  <Badge className={`text-xs ${CONDITION_COLORS[inspection.overall_condition] || ""}`}>
                    {inspection.overall_condition.charAt(0).toUpperCase() + inspection.overall_condition.slice(1)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formatDate(inspection.scheduled_date)}</span>
                {inspection.inspection_number && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    <span className="font-mono text-xs">{inspection.inspection_number}</span>
                  </>
                )}
                {inspection.inspector_contact && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    <span>{inspection.inspector_contact.display_name}</span>
                  </>
                )}
              </div>
              {inspection.status === "in_progress" && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 w-32 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${inspection.completion_percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{inspection.completion_percentage}%</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {inspection.status === "scheduled" && (
              <Button size="sm" onClick={() => onStart(inspection.id)}>
                <Play className="h-3.5 w-3.5 mr-1" />
                Start
              </Button>
            )}
            {inspection.status === "in_progress" && (
              <Button size="sm" onClick={() => onContinue(inspection.id)}>
                <Play className="h-3.5 w-3.5 mr-1" />
                Continue
              </Button>
            )}
            {inspection.status === "completed" && (
              <div className="flex items-center gap-2">
                {inspection.has_report && (
                  <Button size="sm" variant="outline" onClick={() => onViewReport(inspection.id)}>
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Report
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onViewReport(inspection.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
