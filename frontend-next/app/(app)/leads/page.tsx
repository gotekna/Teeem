"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadPipeline } from "@/components/leads/lead-pipeline";
import { LeadForm } from "@/components/leads/lead-form";
import { EmailProposalsTab } from "@/components/leads/email-proposals-tab";
import {
  Lead,
  LeadStatus,
  LEAD_STATUS_CONFIG,
  PROJECT_TYPE_LABELS,
} from "@/types/leads";
import { api } from "@/lib/api";
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Mail,
} from "lucide-react";

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "leads";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingProposalCount, setPendingProposalCount] = useState(0);

  const loadLeads = async () => {
    try {
      const response = await api.get<{ leads: Lead[] }>("/api/v1/leads");
      setLeads(response.leads || []);
    } catch (error) {
      console.error("Failed to load leads:", error);
      setLeads([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadLeads();
      setLoading(false);
    };
    load();
  }, []);

  const handleCreateLead = async (data: Partial<Lead>) => {
    try {
      await api.post("/api/v1/leads", data);
      await loadLeads();
    } catch (error) {
      console.error("Failed to create lead:", error);
      // For demo: add to local state
      const newLead: Lead = {
        id: Date.now(),
        lead_number: `LEAD-${new Date().getFullYear()}-${String(leads.length + 1).padStart(3, "0")}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data,
      } as Lead;
      setLeads((prev) => [...prev, newLead]);
    }
  };

  const handleUpdateLead = async (data: Partial<Lead>) => {
    if (!editingLead) return;
    try {
      await api.patch(`/api/v1/leads/${editingLead.id}`, data);
      await loadLeads();
    } catch (error) {
      console.error("Failed to update lead:", error);
      // For demo: update local state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === editingLead.id ? { ...l, ...data, updated_at: new Date().toISOString() } : l
        )
      );
    }
    setEditingLead(null);
  };

  const handleStatusChange = async (leadId: number, newStatus: LeadStatus) => {
    try {
      await api.patch(`/api/v1/leads/${leadId}/status`, { status: newStatus });
      await loadLeads();
    } catch (error) {
      console.error("Failed to update status:", error);
      // For demo: update local state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l
        )
      );
    }
  };

  const handleLeadClick = (lead: Lead) => {
    router.push(`/leads/${lead.id}`);
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.site_suburb.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.lead_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Stats
  const totalValue = leads.reduce((sum, l) => sum + l.estimated_value, 0);
  const activeLeads = leads.filter(
    (l) => !["won", "lost"].includes(l.status)
  ).length;
  const wonLeads = leads.filter((l) => l.status === "won").length;
  const pipelineValue = leads
    .filter((l) => !["won", "lost"].includes(l.status))
    .reduce((sum, l) => sum + l.estimated_value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
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
            Manage your sales pipeline and convert leads to jobs
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
              <Badge
                className="ml-2 bg-yellow-500 text-white hover:bg-yellow-500"
              >
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

          {/* View Toggle & Search */}
          <div className="flex items-center justify-between gap-4">
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
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[250px]"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {viewMode === "pipeline" ? (
            <LeadPipeline
              leads={filteredLeads}
              onLeadClick={handleLeadClick}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-medium hover:underline"
                          >
                            {lead.title}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">
                            {lead.lead_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.client_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{lead.site_suburb}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.site_state} {lead.site_postcode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {PROJECT_TYPE_LABELS[lead.project_type]}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(lead.estimated_value)}
                      </TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leads/${lead.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">No leads found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setFormOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create your first lead
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
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
