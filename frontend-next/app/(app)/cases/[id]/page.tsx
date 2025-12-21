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
  HelpCircle,
  Star,
  Copy,
  Merge,
  Settings,
  FolderOpen,
  FolderInput,
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

// Import SharePointFolderBrowser (same component used in case proposal approval)
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";

// Import EditCaseContactDialog for editing contact relationships
import { EditCaseContactDialog } from "@/components/cases/EditCaseContactDialog";

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

interface TimelineEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  source: string | null;
  icon: string | null;
  color: string | null;
  metadata: unknown;
  created_at: string;
}

interface CaseContact {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  role: string;
  relationship_type?: string;
  formatted_relationship_type?: string;
  alignment?: string;
  formatted_alignment?: string;
  alignment_color?: string;
  is_primary?: boolean;
  notes: string | null;
  created_at: string;
  reason?: string;
  added_by_name?: string;
  added_at?: string;
  email_count?: number;
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
  inconsistencies: unknown[];
  invoice_variances: number;
  investigation_period: {
    start: string | null;
    end: string | null;
  };
}

interface QAPair {
  id: number;
  question: string;
  answer: string | null;
  question_from: string | null;
  answer_from: string | null;
  question_date: string | null;
  answer_date: string | null;
  is_answered: boolean;
  is_important: boolean;
  category: string | null;
  formatted_category: string | null;
  case_email_id: number | null;
  email_subject: string | null;
  email_short_code: string | null;
  created_at: string;
}

interface ProcessingStatus {
  status: string;
  documents_count: number;
  emails_count: number;
  unanswered_questions_count: number;
  pending_duplicates_count: number;
  source_folder_paths: string[];
  filing_folder_paths: string[];
  file_action: string;
}

