"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ClipboardList,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardCheck,
} from "lucide-react";
import { api } from "@/lib/api";

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
}

const tabs = [
  { name: "Overview", slug: "overview", icon: ClipboardList },
  { name: "Estimates", slug: "estimates", icon: FileText },
  { name: "Budget", slug: "budget", icon: DollarSign },
  { name: "Schedule", slug: "schedule", icon: Calendar },
  { name: "Purchase Orders", slug: "purchase-orders", icon: ShoppingCart },
  { name: "WHS", slug: "whs", icon: Shield },
  { name: "Documents", slug: "documents", icon: FileText },
  { name: "Team", slug: "team", icon: Users },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string): string {
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
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");

  React.useEffect(() => {
    const fetchJob = async () => {
      try {
        const data = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        setJob(data);
      } catch {
        // Use mock data for demo when API is unavailable
        const mockJob = getMockJob(jobId);
        if (mockJob) {
          setJob(mockJob);
        }
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

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
        <Button variant="ghost" onClick={() => router.push("/jobs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
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
          <Button variant="ghost" size="icon" onClick={() => router.push("/jobs")}>
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
            <p className="text-2xl font-bold mt-1">{job.profit_percentage?.toFixed(1) || 0}%</p>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={job.title} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Input value={job.stage} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Contract Value</Label>
                    <Input value={formatCurrency(job.contract_value || 0)} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Certifier Job No</Label>
                    <Input value={job.certifier_job_no || ""} readOnly />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input value={job.location || ""} readOnly className="flex-1" />
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

            {/* Location Map Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {job.location || "No location set"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="purchase-orders" className="mt-6">
          <JobPurchaseOrders jobId={parseInt(jobId)} />
        </TabsContent>

        <TabsContent value="estimates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Estimates will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Budget management coming soon.</p>
            </CardContent>
          </Card>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Rain Days</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">4</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                        <span className="text-sm text-muted-foreground">60 days</span>
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

              {/* Rain Log */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Rain Log</CardTitle>
                  <Button size="sm" variant="outline">
                    <Cloud className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">28 Nov 2024</p>
                        <p className="text-sm text-muted-foreground">Heavy rain - No work</p>
                      </div>
                      <Badge variant="secondary">8 hrs</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">22 Nov 2024</p>
                        <p className="text-sm text-muted-foreground">Morning showers - Delayed start</p>
                      </div>
                      <Badge variant="secondary">3 hrs</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">15 Nov 2024</p>
                        <p className="text-sm text-muted-foreground">Afternoon storm</p>
                      </div>
                      <Badge variant="secondary">2 hrs</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                  <div className="flex items-center justify-between p-3 border rounded-lg border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
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

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Documents and OneDrive integration will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coms" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Communications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Internal messages, emails, and SMS will be displayed here.
              </p>
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}

// Job Purchase Orders Component
interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  description: string;
}

function JobPurchaseOrders({ jobId }: { jobId: number }) {
  const mockPurchaseOrdersByJob: Record<number, PurchaseOrder[]> = {
    1: [
      { id: 1, po_number: "PO-2024-001", supplier_name: "Boral Timber", total_amount: 42850, status: "sent", created_at: "2024-10-15", description: "Framing timber package - LVL beams, studs, plates" },
      { id: 2, po_number: "PO-2024-002", supplier_name: "QLD Steel Supplies", total_amount: 28400, status: "received", created_at: "2024-10-10", description: "Steel lintels and connections" },
      { id: 3, po_number: "PO-2024-003", supplier_name: "Truecore Windows & Doors", total_amount: 67200, status: "approved", created_at: "2024-11-01", description: "Aluminium windows and bifold doors" },
      { id: 22, po_number: "PO-2024-022", supplier_name: "Austral Bricks", total_amount: 22400, status: "draft", created_at: "2024-11-18", description: "Face brickwork - feature walls" },
    ],
    2: [
      { id: 4, po_number: "PO-2024-004", supplier_name: "Hanson Concrete", total_amount: 18900, status: "sent", created_at: "2024-10-28", description: "Slab concrete - 32MPa" },
      { id: 5, po_number: "PO-2024-005", supplier_name: "Reo Steel Fixers", total_amount: 24500, status: "sent", created_at: "2024-10-25", description: "Reinforcement mesh and labour" },
      { id: 6, po_number: "PO-2024-006", supplier_name: "Gold Coast Formwork", total_amount: 15200, status: "received", created_at: "2024-10-20", description: "Slab edge formwork hire" },
      { id: 23, po_number: "PO-2024-023", supplier_name: "QLD Scaffolding Hire", total_amount: 8500, status: "draft", created_at: "2024-11-19", description: "Scaffold hire - 8 weeks" },
    ],
    3: [
      { id: 7, po_number: "PO-2024-007", supplier_name: "Reece Plumbing", total_amount: 12450, status: "sent", created_at: "2024-11-05", description: "Bathroom fixtures and fittings" },
      { id: 8, po_number: "PO-2024-008", supplier_name: "Beacon Lighting", total_amount: 8900, status: "approved", created_at: "2024-11-08", description: "LED downlights and pendants" },
      { id: 9, po_number: "PO-2024-009", supplier_name: "Bunnings Trade", total_amount: 4250, status: "received", created_at: "2024-10-30", description: "Hardware and sundries" },
    ],
    4: [
      { id: 10, po_number: "PO-2024-010", supplier_name: "CSR Bradford Insulation", total_amount: 6800, status: "sent", created_at: "2024-11-10", description: "Wall and ceiling batts R4.0" },
      { id: 11, po_number: "PO-2024-011", supplier_name: "Brickworks Building Products", total_amount: 19500, status: "received", created_at: "2024-09-15", description: "Face bricks - 12,000 units" },
      { id: 12, po_number: "PO-2024-012", supplier_name: "Stratco Roofing", total_amount: 31200, status: "received", created_at: "2024-10-01", description: "Colorbond roofing and gutters" },
    ],
    6: [
      { id: 13, po_number: "PO-2024-013", supplier_name: "BlueScope Steel", total_amount: 156000, status: "sent", created_at: "2024-10-20", description: "Portal frame steel structure" },
      { id: 14, po_number: "PO-2024-014", supplier_name: "Lysaght Building Solutions", total_amount: 42800, status: "approved", created_at: "2024-11-12", description: "Wall and roof sheeting" },
      { id: 15, po_number: "PO-2024-015", supplier_name: "Industrial Concrete QLD", total_amount: 38500, status: "received", created_at: "2024-10-10", description: "Industrial slab - 150mm thick" },
    ],
    8: [
      { id: 16, po_number: "PO-2024-016", supplier_name: "Monier Roofing", total_amount: 24600, status: "sent", created_at: "2024-11-01", description: "Concrete roof tiles - Elabana" },
      { id: 17, po_number: "PO-2024-017", supplier_name: "Fletcher Insulation", total_amount: 5400, status: "pending", created_at: "2024-11-14", description: "Roof blanket insulation R5.0" },
      { id: 18, po_number: "PO-2024-018", supplier_name: "James Hardie", total_amount: 18200, status: "approved", created_at: "2024-10-25", description: "HardiePlank cladding" },
    ],
    9: [
      { id: 19, po_number: "PO-2024-019", supplier_name: "Clipsal Electrical", total_amount: 34200, status: "sent", created_at: "2024-10-28", description: "Commercial electrical package" },
      { id: 20, po_number: "PO-2024-020", supplier_name: "USG Boral Plasterboard", total_amount: 12800, status: "received", created_at: "2024-10-15", description: "Fire-rated plasterboard" },
      { id: 21, po_number: "PO-2024-021", supplier_name: "Rinnai Hot Water", total_amount: 8900, status: "pending", created_at: "2024-11-15", description: "Commercial hot water system" },
      { id: 24, po_number: "PO-2024-024", supplier_name: "Actrol HVAC", total_amount: 45600, status: "draft", created_at: "2024-11-20", description: "Split system AC units x 6" },
    ],
  };

  const purchaseOrders = mockPurchaseOrdersByJob[jobId] || [];
  const totalValue = purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sent</Badge>;
      case "received":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Received</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total POs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{purchaseOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Received</span>
            </div>
            <p className="text-2xl font-bold mt-1">{purchaseOrders.filter(po => po.status === "received").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{purchaseOrders.filter(po => po.status === "pending" || po.status === "draft").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* PO List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Purchase Orders</CardTitle>
          <Button>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Create PO
          </Button>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length > 0 ? (
            <div className="space-y-3">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{po.po_number}</p>
                        {getStatusBadge(po.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{po.supplier_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{po.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(po.total_amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString("en-AU")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No purchase orders for this job yet</p>
              <Button className="mt-4">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create First PO
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data for demo
function getMockJob(jobId: string): Job | null {
  const mockJobs: Record<string, Job> = {
    "1": {
      id: 1,
      title: "Harrison Residence - Custom Home",
      status: "Active",
      stage: "Framing",
      contract_value: 875000,
      live_profit: 142500,
      profit_percentage: 16.3,
      certifier_job_no: "BC-2024-1842",
      start_date: "2024-09-15",
      location: "42 Riverside Drive, Bulimba QLD 4171",
      latitude: -27.4545,
      longitude: 153.0584,
      site_supervisor_name: "James Wilson",
      site_supervisor_email: "james.wilson@teeem.com.au",
      site_supervisor_phone: "0412 345 678",
      contacts: [
        {
          id: 1,
          name: "Michael Harrison",
          email: "michael.harrison@email.com",
          mobile: "0423 456 789",
          company: "Harrison Family Trust",
          is_primary: true,
        },
        {
          id: 2,
          name: "Sarah Harrison",
          email: "sarah.harrison@email.com",
          mobile: "0434 567 890",
          is_primary: false,
        },
      ],
    },
    "2": {
      id: 2,
      title: "Coastal Views Duplex",
      status: "Active",
      stage: "Slab",
      contract_value: 1250000,
      live_profit: 187500,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-2156",
      start_date: "2024-10-01",
      location: "18 Ocean Parade, Mermaid Beach QLD 4218",
      latitude: -28.0442,
      longitude: 153.4311,
      site_supervisor_name: "Mark Thompson",
      site_supervisor_email: "mark.thompson@teeem.com.au",
      site_supervisor_phone: "0421 234 567",
      contacts: [
        {
          id: 3,
          name: "Steve Patterson",
          email: "steve@pattersondevelopments.com.au",
          mobile: "0400 111 222",
          company: "Patterson Developments",
          is_primary: true,
        },
      ],
    },
    "3": {
      id: 3,
      title: "Thompson Family Home - Renovation",
      status: "In Progress",
      stage: "Internal Fit-out",
      contract_value: 320000,
      live_profit: 48000,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-1567",
      start_date: "2024-08-20",
      location: "156 Queensport Road, Murarrie QLD 4172",
      latitude: -27.4612,
      longitude: 153.0945,
      site_supervisor_name: "Lisa Chen",
      site_supervisor_email: "lisa.chen@teeem.com.au",
      site_supervisor_phone: "0433 456 789",
      contacts: [
        {
          id: 4,
          name: "David Thompson",
          email: "david.thompson@gmail.com",
          mobile: "0411 222 333",
          is_primary: true,
        },
      ],
    },
    "4": {
      id: 4,
      title: "Greenfield Estate - Lot 45",
      status: "Active",
      stage: "Lock-up",
      contract_value: 485000,
      live_profit: 72750,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-1234",
      start_date: "2024-07-10",
      location: "45 Greenfield Circuit, Springfield QLD 4300",
      latitude: -27.6607,
      longitude: 152.9067,
      site_supervisor_name: "James Wilson",
      site_supervisor_email: "james.wilson@teeem.com.au",
      site_supervisor_phone: "0412 345 678",
      contacts: [
        {
          id: 5,
          name: "James Chen",
          email: "james.chen@outlook.com",
          mobile: "0422 333 444",
          is_primary: true,
        },
        {
          id: 6,
          name: "Emily Chen",
          email: "emily.chen@outlook.com",
          mobile: "0433 444 555",
          is_primary: false,
        },
      ],
    },
    "5": {
      id: 5,
      title: "Ascot Terrace - Townhouse",
      status: "On Hold",
      stage: "Planning",
      contract_value: 720000,
      live_profit: 0,
      profit_percentage: 0,
      start_date: "2024-11-01",
      location: "8/22 Lancaster Road, Ascot QLD 4007",
      latitude: -27.4322,
      longitude: 153.0658,
      contacts: [
        {
          id: 7,
          name: "Robert Mitchell",
          email: "r.mitchell@ascotproperty.com.au",
          mobile: "0444 555 666",
          company: "Ascot Property Group",
          is_primary: true,
        },
      ],
    },
    "6": {
      id: 6,
      title: "Industrial Shed - BrisWest",
      status: "Active",
      stage: "Steel Erection",
      contract_value: 580000,
      live_profit: 87000,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-2089",
      start_date: "2024-10-15",
      location: "Unit 3, 89 Industrial Avenue, Wacol QLD 4076",
      latitude: -27.5876,
      longitude: 152.9312,
      site_supervisor_name: "Mark Thompson",
      site_supervisor_email: "mark.thompson@teeem.com.au",
      site_supervisor_phone: "0421 234 567",
      contacts: [
        {
          id: 8,
          name: "Karen Wright",
          email: "karen@briswest.com.au",
          mobile: "0455 666 777",
          company: "BrisWest Logistics Pty Ltd",
          is_primary: true,
        },
      ],
    },
    "7": {
      id: 7,
      title: "Roberts Granny Flat",
      status: "Completed",
      stage: "Completed",
      contract_value: 145000,
      live_profit: 21750,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-0892",
      start_date: "2024-06-01",
      location: "14 Jacaranda Street, Kenmore QLD 4069",
      latitude: -27.5073,
      longitude: 152.9378,
      site_supervisor_name: "Lisa Chen",
      site_supervisor_email: "lisa.chen@teeem.com.au",
      site_supervisor_phone: "0433 456 789",
      contacts: [
        {
          id: 9,
          name: "Margaret Roberts",
          email: "margaret.roberts@bigpond.com",
          mobile: "0466 777 888",
          is_primary: true,
        },
      ],
    },
    "8": {
      id: 8,
      title: "Waverly Heights - New Build",
      status: "Active",
      stage: "Roof",
      contract_value: 695000,
      live_profit: 104250,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-1678",
      start_date: "2024-08-05",
      location: "27 Hillcrest Avenue, Camp Hill QLD 4152",
      latitude: -27.4932,
      longitude: 153.0712,
      site_supervisor_name: "James Wilson",
      site_supervisor_email: "james.wilson@teeem.com.au",
      site_supervisor_phone: "0412 345 678",
      contacts: [
        {
          id: 10,
          name: "Tom Miller",
          email: "tom.miller@gmail.com",
          mobile: "0477 888 999",
          is_primary: true,
        },
        {
          id: 11,
          name: "Jessica Miller",
          email: "jess.miller@gmail.com",
          mobile: "0488 999 000",
          is_primary: false,
        },
      ],
    },
    "9": {
      id: 9,
      title: "Commercial Fit-out - Queen St",
      status: "In Progress",
      stage: "Services Rough-in",
      contract_value: 420000,
      live_profit: 63000,
      profit_percentage: 15.0,
      certifier_job_no: "BC-2024-1945",
      start_date: "2024-09-20",
      location: "Level 5, 120 Queen Street, Brisbane QLD 4000",
      latitude: -27.4679,
      longitude: 153.0256,
      site_supervisor_name: "Mark Thompson",
      site_supervisor_email: "mark.thompson@teeem.com.au",
      site_supervisor_phone: "0421 234 567",
      contacts: [
        {
          id: 12,
          name: "Dr. Amanda Lee",
          email: "admin@cbdmedical.com.au",
          mobile: "0499 000 111",
          company: "CBD Medical Centre",
          is_primary: true,
        },
      ],
    },
    "10": {
      id: 10,
      title: "Poolside Pavilion - Johnson",
      status: "Draft",
      stage: "Quoting",
      contract_value: 95000,
      live_profit: 0,
      profit_percentage: 0,
      location: "89 Esplanade, Sandgate QLD 4017",
      latitude: -27.3234,
      longitude: 153.0678,
      contacts: [
        {
          id: 13,
          name: "Richard Johnson",
          email: "richard.j@outlook.com",
          mobile: "0400 222 333",
          is_primary: true,
        },
      ],
    },
  };

  return mockJobs[jobId] || null;
}
