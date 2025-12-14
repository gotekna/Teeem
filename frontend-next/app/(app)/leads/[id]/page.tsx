"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadForm } from "@/components/leads/lead-form";
import { GenerateContractModal } from "@/components/contracts/generate-contract-modal";
import {
  Lead,
  PROJECT_TYPE_LABELS,
  DWELLING_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
} from "@/types/leads";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Edit,
  FileText,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  DollarSign,
  User,
  Briefcase,
  Clock,
  FileSignature,
} from "lucide-react";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  const loadLead = async () => {
    try {
      const response = await api.get<Lead>(`/api/v1/leads/${leadId}`);
      setLead(response);
    } catch (error) {
      console.error("Failed to load lead:", error);
      // Mock data for development
      setLead(getMockLead(parseInt(leadId)));
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadLead();
      setLoading(false);
    };
    load();
     
  }, [leadId]);

  const handleUpdateLead = async (data: Partial<Lead>) => {
    try {
      await api.patch(`/api/v1/leads/${leadId}`, data);
      await loadLead();
    } catch (error) {
      console.error("Failed to update lead:", error);
      // For demo: update local state
      if (lead) {
        setLead({ ...lead, ...data, updated_at: new Date().toISOString() });
      }
    }
  };

  const handleConvertToJob = async () => {
    try {
      const response = await api.post<{ job_id: number }>(
        `/api/v1/leads/${leadId}/convert`
      );
      if (response?.job_id) {
        router.push(`/jobs/${response.job_id}`);
      }
    } catch (error) {
      console.error("Failed to convert lead:", error);
      alert("Failed to convert lead to job. Please try again.");
    }
  };

  const handleGenerateContract = () => {
    setContractModalOpen(true);
  };

  const handleContractGenerated = () => {
    // Reload lead to get updated status/contract info
    loadLead();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Lead not found</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/leads">Back to Leads</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {lead.title}
              </h1>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {lead.lead_number}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditFormOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {lead.status === "won" && lead.job_id ? (
            <Button asChild>
              <Link href={`/jobs/${lead.job_id}`}>
                <Briefcase className="h-4 w-4 mr-2" />
                View Job
              </Link>
            </Button>
          ) : lead.status === "contract_sent" ? (
            <Button onClick={handleConvertToJob}>
              <Briefcase className="h-4 w-4 mr-2" />
              Convert to Job
            </Button>
          ) : (
            <Button onClick={handleGenerateContract}>
              <FileSignature className="h-4 w-4 mr-2" />
              Generate Contract
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Estimated Value</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-1">
              {formatCurrency(lead.estimated_value)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building className="h-4 w-4" />
              <span className="text-xs">Project Type</span>
            </div>
            <div className="text-lg font-medium mt-1">
              {PROJECT_TYPE_LABELS[lead.project_type]}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Expected Start</span>
            </div>
            <div className="text-lg font-medium mt-1">
              {formatDate(lead.expected_start_date)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Created</span>
            </div>
            <div className="text-lg font-medium mt-1">
              {formatDate(lead.created_at)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column - Details */}
            <div className="md:col-span-2 space-y-6">
              {/* Client Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{lead.client_name}</p>
                  </div>
                  {lead.client_company && (
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="font-medium">{lead.client_company}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a
                      href={`mailto:${lead.client_email}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      {lead.client_email}
                    </a>
                  </div>
                  {lead.client_phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <a
                        href={`tel:${lead.client_phone}`}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.client_phone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Site Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Site Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{lead.site_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {lead.site_suburb}, {lead.site_state} {lead.site_postcode}
                    </p>
                  </div>
                  {lead.lot_plan_number && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Lot/Plan Number
                      </p>
                      <p className="font-medium font-mono">
                        {lead.lot_plan_number}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Building Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Building Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Project Type</p>
                    <p className="font-medium">
                      {PROJECT_TYPE_LABELS[lead.project_type]}
                    </p>
                  </div>
                  {lead.dwelling_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Dwelling Type
                      </p>
                      <p className="font-medium">
                        {DWELLING_TYPE_LABELS[lead.dwelling_type]}
                      </p>
                    </div>
                  )}
                  {lead.number_of_storeys && (
                    <div>
                      <p className="text-xs text-muted-foreground">Storeys</p>
                      <p className="font-medium">{lead.number_of_storeys}</p>
                    </div>
                  )}
                  {lead.estimated_floor_area && (
                    <div>
                      <p className="text-xs text-muted-foreground">Floor Area</p>
                      <p className="font-medium">
                        {lead.estimated_floor_area} m²
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {lead.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Quick Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lead Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">
                      {lead.source
                        ? LEAD_SOURCE_LABELS[lead.source]
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Decision Timeline
                    </p>
                    <p className="font-medium">
                      {lead.decision_timeline
                        ? lead.decision_timeline.replace(/_/g, " ")
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{formatDate(lead.updated_at)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleGenerateContract}
                  >
                    <FileSignature className="h-4 w-4 mr-2" />
                    Generate Contract
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    asChild
                  >
                    <a href={`mailto:${lead.client_email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </a>
                  </Button>
                  {lead.client_phone && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      asChild
                    >
                      <a href={`tel:${lead.client_phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call Client
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No contracts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a QBCC contract to send for signature
              </p>
              <Button className="mt-4" onClick={handleGenerateContract}>
                <FileSignature className="h-4 w-4 mr-2" />
                Generate Contract
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No documents yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Attach documents like plans, quotes, or correspondence
              </p>
              <Button variant="outline" className="mt-4">
                Upload Document
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Activity timeline coming soon</p>
              <p className="text-sm text-muted-foreground mt-1">
                Track all interactions and status changes
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form Modal */}
      <LeadForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        lead={lead}
        onSubmit={handleUpdateLead}
      />

      {/* Contract Generation Modal */}
      {lead && (
        <GenerateContractModal
          open={contractModalOpen}
          onOpenChange={setContractModalOpen}
          lead={lead}
          onContractGenerated={handleContractGenerated}
        />
      )}
    </div>
  );
}

// Mock data for development
function getMockLead(id: number): Lead | null {
  const leads: Lead[] = [
    {
      id: 1,
      lead_number: "LEAD-2024-001",
      title: "Smith Residence - New Build",
      status: "qualified",
      source: "referral",
      client_name: "John Smith",
      client_email: "john.smith@email.com",
      client_phone: "+61 412 345 678",
      site_address: "45 Riverside Drive",
      site_suburb: "Hamilton",
      site_state: "QLD",
      site_postcode: "4007",
      project_type: "new_dwelling",
      dwelling_type: "detached_house",
      number_of_storeys: 2,
      estimated_floor_area: 320,
      estimated_value: 850000,
      expected_start_date: "2025-03-01",
      decision_timeline: "2_weeks",
      notes:
        "Client is keen to proceed. Has financing approved. Looking at premium finishes throughout.",
      created_at: "2024-11-15T10:00:00Z",
      updated_at: "2024-11-28T14:30:00Z",
    },
    {
      id: 4,
      lead_number: "LEAD-2024-004",
      title: "Davis Duplex Development",
      status: "contract_sent",
      source: "repeat_client",
      client_name: "Emma Davis",
      client_email: "emma.davis@outlook.com",
      client_phone: "+61 434 567 890",
      site_address: "22 Marina Way",
      site_suburb: "Bulimba",
      site_state: "QLD",
      site_postcode: "4171",
      lot_plan_number: "Lot 5 SP456789",
      project_type: "new_dwelling",
      dwelling_type: "duplex",
      number_of_storeys: 2,
      estimated_floor_area: 400,
      estimated_value: 1200000,
      expected_start_date: "2025-02-15",
      decision_timeline: "immediate",
      notes: "Repeat client - previously built their first home with us.",
      created_at: "2024-10-01T10:00:00Z",
      updated_at: "2024-11-25T16:00:00Z",
    },
  ];

  return leads.find((l) => l.id === id) || leads[0];
}
