"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
  User,
  UserCheck,
  UserX,
  UserMinus,
  Mail,
  Phone,
  Building2,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
  FolderOpen,
  FolderInput,
  FolderOutput,
  Copy,
  Move,
  Calculator,
  Scale,
  Briefcase,
  Users,
  Search,
  X,
  Pencil,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface InvolvedParty {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship_type: string;
  alignment?: string;
  is_primary?: boolean;
  contact_exists?: boolean;
  contact_id?: number;
  skip_create?: boolean;
  seen_before?: boolean;
  seen_count?: number;
  known_party_id?: number;
}

interface RelatedJob {
  job_id: number;
  job_title?: string;
  address?: string;
  job_found?: boolean;
  address_match?: string;
}

interface RelatedCompany {
  company_id?: number;
  name: string;
  entity_type?: string;
  abn?: string;
  acn?: string;
  company_found?: boolean;
  role?: string;
}

interface CaseProposal {
  id: number;
  status: string;
  extracted_data?: {
    case_title?: string;
    case_type?: string;
    description?: string;
    priority?: string;
    urgency?: string;
    involved_parties?: InvolvedParty[];
    related_jobs?: Array<{
      job_id?: number;
      job_title?: string;
      address_match?: string;
      job_found?: boolean;
    }>;
    related_companies?: Array<{
      name: string;
      company_found?: boolean;
      role?: string;
    }>;
    key_dates?: Array<{
      date: string;
      description: string;
      is_deadline?: boolean;
    }>;
    document_requests?: string[];
    missing_info?: string[];
    confidence_score?: number;
    filing_folder?: string;
  };
  folder_paths?: string[];
  email?: {
    id: number;
    subject: string;
    from_email: string;
    from_name?: string;
    body_text?: string;
    preview_body?: string;
  };
  confidence_score?: number;
}

interface CaseProposalApprovalDialogProps {
  proposal: CaseProposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (proposalId: number, userEdits: Record<string, unknown>) => Promise<void>;
  processing: boolean;
}

