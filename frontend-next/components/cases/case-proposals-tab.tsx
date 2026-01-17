"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  Paperclip,
  User,
  Building2,
  Users,
  RefreshCw,
  Briefcase,
  Calendar,
  Scale,
  Calculator,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { CaseProposalApprovalDialog } from "./case-proposal-approval-dialog";

interface InvolvedParty {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship_type: string;
  is_primary?: boolean;
  contact_exists?: boolean;
  contact_id?: number;
}

interface RelatedJob {
  job_id?: number;
  job_title?: string;
  address_match?: string;
  relevance?: string;
  job_found?: boolean;
}

interface CaseProposal {
  id: number;
  status: "pending" | "approved" | "rejected" | "error";
  created_at: string;
  error_message?: string;
  rejection_reason?: string;
  case_record?: {
    id: number;
    case_number: string;
    title: string;
  };
  email?: {
    id: number;
    from_email: string;
    from_name?: string;
    subject: string;
    has_attachments: boolean;
    attachment_count?: number;
    pdf_count?: number;
    received_at: string;
    conversation_id?: string;
  };
  extracted_data?: {
    case_title?: string;
    case_type?: string;
    description?: string;
    priority?: string;
    urgency?: string;
    confidence_score?: number;
    missing_info?: string[];
    involved_parties?: InvolvedParty[];
    related_jobs?: RelatedJob[];
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
    key_issues?: string[];
  };
  confidence_score?: number;
  case_title?: string;
  case_type?: string;
  priority?: string;
  involved_parties?: InvolvedParty[];
  primary_party?: InvolvedParty;
}

interface CaseProposalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

const CASE_TYPE_LABELS: Record<string, string> = {
  ato_audit: "ATO Audit",
  legal_dispute: "Legal Dispute",
  director_investigation: "Director Investigation",
  compliance_review: "Compliance Review",
  due_diligence: "Due Diligence",
  other: "Other",
};

const RELATIONSHIP_ICONS: Record<string, typeof User> = {
  client: User,
  accountant: Calculator,
  lawyer: Scale,
  previous_accountant: Calculator,
  advisor: Users,
  opposing_party: AlertTriangle,
  witness: User,
  ato_officer: Building2,
  director: Briefcase,
};

