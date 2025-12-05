"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  ShoppingCart,
  Cloud,
  MessageSquare,
  Settings,
  ClipboardList,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardCheck,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";
import { JobActivityTab } from "@/components/jobs/JobActivityTab";
import { JobPeopleTab } from "@/components/jobs/JobPeopleTab";
import { RainLogTab } from "@/components/jobs/RainLogTab";
import { JobDocumentsTab } from "@/components/jobs/JobDocumentsTab";
import { JobPurchaseOrdersTab } from "@/components/jobs/JobPurchaseOrdersTab";
import { JobEstimatorTab } from "@/components/jobs/JobEstimatorTab";
import { JobBudgetTab } from "@/components/jobs/JobBudgetTab";
import { JobCommunicationsTab } from "@/components/jobs/JobCommunicationsTab";
import { JobProfitTab } from "@/components/jobs/JobProfitTab";

// Dynamically import LocationMap to avoid SSR issues with Leaflet
const LocationMap = dynamic(
  () => import("@/components/jobs/LocationMap").then((mod) => mod.LocationMap),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" /> }
);

interface Contact {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  company?: string;
  is_primary?: boolean;
}

interface Job {
  id: number;
  title: string;
  status: string;
  stage: string;
  job_type?: { id: number; name: string; icon?: string };
  job_type_id?: number;
  job_status?: { id: number; name: string; color?: string };
  job_status_id?: number;
  job_stage?: { id: number; name: string };
  job_stage_id?: number;
  contract_value: number;
  live_profit: number;
  profit_percentage: number;
  certifier_job_no?: string;
  start_date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  site_supervisor_name?: string;
  site_supervisor_email?: string;
  site_supervisor_phone?: string;
  contacts?: Contact[];
  estimator_analysis?: {
    job_summary?: string;
    key_points?: string[];
    estimated_scope?: {
      complexity?: string;
      duration_estimate?: string;
      key_trades?: string[];
      major_materials?: string[];
      potential_challenges?: string[];
    };
    recommendations?: string[];
    source?: string;
  };
}

interface JobType {
  id: number;
  name: string;
  icon?: string;
}

interface JobStatus {
  id: number;
  name: string;
  color?: string;
}

interface JobStage {
  id: number;
  name: string;
}

