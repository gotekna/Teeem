"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Play,
  FileText,
  Mail,
  Clock,
  Users,
  Building2,
  Briefcase,
  Search,
  BarChart3,
  AlertTriangle,
  Calendar,
  ExternalLink,
  Plus,
  CheckCircle,
  XCircle,
  DollarSign,
  Trash2,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Paperclip,
  User,
  Network,
  FolderTree,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Lazy load the relationship chart since it uses XYFlow
const CaseRelationshipChart = dynamic(
  () => import("@/components/cases/CaseRelationshipChart"),
  { ssr: false }
);

// Lazy load the EntityChat component
const EntityChat = dynamic(
  () => import("@/components/chat/EntityChat").then(mod => ({ default: mod.EntityChat })),
  { ssr: false }
);

// Tabs for case detail
const CASE_TABS = [
  { id: "overview", name: "Overview", icon: Briefcase },
  { id: "subcases", name: "Sub-cases", icon: FolderTree },
  { id: "relationships", name: "Relationships", icon: Network },
  { id: "chat", name: "Chat", icon: MessageSquare },
  { id: "actions", name: "Actions", icon: Play },
  { id: "documents", name: "Documents", icon: FileText },
  { id: "emails", name: "Emails", icon: Mail },
  { id: "timeline", name: "Timeline", icon: Clock },
  { id: "entities", name: "Entities", icon: Users },
  { id: "warehouse", name: "Warehouse", icon: BarChart3 },
];

interface ChildCase {
  id: number;
  case_number: string;
  title: string;
  case_type: string;
  formatted_case_type: string;
  status: string;
  formatted_status: string;
  priority: string;
  formatted_priority: string;
  deadline: string | null;
  overdue: boolean;
  assigned_to: string | null;
  has_children: boolean;
  child_cases_count: number;
  created_at: string;
}

interface CaseDetail {
  id: number;
  case_number: string;
  title: string;
  description: string | null;
  case_type: string;
  formatted_case_type: string;
  status: string;
  formatted_status: string;
  priority: string;
  formatted_priority: string;
  deadline: string | null;
  overdue: boolean;
  days_until_deadline: number | null;
  contact_id: number | null;
  contact_name: string | null;
  company_id: number | null;
  company_name: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  investigation_start_date: string | null;
  investigation_end_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  actions_count: number;
  documents_count: number;
  emails_count: number;
  contacts_count: number;
  companies_count: number;
  jobs_count: number;
  timeline_events_count: number;
  ai_summary: any;
  key_findings: any[];
  risk_score: number | null;
  created_at: string;
  updated_at: string;
  // Hierarchy fields
  parent_case_id: number | null;
  parent_case_number: string | null;
  parent_case_title: string | null;
  hierarchy_level: number;
  is_child_case: boolean;
  has_children: boolean;
  child_cases_count: number;
  child_cases_summary: {
    total: number;
    open: number;
    closed: number;
    overdue: number;
  };
  child_cases: ChildCase[];
}

interface CaseAction {
  id: number;
  action_type: string;
  action_name: string;
  action_description: string;
  status: string;
  query: string | null;
  parameters: any;
  results: any;
  result_count: number | null;
  error_message: string | null;
  execution_time: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ActionType {
  name: string;
  description: string;
  icon: string;
  data_sources: string[];
}

interface CaseDocument {
  id: number;
  company_document_id: number;
  title: string;
  filename: string;
  document_type: string;
  relevance: string;
  notes: string | null;
  sequence: number | null;
  document_date: string | null;
  file_size: number | null;
  created_at: string;
}

interface CaseEmail {
  id: number;
  email_warehouse_id: number;
  subject: string;
  from_email: string;
  to_emails: string[];
  received_at: string;
  relevance: string;
  notes: string | null;
  has_attachments: boolean;
  created_at: string;
}

interface TimelineEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  source: string | null;
  icon: string | null;
  color: string | null;
  metadata: any;
  created_at: string;
}

interface CaseContact {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  role: string;
  notes: string | null;
  created_at: string;
}

interface CaseCompany {
  id: number;
  company_id: number;
  company_name: string;
  abn: string | null;
  role: string;
  notes: string | null;
  created_at: string;
}

