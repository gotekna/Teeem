"use client";

/**
 * DirectorsTab - Displays corporate officers (directors, secretaries, public officers)
 *
 * Extracted from corporate page for unified tab system.
 * Fetches and displays officer history with current/former status.
 * Includes Director Change button for ASIC Form 484 package generation.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Workflow, CheckCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

import { format, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Corporate, OfficerRecord } from "@/lib/types/corporate";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";

interface WorkflowInstance {
  id: number;
  status: string;
  process_name: string;
  current_node?: string;
  pending_tasks: number;
  started_at: string;
  completed_at?: string;
  progress: number;
}

interface DirectorsTabProps {
  companyId: string;
  entityId?: string;
  company?: Corporate;
  onUpdate?: () => void;
}

export function DirectorsTab({ companyId, entityId, company, onUpdate }: DirectorsTabProps) {
  const effectiveCompanyId = companyId || entityId;
  const router = useRouter();
  const [officers, setOfficers] = React.useState<OfficerRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [startingWorkflow, setStartingWorkflow] = React.useState(false);
  const [workflowInstances, setWorkflowInstances] = React.useState<WorkflowInstance[]>([]);

  const loadOfficers = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; directors: OfficerRecord[] }>(
        `/api/v1/companies/${effectiveCompanyId}/directors`
      );
      setOfficers(response.directors || []);
    } catch (error) {
      console.error("Failed to load officers:", error);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  const loadWorkflowInstances = React.useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const res = await api.get<{ instances: WorkflowInstance[]; success: boolean }>(
        `/api/v1/bpmn_process_instances/for_subject?subject_type=Corporate&subject_id=${effectiveCompanyId}`
      );
      if (res.success) {
        setWorkflowInstances(res.instances || []);
      }
    } catch {
      // Non-critical - don't block tab rendering
    }
  }, [effectiveCompanyId]);

  React.useEffect(() => {
    loadOfficers();
    loadWorkflowInstances();
  }, [loadOfficers, loadWorkflowInstances]);

  // Group officers by role type
  const directors = officers.filter(o => o.position?.includes("director") || o.position === "chairman");
  const secretaries = officers.filter(o => o.position?.includes("secretary"));
  const publicOfficers = officers.filter(o => o.position?.includes("public_officer"));

  const startDirectorChangeWorkflow = React.useCallback(async () => {
    if (!company) return;
    setStartingWorkflow(true);
    try {
      const res = await api.post<{
        success: boolean;
        instance: { id: number };
        first_task_id: number | null;
        error?: string;
      }>("/api/v1/bpmn_process_instances", {
        bpmn_process_id: "Director Change",
        subject_type: "Corporate",
        subject_id: company.id,
      });

      if (res?.success && res.first_task_id) {
        router.push(`/workflows/tasks/${res.first_task_id}`);
      } else if (res?.success) {
        router.push("/workflows");
      } else {
        console.error("Failed to start workflow:", res?.error);
      }
    } catch (err) {
      console.error("Failed to start director change workflow:", err);
    } finally {
      setStartingWorkflow(false);
    }
  }, [company, router]);

  const renderOfficerList = (title: string, officerList: OfficerRecord[]) => {
    const current = officerList.filter(o => o.is_current);
    const former = officerList.filter(o => !o.is_current);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        {officerList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No {title.toLowerCase()} recorded</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Position</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Appointed</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Resigned</TableHead>
                  <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {/* Current officers first */}
                {current.map((officer) => (
                  <TableRow key={officer.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <a href={`mailto:${officer.contact.email}`} className="text-xs text-muted-foreground hover:text-primary">
                              {officer.contact.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.formatted_position}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), DATE_DISPLAY) : "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">-</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Former officers */}
                {former.map((officer) => (
                  <TableRow key={officer.id} className="hover:bg-muted/30 opacity-60">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted dark:bg-card flex items-center justify-center text-muted-foreground text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <span className="text-xs text-muted-foreground">{officer.contact.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.formatted_position}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), DATE_DISPLAY) : "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{officer.resignation_date ? format(new Date(officer.resignation_date), DATE_DISPLAY) : "-"}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary">Former</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Corporate Officers History</h3>
        {company && (
          <Button
            variant="outline"
            size="sm"
            onClick={startDirectorChangeWorkflow}
            disabled={startingWorkflow}
          >
            {startingWorkflow ? (
              <Spinner size={16} className="mr-1.5" />
            ) : (
              <FileText className="w-4 h-4 mr-1.5" />
            )}
            Director Changes
          </Button>
        )}
      </div>
      {/* Active Workflow Instances */}
      {workflowInstances.length > 0 && (
        <div className="space-y-2">
          {workflowInstances
            .filter(i => i.status === "active" || i.status === "suspended")
            .map((instance) => (
            <Card key={instance.id} className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Workflow className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium">{instance.process_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {instance.current_node && <span>At: {instance.current_node} &bull; </span>}
                        {instance.pending_tasks > 0 && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {instance.pending_tasks} pending task{instance.pending_tasks !== 1 ? "s" : ""} &bull;{" "}
                          </span>
                        )}
                        Started {formatDistanceToNow(new Date(instance.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-blue-500 text-xs">
                      {Math.round(instance.progress)}%
                    </Badge>
                    <Link href="/workflows/tasks">
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        View <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {workflowInstances.filter(i => i.status === "completed").length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
              {workflowInstances.filter(i => i.status === "completed").length} completed workflow
              {workflowInstances.filter(i => i.status === "completed").length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {renderOfficerList("Directors", directors)}
      {renderOfficerList("Secretaries", secretaries)}
      {renderOfficerList("Public Officers", publicOfficers)}
    </div>
  );
}

export default DirectorsTab;
