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
  MapPin,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";

interface EmailProposal {
  id: number;
  status: "pending" | "approved" | "rejected" | "error";
  created_at: string;
  error_message?: string;
  rejection_reason?: string;
  job_id?: number;
  email?: {
    from_email: string;
    subject: string;
    has_attachments: boolean;
    attachment_count?: number;
    pdf_count?: number;
  };
  extracted_data?: {
    job_title?: string;
    property_address?: string;
    job_type?: string;
    urgency?: string;
    contract_value?: number;
    confidence_score?: number;
    missing_info?: string[];
    description?: string;
    scope_of_work?: string;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      contact_exists?: boolean;
    };
    referral_contact?: {
      name?: string;
      email?: string;
      contact_exists?: boolean;
    };
    external_sales?: Array<{
      name: string;
      email: string;
      contact_exists?: boolean;
    }>;
    internal_sales?: {
      user_name: string;
      user_email: string;
    };
  };
}

interface EmailProposalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export function EmailProposalsTab({ onPendingCountChange }: EmailProposalsTabProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState<EmailProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    loadProposals();
     
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ proposals: EmailProposal[] }>(
        "/api/v1/email_job_proposals?status="
      );
      setProposals(response.proposals || []);

      // Notify parent of pending count
      const pendingCount = (response.proposals || []).filter(p => p.status === "pending").length;
      onPendingCountChange?.(pendingCount);
    } catch (error) {
      console.error("Failed to load proposals:", error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (proposalId: number) => {
    // Navigate to new job page with proposal ID to pre-fill data
    router.push(`/jobs/new?from_proposal=${proposalId}`);
  };

  const handleReject = async (proposalId: number) => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;

    try {
      setProcessing(proposalId);
      await api.post(`/api/v1/email_job_proposals/${proposalId}/reject`, {
        rejection_reason: reason,
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
    if (!confirm("Re-extract data from email and PDFs with latest extraction logic?")) {
      return;
    }

    try {
      setProcessing(proposalId);
      await api.post(`/api/v1/email_job_proposals/${proposalId}/re_extract`);
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
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
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
    let className = "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";

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
            AI-generated job proposals from emails sent to{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">newjob@tekna.com.au</code>
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
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-1">{proposals.length}</div>
          </CardContent>
        </Card>
        <Card className={pendingProposals.length > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold font-mono text-yellow-600 mt-1">
              {pendingProposals.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <div className="text-2xl font-bold font-mono text-green-600 mt-1">
              {proposals.filter((p) => p.status === "approved").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Rejected</span>
            </div>
            <div className="text-2xl font-bold font-mono text-red-600 mt-1">
              {proposals.filter((p) => p.status === "rejected" || p.status === "error").length}
            </div>
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
                (showing latest of {pendingProposals.length})
              </span>
            )}
          </h3>
          <ProposalCard
            proposal={pendingProposals[0]}
            onApprove={handleApprove}
            onReject={handleReject}
            onReExtract={handleReExtract}
            processing={processing}
            getStatusBadge={getStatusBadge}
            getConfidenceBadge={getConfidenceBadge}
          />
        </div>
      )}

      {/* Other Proposals */}
      {otherProposals.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Previous Proposals</h3>
          <div className="space-y-4">
            {otherProposals.map((proposal) => (
              <ProposalCard
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
          <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium">No proposals yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Forward emails to newjob@tekna.com.au to create proposals
          </p>
        </div>
      )}
    </div>
  );
}

interface ProposalCardProps {
  proposal: EmailProposal;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onReExtract: (id: number) => void;
  processing: number | null;
  getStatusBadge: (status: string) => React.ReactNode;
  getConfidenceBadge: (score: number) => React.ReactNode;
  readonly?: boolean;
}

function ProposalCard({
  proposal,
  onApprove,
  onReject,
  onReExtract,
  processing,
  getStatusBadge,
  getConfidenceBadge,
  readonly = false,
}: ProposalCardProps) {
  const email = proposal.email || { from_email: "", subject: "", has_attachments: false };
  const data = proposal.extracted_data || {};
  const customer = data.customer || {};

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="text-lg font-medium">
                {data.job_title || email.subject || "Untitled"}
              </h4>
              {getStatusBadge(proposal.status)}
              {getConfidenceBadge(data.confidence_score || 0)}
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground gap-4 flex-wrap">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-1" />
                From: {email.from_email}
              </div>
              <div>{new Date(proposal.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Actions - show Re-extract for error proposals even in readonly mode */}
          {((!readonly && (proposal.status === "pending" || proposal.status === "error")) ||
            (readonly && proposal.status === "error")) && (
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
              {!readonly && proposal.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onApprove(proposal.id)}
                    disabled={processing === proposal.id}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Review & Create Job
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
                </>
              )}
            </div>
          )}
        </div>

        {/* Client Section */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Client</span>
            <Badge variant="secondary" className="text-xs">
              {customer.name ? "1" : "0"}
            </Badge>
          </div>
          {customer.name ? (
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{customer.name}</span>
                {customer.contact_exists ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    Existing
                  </Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
                    Create New
                  </Badge>
                )}
              </div>
              {customer.email && <div className="ml-6 text-sm text-muted-foreground">{customer.email}</div>}
              {customer.phone && <div className="ml-6 text-sm text-muted-foreground">{customer.phone}</div>}
            </div>
          ) : (
            <div className="pl-6 text-sm text-muted-foreground italic">No client detected</div>
          )}
        </div>

        {/* Job Details */}
        <div className="mt-4 pt-4 border-t">
          <span className="text-sm font-medium">Job Details</span>
          <div className="pl-6 mt-2 space-y-1 text-sm">
            {data.property_address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {data.property_address}
              </div>
            )}
            {data.job_type && (
              <div>
                <span className="text-muted-foreground">Type:</span> {data.job_type}
              </div>
            )}
            {data.urgency && (
              <div>
                <span className="text-muted-foreground">Urgency:</span> {data.urgency}
              </div>
            )}
            {data.contract_value && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                ${data.contract_value.toLocaleString()}
              </div>
            )}
            {email.has_attachments && (
              <div className="flex items-center gap-1 text-blue-600">
                <Paperclip className="w-4 h-4" />
                {email.pdf_count && email.attachment_count && email.attachment_count > email.pdf_count
                  ? `${email.pdf_count} PDF${email.pdf_count !== 1 ? "s" : ""} / ${email.attachment_count} total`
                  : `${email.attachment_count || 1} attachment${(email.attachment_count || 1) !== 1 ? "s" : ""}`}
              </div>
            )}
          </div>
        </div>

        {/* Referral */}
        {data.referral_contact && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Referral</span>
            </div>
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <span className="text-sm">{data.referral_contact.name}</span>
                {data.referral_contact.contact_exists ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">Existing</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800 text-xs">Create New</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* External Sales */}
        {data.external_sales && data.external_sales.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">External Sales</span>
              <Badge variant="secondary" className="text-xs">{data.external_sales.length}</Badge>
            </div>
            <div className="pl-6 space-y-2">
              {data.external_sales.map((sales, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm">{sales.name}</span>
                  {sales.contact_exists ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">Existing</Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-800 text-xs">Create New</Badge>
                  )}
                </div>
              ))}
            </div>
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

        {/* Job Link */}
        {proposal.job_id && (
          <div className="mt-4 pt-4 border-t">
            <a
              href={`/jobs/${proposal.job_id}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Job #{proposal.job_id}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