interface CaseJob {
  id: number;
  job_id: number;
  job_number: string;
  job_title: string;
  client_name: string | null;
  role: string;
  notes: string | null;
  created_at: string;
}

interface WarehouseSummary {
  case_number: string;
  title: string;
  status: string;
  generated_at: string;
  related_contacts: number;
  related_companies: number;
  related_jobs: number;
  documents_linked: number;
  emails_linked: number;
  actions_completed: number;
  actions_with_findings: number;
  total_job_income: number;
  total_job_expenses: number;
  total_hours_logged: number;
  inconsistencies: any[];
  invoice_variances: number;
  investigation_period: {
    start: string | null;
    end: string | null;
  };
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [caseData, setCaseData] = React.useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");

  // Tab-specific data
  const [actions, setActions] = React.useState<CaseAction[]>([]);
  const [loadingActions, setLoadingActions] = React.useState(false);

  const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = React.useState(false);

  const [emails, setEmails] = React.useState<CaseEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = React.useState(false);

  const [timelineEvents, setTimelineEvents] = React.useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(false);

  const [contacts, setContacts] = React.useState<CaseContact[]>([]);
  const [companies, setCompanies] = React.useState<CaseCompany[]>([]);
  const [jobs, setJobs] = React.useState<CaseJob[]>([]);
  const [loadingEntities, setLoadingEntities] = React.useState(false);

  const [warehouseSummary, setWarehouseSummary] = React.useState<WarehouseSummary | null>(null);
  const [loadingWarehouse, setLoadingWarehouse] = React.useState(false);

  const [relationshipGraph, setRelationshipGraph] = React.useState<any>(null);
  const [loadingRelationships, setLoadingRelationships] = React.useState(false);

  // Action types
  const [actionTypes, setActionTypes] = React.useState<Record<string, ActionType>>({});

  // Run action modal
  const [showRunAction, setShowRunAction] = React.useState(false);
  const [selectedActionType, setSelectedActionType] = React.useState<string>("");
  const [actionQuery, setActionQuery] = React.useState("");
  const [runningAction, setRunningAction] = React.useState(false);

  // Create sub-case modal
  const [showCreateSubCase, setShowCreateSubCase] = React.useState(false);
  const [newSubCaseTitle, setNewSubCaseTitle] = React.useState("");
  const [newSubCaseDescription, setNewSubCaseDescription] = React.useState("");
  const [creatingSubCase, setCreatingSubCase] = React.useState(false);

