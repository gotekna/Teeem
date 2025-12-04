"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
  User,
  Mail,
  Phone,
  Building2,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
  FolderOpen,
  Calculator,
  Scale,
  Briefcase,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";

interface InvolvedParty {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship_type: string;
  is_primary?: boolean;
  contact_exists?: boolean;
  contact_id?: number;
  skip_create?: boolean;
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
  { value: "previous_accountant", label: "Previous Accountant", icon: Calculator, color: "bg-gray-500" },
  { value: "advisor", label: "Advisor", icon: Users, color: "bg-teal-500" },
  { value: "opposing_party", label: "Opposing Party", icon: AlertTriangle, color: "bg-orange-500" },
  { value: "witness", label: "Witness", icon: User, color: "bg-yellow-500" },
  { value: "ato_officer", label: "ATO Officer", icon: Building2, color: "bg-red-500" },
  { value: "director", label: "Director", icon: Briefcase, color: "bg-indigo-500" },
  { value: "shareholder", label: "Shareholder", icon: Users, color: "bg-pink-500" },
  { value: "bank_manager", label: "Bank Manager", icon: Building2, color: "bg-cyan-500" },
  { value: "insurer", label: "Insurer", icon: Building2, color: "bg-emerald-500" },
  { value: "broker", label: "Broker", icon: Users, color: "bg-violet-500" },
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
  const [folderPaths, setFolderPaths] = useState<string[]>(proposal.folder_paths || []);
  const [newFolderPath, setNewFolderPath] = useState("");

  // Reset form when proposal changes
  useEffect(() => {
    const newData = proposal.extracted_data || {};
    setCaseTitle(newData.case_title || "");
    setCaseType(newData.case_type || "other");
    setDescription(newData.description || "");
    setPriority(newData.priority || "medium");
    setParties(newData.involved_parties || []);
    setFolderPaths(proposal.folder_paths || []);
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
      is_primary: false,
      contact_exists: false,
    }]);
  };

  const addFolderPath = () => {
    if (newFolderPath.trim()) {
      setFolderPaths(prev => [...prev, newFolderPath.trim()]);
      setNewFolderPath("");
    }
  };

  const removeFolderPath = (index: number) => {
    setFolderPaths(prev => prev.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    const userEdits = {
      case_title: caseTitle,
      case_type: caseType,
      description,
      priority,
      involved_parties: parties.filter(p => !p.skip_create && p.name.trim()),
      folder_paths: folderPaths,
    };
    await onApprove(proposal.id, userEdits);
  };

  const confidenceScore = proposal.confidence_score || data.confidence_score || 0;
  const confidencePercent = Math.round(confidenceScore * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Review & Approve Case Proposal</span>
            <Badge className={
              confidencePercent >= 80 ? "bg-green-100 text-green-800" :
              confidencePercent >= 60 ? "bg-yellow-100 text-yellow-800" :
              "bg-orange-100 text-orange-800"
            }>
              <Sparkles className="w-3 h-3 mr-1" />
              {confidencePercent}% confidence
            </Badge>
          </DialogTitle>
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
                    <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-500">
                      {data.missing_info.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Folder Paths for Indexing */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Folders to Index (OneDrive paths)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add OneDrive/SharePoint folder paths containing relevant documents to index
                  </p>
                  <div className="space-y-2">
                    {folderPaths.map((path, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input value={path} readOnly className="flex-1 bg-muted" />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFolderPath(idx)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newFolderPath}
                        onChange={(e) => setNewFolderPath(e.target.value)}
                        placeholder="/path/to/folder or OneDrive URL"
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && addFolderPath()}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={addFolderPath}
                        disabled={!newFolderPath.trim()}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
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
              {data.related_jobs && data.related_jobs.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Related Jobs
                    </h4>
                    <div className="space-y-2">
                      {data.related_jobs.map((job, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          {job.job_found ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="font-medium">Job #{job.job_id}</span>
                              <span className="text-muted-foreground">- {job.job_title}</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              <span className="text-muted-foreground">
                                Address match: {job.address_match}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Related Companies */}
              {data.related_companies && data.related_companies.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Related Companies
                    </h4>
                    <div className="space-y-2">
                      {data.related_companies.map((company, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          {company.company_found ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                          <span className="font-medium">{company.name}</span>
                          {company.role && (
                            <Badge variant="outline" className="text-xs">{company.role}</Badge>
                          )}
                          {!company.company_found && (
                            <span className="text-xs text-muted-foreground">(will be created)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Key Dates */}
              {data.key_dates && data.key_dates.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3">Key Dates</h4>
                    <div className="space-y-2">
                      {data.key_dates.map((date, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          <span className="font-mono">{date.date}</span>
                          <span className="text-muted-foreground">- {date.description}</span>
                          {date.is_deadline && (
                            <Badge className="bg-red-100 text-red-800 text-xs">Deadline</Badge>
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
                    <h4 className="font-medium mb-3">Documents Requested</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {data.document_requests.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {!data.related_jobs?.length && !data.related_companies?.length &&
               !data.key_dates?.length && !data.document_requests?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No related items detected</p>
                </div>
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
  );
}

interface PartyEditorProps {
  party: InvolvedParty;
  index: number;
  onChange: (index: number, updates: Partial<InvolvedParty>) => void;
  onRemove: (index: number) => void;
}

function PartyEditor({ party, index, onChange, onRemove }: PartyEditorProps) {
  const relType = RELATIONSHIP_TYPES.find(r => r.value === party.relationship_type);
  const Icon = relType?.icon || User;

  return (
    <Card className={party.skip_create ? "opacity-50" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${relType?.color || "bg-gray-500"}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Fields */}
          <div className="flex-1 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
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
                <Select
                  value={party.relationship_type}
                  onValueChange={(v) => onChange(index, { relationship_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
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
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Existing Contact
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Will create new contact
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
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
