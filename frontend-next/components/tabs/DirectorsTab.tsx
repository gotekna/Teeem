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
import { FileText, Plus, Trash2, Workflow, CheckCircle, ChevronRight, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInMonths, differenceInYears, format, formatDistanceToNow } from "date-fns";
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
  const [showAddDirector, setShowAddDirector] = React.useState(false);
  const [addSearch, setAddSearch] = React.useState("");
  const [addResults, setAddResults] = React.useState<Array<{ id: number; display_name: string; email?: string }>>([]);
  const [addSearching, setAddSearching] = React.useState(false);
  const [addPosition, setAddPosition] = React.useState("director");
  const [addingDirector, setAddingDirector] = React.useState(false);
  const addDropdownRef = React.useRef<HTMLDivElement>(null);

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

  // Contact search for adding directors
  React.useEffect(() => {
    if (addSearch.length < 2) { setAddResults([]); return; }
    const timer = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await api.get<{ contacts: Array<{ id: number; display_name: string; email?: string; entity_type?: string }> }>(
          `/api/v1/contacts?search=${encodeURIComponent(addSearch)}&per_page=10`
        );
        setAddResults((res.contacts || []).filter(c => c.entity_type === "person" || c.entity_type === "sole_trader"));
      } catch { setAddResults([]); }
      finally { setAddSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [addSearch]);

  // Close add dropdown on click outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addDirector = React.useCallback(async (contactId: number) => {
    setAddingDirector(true);
    try {
      await api.post(`/api/v1/companies/${effectiveCompanyId}/add_director`, {
        contact_id: contactId,
        position: addPosition,
      });
      setShowAddDirector(false);
      setAddSearch("");
      setAddResults([]);
      setAddPosition("director");
      loadOfficers();
    } catch (err) {
      console.error("Failed to add director:", err);
    } finally {
      setAddingDirector(false);
    }
  }, [effectiveCompanyId, addPosition, loadOfficers]);

  const deleteDirector = React.useCallback(async (directorId: number, position?: string) => {
    const posLabel = position ? ` (${position})` : "";
    if (!confirm(`Permanently delete this officer record${posLabel}? This removes them from all role groups.`)) return;
    try {
      await api.delete(`/api/v1/companies/${effectiveCompanyId}/directors/${directorId}?hard_delete=true`);
      loadOfficers();
    } catch (err) {
      console.error("Failed to delete director:", err);
    }
  }, [effectiveCompanyId, loadOfficers]);

  // Group officers by primary role - each officer appears in ONE group only
  // Priority: director/chairman > secretary > public_officer > corporate_officer
  const directors = officers.filter(o => o.position?.includes("director") || o.position === "chairman");
  const secretaries = officers.filter(o => o.position?.includes("secretary") && !o.position?.includes("director") && o.position !== "chairman");
  const publicOfficers = officers.filter(o => o.position?.includes("public_officer") && !o.position?.includes("director") && !o.position?.includes("secretary") && o.position !== "chairman");

  const startDirectorChangeWorkflow = React.useCallback(async () => {
    if (!company) return;

    // If an active workflow already exists for this company, navigate to it
    const activeInstance = workflowInstances.find(
      (i) => i.status === "active" || i.status === "suspended"
    );
    if (activeInstance) {
      router.push("/workflows/tasks");
      return;
    }

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
  }, [company, router, workflowInstances]);

  const cancelWorkflow = React.useCallback(async (instanceId: number) => {
    try {
      await api.post(`/api/v1/bpmn_process_instances/${instanceId}/cancel`, {
        reason: "Cancelled by user",
      });
      loadWorkflowInstances();
    } catch (err) {
      console.error("Failed to cancel workflow:", err);
    }
  }, [loadWorkflowInstances]);

  const formatDuration = (appointmentDate?: string, resignationDate?: string) => {
    if (!appointmentDate) return "-";
    const start = new Date(appointmentDate);
    const end = resignationDate ? new Date(resignationDate) : new Date();
    const years = differenceInYears(end, start);
    const months = differenceInMonths(end, start) % 12;
    if (years === 0 && months === 0) return "< 1 month";
    const parts: string[] = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    return parts.join(" ");
  };

  const renderOfficerRow = (officer: OfficerRecord, showDelete = true) => {
    const isCurrent = officer.is_current;
    return (
      <TableRow key={officer.id} className={isCurrent ? "hover:bg-muted/30" : "hover:bg-muted/30 opacity-60"}>
        <TableCell className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              isCurrent
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-muted dark:bg-card text-muted-foreground"
            }`}>
              {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
            </div>
            <div>
              <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
              {officer.contact?.email && (
                isCurrent ? (
                  <a href={`mailto:${officer.contact.email}`} className="text-xs text-muted-foreground hover:text-primary">
                    {officer.contact.email}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">{officer.contact.email}</span>
                )
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 text-sm">{officer.formatted_position}</TableCell>
        <TableCell className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), DATE_DISPLAY) : "-"}</TableCell>
        <TableCell className="px-4 py-3 text-sm">{isCurrent ? "-" : (officer.resignation_date ? format(new Date(officer.resignation_date), DATE_DISPLAY) : "-")}</TableCell>
        <TableCell className="px-4 py-3">
          {isCurrent ? (
            <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300">Current</Badge>
          ) : (
            <Badge variant="secondary">Former</Badge>
          )}
        </TableCell>
        {showDelete && (
          <TableCell className="px-2 py-3">
            <button
              onClick={() => deleteDirector(officer.id, officer.formatted_position)}
              className="text-muted-foreground hover:text-destructive p-1"
              title="Delete officer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const renderOfficerList = (title: string, officerList: OfficerRecord[], currentOnly = false) => {
    const filtered = currentOnly ? officerList.filter(o => o.is_current) : officerList;
    const current = filtered.filter(o => o.is_current);
    const former = filtered.filter(o => !o.is_current);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No {currentOnly ? "current " : ""}{title.toLowerCase()} recorded</p>
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {current.map((officer) => renderOfficerRow(officer))}
                {former.map((officer) => renderOfficerRow(officer))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryTable = () => {
    const sorted = [...officers].sort((a, b) => {
      if (!a.appointment_date && !b.appointment_date) return 0;
      if (!a.appointment_date) return 1;
      if (!b.appointment_date) return -1;
      return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime();
    });

    if (sorted.length === 0) {
      return <p className="text-sm text-muted-foreground py-4">No officer records found</p>;
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Position</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Appointed</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Resigned</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Duration</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {sorted.map((officer) => (
              <TableRow key={officer.id} className={officer.is_current ? "hover:bg-muted/30" : "hover:bg-muted/30 opacity-60"}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      officer.is_current
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-muted dark:bg-card text-muted-foreground"
                    }`}>
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
                <TableCell className="px-4 py-3 text-sm">{formatDuration(officer.appointment_date, officer.resignation_date)}</TableCell>
                <TableCell className="px-4 py-3">
                  {officer.is_current ? (
                    <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                  ) : (
                    <Badge variant="secondary">Former</Badge>
                  )}
                </TableCell>
                <TableCell className="px-2 py-3">
                  <button
                    onClick={() => deleteDirector(officer.id, officer.formatted_position)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    title="Delete officer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
        <h3 className="text-lg font-medium">Corporate Officers</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDirector(!showAddDirector)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Officer
          </Button>
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
              {workflowInstances.some(i => i.status === "active" || i.status === "suspended")
                ? "Resume Director Change"
                : "Director Changes"}
            </Button>
          )}
        </div>
      </div>

      {/* Add Director Form */}
      {showAddDirector && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-3 px-4 space-y-3">
            <p className="text-sm font-medium">Add Officer</p>
            <div className="flex items-center gap-3">
              <Select value={addPosition} onValueChange={setAddPosition}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="public_officer">Public Officer</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1" ref={addDropdownRef}>
                <Input
                  placeholder="Search contacts..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="h-8 text-sm"
                  disabled={addingDirector}
                />
                {addSearching && (
                  <div className="absolute right-2 top-1.5">
                    <Spinner size={16} />
                  </div>
                )}
                {addResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {addResults.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => addDirector(contact.id)}
                        disabled={addingDirector}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        <p className="font-medium">{contact.display_name}</p>
                        {contact.email && (
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setShowAddDirector(false); setAddSearch(""); setAddResults([]); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Active Workflow Instances */}
      {workflowInstances.filter(i => i.status === "active" || i.status === "suspended").map((instance) => (
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => cancelWorkflow(instance.id)}
                  title="Cancel workflow"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {/* Completed Workflow Instances */}
      {workflowInstances.filter(i => i.status === "completed").map((instance) => (
        <Card key={instance.id} className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium">{instance.process_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Completed {instance.completed_at ? formatDistanceToNow(new Date(instance.completed_at), { addSuffix: true }) : ""} &bull;{" "}
                    Started {formatDistanceToNow(new Date(instance.started_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300 text-xs">
                Completed
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Officers</TabsTrigger>
          <TabsTrigger value="history">Officers History</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6 mt-4">
          {renderOfficerList("Directors", directors, true)}
          {renderOfficerList("Secretaries", secretaries, true)}
          {renderOfficerList("Public Officers", publicOfficers, true)}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {renderHistoryTable()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DirectorsTab;
