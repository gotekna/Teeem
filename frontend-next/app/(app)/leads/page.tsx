"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobPipeline } from "@/components/leads/job-pipeline";
import {
  PipelineJob,
  PipelineStage,
} from "@/types/leads";
import { api } from "@/lib/api";
import {
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  Mail,
  DollarSign,
} from "lucide-react";

// Email proposal type for pipeline display
export interface EmailProposal {
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

// Pipeline API response type
interface PipelineResponse {
  success: boolean;
  jobs_by_stage: Record<string, PipelineJob[]>;
  stages: Array<{ id: number; name: string; position: number }>;
  meta: {
    total_count: number;
    total_pipeline_value: number;
    won_count: number;
    won_value: number;
    lost_count: number;
  };
}

export default function LeadsPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "leads";

  const [jobsByStage, setJobsByStage] = useState<Record<string, PipelineJob[]>>({});
  const [pipelineMeta, setPipelineMeta] = useState<PipelineResponse["meta"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingProposalCount, setPendingProposalCount] = useState(0);

  const loadPipeline = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<PipelineResponse>("/api/v1/jobs/pipeline");
      setJobsByStage(response.jobs_by_stage || {});
      setPipelineMeta(response.meta || null);
    } catch (error) {
      console.error("Failed to load pipeline:", error);
      setJobsByStage({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadEmailProposals = async () => {
    try {
      const response = await api.get<{ proposals: EmailProposal[] }>(
        "/api/v1/email_job_proposals?status="
      );
      const proposals = response.proposals || [];
      const pendingCount = proposals.filter(p => p.status === "pending").length;
      setPendingProposalCount(pendingCount);
    } catch (error) {
      console.error("Failed to load email proposals:", error);
    }
  };

  useEffect(() => {
    loadPipeline();
    loadEmailProposals();
  }, [loadPipeline]);

  const handleStageChange = async (jobId: number, newStage: PipelineStage) => {
    try {
      await api.patch(`/api/v1/jobs/${jobId}/stage`, { stage: newStage });
      loadPipeline();
    } catch (error) {
      console.error("Failed to update stage:", error);
    }
  };

  const handleMarkAsLost = async (jobId: number) => {
    try {
      await api.patch(`/api/v1/jobs/${jobId}/mark_lost`);
      loadPipeline();
    } catch (error) {
      console.error("Failed to mark job as lost:", error);
    }
  };

  const handleJobClick = (job: PipelineJob) => {
    router.push(`/jobs/${job.id}`);
  };

  const handleNewEnquiry = () => {
    // Navigate to new job form with Enquiry status pre-selected
    router.push("/jobs/new?status=Enquiry");
  };

  const formatCurrency = (value: number | string) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  };

  // Calculate active count (all jobs in pipeline except won/lost)
  const activeCount = Object.entries(jobsByStage)
    .filter(([stage]) => !["won", "lost"].includes(stage))
    .reduce((sum, [, jobs]) => sum + jobs.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Leads & Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your sales pipeline and convert enquiries to jobs
          </p>
        </div>
        <Button onClick={handleNewEnquiry}>
          <Plus className="h-4 w-4 mr-2" />
          New Enquiry
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">
            <TrendingUp className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger
            value="email-leads"
            className="relative"
            onClick={(e) => {
              e.preventDefault();
              router.push("/leads/emails");
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Leads
            {pendingProposalCount > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-white hover:bg-yellow-500">
                {pendingProposalCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="leads" className="mt-6 space-y-6">
          {/* Pipeline View */}
          <JobPipeline
            jobsByStage={jobsByStage}
            onJobClick={handleJobClick}
            onStageChange={handleStageChange}
            onMarkAsLost={handleMarkAsLost}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