  // Load case
  React.useEffect(() => {
    const loadCase = async () => {
      try {
        setLoading(true);
        const [caseResponse, typesResponse] = await Promise.all([
          api.get<{ success: boolean; data: CaseDetail }>(`/api/v1/cases/${caseId}`),
          api.get<{ success: boolean; data: { action_types: Record<string, ActionType> } }>("/api/v1/cases/types"),
        ]);
        setCaseData(caseResponse.data);
        setActionTypes(typesResponse.data.action_types || {});
      } catch (error) {
        console.error("Failed to load case:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCase();
  }, [caseId]);

  // Load tab data when tab changes
  React.useEffect(() => {
    if (!caseData) return;

    switch (activeTab) {
      case "relationships":
        if (!relationshipGraph) loadRelationshipGraph();
        break;
      case "actions":
        if (actions.length === 0) loadActions();
        break;
      case "documents":
        if (documents.length === 0) loadDocuments();
        break;
      case "emails":
        if (emails.length === 0) loadEmails();
        break;
      case "timeline":
        if (timelineEvents.length === 0) loadTimeline();
        break;
      case "entities":
        if (contacts.length === 0 && companies.length === 0) loadEntities();
        break;
      case "warehouse":
        if (!warehouseSummary) loadWarehouseSummary();
        break;
    }
  }, [activeTab, caseData]);

  const loadActions = async () => {
    try {
      setLoadingActions(true);
      const response = await api.get<{ success: boolean; data: CaseAction[] }>(
        `/api/v1/cases/${caseId}/actions`
      );
      setActions(response.data || []);
    } catch (error) {
      console.error("Failed to load actions:", error);
    } finally {
      setLoadingActions(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const response = await api.get<{ success: boolean; data: CaseDocument[] }>(
        `/api/v1/cases/${caseId}/documents`
      );
      setDocuments(response.data || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const loadEmails = async () => {
    try {
      setLoadingEmails(true);
      const response = await api.get<{ success: boolean; data: CaseEmail[] }>(
        `/api/v1/cases/${caseId}/emails`
      );
      setEmails(response.data || []);
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadTimeline = async () => {
    try {
      setLoadingTimeline(true);
      const response = await api.get<{ success: boolean; data: TimelineEvent[] }>(
        `/api/v1/cases/${caseId}/timeline`
      );
      setTimelineEvents(response.data || []);
    } catch (error) {
      console.error("Failed to load timeline:", error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const loadEntities = async () => {
    try {
      setLoadingEntities(true);
      const [contactsRes, companiesRes, jobsRes] = await Promise.all([
        api.get<{ success: boolean; data: CaseContact[] }>(`/api/v1/cases/${caseId}/contacts`),
        api.get<{ success: boolean; data: CaseCompany[] }>(`/api/v1/cases/${caseId}/companies`),
        api.get<{ success: boolean; data: CaseJob[] }>(`/api/v1/cases/${caseId}/jobs`),
      ]);
      setContacts(contactsRes.data || []);
      setCompanies(companiesRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoadingEntities(false);
    }
  };

  const loadWarehouseSummary = async () => {
    try {
      setLoadingWarehouse(true);
      const response = await api.get<{ success: boolean; data: WarehouseSummary }>(
        `/api/v1/cases/${caseId}/warehouse_summary`
      );
      setWarehouseSummary(response.data);
    } catch (error) {
      console.error("Failed to load warehouse summary:", error);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  const loadRelationshipGraph = async () => {
    try {
      setLoadingRelationships(true);
      const response = await api.get<{ success: boolean; data: any }>(
        `/api/v1/cases/${caseId}/relationship_graph`
      );
      setRelationshipGraph(response.data);
    } catch (error) {
      console.error("Failed to load relationship graph:", error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  const handleSaveContactPosition = async (contactId: number, position: { x: number; y: number }) => {
    try {
      await api.patch(`/api/v1/cases/${caseId}/contacts/${contactId}/position`, {
        display_position: position,
      });
    } catch (error) {
      console.error("Failed to save contact position:", error);
    }
  };

  const buildTimeline = async () => {
    try {
      setLoadingTimeline(true);
      const response = await api.post<{ success: boolean; data: TimelineEvent[] }>(
        `/api/v1/cases/${caseId}/build_timeline`
      );
      setTimelineEvents(response?.data || []);
    } catch (error) {
      console.error("Failed to build timeline:", error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const createSubCase = async () => {
    if (!newSubCaseTitle.trim()) return;

    try {
      setCreatingSubCase(true);
      const response = await api.post<{ success: boolean; data: CaseDetail; message: string }>(
        `/api/v1/cases/${caseId}/create_child`,
        {
          case: {
            title: newSubCaseTitle,
            description: newSubCaseDescription,
          },
        }
      );

      if (!response?.data) {
        throw new Error("Failed to create sub-case");
      }

      const newCaseId = response.data.id;

      // Refresh case data to show new child case
      const caseResponse = await api.get<{ success: boolean; data: CaseDetail }>(
        `/api/v1/cases/${caseId}`
      );
      setCaseData(caseResponse.data);

      // Reset form and close dialog
      setNewSubCaseTitle("");
      setNewSubCaseDescription("");
      setShowCreateSubCase(false);

      // Navigate to the new sub-case
      router.push(`/cases/${newCaseId}`);
    } catch (error) {
      console.error("Failed to create sub-case:", error);
    } finally {
      setCreatingSubCase(false);
    }
  };

  const runAction = async () => {
    if (!selectedActionType) return;

    try {
      setRunningAction(true);
      await api.post(`/api/v1/cases/${caseId}/run_action`, {
        action_type: selectedActionType,
        query: actionQuery,
        parameters: {},
      });
      setShowRunAction(false);
      setSelectedActionType("");
      setActionQuery("");
      loadActions();
    } catch (error) {
      console.error("Failed to run action:", error);
    } finally {
      setRunningAction(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-700";
      case "in_progress":
        return "bg-amber-100 text-amber-700";
      case "review":
        return "bg-purple-100 text-purple-700";
      case "closed":
        return "bg-green-100 text-green-700";
      case "archived":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "normal":
        return "bg-blue-100 text-blue-700";
      case "low":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "running":
        return "bg-blue-100 text-blue-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case "key_evidence":
        return "bg-red-100 text-red-700";
      case "supporting":
        return "bg-amber-100 text-amber-700";
      case "background":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getTimelineIcon = (eventType: string) => {
    switch (eventType) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "transaction":
        return <DollarSign className="h-4 w-4" />;
      case "meeting":
        return <Users className="h-4 w-4" />;
      case "filing":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTimelineColor = (eventType: string) => {
    switch (eventType) {
      case "email":
        return "bg-purple-500";
      case "document":
        return "bg-blue-500";
      case "transaction":
        return "bg-green-500";
      case "meeting":
        return "bg-amber-500";
      case "filing":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Case not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/cases")}>
          Back to Cases
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/cases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">
                {caseData.case_number}
              </span>
              <Badge className={getStatusColor(caseData.status)}>
                {caseData.formatted_status}
              </Badge>
              <Badge className={getPriorityColor(caseData.priority)}>
                {caseData.formatted_priority}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{caseData.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>Type: {caseData.formatted_case_type}</span>
              {caseData.deadline && (
                <span className={caseData.overdue ? "text-red-600" : ""}>
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Due: {format(new Date(caseData.deadline), "d MMM yyyy")}
                  {caseData.overdue && " (Overdue)"}
                </span>
              )}
              {caseData.assigned_to && <span>Assigned to: {caseData.assigned_to}</span>}
            </div>
          </div>
        </div>
        <Button onClick={() => setShowRunAction(true)}>
          <Play className="h-4 w-4 mr-2" />
          Run Action
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          {CASE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Parent Case Dashboard - shown when this is a parent/master case */}
            {(caseData.has_children || !caseData.is_child_case) && caseData.child_cases_summary && (
              <div className="space-y-6">
                {/* Sub-case Status Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Matters</p>
                          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                            {caseData.child_cases_summary.total}
                          </p>
                        </div>
                        <FolderTree className="h-8 w-8 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Open</p>
                          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                            {caseData.child_cases_summary.open}
                          </p>
                        </div>
                        <Activity className="h-8 w-8 text-amber-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">Closed</p>
                          <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                            {caseData.child_cases_summary.closed}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={cn(
                    "border",
                    caseData.child_cases_summary.overdue > 0
                      ? "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200"
                      : "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn(
                            "text-sm font-medium",
                            caseData.child_cases_summary.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"
                          )}>Overdue</p>
                          <p className={cn(
                            "text-3xl font-bold",
                            caseData.child_cases_summary.overdue > 0 ? "text-red-700 dark:text-red-300" : "text-slate-700 dark:text-slate-300"
                          )}>
                            {caseData.child_cases_summary.overdue}
                          </p>
                        </div>
                        <AlertTriangle className={cn(
                          "h-8 w-8 opacity-50",
                          caseData.child_cases_summary.overdue > 0 ? "text-red-500" : "text-slate-400"
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Active Sub-cases List */}
                {caseData.child_cases && caseData.child_cases.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-lg">Active Matters</CardTitle>
                      <Button size="sm" onClick={() => setShowCreateSubCase(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        New Matter
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {caseData.child_cases
                          .filter(c => c.status !== 'closed' && c.status !== 'archived')
                          .slice(0, 5)
                          .map((child) => (
                          <div
                            key={child.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                              child.overdue && "border-red-300 bg-red-50 dark:bg-red-950/20"
                            )}
                            onClick={() => router.push(`/cases/${child.id}`)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {child.case_number}
                                  </span>
                                  {child.overdue && (
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium truncate">{child.title}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(child.status)}>
                                {child.formatted_status}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                        {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length > 5 && (
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setActiveTab('subcases')}
                          >
                            View all {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length} active matters
                          </Button>
                        )}
                        {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length === 0 && (
                          <div className="text-center py-6 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>All matters resolved</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => setShowCreateSubCase(true)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create New Matter
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No sub-cases yet - prompt to create first one */}
                {(!caseData.child_cases || caseData.child_cases.length === 0) && (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <FolderTree className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Matters Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        This is your client file. Create your first matter to start tracking specific issues.
                      </p>
                      <Button onClick={() => setShowCreateSubCase(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Matter
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Standard Case Details Grid */}
            <div className="grid grid-cols-3 gap-6">
              {/* Main Info */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>
                    {caseData.has_children || !caseData.is_child_case ? "Client File Details" : "Case Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {caseData.description && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="mt-1">{caseData.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Investigation Period
                      </label>
                      <p className="mt-1">
                        {caseData.investigation_start_date && caseData.investigation_end_date
                          ? `${format(new Date(caseData.investigation_start_date), "d MMM yyyy")} - ${format(
                              new Date(caseData.investigation_end_date),
                              "d MMM yyyy"
                            )}`
                          : "Not specified"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created By</label>
                      <p className="mt-1">{caseData.created_by || "Unknown"}</p>
                    </div>
                  </div>
                  {caseData.key_findings && caseData.key_findings.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Key Findings</label>
                      <ul className="mt-1 list-disc list-inside space-y-1">
                        {caseData.key_findings.map((finding, idx) => (
                          <li key={idx}>{String(finding)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Side Panel */}
              <div className="space-y-4">
                {/* Primary Entity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Primary Entity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {caseData.contact_name && (
                      <div className="flex items-center justify-between">
                        <span>{caseData.contact_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/contacts/${caseData.contact_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {caseData.company_name && (
                      <div className="flex items-center justify-between">
                        <span>{caseData.company_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/corporate/companies/${caseData.company_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {!caseData.contact_name && !caseData.company_name && (
                      <p className="text-muted-foreground text-sm">No primary entity</p>
                    )}
                  </CardContent>
                </Card>

                {/* Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {caseData.has_children ? "File Statistics" : "Case Statistics"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {caseData.has_children && (
                        <div className="flex justify-between font-medium border-b pb-2 mb-2">
                          <span className="text-muted-foreground">Sub-cases</span>
                          <span>{caseData.child_cases_count}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Actions Run</span>
                        <span className="font-medium">{caseData.actions_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Documents</span>
                        <span className="font-medium">{caseData.documents_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Emails</span>
                        <span className="font-medium">{caseData.emails_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timeline Events</span>
                        <span className="font-medium">{caseData.timeline_events_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Related Contacts</span>
                        <span className="font-medium">{caseData.contacts_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Related Companies</span>
                        <span className="font-medium">{caseData.companies_count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Score */}
                {caseData.risk_score !== null && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Risk Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "text-3xl font-bold",
                            caseData.risk_score >= 70
                              ? "text-red-600"
                              : caseData.risk_score >= 40
                              ? "text-amber-600"
                              : "text-green-600"
                          )}
                        >
                          {caseData.risk_score}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {caseData.risk_score >= 70
                            ? "High Risk"
                            : caseData.risk_score >= 40
                            ? "Medium Risk"
                            : "Low Risk"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "subcases" && (
          <div className="space-y-6">
            {/* Parent Case Banner */}
            {caseData.parent_case_id && (
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className="h-5 w-5 text-blue-500 rotate-180" />
                      <div>
                        <p className="text-sm text-muted-foreground">This is a sub-case of:</p>
                        <p className="font-medium">{caseData.parent_case_title}</p>
                        <p className="text-sm text-muted-foreground">{caseData.parent_case_number}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/cases/${caseData.parent_case_id}`)}
                    >
                      View Parent Case
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sub-cases Header */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="h-5 w-5" />
                    Sub-cases
                  </CardTitle>
                  {caseData.child_cases_summary && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {caseData.child_cases_summary.open} open, {caseData.child_cases_summary.closed} closed
                      {caseData.child_cases_summary.overdue > 0 && (
                        <span className="text-red-600 ml-1">
                          ({caseData.child_cases_summary.overdue} overdue)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <Button onClick={() => setShowCreateSubCase(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Sub-case
                </Button>
              </CardHeader>
              <CardContent>
                {caseData.child_cases && caseData.child_cases.length > 0 ? (
                  <div className="space-y-3">
                    {caseData.child_cases.map((child) => (
                      <div
                        key={child.id}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          child.overdue && "border-red-300 bg-red-50 dark:bg-red-950/20"
                        )}
                        onClick={() => router.push(`/cases/${child.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm text-muted-foreground">
                                {child.case_number}
                              </span>
                              <Badge className={getStatusColor(child.status)}>
                                {child.formatted_status}
                              </Badge>
                              <Badge className={getPriorityColor(child.priority)}>
                                {child.formatted_priority}
                              </Badge>
                              {child.overdue && (
                                <Badge className="bg-red-100 text-red-800">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium truncate">{child.title}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {child.assigned_to && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {child.assigned_to}
                                </span>
                              )}
                              {child.deadline && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(child.deadline), "d MMM yyyy")}
                                </span>
                              )}
                              {child.has_children && (
                                <span className="flex items-center gap-1">
                                  <FolderTree className="h-3 w-3" />
                                  {child.child_cases_count} sub-case{child.child_cases_count !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sub-cases yet</p>
                    <p className="text-sm mt-1">Create a sub-case to track related issues</p>
                    <Button className="mt-4" onClick={() => setShowCreateSubCase(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Sub-case
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "relationships" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Case Relationships
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => loadRelationshipGraph()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRelationships ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <CaseRelationshipChart
                  caseId={parseInt(caseId)}
                  data={relationshipGraph}
                  onContactClick={(contactId) => router.push(`/contacts/${contactId}`)}
                  onCompanyClick={(companyId) => router.push(`/corporate/companies/${companyId}`)}
                  onJobClick={(jobId) => router.push(`/jobs/${jobId}`)}
                  onCaseClick={(relatedCaseId) => router.push(`/cases/${relatedCaseId}`)}
                  onPositionChange={handleSaveContactPosition}
                />
              )}
              <div className="mt-4 text-sm text-muted-foreground">
                <p>
                  Drag nodes to reposition. Click on a contact, company, or job to view details.
                  Node positions are saved automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "chat" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Internal Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EntityChat
                entityType="case"
                entityId={parseInt(caseId)}
                entityName={caseDetail?.title}
                showOnlineUsers={true}
                maxHeight="500px"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "actions" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Actions</CardTitle>
              <Button onClick={() => setShowRunAction(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Run Action
              </Button>
            </CardHeader>
            <CardContent>
              {loadingActions ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No actions have been run yet</p>
                  <p className="text-sm mt-1">Run an action to search the data warehouse</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action) => (
                    <Card key={action.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{action.action_name}</span>
                              <Badge className={getActionStatusColor(action.status)}>
                                {action.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {action.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                                {action.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {action.status}
                              </Badge>
                            </div>
                            {action.query && (
                              <p className="text-sm text-muted-foreground mb-2">
                                Query: "{action.query}"
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {action.result_count !== null && (
                                <span className="mr-4">{action.result_count} results</span>
                              )}
                              {action.execution_time && <span className="mr-4">{action.execution_time}</span>}
                              <span>
                                {format(new Date(action.created_at), "d MMM yyyy HH:mm")}
                              </span>
                            </div>
                          </div>
                          {action.status === "completed" && action.results && (
                            <Button variant="outline" size="sm">
                              View Results
                            </Button>
                          )}
                        </div>
                        {action.error_message && (
                          <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
                            {action.error_message}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documents ({documents.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => loadDocuments()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No documents linked to this case</p>
                  <p className="text-sm mt-1">Run a document search action to find relevant documents</p>
                </div>
              ) : (
                <div className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded text-blue-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{doc.title || doc.filename}</span>
                            <Badge className={getRelevanceColor(doc.relevance)}>
                              {doc.relevance?.replace("_", " ") || "linked"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>{doc.document_type}</span>
                            {doc.document_date && (
                              <span className="ml-3">
                                {format(new Date(doc.document_date), "d MMM yyyy")}
                              </span>
                            )}
                            <span className="ml-3">{formatFileSize(doc.file_size)}</span>
                          </div>
                          {doc.notes && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              {doc.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "emails" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Emails ({emails.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => loadEmails()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingEmails ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No emails linked to this case</p>
                  <p className="text-sm mt-1">Run an email search action to find relevant emails</p>
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map((email) => (
                    <div key={email.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded text-purple-600">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{email.subject || "(No Subject)"}</span>
                            <Badge className={getRelevanceColor(email.relevance)}>
                              {email.relevance?.replace("_", " ") || "linked"}
                            </Badge>
                            {email.has_attachments && (
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>From: {email.from_email}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span>To: {email.to_emails?.join(", ") || "-"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {email.received_at &&
                              format(new Date(email.received_at), "d MMM yyyy HH:mm")}
                          </div>
                          {email.notes && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              {email.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "timeline" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Timeline ({timelineEvents.length} events)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => loadTimeline()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => buildTimeline()}>
                  <Activity className="h-4 w-4 mr-2" />
                  Auto-Build
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTimeline ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No timeline events yet</p>
                  <p className="text-sm mt-1">
                    Click "Auto-Build" to generate a timeline from warehouse data
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {/* Timeline events */}
                  <div className="space-y-6">
                    {timelineEvents.map((event, idx) => (
                      <div key={event.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-white",
                            getTimelineColor(event.event_type)
                          )}
                        >
                          {getTimelineIcon(event.event_type)}
                        </div>

                        {/* Event content */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                  {format(new Date(event.event_date), "d MMM yyyy")}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {event.event_type}
                                </Badge>
                              </div>
                              <h4 className="font-medium">{event.title}</h4>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {event.description}
                                </p>
                              )}
                              {event.source && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Source: {event.source}
                                </p>
                              )}
                            </div>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "entities" && (
          <div className="space-y-6">
            {loadingEntities ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Contacts Section */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">
                      <User className="h-4 w-4 inline mr-2" />
                      Contacts ({contacts.length})
                    </CardTitle>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No contacts linked to this case
                      </p>
                    ) : (
                      <div className="divide-y">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-teal-100 rounded-full text-teal-600">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{contact.contact_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {contact.contact_email || "No email"}
                                  {contact.role && (
                                    <Badge variant="outline" className="ml-2">
                                      {contact.role}
                                    </Badge>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/contacts/${contact.contact_id}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Companies Section */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">
                      <Building2 className="h-4 w-4 inline mr-2" />
                      Companies ({companies.length})
                    </CardTitle>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No companies linked to this case
                      </p>
                    ) : (
                      <div className="divide-y">
                        {companies.map((company) => (
                          <div
                            key={company.id}
                            className="py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded text-blue-600">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{company.company_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {company.abn && `ABN: ${company.abn}`}
                                  {company.role && (
                                    <Badge variant="outline" className="ml-2">
                                      {company.role}
                                    </Badge>
                                  )}
                                </div>
                                {company.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {company.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/corporate/companies/${company.company_id}`)
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Jobs Section */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">
                      <Briefcase className="h-4 w-4 inline mr-2" />
                      Jobs ({jobs.length})
                    </CardTitle>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Job
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {jobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No jobs linked to this case
                      </p>
                    ) : (
                      <div className="divide-y">
                        {jobs.map((job) => (
                          <div
                            key={job.id}
                            className="py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-100 rounded text-amber-600">
                                <Briefcase className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">
                                    {job.job_number}
                                  </span>
                                  <span className="font-medium">{job.job_title}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {job.client_name && `Client: ${job.client_name}`}
                                  {job.role && (
                                    <Badge variant="outline" className="ml-2">
                                      {job.role}
                                    </Badge>
                                  )}
                                </div>
                                {job.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {job.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/jobs/${job.job_id}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === "warehouse" && (
          <div className="space-y-6">
            {loadingWarehouse ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !warehouseSummary ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Failed to load warehouse data</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => loadWarehouseSummary()}
                    >
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Job Income</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(warehouseSummary.total_job_income || 0)}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Job Expenses</p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(warehouseSummary.total_job_expenses || 0)}
                          </p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Hours Logged</p>
                          <p className="text-2xl font-bold">
                            {(warehouseSummary.total_hours_logged || 0).toFixed(1)}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Invoice Variances</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {warehouseSummary.invoice_variances || 0}
                          </p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-amber-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Related Entities Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Related Entities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <Users className="h-6 w-6 mx-auto mb-2 text-teal-600" />
                        <p className="text-2xl font-bold">{warehouseSummary.related_contacts}</p>
                        <p className="text-sm text-muted-foreground">Contacts</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <Building2 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold">{warehouseSummary.related_companies}</p>
                        <p className="text-sm text-muted-foreground">Companies</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <Briefcase className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                        <p className="text-2xl font-bold">{warehouseSummary.related_jobs}</p>
                        <p className="text-sm text-muted-foreground">Jobs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions & Documents Summary */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Actions Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Completed Actions</span>
                          <span className="font-medium">{warehouseSummary.actions_completed}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">With Findings</span>
                          <span className="font-medium">{warehouseSummary.actions_with_findings}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Documents Linked</span>
                          <span className="font-medium">{warehouseSummary.documents_linked}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Emails Linked</span>
                          <span className="font-medium">{warehouseSummary.emails_linked}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Investigation Period</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Start Date</span>
                          <span className="font-medium">
                            {warehouseSummary.investigation_period?.start
                              ? format(new Date(warehouseSummary.investigation_period.start), "d MMM yyyy")
                              : "Not set"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">End Date</span>
                          <span className="font-medium">
                            {warehouseSummary.investigation_period?.end
                              ? format(new Date(warehouseSummary.investigation_period.end), "d MMM yyyy")
                              : "Not set"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Generated At</span>
                          <span className="font-medium">
                            {format(new Date(warehouseSummary.generated_at), "d MMM yyyy HH:mm")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Inconsistencies */}
                {warehouseSummary.inconsistencies && warehouseSummary.inconsistencies.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Issues & Inconsistencies ({warehouseSummary.inconsistencies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {warehouseSummary.inconsistencies.map((issue: any, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-lg border",
                              issue.severity === "high"
                                ? "border-red-200 bg-red-50"
                                : issue.severity === "medium"
                                ? "border-amber-200 bg-amber-50"
                                : "border-gray-200 bg-gray-50"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={cn(
                                      issue.severity === "high"
                                        ? "bg-red-100 text-red-700"
                                        : issue.severity === "medium"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-gray-100 text-gray-700"
                                    )}
                                  >
                                    {issue.severity}
                                  </Badge>
                                  <span className="font-medium">{issue.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {issue.description}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Type: {issue.type} | Source: {issue.source}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Refresh Button */}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => loadWarehouseSummary()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Warehouse Data
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Run Action Modal */}
      {showRunAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Run Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Action Type</label>
                <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select action type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(actionTypes).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium">{config.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {config.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Query (optional)</label>
                <Textarea
                  value={actionQuery}
                  onChange={(e) => setActionQuery(e.target.value)}
                  placeholder="Enter search query or instructions..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRunAction(false)}>
                  Cancel
                </Button>
                <Button onClick={runAction} disabled={!selectedActionType || runningAction}>
                  {runningAction ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Sub-case Dialog */}
      <Dialog open={showCreateSubCase} onOpenChange={setShowCreateSubCase}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Create Sub-case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Create a new sub-case under "{caseData?.title}". The sub-case will inherit
              contacts, companies, and investigation settings from the parent case.
            </p>
            <div className="space-y-2">
              <Label htmlFor="subcase-title">Title *</Label>
              <Input
                id="subcase-title"
                placeholder="e.g., FY2024 Tax Assessment Issue"
                value={newSubCaseTitle}
                onChange={(e) => setNewSubCaseTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcase-description">Description</Label>
              <Textarea
                id="subcase-description"
                placeholder="Describe the specific issue this sub-case addresses..."
                value={newSubCaseDescription}
                onChange={(e) => setNewSubCaseDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSubCase(false)}>
              Cancel
            </Button>
            <Button
              onClick={createSubCase}
              disabled={!newSubCaseTitle.trim() || creatingSubCase}
            >
              {creatingSubCase ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Sub-case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