interface DuplicateReview {
  id: number;
  status: string;
  resolution: string | null;
  existing_document_id: number;
  existing_title: string | null;
  existing_filename: string | null;
  existing_onedrive_path: string | null;
  existing_file_size: number | null;
  existing_document_date: string | null;
  new_file_path: string | null;
  new_file_name: string | null;
  new_file_hash: string | null;
  new_file_size: number | null;
  source_type: string | null;
  new_document_id: number | null;
  new_document_title: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}


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

  const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = React.useState(false);

  // Source folder picker state for OneDrive (using same pattern as case-proposal-approval-dialog)
  const [showSourceFolderBrowser, setShowSourceFolderBrowser] = React.useState(false);
  const [sourceFolderInputMode, setSourceFolderInputMode] = React.useState<"browse" | "type">("browse");
  const [newSourceFolderPath, setNewSourceFolderPath] = React.useState("");
  const [scanningFolders, setScanningFolders] = React.useState(false);

  // Case folder state
  const [caseFolderInfo, setCaseFolderInfo] = React.useState<{
    has_folder: boolean;
    folder_id?: string;
    folder_name?: string;
    folder_path?: string;
    web_url?: string;
    folder_missing?: boolean;
  } | null>(null);
  const [creatingFolder, setCreatingFolder] = React.useState(false);

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

  const [relationshipGraph, setRelationshipGraph] = React.useState<unknown>(null);
  const [loadingRelationships, setLoadingRelationships] = React.useState(false);

  // Q&A and document processing
  const [qaPairs, setQaPairs] = React.useState<QAPair[]>([]);
  const [loadingQA, setLoadingQA] = React.useState(false);
  const [processingStatus, setProcessingStatus] = React.useState<ProcessingStatus | null>(null);
  const [duplicates, setDuplicates] = React.useState<DuplicateReview[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = React.useState(false);
  const [qaFilter, setQaFilter] = React.useState<"all" | "unanswered" | "important">("all");

  // Folder settings
  const [editingFolders, setEditingFolders] = React.useState(false);
  const [folderSettings, setFolderSettings] = React.useState<{
    source_folder_paths: string[];
    filing_folder_paths: string[];
    file_action: string;
  }>({ source_folder_paths: [], filing_folder_paths: [], file_action: "copy" });
  const [savingFolders, setSavingFolders] = React.useState(false);

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

  // Add contact modal
  const [showAddContact, setShowAddContact] = React.useState(false);
  const [contactSearchQuery, setContactSearchQuery] = React.useState("");
  const [contactSearchResults, setContactSearchResults] = React.useState<Array<{id: number; display_name: string; email: string | null; company_name: string | null}>>([]);
  const [searchingContacts, setSearchingContacts] = React.useState(false);
  const [selectedContactRole, setSelectedContactRole] = React.useState("related_party");
  const [contactReason, setContactReason] = React.useState("");
  const [addingContact, setAddingContact] = React.useState(false);

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
        break;
      case "actions":
        if (actions.length === 0) loadActions();
        break;
      case "documents":
        if (documents.length === 0) loadDocuments();
        if (caseFolderInfo === null) loadCaseFolderInfo();
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
      case "qa":
        if (qaPairs.length === 0) loadQAPairs();
        if (!processingStatus) loadProcessingStatus();
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

  // Handle folder selection from SharePointFolderBrowser (same pattern as case-proposal-approval-dialog)
  const handleSourceFolderSelect = (folder: { id: string; name: string; web_url?: string; child_count: number } | null, path: string) => {
    // Add folder path to source folders if not already present
    if (path && !folderSettings.source_folder_paths.includes(path)) {
      setFolderSettings(prev => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, path]
      }));
    }
  };

  // Add source folder from typed path
  const addSourceFolderFromPath = () => {
    if (newSourceFolderPath.trim() && !folderSettings.source_folder_paths.includes(newSourceFolderPath.trim())) {
      setFolderSettings(prev => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, newSourceFolderPath.trim()]
      }));
      setNewSourceFolderPath("");
    }
  };

  // Scan all selected source folders for documents
  const scanSourceFolders = async () => {
    if (folderSettings.source_folder_paths.length === 0) return;

    setScanningFolders(true);
    try {
      // Call backend to scan folders and link documents
      await api.post(`/api/v1/cases/${caseId}/scan_folders`, {
        folder_paths: folderSettings.source_folder_paths,
      });
      // Refresh documents list after scanning
      await loadDocuments();
    } catch (error) {
      console.error("Failed to scan folders:", error);
    } finally {
      setScanningFolders(false);
    }
  };

  // Load case folder info from OneDrive
  const loadCaseFolderInfo = async () => {
    try {
      const response = await api.get<{ success: boolean; data: typeof caseFolderInfo }>(
        `/api/v1/cases/${caseId}/folder_info`
      );
      setCaseFolderInfo(response.data);
    } catch (error) {
      console.error("Failed to load folder info:", error);
    }
  };

  // Create case folder in OneDrive
  const createCaseFolder = async () => {
    setCreatingFolder(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: { folder_id: string; folder_name: string; folder_path: string; web_url: string };
        message?: string;
      }>(`/api/v1/cases/${caseId}/create_folder`);

      if (response && response.data) {
        setCaseFolderInfo({
          has_folder: true,
          folder_id: response.data.folder_id,
          folder_name: response.data.folder_name,
          folder_path: response.data.folder_path,
          web_url: response.data.web_url,
        });

        toast({
          title: "Success",
          description: response.message || "Case folder created successfully",
        });
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast({
        title: "Error",
        description: "Failed to create case folder. Make sure SharePoint is connected.",
        variant: "destructive",
      });
    } finally {
      setCreatingFolder(false);
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

  // Search contacts for add dialog
  const searchContactsForCase = async (query: string) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }
    try {
      setSearchingContacts(true);
      const response = await api.get<{ contacts?: Array<{id: number; display_name: string; email: string | null; company_name: string | null}> }>("/api/v1/contacts", {
        params: { search: query, per_page: 10 },
      });
      // Filter out contacts already in the case
      const existingIds = contacts.map((c) => c.contact_id);
      const filtered = (response.contacts || []).filter((c) => !existingIds.includes(c.id));
      setContactSearchResults(filtered);
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setSearchingContacts(false);
    }
  };

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (showAddContact && contactSearchQuery.length >= 2) {
        searchContactsForCase(contactSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
     
  }, [contactSearchQuery, showAddContact]);

  // Load entities when Relationships tab is activated
  React.useEffect(() => {
    if (activeTab === "relationships" && contacts.length === 0) {
      loadEntities();
    }
     
  }, [activeTab]);

  // Add contact to case
  const handleAddContactToCase = async (contactId: number) => {
    // Validate reason is provided
    if (!contactReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for adding this contact",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddingContact(true);
      const response = await api.post<{ success: boolean; data: CaseContact }>(
        `/api/v1/cases/${caseId}/add_contact`,
        {
          contact_id: contactId,
          role: selectedContactRole,
          reason: contactReason,
        }
      );
      if (response?.success && response?.data) {
        setContacts([...contacts, response.data]);
        toast({
          title: "Success",
          description: "Contact added to case",
        });
      }
      // Reset dialog state
      setShowAddContact(false);
      setContactSearchQuery("");
      setContactSearchResults([]);
      setSelectedContactRole("related_party");
      setContactReason("");
    } catch (error) {
      console.error("Failed to add contact:", error);
      toast({
        title: "Error",
        description: "Failed to add contact to case",
        variant: "destructive",
      });
    } finally {
      setAddingContact(false);
    }
  };

  // Delete contact from case
  const handleDeleteContact = async (contactId: number, contactName: string) => {
    // Confirm deletion
    if (!confirm(`Remove ${contactName} from this case? This will also remove all emails involving this contact.`)) {
      return;
    }

    try {
      const response = await api.delete<{ success: boolean; message: string }>(
        `/api/v1/cases/${caseId}/contacts/${contactId}`
      );

      if (response?.success) {
        // Remove from local state
        setContacts(contacts.filter(c => c.contact_id !== contactId));
        toast({
          title: "Success",
          description: response.message || "Contact removed from case",
        });
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast({
        title: "Error",
        description: "Failed to remove contact from case",
        variant: "destructive",
      });
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

  const loadQAPairs = async () => {
    try {
      setLoadingQA(true);
      const params = new URLSearchParams();
      if (qaFilter === "unanswered") params.append("answered", "false");
      if (qaFilter === "important") params.append("important", "true");

      const response = await api.get<{ success: boolean; data: QAPair[] }>(
        `/api/v1/cases/${caseId}/qa_pairs?${params.toString()}`
      );
      setQaPairs(response.data || []);
    } catch (error) {
      console.error("Failed to load Q&A pairs:", error);
    } finally {
      setLoadingQA(false);
    }
  };

  const loadProcessingStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: ProcessingStatus }>(
        `/api/v1/cases/${caseId}/processing_status`
      );
      setProcessingStatus(response.data);
    } catch (error) {
      console.error("Failed to load processing status:", error);
    }
  };

  const loadDuplicates = async () => {
    try {
      setLoadingDuplicates(true);
      const response = await api.get<{ success: boolean; data: DuplicateReview[] }>(
        `/api/v1/cases/${caseId}/duplicates?status=pending`
      );
      setDuplicates(response.data || []);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const resolveDuplicate = async (reviewId: number, resolution: string) => {
    try {
      await api.post(`/api/v1/cases/${caseId}/resolve_duplicate`, {
        review_id: reviewId,
        resolution: resolution,
      });
      loadDuplicates();
      loadProcessingStatus();
    } catch (error) {
      console.error("Failed to resolve duplicate:", error);
    }
  };

  const reprocessDocuments = async () => {
    try {
      await api.post(`/api/v1/cases/${caseId}/reprocess_documents`);
      loadProcessingStatus();
    } catch (error) {
      console.error("Failed to reprocess documents:", error);
    }
  };

  const initFolderSettings = () => {
    if (caseData) {
      setFolderSettings({
        source_folder_paths: caseData.source_folder_paths || [],
        filing_folder_paths: caseData.filing_folder_paths || [],
        file_action: caseData.file_action || "copy",
      });
    }
    setEditingFolders(true);
  };

  const saveFolderSettings = async () => {
    try {
      setSavingFolders(true);
      const response = await api.patch<{ success: boolean; data: CaseDetail }>(
        `/api/v1/cases/${caseId}/folder_settings`,
        folderSettings
      );
      if (response?.data) {
        setCaseData(response.data);
      }
      setEditingFolders(false);
    } catch (error) {
      console.error("Failed to save folder settings:", error);
    } finally {
      setSavingFolders(false);
    }
  };

  const addSourceFolder = (path: string) => {
    if (path && !folderSettings.source_folder_paths.includes(path)) {
      setFolderSettings(prev => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, path]
      }));
    }
  };

  const removeSourceFolder = (path: string) => {
    setFolderSettings(prev => ({
      ...prev,
      source_folder_paths: prev.source_folder_paths.filter(p => p !== path)
    }));
  };

  const addFilingFolder = (path: string) => {
    if (path && !folderSettings.filing_folder_paths.includes(path)) {
      setFolderSettings(prev => ({
        ...prev,
        filing_folder_paths: [...prev.filing_folder_paths, path]
      }));
    }
  };

  const removeFilingFolder = (path: string) => {
    setFolderSettings(prev => ({
      ...prev,
      filing_folder_paths: prev.filing_folder_paths.filter(p => p !== path)
    }));
  };

  const toggleQAImportant = async (qaId: number, isImportant: boolean) => {
    try {
      await api.patch(`/api/v1/cases/${caseId}/qa_pairs/${qaId}`, {
        is_important: !isImportant,
      });
      loadQAPairs();
    } catch (error) {
      console.error("Failed to toggle importance:", error);
    }
  };

  const markQAAnswered = async (qaId: number, answer: string) => {
    try {
      await api.patch(`/api/v1/cases/${caseId}/qa_pairs/${qaId}`, {
        is_answered: true,
        answer: answer,
      });
      loadQAPairs();
    } catch (error) {
      console.error("Failed to mark as answered:", error);
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
                        onClick={() => setShowAddContact(true)}
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
          <div className="space-y-4">
            {/* Case Folder Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Case Folder</CardTitle>
                {caseFolderInfo?.has_folder && caseFolderInfo.web_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(caseFolderInfo.web_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in SharePoint
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {caseFolderInfo === null ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : caseFolderInfo.has_folder ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <FolderOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        {caseFolderInfo.folder_path}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Folder created in SharePoint
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FolderInput className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-3">
                      No folder created yet for this case
                    </p>
                    <Button onClick={createCaseFolder} disabled={creatingFolder}>
                      {creatingFolder ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Case Folder
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Creates folder at: Corporate/Case Info/{caseData?.case_number}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source Folders Section - same UI pattern as case-proposal-approval-dialog */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderInput className="h-4 w-4 text-blue-500" />
                  Source Folders
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSourceFolderBrowser(!showSourceFolderBrowser)}
                >
                  {showSourceFolderBrowser ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Close
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Folder
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Folder Browser Panel (when open) */}
                {showSourceFolderBrowser && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    {/* Browse / Type tabs */}
                    <div className="flex rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                          sourceFolderInputMode === "browse"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                        onClick={() => setSourceFolderInputMode("browse")}
                      >
                        <Search className="w-4 h-4" />
                        Browse Folders
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                          sourceFolderInputMode === "type"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                        onClick={() => setSourceFolderInputMode("type")}
                      >
                        <Pencil className="w-4 h-4" />
                        Type Path
                      </button>
                    </div>

                    {sourceFolderInputMode === "browse" ? (
                      <div>
                        <SharePointFolderBrowser
                          onSelect={handleSourceFolderSelect}
                          className="max-h-[300px]"
                        />
                        <div className="flex justify-end pt-2 border-t mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSourceFolderBrowser(false)}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newSourceFolderPath}
                          onChange={(e) => setNewSourceFolderPath(e.target.value)}
                          placeholder="e.g. Corporate/Clients/Smith"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSourceFolderPath.trim()) {
                              addSourceFolderFromPath();
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addSourceFolderFromPath}
                          disabled={!newSourceFolderPath.trim()}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected folders list */}
                {folderSettings.source_folder_paths.length === 0 ? (
                  !showSourceFolderBrowser && (
                    <div className="text-center py-4 text-muted-foreground">
                      <FolderInput className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No source folders selected</p>
                      <p className="text-xs mt-1">Add folders from SharePoint to scan for documents</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    {folderSettings.source_folder_paths.map((path, index) => (
                      <div
                        key={path || `folder-${index}`}
                        className="flex items-center justify-between p-2 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">{path}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSourceFolder(path)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-end mt-3">
                      <Button
                        onClick={scanSourceFolders}
                        disabled={scanningFolders}
                      >
                        {scanningFolders ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Scan Folders
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents List */}
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
                    <p className="text-sm mt-1">Add source folders above to scan for documents</p>
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
                            <span className="font-medium">{doc.filename}</span>
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

          </div>
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
          <div className="space-y-6">
            {/* Folder Settings Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Document Folder Settings
                </CardTitle>
                {!editingFolders ? (
                  <Button variant="outline" size="sm" onClick={initFolderSettings}>
                    Configure Folders
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingFolders(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveFolderSettings} disabled={savingFolders}>
                      {savingFolders && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!editingFolders ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Source Folders</p>
                      {caseData?.source_folder_paths && caseData.source_folder_paths.length > 0 ? (
                        <div className="space-y-1">
                          {caseData.source_folder_paths.map((path, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-blue-500" />
                              <span className="truncate" title={path}>{path.split("/").pop() || path}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Not configured</span>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Filing Folders</p>
                      {caseData?.filing_folder_paths && caseData.filing_folder_paths.length > 0 ? (
                        <div className="space-y-1">
                          {caseData.filing_folder_paths.map((path, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <FolderInput className="h-4 w-4 text-green-500" />
                              <span className="truncate" title={path}>{path.split("/").pop() || path}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Not configured</span>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">File Action</p>
                      <Badge variant="outline">
                        {caseData?.file_action === "move" ? "Move files" : "Copy files"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Source Folders */}
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                        Source Folders
                        <span className="text-muted-foreground font-normal text-xs">(Where to scan for documents)</span>
                      </Label>
                      <div className="space-y-2">
                        {folderSettings.source_folder_paths.map((path, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input value={path} readOnly className="flex-1" />
                            <Button variant="ghost" size="sm" onClick={() => removeSourceFolder(path)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter SharePoint/OneDrive folder path..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                addSourceFolder((e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }}
                            className="flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                            addSourceFolder(input.value);
                            input.value = "";
                          }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Filing Folders */}
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <FolderInput className="h-4 w-4 text-green-500" />
                        Filing Folders
                        <span className="text-muted-foreground font-normal text-xs">(Where to organize case documents)</span>
                      </Label>
                      <div className="space-y-2">
                        {folderSettings.filing_folder_paths.map((path, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input value={path} readOnly className="flex-1" />
                            <Button variant="ghost" size="sm" onClick={() => removeFilingFolder(path)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter SharePoint/OneDrive folder path..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                addFilingFolder((e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }}
                            className="flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                            addFilingFolder(input.value);
                            input.value = "";
                          }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* File Action */}
                    <div>
                      <Label className="mb-2 block">File Action</Label>
                      <Select
                        value={folderSettings.file_action}
                        onValueChange={(v) => setFolderSettings(prev => ({ ...prev, file_action: v }))}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="copy">Copy files (keep originals)</SelectItem>
                          <SelectItem value="move">Move files (remove from source)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {processingStatus && (
              <Card className={cn(
                "border-l-4",
                processingStatus.status === "completed" ? "border-l-green-500" :
                processingStatus.status === "processing" ? "border-l-blue-500" :
                processingStatus.status === "failed" ? "border-l-red-500" : "border-l-gray-300"
              )}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Document Processing Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn(
                          processingStatus.status === "completed" ? "bg-green-100 text-green-700" :
                          processingStatus.status === "processing" ? "bg-blue-100 text-blue-700" :
                          processingStatus.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {processingStatus.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {processingStatus.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {processingStatus.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                          {processingStatus.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {processingStatus.documents_count} docs, {processingStatus.emails_count} emails
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {processingStatus.unanswered_questions_count > 0 && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-600">{processingStatus.unanswered_questions_count}</p>
                          <p className="text-xs text-muted-foreground">Unanswered</p>
                        </div>
                      )}
                      {processingStatus.pending_duplicates_count > 0 && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">{processingStatus.pending_duplicates_count}</p>
                          <p className="text-xs text-muted-foreground">Duplicates</p>
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => reprocessDocuments()}>
                        <RefreshCw className="h-4 w-4 mr-2" />Reprocess
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />Questions & Answers ({qaPairs.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={qaFilter} onValueChange={(v: "all" | "unanswered" | "important") => setQaFilter(v)}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Questions</SelectItem>
                      <SelectItem value="unanswered">Unanswered</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => loadQAPairs()}>
                    <RefreshCw className="h-4 w-4 mr-2" />Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingQA ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : qaPairs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No Q&A pairs extracted yet</p>
                    <p className="text-sm mt-1">Questions will be automatically extracted from case emails</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {qaPairs.map((qa) => (
                      <div key={qa.id} className={cn(
                        "p-4 rounded-lg border",
                        !qa.is_answered && "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
                        qa.is_important && !qa.is_answered && "border-red-300 bg-red-50 dark:bg-red-950/20"
                      )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {qa.is_important && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                              <Badge variant="outline" className="text-xs">{qa.formatted_category || "General"}</Badge>
                              {qa.email_short_code && <span className="text-xs font-mono text-muted-foreground">{qa.email_short_code}</span>}
                              {!qa.is_answered && <Badge className="bg-amber-100 text-amber-700">Unanswered</Badge>}
                            </div>
                            <p className="font-medium">{qa.question}</p>
                            {qa.question_from && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Asked by: {qa.question_from}{qa.question_date && ` on ${format(new Date(qa.question_date), "d MMM yyyy")}`}
                              </p>
                            )}
                            {qa.is_answered && qa.answer && (
                              <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200">
                                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Answer:</p>
                                <p className="text-sm">{qa.answer}</p>
                                {qa.answer_from && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    By: {qa.answer_from}{qa.answer_date && ` on ${format(new Date(qa.answer_date), "d MMM yyyy")}`}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button variant="ghost" size="sm" onClick={() => toggleQAImportant(qa.id, qa.is_important)} className={qa.is_important ? "text-amber-500" : ""}>
                              <Star className={cn("h-4 w-4", qa.is_important && "fill-amber-500")} />
                            </Button>
                            {!qa.is_answered && (
                              <Button variant="ghost" size="sm" onClick={() => markQAAnswered(qa.id, "Marked as answered")}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {processingStatus && processingStatus.pending_duplicates_count > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="h-5 w-5" />Duplicate Documents ({processingStatus.pending_duplicates_count} pending)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => loadDuplicates()}>
                    <RefreshCw className="h-4 w-4 mr-2" />Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingDuplicates ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : duplicates.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>Click Refresh to load pending duplicates</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {duplicates.map((dup) => (
                        <div key={dup.id} className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Existing Document</p>
                                <p className="font-medium">{dup.existing_title || dup.existing_filename}</p>
                                <p className="text-xs text-muted-foreground">{dup.existing_onedrive_path}</p>
                                <p className="text-xs text-muted-foreground">Size: {dup.existing_file_size ? formatFileSize(dup.existing_file_size) : "-"}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">New File</p>
                                <p className="font-medium">{dup.new_file_name}</p>
                                <p className="text-xs text-muted-foreground">{dup.new_file_path}</p>
                                <p className="text-xs text-muted-foreground">Size: {dup.new_file_size ? formatFileSize(dup.new_file_size) : "-"}</p>
                                <Badge variant="outline" className="mt-1">{dup.source_type}</Badge>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button size="sm" variant="outline" onClick={() => resolveDuplicate(dup.id, "keep_existing")}>Keep Existing</Button>
                              <Button size="sm" variant="outline" onClick={() => resolveDuplicate(dup.id, "replace")}>Replace</Button>
                              <Button size="sm" variant="outline" onClick={() => resolveDuplicate(dup.id, "keep_both")}>
                                <Merge className="h-4 w-4 mr-1" />Keep Both
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
                    Click &quot;Auto-Build&quot; to generate a timeline from warehouse data
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {/* Timeline events */}
                  <div className="space-y-6">
                    {timelineEvents.map((event) => (
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
                            {event.metadata && Object.keys(event.metadata).length > 0 ? (
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : null}
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
                {/* Section 1: Case Info & Sub-cases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      <FileText className="h-4 w-4 inline mr-2" />
                      Case & Sub-cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Main Case Info */}
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{caseData?.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {caseData?.case_number} • {caseData?.formatted_case_type}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
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
                              className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
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

                {/* Section 2: Friendly Contacts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-green-600">Friendly</span> Contacts
                      <span className="text-muted-foreground text-sm">
                        ({contacts.filter(c => c.alignment === 'friendly').length})
                      </span>
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowAddContact(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contacts.filter(c => c.alignment === 'friendly').length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No friendly contacts
                      </p>
                    ) : (
                      <div className="divide-y">
                        {contacts.filter(c => c.alignment === 'friendly').map((contact) => (
                          <div key={contact.id} className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-green-100 rounded-full text-green-600">
                                  <User className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{contact.contact_name}</span>
                                    {contact.is_primary && (
                                      <Badge variant="default" className="bg-blue-600">Primary</Badge>
                                    )}
                                    {contact.formatted_alignment && (
                                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                                        {contact.formatted_alignment}
                                      </Badge>
                                    )}
                                    {contact.email_count !== undefined && contact.email_count > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        📧 {contact.email_count}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {contact.contact_email || "No email"}
                                  </p>
                                  {contact.formatted_relationship_type && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {contact.formatted_relationship_type}
                                    </Badge>
                                  )}
                                  {contact.reason && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      <span className="font-semibold">Reason:</span> {contact.reason}
                                    </p>
                                  )}
                                  {contact.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-semibold">Notes:</span> {contact.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/contacts/${contact.contact_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteContact(contact.contact_id, contact.contact_name)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Section 3: Neutral Contacts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-gray-600">Neutral</span> Contacts
                      <span className="text-muted-foreground text-sm">
                        ({contacts.filter(c => !c.alignment || c.alignment === 'neutral').length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts.filter(c => !c.alignment || c.alignment === 'neutral').length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No neutral contacts
                      </p>
                    ) : (
                      <div className="divide-y">
                        {contacts.filter(c => !c.alignment || c.alignment === 'neutral').map((contact) => (
                          <div key={contact.id} className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-gray-100 rounded-full text-gray-600">
                                  <User className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{contact.contact_name}</span>
                                    {contact.is_primary && (
                                      <Badge variant="default" className="bg-blue-600">Primary</Badge>
                                    )}
                                    {contact.email_count !== undefined && contact.email_count > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        📧 {contact.email_count}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {contact.contact_email || "No email"}
                                  </p>
                                  {contact.formatted_relationship_type && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {contact.formatted_relationship_type}
                                    </Badge>
                                  )}
                                  {contact.reason && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      <span className="font-semibold">Reason:</span> {contact.reason}
                                    </p>
                                  )}
                                  {contact.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-semibold">Notes:</span> {contact.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/contacts/${contact.contact_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteContact(contact.contact_id, contact.contact_name)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Section 4: Opposing Contacts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-red-600">Opposing</span> Contacts
                      <span className="text-muted-foreground text-sm">
                        ({contacts.filter(c => c.alignment === 'opposing').length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts.filter(c => c.alignment === 'opposing').length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No opposing contacts
                      </p>
                    ) : (
                      <div className="divide-y">
                        {contacts.filter(c => c.alignment === 'opposing').map((contact) => (
                          <div key={contact.id} className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-red-100 rounded-full text-red-600">
                                  <User className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{contact.contact_name}</span>
                                    {contact.is_primary && (
                                      <Badge variant="default" className="bg-blue-600">Primary</Badge>
                                    )}
                                    {contact.formatted_alignment && (
                                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                                        {contact.formatted_alignment}
                                      </Badge>
                                    )}
                                    {contact.email_count !== undefined && contact.email_count > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        📧 {contact.email_count}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {contact.contact_email || "No email"}
                                  </p>
                                  {contact.formatted_relationship_type && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {contact.formatted_relationship_type}
                                    </Badge>
                                  )}
                                  {contact.reason && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      <span className="font-semibold">Reason:</span> {contact.reason}
                                    </p>
                                  )}
                                  {contact.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-semibold">Notes:</span> {contact.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/contacts/${contact.contact_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteContact(contact.contact_id, contact.contact_name)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
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

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={(open) => {
        setShowAddContact(open);
        if (!open) {
          setContactSearchQuery("");
          setContactSearchResults([]);
          setSelectedContactRole("related_party");
          setContactReason("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Add Contact to Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedContactRole} onValueChange={setSelectedContactRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">Subject</SelectItem>
                  <SelectItem value="witness">Witness</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="opposing_party">Opposing Party</SelectItem>
                  <SelectItem value="related_party">Related Party</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_reason">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="contact_reason"
                placeholder="Why is this contact being added to the case? (e.g., 'Key witness in ATO audit', 'Client's accountant')"
                value={contactReason}
                onChange={(e) => setContactReason(e.target.value)}
                rows={3}
                className={!contactReason.trim() ? "border-red-300" : ""}
              />
              {!contactReason.trim() && (
                <p className="text-xs text-red-500">Reason is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Search Contact</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {searchingContacts && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!searchingContacts && contactSearchQuery.length >= 2 && contactSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No contacts found matching &quot;{contactSearchQuery}&quot;
              </p>
            )}
            {contactSearchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {contactSearchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center justify-between"
                    onClick={() => handleAddContactToCase(contact.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-full text-teal-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{contact.display_name || "No name"}</div>
                        <div className="text-sm text-muted-foreground">
                          {contact.email || "No email"}
                          {contact.company_name && (
                            <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded">
                              {contact.company_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {addingContact && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>
              Cancel
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
            loadEntities();
            loadRelationshipGraph();
          }}
        />
      )}
    </div>
  );
}
