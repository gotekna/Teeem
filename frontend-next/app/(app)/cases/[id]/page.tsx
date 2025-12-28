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
import { useToast } from "@/components/ui/use-toast";
import { BackButton } from "@/components/ui/back-button";
import {
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
  RefreshCw,
  Paperclip,
  User,
  Network,
  FolderTree,
  ChevronRight,
  MessageSquare,
  HelpCircle,
  Star,
  Copy,
  Merge,
  Settings,
  Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Lazy load the EntityChat component
const EntityChat = dynamic(
  () => import("@/components/chat/EntityChat").then(mod => ({ default: mod.EntityChat })),
  { ssr: false }
);

// Import EditCaseContactDialog for editing contact relationships
import { EditCaseContactDialog } from "@/components/cases/EditCaseContactDialog";

// Extracted tab components
import { CaseWarehouseTab } from "@/components/cases/CaseWarehouseTab";
import { CaseTimelineTab } from "@/components/cases/CaseTimelineTab";
import { CaseEntitiesTab } from "@/components/cases/CaseEntitiesTab";
import { CaseQATab } from "@/components/cases/CaseQATab";
import { CaseOverviewTab } from "@/components/cases/CaseOverviewTab";
import { CaseDocumentsTab } from "@/components/cases/CaseDocumentsTab";

// Tabs for case detail
const CASE_TABS = [
  { id: "overview", name: "Overview", icon: Briefcase },
  { id: "subcases", name: "Sub-cases", icon: FolderTree },
  { id: "relationships", name: "Relationships", icon: Network },
  { id: "chat", name: "Chat", icon: MessageSquare },
  { id: "actions", name: "Actions", icon: Play },
  { id: "documents", name: "Documents", icon: FileText },
  { id: "emails", name: "Emails", icon: Mail },
  { id: "qa", name: "Q&A", icon: HelpCircle },
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
  ai_summary: unknown;
  key_findings: unknown[];
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
  // Folder settings
  source_folder_paths: string[];
  filing_folder_paths: string[];
  file_action: string;
}

interface CaseAction {
  id: number;
  action_type: string;
  action_name: string;
  action_description: string;
  status: string;
  query: string | null;
  parameters: unknown;
  results: unknown;
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

// Note: QAPair, ProcessingStatus, DuplicateReview interfaces are in CaseQATab component

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const caseId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [caseData, setCaseData] = React.useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");

  // Tab-specific data
  const [actions, setActions] = React.useState<CaseAction[]>([]);
  const [loadingActions, setLoadingActions] = React.useState(false);

  // Note: Documents state now managed by CaseDocumentsTab component

  const [emails, setEmails] = React.useState<CaseEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = React.useState(false);

  // Contacts for relationships tab (shared with entities tab)
  const [contacts, setContacts] = React.useState<{
    id: number;
    contact_id: number;
    contact_name: string;
    contact_email: string | null;
    role: string;
    relationship_type?: string;
    formatted_relationship_type?: string;
    alignment?: string;
    formatted_alignment?: string;
    is_primary?: boolean;
    notes: string | null;
    reason?: string;
    email_count?: number;
  }[]>([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);

  const [relationshipGraph, setRelationshipGraph] = React.useState<unknown>(null);
  const [loadingRelationships, setLoadingRelationships] = React.useState(false);

  // Note: Folder settings now managed by CaseDocumentsTab component

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

  // Edit case modal
  const [showEditCase, setShowEditCase] = React.useState(false);
  const [editCaseForm, setEditCaseForm] = React.useState({
    title: "",
    description: "",
    case_type: "",
    status: "",
    priority: "",
    deadline: "",
  });
  const [savingCase, setSavingCase] = React.useState(false);

  // Edit contact relationship modal
  const [showEditCaseContact, setShowEditCaseContact] = React.useState(false);
  const [editContactId, setEditContactId] = React.useState<number | null>(null);

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
        if (contacts.length === 0) loadContacts();
        break;
      case "actions":
        if (actions.length === 0) loadActions();
        break;
      // documents tab handles its own data loading via CaseDocumentsTab component
      case "emails":
        if (emails.length === 0) loadEmails();
        break;
      // qa tab handles its own data loading via CaseQATab component
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

  // Note: Document functions (loadDocuments, handleSourceFolderSelect, addSourceFolderFromPath,
  // scanSourceFolders, loadCaseFolderInfo, createCaseFolder) are now in CaseDocumentsTab component

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

  // Load contacts for relationships tab
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = await api.get<{ success: boolean; data: typeof contacts }>(
        `/api/v1/cases/${caseId}/contacts`
      );
      setContacts(response.data || []);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Open edit case modal
  const openEditCase = () => {
    if (!caseData) return;
    setEditCaseForm({
      title: caseData.title || "",
      description: caseData.description || "",
      case_type: caseData.case_type || "",
      status: caseData.status || "",
      priority: caseData.priority || "",
      deadline: caseData.deadline || "",
    });
    setShowEditCase(true);
  };

  // Save case changes
  const handleSaveCase = async () => {
    try {
      setSavingCase(true);
      const response = await api.patch<{ success: boolean; data: CaseDetail }>(
        `/api/v1/cases/${caseId}`,
        { case: editCaseForm }
      );
      if (response?.success && response?.data) {
        setCaseData(response.data);
      }
      setShowEditCase(false);
    } catch (error) {
      console.error("Failed to save case:", error);
    } finally {
      setSavingCase(false);
    }
  };

  // Delete case
  const handleDeleteCase = async () => {
    if (!caseData) return;

    // Confirmation dialog
    const confirmed = confirm(
      `Are you sure you want to delete "${caseData.title}"?\n\nThis action cannot be undone. All case data, documents, emails, and relationships will be permanently deleted.`
    );

    if (!confirmed) return;

    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/cases/${caseId}`
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "Case deleted successfully",
        });
        // Redirect to cases list
        router.push("/cases");
      }
    } catch (error) {
      console.error("Failed to delete case:", error);
      toast({
        title: "Error",
        description: "Failed to delete case",
        variant: "destructive",
      });
    }
  };

  const loadRelationshipGraph = async () => {
    try {
      setLoadingRelationships(true);
      const response = await api.get<{ success: boolean; data: unknown }>(
        `/api/v1/cases/${caseId}/relationship_graph`
      );
      setRelationshipGraph(response.data);
    } catch (error) {
      console.error("Failed to load relationship graph:", error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  // Note: QA functions are in CaseQATab component
  // Note: Folder functions (addSourceFolder, removeSourceFolder) are in CaseDocumentsTab component

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
        <BackButton fallbackHref="/cases" label="Back to Cases" variant="outline" className="mt-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/cases" />
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditCase}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={handleDeleteCase}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button onClick={() => setShowRunAction(true)}>
            <Play className="h-4 w-4 mr-2" />
            Run Action
          </Button>
        </div>
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
          <CaseOverviewTab
            caseData={caseData}
            onCreateSubCase={() => setShowCreateSubCase(true)}
            onViewAllMatters={() => setActiveTab('subcases')}
          />
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
          <div className="space-y-6">
            {loadingRelationships ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Section 1: Case Info & Sub-cases (Full Width) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Case & Sub-cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Main Case Info */}
                    <div className="p-4 bg-blue-50 border-2 border-blue-400 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{caseData?.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {caseData?.case_number} • {caseData?.formatted_case_type}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant={
                              caseData?.status === 'open' ? 'default' :
                              caseData?.status === 'in_progress' ? 'secondary' :
                              caseData?.status === 'closed' ? 'outline' : 'default'
                            }>
                              {caseData?.formatted_status}
                            </Badge>
                            <Badge variant={
                              caseData?.priority === 'urgent' ? 'destructive' :
                              caseData?.priority === 'high' ? 'default' : 'secondary'
                            }>
                              {caseData?.formatted_priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sub-cases */}
                    {caseData?.child_cases && caseData.child_cases.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Sub-cases ({caseData.child_cases.length})</h4>
                        <div className="space-y-2">
                          {caseData.child_cases.map((subCase) => (
                            <div
                              key={subCase.id}
                              className="p-3 border-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => router.push(`/cases/${subCase.id}`)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{subCase.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {subCase.case_number} • {subCase.formatted_case_type}
                                  </p>
                                </div>
                                <Badge variant={subCase.status === 'open' ? 'default' : 'outline'}>
                                  {subCase.formatted_status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Four Column Layout: Client | Advisors | Neutral | Opposing */}
                <div className="grid grid-cols-4 gap-4">
                  {/* Column 1: Client (Primary + Friendly) */}
                  <Card className="border-2 border-blue-300">
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        <span className="text-blue-600">Client</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {contacts.filter(c => c.is_primary && c.alignment === 'friendly').length} contact{contacts.filter(c => c.is_primary && c.alignment === 'friendly').length !== 1 ? 's' : ''}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {contacts.filter(c => c.is_primary && c.alignment === 'friendly').map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 border-2 border-blue-200 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => {
                              setEditContactId(contact.contact_id);
                              setShowEditCaseContact(true);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{contact.contact_name}</p>
                                <Badge className="bg-blue-600 text-xs mt-1">Primary</Badge>
                                {contact.formatted_relationship_type && (
                                  <p className="text-xs font-medium text-blue-700 mt-1">
                                    {contact.formatted_relationship_type}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {contact.contact_email || "No email"}
                                </p>
                                {contact.email_count !== undefined && contact.email_count > 0 && (
                                  <Badge variant="secondary" className="text-sm font-semibold mt-1 px-3 py-1">
                                    📧 {contact.email_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {contacts.filter(c => c.is_primary && c.alignment === 'friendly').length === 0 && (
                          <p className="text-center py-6 text-xs text-muted-foreground">No client</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Column 2: Advisors (Friendly but not Primary) */}
                  <Card className="border-2 border-green-200">
                    <CardHeader className="bg-green-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-green-600" />
                        <span className="text-green-600">Advisors</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {contacts.filter(c => c.alignment === 'friendly' && !c.is_primary).length} contact{contacts.filter(c => c.alignment === 'friendly' && !c.is_primary).length !== 1 ? 's' : ''}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setActiveTab("entities")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Contact
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {contacts.filter(c => c.alignment === 'friendly' && !c.is_primary).map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 border-2 border-green-200 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                            onClick={() => {
                              setEditContactId(contact.contact_id);
                              setShowEditCaseContact(true);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{contact.contact_name}</p>
                                {contact.is_primary && (
                                  <Badge className="bg-blue-600 text-xs mt-1">Primary</Badge>
                                )}
                                {contact.formatted_relationship_type && (
                                  <p className="text-xs font-medium text-green-700 mt-1">
                                    {contact.formatted_relationship_type}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {contact.contact_email || "No email"}
                                </p>
                                {contact.email_count !== undefined && contact.email_count > 0 && (
                                  <Badge variant="secondary" className="text-sm font-semibold mt-1 px-3 py-1">
                                    📧 {contact.email_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {contacts.filter(c => c.alignment === 'friendly' && !c.is_primary).length === 0 && (
                          <p className="text-center py-6 text-xs text-muted-foreground">No advisors</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Column 3: Neutral Contacts */}
                  <Card className="border-2 border-gray-200">
                    <CardHeader className="bg-gray-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-gray-600" />
                        <span className="text-gray-600">Neutral</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {contacts.filter(c => !c.alignment || c.alignment === 'neutral').length} contact{contacts.filter(c => !c.alignment || c.alignment === 'neutral').length !== 1 ? 's' : ''}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {contacts.filter(c => !c.alignment || c.alignment === 'neutral').map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 border-2 border-gray-200 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => {
                              setEditContactId(contact.contact_id);
                              setShowEditCaseContact(true);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-gray-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{contact.contact_name}</p>
                                {contact.formatted_relationship_type && (
                                  <p className="text-xs font-medium text-gray-700 mt-1">
                                    {contact.formatted_relationship_type}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {contact.contact_email || "No email"}
                                </p>
                                {contact.email_count !== undefined && contact.email_count > 0 && (
                                  <Badge variant="secondary" className="text-sm font-semibold mt-1 px-3 py-1">
                                    📧 {contact.email_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {contacts.filter(c => !c.alignment || c.alignment === 'neutral').length === 0 && (
                          <p className="text-center py-6 text-xs text-muted-foreground">No contacts</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Column 4: Opposing Contacts */}
                  <Card className="border-2 border-red-200">
                    <CardHeader className="bg-red-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-red-600" />
                        <span className="text-red-600">Opposing</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {contacts.filter(c => c.alignment === 'opposing').length} contact{contacts.filter(c => c.alignment === 'opposing').length !== 1 ? 's' : ''}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {contacts.filter(c => c.alignment === 'opposing').map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 border-2 border-red-200 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                            onClick={() => {
                              setEditContactId(contact.contact_id);
                              setShowEditCaseContact(true);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-red-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{contact.contact_name}</p>
                                {contact.formatted_relationship_type && (
                                  <p className="text-xs font-medium text-red-700 mt-1">
                                    {contact.formatted_relationship_type}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {contact.contact_email || "No email"}
                                </p>
                                {contact.email_count !== undefined && contact.email_count > 0 && (
                                  <Badge variant="secondary" className="text-sm font-semibold mt-1 px-3 py-1">
                                    📧 {contact.email_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {contacts.filter(c => c.alignment === 'opposing').length === 0 && (
                          <p className="text-center py-6 text-xs text-muted-foreground">No contacts</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
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
                entityName={caseData?.title}
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
                                Query: &quot;{action.query}&quot;
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
                          {action.status === "completed" && action.results ? (
                            <Button variant="outline" size="sm">
                              View Results
                            </Button>
                          ) : null}
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
          <CaseDocumentsTab
            caseId={caseId}
            caseNumber={caseData?.case_number || null}
          />
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

        {activeTab === "qa" && (
          <CaseQATab
            caseId={caseId}
            initialFolderSettings={{
              source_folder_paths: caseData?.source_folder_paths || [],
              filing_folder_paths: caseData?.filing_folder_paths || [],
              file_action: caseData?.file_action || "copy",
            }}
            onFolderSettingsSaved={(settings) => {
              if (caseData) {
                setCaseData({
                  ...caseData,
                  source_folder_paths: settings.source_folder_paths,
                  filing_folder_paths: settings.filing_folder_paths,
                  file_action: settings.file_action,
                });
              }
            }}
          />
        )}

        {activeTab === "timeline" && <CaseTimelineTab caseId={caseId} />}

        {activeTab === "entities" && (
          <CaseEntitiesTab caseId={caseId} caseData={caseData} />
        )}

        {activeTab === "warehouse" && <CaseWarehouseTab caseId={caseId} />}
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
              Create a new sub-case under &quot;{caseData?.title}&quot;. The sub-case will inherit
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

      {/* Edit Case Dialog */}
      <Dialog open={showEditCase} onOpenChange={setShowEditCase}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editCaseForm.title}
                onChange={(e) => setEditCaseForm({...editCaseForm, title: e.target.value})}
                placeholder="Case title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editCaseForm.description}
                onChange={(e) => setEditCaseForm({...editCaseForm, description: e.target.value})}
                placeholder="Case description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Case Type</Label>
                <Select
                  value={editCaseForm.case_type}
                  onValueChange={(value) => setEditCaseForm({...editCaseForm, case_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ato_audit">ATO Audit</SelectItem>
                    <SelectItem value="legal_dispute">Legal Dispute</SelectItem>
                    <SelectItem value="director_investigation">Director Investigation</SelectItem>
                    <SelectItem value="compliance_review">Compliance Review</SelectItem>
                    <SelectItem value="due_diligence">Due Diligence</SelectItem>
                    <SelectItem value="fraud_investigation">Fraud Investigation</SelectItem>
                    <SelectItem value="insolvency">Insolvency</SelectItem>
                    <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editCaseForm.status}
                  onValueChange={(value) => setEditCaseForm({...editCaseForm, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Under Review</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={editCaseForm.priority}
                  onValueChange={(value) => setEditCaseForm({...editCaseForm, priority: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  value={editCaseForm.deadline}
                  onChange={(e) => setEditCaseForm({...editCaseForm, deadline: e.target.value})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCase(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCase} disabled={savingCase || !editCaseForm.title.trim()}>
              {savingCase ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case Contact Relationship Dialog */}
      {editContactId && (
        <EditCaseContactDialog
          open={showEditCaseContact}
          onOpenChange={setShowEditCaseContact}
          caseId={parseInt(caseId)}
          contactId={editContactId}
          onSaved={() => {
            loadContacts();
            loadRelationshipGraph();
          }}
        />
      )}
    </div>
  );
}
