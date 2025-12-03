"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationById } from "@/hooks/useFoundationById";
import { LeadPipeline } from "@/components/leads/lead-pipeline";
import { LeadForm } from "@/components/leads/lead-form";
import { EmailProposalsTab } from "@/components/leads/email-proposals-tab";
import {
  Lead,
  LeadStatus,
} from "@/types/leads";
import { api } from "@/lib/api";
import {
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  Mail,
  DollarSign,
  LayoutGrid,
  List,
} from "lucide-react";
import type { TableRow } from "@/components/table/types";

// Foundation ID for Leads table
const LEADS_FOUNDATION_ID = 455;

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

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "leads";

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationById(LEADS_FOUNDATION_ID);

  const [emailProposals, setEmailProposals] = useState<EmailProposal[]>([]);
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingProposalCount, setPendingProposalCount] = useState(0);

  const loadEmailProposals = async () => {
    try {
      const response = await api.get<{ proposals: EmailProposal[] }>(
        "/api/v1/email_job_proposals?status="
      );
      const proposals = response.proposals || [];
      setEmailProposals(proposals);
      const pendingCount = proposals.filter(p => p.status === "pending").length;
      setPendingProposalCount(pendingCount);
    } catch (error) {
      console.error("Failed to load email proposals:", error);
      setEmailProposals([]);
    }
  };

  useEffect(() => {
    loadEmailProposals();
  }, []);

  const handleCreateLead = async (data: Partial<Lead>) => {
    try {
      await api.post("/api/v1/leads", data);
      refresh();
    } catch (error) {
      console.error("Failed to create lead:", error);
    }
  };

  const handleUpdateLead = async (data: Partial<Lead>) => {
    if (!editingLead) return;
    try {
      await api.patch(`/api/v1/leads/${editingLead.id}`, data);
      refresh();
    } catch (error) {
      console.error("Failed to update lead:", error);
    }
    setEditingLead(null);
  };

  const handleStatusChange = async (leadId: number, newStatus: LeadStatus) => {
    try {
      await api.patch(`/api/v1/leads/${leadId}/status`, { status: newStatus });
      refresh();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  // Handle row click - navigate to lead detail
  const handleRowClick = useCallback((row: TableRow) => {
    router.push(`/leads/${row.id}`);
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/${LEADS_FOUNDATION_ID}/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update lead:", error);
      throw error;
    }
  }, [refresh]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Stats from records
  const totalValue = records.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);
  const activeLeads = records.filter(
    (l) => !["won", "lost"].includes(l.status as string)
  ).length;
  const wonLeads = records.filter((l) => l.status === "won").length;
  const pipelineValue = records
    .filter((l) => !["won", "lost"].includes(l.status as string))
    .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  // Left actions - New Lead button
  const leftActions = (
    <Button onClick={() => setFormOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Lead
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Leads & Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your sales pipeline and convert leads to jobs
            <span className="ml-2 text-xs font-mono">Table #455</span>
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">
            <TrendingUp className="h-4 w-4 mr-2" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="email-proposals" className="relative">
            <Mail className="h-4 w-4 mr-2" />
            Email Proposals
            {pendingProposalCount > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-white hover:bg-yellow-500">
                {pendingProposalCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Pipeline</span>
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatCurrency(pipelineValue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Active Leads</span>
                </div>
                <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                  {activeLeads}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Won</span>
                </div>
                <div className="text-2xl font-bold font-mono text-green-600 mt-1">
                  {wonLeads}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Value</span>
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatCurrency(totalValue)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "pipeline" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("pipeline")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Pipeline
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>

          {/* Content */}
          {viewMode === "pipeline" ? (
            <LeadPipeline
              leads={records as unknown as Lead[]}
              emailProposals={emailProposals.filter(p => p.status === "pending")}
              onLeadClick={(lead) => router.push(`/leads/${lead.id}`)}
              onStatusChange={handleStatusChange}
              onProposalsChange={loadEmailProposals}
              onLeadsChange={refresh}
            />
          ) : (
            <TeeemTableView
              entries={records}
              columns={columns}
              foundationId={String(LEADS_FOUNDATION_ID)}
              foundationIdNumeric={LEADS_FOUNDATION_ID}
              tableName={foundation?.name || "Leads"}
              enableExport={true}
              onRefresh={refresh}
              onRowClick={handleRowClick}
              onRowUpdate={handleRowUpdate}
              leftActions={leftActions}
            />
          )}
        </TabsContent>

        {/* Email Proposals Tab */}
        <TabsContent value="email-proposals" className="mt-6">
          <EmailProposalsTab onPendingCountChange={setPendingProposalCount} />
        </TabsContent>
      </Tabs>

      {/* Lead Form Modal */}
      <LeadForm
        open={formOpen || !!editingLead}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingLead(null);
        }}
        lead={editingLead}
        onSubmit={editingLead ? handleUpdateLead : handleCreateLead}
      />
    </div>
  );
}