export function CaseProposalsTab({ onPendingCountChange }: CaseProposalsTabProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState<CaseProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<CaseProposal | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    loadProposals();
     
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        proposals: CaseProposal[];
        stats: { total: number; pending: number; approved: number; rejected: number };
      }>("/api/v1/email_case_proposals");
      setProposals(response.proposals || []);
      setStats(response.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });

      const pendingCount = response.stats?.pending || 0;
      onPendingCountChange?.(pendingCount);
    } catch (error) {
      console.error("Failed to load case proposals:", error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (proposalId: number) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal) {
      setSelectedProposal(proposal);
      setShowApprovalDialog(true);
    }
  };

  const handleApproveWithEdits = async (proposalId: number, userEdits: Record<string, unknown>) => {
    try {
      setProcessing(proposalId);
      const response = await api.post<{ success: boolean; case: { id: number } }>(
        `/api/v1/email_case_proposals/${proposalId}/approve`,
        { user_edits: userEdits }
      );

      if (response?.success) {
        setShowApprovalDialog(false);
        setSelectedProposal(null);
        loadProposals();

        if (response?.case?.id) {
          router.push(`/cases/${response.case.id}`);
        }
      }
    } catch (error) {
      console.error("Failed to approve proposal:", error);
      alert("Failed to approve proposal");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (proposalId: number) => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;

    try {
      setProcessing(proposalId);
      await api.post(`/api/v1/email_case_proposals/${proposalId}/reject`, {
        reason: reason,
      });
      loadProposals();
    } catch (error) {
      console.error("Failed to reject proposal:", error);
      alert("Failed to reject proposal");
    } finally {
      setProcessing(null);
    }
  };

  const handleReExtract = async (proposalId: number) => {
    if (!confirm("Re-extract data from email thread with latest extraction logic?")) {
      return;
    }

    try {
      setProcessing(proposalId);
      await api.post(`/api/v1/email_case_proposals/${proposalId}/re_extract`);
      loadProposals();
    } catch (error) {
      console.error("Failed to re-extract proposal:", error);
      alert("Failed to re-extract proposal");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { className: string; icon: typeof Clock; label: string }> = {
      pending: {
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        icon: Clock,
        label: "Pending Review",
      },
      approved: {
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircle,
        label: "Approved",
      },
      rejected: {
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: XCircle,
        label: "Rejected",
      },
      error: {
        className: "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground",
        icon: AlertTriangle,
        label: "Error",
      },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <Badge className={badge.className}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  const getConfidenceBadge = (score: number) => {
    const percentage = Math.round(score * 100);
    let className = "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground";

    if (percentage >= 80) {
      className = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    } else if (percentage >= 60) {
      className = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    } else if (percentage >= 30) {
      className = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    } else {
      className = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    }

    return (
      <Badge className={className}>
        <Sparkles className="w-3 h-3 mr-1" />
        {percentage}% confidence
      </Badge>
    );
  };

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const otherProposals = proposals.filter((p) => p.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            AI-generated case proposals from emails sent to{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">newcase@teeem.com.au</code>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProposals}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold font-mono text-yellow-600 mt-1">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <div className="text-2xl font-bold font-mono text-green-600 mt-1">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Rejected</span>
            </div>
            <div className="text-2xl font-bold font-mono text-red-600 mt-1">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Proposals */}
      {pendingProposals.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">
            Pending Review
            {pendingProposals.length > 1 && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({pendingProposals.length} proposals)
              </span>
            )}
          </h3>
          <div className="space-y-4">
            {pendingProposals.map((proposal) => (
              <CaseProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onReExtract={handleReExtract}
                processing={processing}
                getStatusBadge={getStatusBadge}
                getConfidenceBadge={getConfidenceBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Proposals */}
      {otherProposals.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Previous Proposals</h3>
          <div className="space-y-4">
            {otherProposals.map((proposal) => (
              <CaseProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onReExtract={handleReExtract}
                processing={processing}
                getStatusBadge={getStatusBadge}
                getConfidenceBadge={getConfidenceBadge}
                readonly
              />
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium">No case proposals yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Forward emails to newcase@teeem.com.au to create case proposals
          </p>
        </div>
      )}

      {/* Approval Dialog */}
      {showApprovalDialog && selectedProposal && (
        <CaseProposalApprovalDialog
          proposal={selectedProposal}
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          onApprove={handleApproveWithEdits}
          processing={processing === selectedProposal.id}
        />
      )}
    </div>
  );
}

interface CaseProposalCardProps {
  proposal: CaseProposal;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onReExtract: (id: number) => void;
  processing: number | null;
  getStatusBadge: (status: string) => React.ReactNode;
  getConfidenceBadge: (score: number) => React.ReactNode;
  readonly?: boolean;
}

function CaseProposalCard({
  proposal,
  onApprove,
  onReject,
  onReExtract,
  processing,
  getStatusBadge,
  getConfidenceBadge,
  readonly = false,
}: CaseProposalCardProps) {
  const email = proposal.email || { from_email: "", subject: "", has_attachments: false };
  const data = proposal.extracted_data || {};
  const involvedParties = data.involved_parties || [];
  const primaryParty = involvedParties.find((p) => p.is_primary);
  const confidenceScore = proposal.confidence_score || data.confidence_score || 0;

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="text-lg font-medium">
                {proposal.case_title || data.case_title || email.subject || "Untitled Case"}
              </h4>
              {getStatusBadge(proposal.status)}
              {getConfidenceBadge(confidenceScore)}
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground gap-4 flex-wrap">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-1" />
                From: {email.from_email}
              </div>
              {(proposal.case_type || data.case_type) && (
                <Badge variant="outline">
                  {CASE_TYPE_LABELS[proposal.case_type || data.case_type || "other"] || "Other"}
                </Badge>
              )}
              <div>{new Date(proposal.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Actions */}
          {!readonly && proposal.status === "pending" && (
            <div className="ml-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReExtract(proposal.id)}
                disabled={processing === proposal.id}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${processing === proposal.id ? "animate-spin" : ""}`} />
                Re-extract
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => onApprove(proposal.id)}
                disabled={processing === proposal.id}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Edit & Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(proposal.id)}
                disabled={processing === proposal.id}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">{data.description}</p>
          </div>
        )}

        {/* Involved Parties */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Involved Parties</span>
            <Badge variant="secondary" className="text-xs">{involvedParties.length}</Badge>
          </div>
          {involvedParties.length > 0 ? (
            <div className="pl-6 space-y-2">
              {involvedParties.slice(0, 5).map((party, idx) => {
                const Icon = RELATIONSHIP_ICONS[party.relationship_type] || User;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{party.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {party.relationship_type?.replace(/_/g, " ")}
                    </Badge>
                    {party.is_primary && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Primary</Badge>
                    )}
                    {party.contact_exists ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Existing</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800 text-xs">Create New</Badge>
                    )}
                  </div>
                );
              })}
              {involvedParties.length > 5 && (
                <div className="text-sm text-muted-foreground">
                  +{involvedParties.length - 5} more
                </div>
              )}
            </div>
          ) : (
            <div className="pl-6 text-sm text-muted-foreground italic">No parties detected</div>
          )}
        </div>

        {/* Related Jobs */}
        {data.related_jobs && data.related_jobs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Related Jobs</span>
              <Badge variant="secondary" className="text-xs">{data.related_jobs.length}</Badge>
            </div>
            <div className="pl-6 space-y-1">
              {data.related_jobs.map((job, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {job.job_found ? (
                    <>
                      <span className="text-blue-600">Job #{job.job_id}</span>
                      <span className="text-muted-foreground">- {job.job_title}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Address match: {job.address_match}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Dates */}
        {data.key_dates && data.key_dates.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Key Dates</span>
            </div>
            <div className="pl-6 space-y-1">
              {data.key_dates.slice(0, 3).map((date, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{date.date}</span>
                  <span className="text-muted-foreground">- {date.description}</span>
                  {date.is_deadline && (
                    <Badge className="bg-red-100 text-red-800 text-xs">Deadline</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document Requests */}
        {data.document_requests && data.document_requests.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Documents Requested</span>
            </div>
            <ul className="pl-6 list-disc list-inside text-sm text-muted-foreground">
              {data.document_requests.slice(0, 5).map((doc, idx) => (
                <li key={idx}>{doc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing Info Warning */}
        {data.missing_info && data.missing_info.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 text-sm font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              Missing Information
            </div>
            <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-500">
              {data.missing_info.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Attachments */}
        {email.has_attachments && (
          <div className="mt-4 flex items-center gap-1 text-sm text-blue-600">
            <Paperclip className="w-4 h-4" />
            {email.pdf_count && email.attachment_count && email.attachment_count > email.pdf_count
              ? `${email.pdf_count} PDF${email.pdf_count !== 1 ? "s" : ""} / ${email.attachment_count} total`
              : `${email.attachment_count || 1} attachment${(email.attachment_count || 1) !== 1 ? "s" : ""}`}
          </div>
        )}

        {/* Error Message */}
        {proposal.error_message && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md">
            <div className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Error</div>
            <p className="text-sm text-red-700 dark:text-red-500">{proposal.error_message}</p>
          </div>
        )}

        {/* Rejection Reason */}
        {proposal.rejection_reason && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <div className="text-sm font-medium mb-1">Rejection Reason</div>
            <p className="text-sm text-muted-foreground">{proposal.rejection_reason}</p>
          </div>
        )}

        {/* Case Link */}
        {proposal.case_record?.id && (
          <div className="mt-4 pt-4 border-t">
            <a
              href={`/cases/${proposal.case_record.id}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Case {proposal.case_record.case_number}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