const CASE_TYPES = [
  { value: "ato_audit", label: "ATO Audit" },
  { value: "legal_dispute", label: "Legal Dispute" },
  { value: "director_investigation", label: "Director Investigation" },
  { value: "compliance_review", label: "Compliance Review" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "fraud_investigation", label: "Fraud Investigation" },
  { value: "insolvency", label: "Insolvency" },
  { value: "bankruptcy", label: "Bankruptcy" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const RELATIONSHIP_TYPES = [
  { value: "client", label: "Client", icon: User, color: "bg-blue-500" },
  { value: "accountant", label: "Accountant", icon: Calculator, color: "bg-green-500" },
  { value: "lawyer", label: "Lawyer", icon: Scale, color: "bg-purple-500" },
  { value: "previous_accountant", label: "Previous Accountant", icon: Calculator, color: "bg-muted0" },
  { value: "advisor", label: "Advisor", icon: Users, color: "bg-teal-500" },
  { value: "opposing_party", label: "Opposing Party", icon: AlertTriangle, color: "bg-orange-500" },
  { value: "witness", label: "Witness", icon: User, color: "bg-yellow-500" },
  { value: "related_party", label: "Related Party", icon: Users, color: "bg-muted0" },
  { value: "ato_officer", label: "ATO Officer", icon: Building2, color: "bg-red-500" },
  { value: "afsa_officer", label: "AFSA Officer", icon: Building2, color: "bg-red-600" },
  { value: "inspector_general", label: "Inspector-General", icon: Building2, color: "bg-red-700" },
  { value: "trustee", label: "Trustee (Bankruptcy)", icon: Briefcase, color: "bg-amber-600" },
  { value: "director", label: "Director", icon: Briefcase, color: "bg-indigo-500" },
  { value: "shareholder", label: "Shareholder", icon: Users, color: "bg-pink-500" },
  { value: "bank_manager", label: "Bank Manager", icon: Building2, color: "bg-cyan-500" },
  { value: "insurer", label: "Insurer", icon: Building2, color: "bg-emerald-500" },
  { value: "broker", label: "Broker", icon: Users, color: "bg-violet-500" },
  { value: "creditor", label: "Creditor", icon: Building2, color: "bg-orange-600" },
  { value: "debtor", label: "Debtor", icon: User, color: "bg-rose-500" },
];

const ALIGNMENTS = [
  { value: "friendly", label: "Friendly", icon: UserCheck, color: "bg-green-500", textColor: "text-green-700" },
  { value: "neutral", label: "Neutral", icon: UserMinus, color: "bg-muted-foreground", textColor: "text-muted-foreground" },
  { value: "opposing", label: "Opposing", icon: UserX, color: "bg-red-500", textColor: "text-red-700" },
];

export function CaseProposalApprovalDialog({
  proposal,
  open,
  onOpenChange,
  onApprove,
  processing,
}: CaseProposalApprovalDialogProps) {
  const data = proposal.extracted_data || {};

  // Form state
  const [caseTitle, setCaseTitle] = useState(data.case_title || "");
  const [caseType, setCaseType] = useState(data.case_type || "other");
  const [description, setDescription] = useState(data.description || "");
  const [priority, setPriority] = useState(data.priority || "medium");
  const [parties, setParties] = useState<InvolvedParty[]>(data.involved_parties || []);
  const [sourceFolders, setSourceFolders] = useState<string[]>(proposal.folder_paths || []);
  const [newSourceFolder, setNewSourceFolder] = useState("");
  const [filingFolders, setFilingFolders] = useState<string[]>(
    proposal.extracted_data?.filing_folder ? [proposal.extracted_data.filing_folder] : []
  );
  const [fileAction, setFileAction] = useState<"copy" | "move">("copy");

  // Related items state
  const [relatedJobs, setRelatedJobs] = useState<RelatedJob[]>([]);
  const [relatedCompanies, setRelatedCompanies] = useState<RelatedCompany[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [jobSearchResults, setJobSearchResults] = useState<RelatedJob[]>([]);
  const [companySearchResults, setCompanySearchResults] = useState<RelatedCompany[]>([]);
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  // Folder browser state
  const [showSourceFolderBrowser, setShowSourceFolderBrowser] = useState(false);
  const [showFilingFolderBrowser, setShowFilingFolderBrowser] = useState(false);
  const [sourceFolderInputMode, setSourceFolderInputMode] = useState<"browse" | "type">("browse");
  const [filingFolderInputMode, setFilingFolderInputMode] = useState<"browse" | "type">("browse");
  const [newFilingFolder, setNewFilingFolder] = useState("");
  const [sourceFolderFullscreen, setSourceFolderFullscreen] = useState(false);
  const [filingFolderFullscreen, setFilingFolderFullscreen] = useState(false);

  // Reset form when proposal changes
  useEffect(() => {
    const newData = proposal.extracted_data || {};
    setCaseTitle(newData.case_title || "");
    setCaseType(newData.case_type || "other");
    setDescription(newData.description || "");
    setPriority(newData.priority || "medium");
    setParties(newData.involved_parties || []);
    setSourceFolders(proposal.folder_paths || []);
    setFilingFolders(newData.filing_folder ? [newData.filing_folder] : []);
    // Initialize related items from AI extraction
    setRelatedJobs((newData.related_jobs || []).map((j: Record<string, unknown>) => ({
      job_id: j.job_id as number,
      job_title: j.job_title as string,
      job_found: j.job_found as boolean,
      address_match: j.address_match as string,
    })).filter((j: RelatedJob) => j.job_id));
    setRelatedCompanies((newData.related_companies || []).map((c: Record<string, unknown>) => ({
      company_id: c.company_id as number,
      name: c.name as string,
      company_found: c.company_found as boolean,
      role: c.role as string,
    })));
  }, [proposal]);

  const updateParty = (index: number, updates: Partial<InvolvedParty>) => {
    setParties(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const removeParty = (index: number) => {
    setParties(prev => prev.filter((_, i) => i !== index));
  };

  const addParty = () => {
    setParties(prev => [...prev, {
      name: "",
      email: "",
      phone: "",
      company: "",
      relationship_type: "client",
      alignment: "neutral",
      is_primary: false,
      contact_exists: false,
    }]);
  };

  const addSourceFolder = () => {
    if (newSourceFolder.trim()) {
      setSourceFolders(prev => [...prev, newSourceFolder.trim()]);
      setNewSourceFolder("");
    }
  };

  const removeSourceFolder = (index: number) => {
    setSourceFolders(prev => prev.filter((_, i) => i !== index));
  };

  const addFilingFolder = () => {
    if (newFilingFolder.trim() && !filingFolders.includes(newFilingFolder.trim())) {
      setFilingFolders(prev => [...prev, newFilingFolder.trim()]);
      setNewFilingFolder("");
    }
  };

  const removeFilingFolder = (index: number) => {
    setFilingFolders(prev => prev.filter((_, i) => i !== index));
  };

  // Search for jobs
  const searchJobs = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setJobSearchResults([]);
      return;
    }
    setSearchingJobs(true);
    try {
      const response = await api.get<{ jobs?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(`/jobs?search=${encodeURIComponent(query)}&limit=10`);
      const responseData = response as { jobs?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const jobsArray = Array.isArray(responseData) ? responseData : (responseData.jobs || []);
      const jobs: RelatedJob[] = jobsArray.map((j: Record<string, unknown>) => ({
        job_id: j.id as number,
        job_title: (j.title || j.name) as string | undefined,
        address: j.address as string | undefined,
        job_found: true,
      }));
      setJobSearchResults(jobs);
    } catch (error) {
      console.error("Error searching jobs:", error);
      setJobSearchResults([]);
    } finally {
      setSearchingJobs(false);
    }
  };

  // Search for companies
  const searchCompanies = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setCompanySearchResults([]);
      return;
    }
    setSearchingCompanies(true);
    try {
      const response = await api.get<{ companies?: Array<Record<string, unknown>> }>(`/companies?search=${encodeURIComponent(query)}&limit=10`);
      const responseData = response as { companies?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const companiesArray = Array.isArray(responseData) ? responseData : (responseData.companies || []);
      const companies: RelatedCompany[] = companiesArray.map((c: Record<string, unknown>) => ({
        company_id: c.id as number | undefined,
        name: c.name as string,
        entity_type: c.entity_type as string | undefined,
        abn: c.abn as string | undefined,
        acn: c.acn as string | undefined,
        company_found: true,
      }));
      setCompanySearchResults(companies);
    } catch (error) {
      console.error("Error searching companies:", error);
      setCompanySearchResults([]);
    } finally {
      setSearchingCompanies(false);
    }
  };

  // Add job to related items
  const addRelatedJob = (job: RelatedJob) => {
    if (!relatedJobs.find(j => j.job_id === job.job_id)) {
      setRelatedJobs(prev => [...prev, job]);
    }
    setJobSearch("");
    setJobSearchResults([]);
  };

  // Remove job from related items
  const removeRelatedJob = (jobId: number) => {
    setRelatedJobs(prev => prev.filter(j => j.job_id !== jobId));
  };

  // Add company to related items
  const addRelatedCompany = (company: RelatedCompany) => {
    if (company.company_id && !relatedCompanies.find(c => c.company_id === company.company_id)) {
      setRelatedCompanies(prev => [...prev, company]);
    } else if (!company.company_id) {
      // New company to create
      setRelatedCompanies(prev => [...prev, company]);
    }
    setCompanySearch("");
    setCompanySearchResults([]);
  };

  // Remove company from related items
  const removeRelatedCompany = (index: number) => {
    setRelatedCompanies(prev => prev.filter((_, i) => i !== index));
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (jobSearch) searchJobs(jobSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [jobSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearch) searchCompanies(companySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  const handleApprove = async () => {
    const userEdits = {
      case_title: caseTitle,
      case_type: caseType,
      description,
      priority,
      involved_parties: parties.filter(p => !p.skip_create && p.name.trim()),
      source_folders: sourceFolders,
      filing_folders: filingFolders,
      file_action: fileAction,
      job_ids: relatedJobs.map(j => j.job_id),
      company_ids: relatedCompanies.filter(c => c.company_id).map(c => c.company_id),
      new_companies: relatedCompanies.filter(c => !c.company_id),
    };
    await onApprove(proposal.id, userEdits);
  };

  const confidenceScore = proposal.confidence_score || data.confidence_score || 0;
  const confidencePercent = Math.round(confidenceScore * 100);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={
        (sourceFolderFullscreen || filingFolderFullscreen)
          ? "!fixed !inset-4 !max-w-none !max-h-none !w-[calc(100vw-2rem)] !h-[calc(100vh-2rem)] !translate-x-0 !translate-y-0 !top-4 !left-4 overflow-hidden flex flex-col z-[100] bg-background border rounded-lg shadow-lg"
          : "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      }>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Review & Approve Case Proposal</span>
            <Badge className={
              confidencePercent >= 80 ? "bg-status-success text-status-success-foreground" :
              confidencePercent >= 60 ? "bg-status-warning text-status-warning-foreground" :
              "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
            }>
              <Sparkles className="w-3 h-3 mr-1" />
              {confidencePercent}% confidence
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review AI-extracted case information and approve to create the case
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Case Details</TabsTrigger>
            <TabsTrigger value="parties">
              Parties
              <Badge variant="secondary" className="ml-1 text-xs">
                {parties.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="related">Related Items</TabsTrigger>
            <TabsTrigger value="email">Original Email</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4 mt-4">
            {/* Case Details Tab */}
            <TabsContent value="details" className="space-y-4 m-0">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="caseTitle">Case Title</Label>
                  <Input
                    id="caseTitle"
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value)}
                    placeholder="Enter case title..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="caseType">Case Type</Label>
                    <Select value={caseType} onValueChange={setCaseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CASE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter case description..."
                    rows={4}
                  />
                </div>

                {/* Missing Info Warning */}
                {data.missing_info && data.missing_info.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 text-sm font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      AI flagged missing information
                    </div>
                    <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400">
                      {data.missing_info.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Source Folders - where documents currently are */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <FolderInput className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    Source Folders (where documents are now)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    OneDrive/SharePoint folders containing existing case documents to index
                  </p>

                  {/* Selected source folders */}
                  {sourceFolders.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {sourceFolders.map((path, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <FolderOpen className="w-4 h-4 text-amber-500" />
                          <span className="flex-1 text-sm truncate">{path}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeSourceFolder(idx)}
                          >
                            <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Folder browser or input toggle */}
                  {showSourceFolderBrowser ? (
                    <div className={sourceFolderFullscreen
                      ? "flex-1 min-h-0 flex flex-col space-y-4"
                      : "border rounded-lg p-4 space-y-4"
                    }>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Select Source Folder</h4>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSourceFolderFullscreen(!sourceFolderFullscreen)}
                            title={sourceFolderFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          >
                            {sourceFolderFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowSourceFolderBrowser(false);
                              setSourceFolderFullscreen(false);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

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
                        <div className={sourceFolderFullscreen ? "flex-1 min-h-0 flex flex-col" : ""}>
                          <SharePointFolderBrowser
                            onSelect={(folder, path) => {
                              if (path && !sourceFolders.includes(path)) {
                                setSourceFolders(prev => [...prev, path]);
                              }
                            }}
                            className={sourceFolderFullscreen ? "flex-1 min-h-0" : "max-h-[250px]"}
                          />
                          <div className="flex justify-between items-center pt-2 border-t shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSourceFolderFullscreen(!sourceFolderFullscreen)}
                            >
                              {sourceFolderFullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                              {sourceFolderFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowSourceFolderBrowser(false);
                                setSourceFolderFullscreen(false);
                              }}
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newSourceFolder}
                            onChange={(e) => setNewSourceFolder(e.target.value)}
                            placeholder="e.g. /Clients/Smith"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newSourceFolder.trim()) {
                                addSourceFolder();
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addSourceFolder}
                            disabled={!newSourceFolder.trim()}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowSourceFolderBrowser(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Source Folder
                    </Button>
                  )}
                </div>

                {/* Filing Folders - where to save new documents */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <FolderOutput className="w-4 h-4 text-green-500 dark:text-green-400" />
                    Filing Folders (where to save case documents)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    New documents will be saved to these locations. Add multiple if documents need to be filed in different places.
                  </p>

                  {/* Selected filing folders */}
                  {filingFolders.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {filingFolders.map((path, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                          <FolderOpen className="w-4 h-4 text-green-500 dark:text-green-400" />
                          <span className="flex-1 text-sm truncate">{path}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFilingFolder(idx)}
                          >
                            <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Folder browser or input toggle */}
                  {showFilingFolderBrowser ? (
                    <div className={filingFolderFullscreen
                      ? "flex-1 min-h-0 flex flex-col space-y-4"
                      : "border rounded-lg p-4 space-y-4"
                    }>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Select Filing Folder</h4>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilingFolderFullscreen(!filingFolderFullscreen)}
                            title={filingFolderFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          >
                            {filingFolderFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowFilingFolderBrowser(false);
                              setFilingFolderFullscreen(false);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Browse / Type tabs */}
                      <div className="flex rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                            filingFolderInputMode === "browse"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          onClick={() => setFilingFolderInputMode("browse")}
                        >
                          <Search className="w-4 h-4" />
                          Browse Folders
                        </button>
                        <button
                          type="button"
                          className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                            filingFolderInputMode === "type"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          onClick={() => setFilingFolderInputMode("type")}
                        >
                          <Pencil className="w-4 h-4" />
                          Type Path
                        </button>
                      </div>

                      {filingFolderInputMode === "browse" ? (
                        <div className={filingFolderFullscreen ? "flex-1 min-h-0 flex flex-col" : ""}>
                          <SharePointFolderBrowser
                            onSelect={(folder, path) => {
                              if (path && !filingFolders.includes(path)) {
                                setFilingFolders(prev => [...prev, path]);
                              }
                            }}
                            className={filingFolderFullscreen ? "flex-1 min-h-0" : "max-h-[250px]"}
                          />
                          <div className="flex justify-between items-center pt-2 border-t shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFilingFolderFullscreen(!filingFolderFullscreen)}
                            >
                              {filingFolderFullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                              {filingFolderFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowFilingFolderBrowser(false);
                                setFilingFolderFullscreen(false);
                              }}
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newFilingFolder}
                            onChange={(e) => setNewFilingFolder(e.target.value)}
                            placeholder="e.g. /Cases/Smith ATO Audit 2025"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newFilingFolder.trim()) {
                                addFilingFolder();
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addFilingFolder}
                            disabled={!newFilingFolder.trim()}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowFilingFolderBrowser(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Filing Folder
                    </Button>
                  )}
                </div>

                {/* Copy or Move toggle */}
                {sourceFolders.length > 0 && filingFolders.length > 0 && (
                  <div className="grid gap-2">
                    <Label className="text-sm">File Action</Label>
                    <p className="text-xs text-muted-foreground">
                      What to do with files from source folders
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={fileAction === "copy" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFileAction("copy")}
                        className={fileAction === "copy" ? "bg-blue-600 hover:bg-blue-700" : ""}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Files
                      </Button>
                      <Button
                        type="button"
                        variant={fileAction === "move" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFileAction("move")}
                        className={fileAction === "move" ? "bg-amber-600 hover:bg-amber-700" : ""}
                      >
                        <Move className="w-4 h-4 mr-1" />
                        Move Files
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fileAction === "copy"
                        ? "Files will be copied to the filing folder (originals remain in source)"
                        : "Files will be moved to the filing folder (removed from source)"}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Parties Tab */}
            <TabsContent value="parties" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Review and edit involved parties. These will be created as contacts linked to the case.
                </p>
                <Button variant="outline" size="sm" onClick={addParty}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Party
                </Button>
              </div>

              <div className="space-y-3">
                {parties.map((party, idx) => (
                  <PartyEditor
                    key={idx}
                    party={party}
                    index={idx}
                    onChange={updateParty}
                    onRemove={removeParty}
                  />
                ))}
                {parties.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No involved parties detected</p>
                    <Button variant="link" onClick={addParty}>
                      Add a party manually
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Related Items Tab */}
            <TabsContent value="related" className="space-y-4 m-0">
              {/* Related Jobs */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Related Jobs
                  </h4>

                  {/* Added jobs */}
                  {relatedJobs.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {relatedJobs.map((job) => (
                        <div key={job.job_id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                          <span className="font-medium">Job #{job.job_id}</span>
                          <span className="text-muted-foreground flex-1">- {job.job_title}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeRelatedJob(job.job_id)}
                          >
                            <X className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Job search */}
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={jobSearch}
                          onChange={(e) => setJobSearch(e.target.value)}
                          placeholder="Search jobs by name or address..."
                          className="pl-8"
                        />
                        {searchingJobs && (
                          <Spinner size={16} className="absolute right-2 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </div>

                    {/* Search results dropdown */}
                    {jobSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                        {jobSearchResults.map((job) => (
                          <button
                            key={job.job_id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                            onClick={() => addRelatedJob(job)}
                          >
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">#{job.job_id}</span>
                            <span className="text-muted-foreground truncate">{job.job_title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {relatedJobs.length === 0 && !jobSearch && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Search and add jobs related to this case
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Related Companies/Trusts */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Related Companies & Trusts
                  </h4>

                  {/* Added companies */}
                  {relatedCompanies.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {relatedCompanies.map((company, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          {company.company_found ? (
                            <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                          )}
                          <span className="font-medium">{company.name}</span>
                          {company.entity_type && (
                            <Badge variant="outline" className="text-xs">{company.entity_type}</Badge>
                          )}
                          {company.role && (
                            <Badge variant="secondary" className="text-xs">{company.role}</Badge>
                          )}
                          {!company.company_found && (
                            <span className="text-xs text-muted-foreground">(will be created)</span>
                          )}
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeRelatedCompany(idx)}
                          >
                            <X className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Company search */}
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          placeholder="Search companies, trusts by name or ABN..."
                          className="pl-8"
                        />
                        {searchingCompanies && (
                          <Spinner size={16} className="absolute right-2 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </div>

                    {/* Search results dropdown */}
                    {companySearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                        {companySearchResults.map((company) => (
                          <button
                            key={company.company_id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                            onClick={() => addRelatedCompany(company)}
                          >
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{company.name}</span>
                            {company.entity_type && (
                              <Badge variant="outline" className="text-xs">{company.entity_type}</Badge>
                            )}
                            {company.abn && (
                              <span className="text-xs text-muted-foreground">ABN: {company.abn}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Option to create new */}
                    {companySearch.length >= 2 && !searchingCompanies && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => addRelatedCompany({
                          name: companySearch,
                          company_found: false,
                          role: 'subject'
                        })}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create new: "{companySearch}"
                      </Button>
                    )}
                  </div>

                  {relatedCompanies.length === 0 && !companySearch && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Search and add companies or trusts related to this case
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Key Dates */}
              {data.key_dates && data.key_dates.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium mb-3">Key Dates</h4>
                    <div className="space-y-2">
                      {data.key_dates.map((date, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          <span className="font-mono">{date.date}</span>
                          <span className="text-muted-foreground">- {date.description}</span>
                          {date.is_deadline && (
                            <Badge className="bg-status-error text-status-error-foreground text-xs">Deadline</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Requests */}
              {data.document_requests && data.document_requests.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium mb-3">Documents Requested</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {data.document_requests.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="space-y-4 m-0">
              {proposal.email && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <p className="font-medium">{proposal.email.subject}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <p>{proposal.email.from_name || proposal.email.from_email}</p>
                        {proposal.email.from_name && (
                          <p className="text-sm text-muted-foreground">{proposal.email.from_email}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Body Preview</Label>
                        <pre className="mt-2 p-3 bg-muted rounded text-sm whitespace-pre-wrap font-sans max-h-[300px] overflow-auto">
                          {proposal.email.preview_body || proposal.email.body_text || "No body content"}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={processing || !caseTitle.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {processing ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Create Case
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  );
}

interface PartyEditorProps {
  party: InvolvedParty;
  index: number;
  onChange: (index: number, updates: Partial<InvolvedParty>) => void;
  onRemove: (index: number) => void;
}

function PartyEditor({ party, index, onChange, onRemove }: PartyEditorProps) {
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const relType = RELATIONSHIP_TYPES.find(r => r.value === party.relationship_type);
  const alignmentType = ALIGNMENTS.find(a => a.value === party.alignment) || ALIGNMENTS[1]; // default neutral
  const AlignmentIcon = alignmentType.icon;
  const RelIcon = relType?.icon || User;

  return (
    <Card className={party.skip_create ? "opacity-50" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Icon - shows alignment */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${alignmentType.color}`}>
            <AlignmentIcon className="w-5 h-5" />
          </div>

          {/* Fields */}
          <div className="flex-1 grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={party.name}
                  onChange={(e) => onChange(index, { name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Relationship</Label>
                <Popover open={relationshipOpen} onOpenChange={setRelationshipOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={relationshipOpen}
                      className="justify-between font-normal"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <RelIcon className="w-3 h-3 shrink-0" />
                        {relType?.label || "Select..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search relationship..." />
                      <CommandList>
                        <CommandEmpty>No relationship found.</CommandEmpty>
                        <CommandGroup>
                          {RELATIONSHIP_TYPES.map((type) => {
                            const TypeIcon = type.icon;
                            return (
                              <CommandItem
                                key={type.value}
                                value={type.label}
                                onSelect={() => {
                                  onChange(index, { relationship_type: type.value });
                                  setRelationshipOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${party.relationship_type === type.value ? "opacity-100" : "opacity-0"}`}
                                />
                                <TypeIcon className="mr-2 h-4 w-4" />
                                {type.label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={party.alignment || "neutral"}
                  onValueChange={(v) => onChange(index, { alignment: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALIGNMENTS.map((align) => (
                      <SelectItem key={align.value} value={align.value}>
                        <span className={align.textColor}>{align.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input
                  value={party.email || ""}
                  onChange={(e) => onChange(index, { email: e.target.value })}
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </Label>
                <Input
                  value={party.phone || ""}
                  onChange={(e) => onChange(index, { phone: e.target.value })}
                  placeholder="0412 345 678"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Company
                </Label>
                <Input
                  value={party.company || ""}
                  onChange={(e) => onChange(index, { company: e.target.value })}
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`primary-${index}`}
                  checked={party.is_primary}
                  onCheckedChange={(checked) => onChange(index, { is_primary: !!checked })}
                />
                <Label htmlFor={`primary-${index}`} className="text-xs">
                  Primary contact
                </Label>
              </div>

              {party.contact_exists ? (
                <Badge className="bg-status-success text-status-success-foreground text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Existing Contact
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Will create new contact
                </Badge>
              )}

              {party.company && !party.contact_exists && (
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  + Company
                </Badge>
              )}

              {party.seen_before && (
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs" title={`Seen in ${party.seen_count} previous case${party.seen_count === 1 ? '' : 's'}`}>
                  <User className="w-3 h-3 mr-1" />
                  Seen {party.seen_count}x
                </Badge>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Checkbox
                  id={`skip-${index}`}
                  checked={party.skip_create}
                  onCheckedChange={(checked) => onChange(index, { skip_create: !!checked })}
                />
                <Label htmlFor={`skip-${index}`} className="text-xs text-muted-foreground">
                  Skip
                </Label>
              </div>
            </div>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-red-500 dark:text-red-400 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