const tabs = [
  { name: "Overview", slug: "overview", icon: ClipboardList },
  { name: "People", slug: "people", icon: Users },
  { name: "Purchase Orders", slug: "purchase-orders", icon: ShoppingCart },
  { name: "Estimates", slug: "estimates", icon: FileText },
  { name: "Profit", slug: "profit", icon: TrendingUp },
  { name: "Activity", slug: "activity", icon: TrendingUp },
  { name: "Budget", slug: "budget", icon: DollarSign },
  { name: "Schedule", slug: "schedule", icon: Calendar },
  { name: "WHS", slug: "whs", icon: Shield },
  { name: "Rain Log", slug: "rain-log", icon: Cloud },
  { name: "Documents", slug: "documents", icon: FileText },
  { name: "Coms", slug: "coms", icon: MessageSquare },
  { name: "Settings", slug: "settings", icon: Settings },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStageBadgeVariant(stage: string): "default" | "secondary" | "outline" {
  switch (stage?.toLowerCase()) {
    case "construction":
      return "default";
    case "planning":
    case "design":
      return "secondary";
    default:
      return "outline";
  }
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Partial<Job>>({});
  const [saving, setSaving] = React.useState(false);

  // Lookup data for dropdowns
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);

  // Get tab from URL or default to "overview"
  const tabFromUrl = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = React.useState(tabFromUrl);

  // Update URL when tab changes - keep numeric ID in URL
  const handleTabChange = React.useCallback((newTab: string) => {
    setActiveTab(newTab);
    // Only add ?tab= for non-default tabs (cleaner URLs)
    const newUrl = newTab === "overview"
      ? `/jobs/${jobId}`
      : `/jobs/${jobId}?tab=${newTab}`;
    router.replace(newUrl, { scroll: false });
  }, [jobId, router]);

  const loadJob = React.useCallback(async () => {
    try {
      const data = await api.get<Job>(`/api/v1/jobs/${jobId}`);
      setJob(data);
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Load lookup data for dropdowns - only when editing starts
  const loadLookupData = React.useCallback(async () => {
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ job_stages: JobStage[] } | JobStage[]>("/api/v1/job_stages"),
      ]);
      setJobTypes(typesRes?.job_types || []);
      setJobStatuses(statusesRes?.job_statuses || []);
      // Handle both wrapped and array responses for stages
      if (Array.isArray(stagesRes)) {
        setJobStages(stagesRes);
      } else if (stagesRes?.job_stages) {
        setJobStages(stagesRes.job_stages);
      } else {
        setJobStages([]);
      }
    } catch (error) {
      console.error("Failed to load lookup data:", error);
    }
  }, []);

  React.useEffect(() => {
    if (jobId) {
      loadJob();
    }
  }, [jobId, loadJob]);

  // Start editing - populate form with current values and load lookup data
  const startEditing = async () => {
    if (job) {
      setEditForm({
        title: job.title,
        contract_value: job.contract_value,
        certifier_job_no: job.certifier_job_no,
        start_date: job.start_date,
        location: job.location,
        job_type_id: job.job_type?.id || job.job_type_id,
        job_status_id: job.job_status?.id || job.job_status_id,
        job_stage_id: job.job_stage?.id || job.job_stage_id,
      });
      setIsEditing(true);
      // Load dropdown data only when editing
      if (jobTypes.length === 0) {
        loadLookupData();
      }
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  // Save changes
  const saveChanges = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const updatedJob = await api.patch<Job>(`/api/v1/jobs/${job.id}`, {
        job: editForm,
      });
      setJob({ ...job, ...updatedJob });
      setIsEditing(false);
      setEditForm({});
      // Reload to get fresh data with associations
      loadJob();
    } catch (error) {
      console.error("Failed to save job:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Job not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getStageBadgeVariant(job.stage)}>{job.stage}</Badge>
              <span className="text-sm text-muted-foreground">{job.status}</span>
              {job.certifier_job_no && (
                <span className="text-sm text-muted-foreground">
                  • Job #{job.certifier_job_no}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/jobs/${jobId}/schedule`)}>
          Open Schedule Master
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Contract Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(job.contract_value || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Live Profit</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(job.live_profit || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Profit %</span>
            </div>
            <p className="text-2xl font-bold mt-1">{Number(job.profit_percentage ?? 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Start Date</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {job.start_date
                ? new Date(job.start_date).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.slug} value={tab.slug} className="gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Details */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Job Details</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveChanges} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.title || ""}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      />
                    ) : (
                      <Input value={job.title} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Type</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.job_type_id?.toString() || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, job_type_id: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={job.job_type?.name || "-"} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.job_status_id?.toString() || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, job_status_id: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobStatuses.map((status) => (
                            <SelectItem key={status.id} value={status.id.toString()}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={job.job_status?.name || job.status || "-"} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.job_stage_id?.toString() || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, job_stage_id: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id.toString()}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={job.job_stage?.name || job.stage || "-"} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Contract Value</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.contract_value || ""}
                        onChange={(e) => setEditForm({ ...editForm, contract_value: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <Input value={formatCurrency(job.contract_value || 0)} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Certifier Job No</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.certifier_job_no || ""}
                        onChange={(e) => setEditForm({ ...editForm, certifier_job_no: e.target.value })}
                      />
                    ) : (
                      <Input value={job.certifier_job_no || ""} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.start_date || ""}
                        onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      />
                    ) : (
                      <Input
                        value={job.start_date
                          ? new Date(job.start_date).toLocaleDateString("en-AU")
                          : "Not set"}
                        readOnly
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {isEditing ? (
                      <Input
                        value={editForm.location || ""}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="flex-1"
                      />
                    ) : (
                      <Input value={job.location || ""} readOnly className="flex-1" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader>
                <CardTitle>Client Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                {job.contacts && job.contacts.length > 0 ? (
                  <div className="space-y-4">
                    {job.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{contact.name}</p>
                            {contact.is_primary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          {contact.company && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contact.company}
                            </p>
                          )}
                          {contact.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </p>
                          )}
                          {contact.mobile && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.mobile}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contacts assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Team */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {job.site_supervisor_name ? getInitials(job.site_supervisor_name) : "SS"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{job.site_supervisor_name || "Not assigned"}</p>
                    <p className="text-sm text-muted-foreground">Site Supervisor</p>
                    {job.site_supervisor_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {job.site_supervisor_email}
                      </p>
                    )}
                    {job.site_supervisor_phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {job.site_supervisor_phone}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Map */}
            <div className="lg:col-span-1">
              <LocationMap
                jobId={job.id}
                location={job.location}
                latitude={job.latitude}
                longitude={job.longitude}
                onLocationUpdate={(data) => {
                  // Update job state with new location data using functional update
                  setJob((prevJob) => prevJob ? { ...prevJob, ...data } : prevJob);
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          <JobPeopleTab jobId={job.id} onUpdate={loadJob} />
        </TabsContent>

        <TabsContent value="purchase-orders" className="mt-6">
          <JobPurchaseOrdersTab jobId={job.id} jobTitle={job.title} />
        </TabsContent>

        <TabsContent value="estimates" className="mt-6">
          <JobEstimatorTab jobId={job.id} job={job} />
        </TabsContent>

        <TabsContent value="profit" className="mt-6">
          <JobProfitTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <JobActivityTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <JobBudgetTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Schedule Master</CardTitle>
              <Button onClick={() => router.push(`/jobs/${jobId}/schedule`)}>
                Open Full View
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View the full Schedule Master for detailed task management and Gantt chart.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whs" className="mt-6">
          <div className="space-y-6">
            {/* WHS Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Active SWMS</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">2</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Inducted Workers</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">8</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Inspections</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">3</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Open Incidents</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">0</p>
                </CardContent>
              </Card>
            </div>

            {/* SWMS for this job */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Safe Work Method Statements</CardTitle>
                <Button size="sm">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Create SWMS
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Excavation Works SWMS</p>
                        <p className="text-sm text-muted-foreground">Version 2 • 8 workers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                      <span className="text-sm text-muted-foreground">60 days remaining</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Concrete Pouring SWMS</p>
                        <p className="text-sm text-muted-foreground">Version 1 • Draft</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Draft</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inducted Workers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Inducted Workers</CardTitle>
                <Button size="sm" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Start Induction
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["James Wilson", "Mark Thompson", "Lisa Chen"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">General Site Induction</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Inducted</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 border rounded-lg border-orange-200 bg-orange-50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>TB</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Tom Bradley</p>
                        <p className="text-sm text-muted-foreground">Pending induction</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <Button size="sm">Start</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/inspections")}>
                <CheckCircle className="h-5 w-5 mb-2" />
                Run Inspection
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/incidents")}>
                <AlertTriangle className="h-5 w-5 mb-2" />
                Report Incident
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/swms")}>
                <ClipboardCheck className="h-5 w-5 mb-2" />
                All SWMS
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs")}>
                <Shield className="h-5 w-5 mb-2" />
                WHS Dashboard
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rain-log" className="mt-6">
          <RainLogTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <JobDocumentsTab jobId={job.id} jobTitle={job.title} />
        </TabsContent>

        <TabsContent value="coms" className="mt-6">
          <JobCommunicationsTab jobId={job.id} jobTitle={job.title} />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Team settings will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Job settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Help & Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Help documentation will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
