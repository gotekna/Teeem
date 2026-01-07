"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
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
  ClipboardList,
  Shield,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyJobTitle } from "@/lib/url-utils";
import { JobActivityTab } from "@/components/jobs/JobActivityTab";
import { JobPeopleTab } from "@/components/jobs/JobPeopleTab";
import { RainLogTab } from "@/components/jobs/RainLogTab";
import { JobDocumentsTab } from "@/components/jobs/JobDocumentsTab";
import { JobPurchaseOrdersTab } from "@/components/jobs/JobPurchaseOrdersTab";
import { JobEstimatorTab } from "@/components/jobs/JobEstimatorTab";
import { JobBudgetTab } from "@/components/jobs/JobBudgetTab";
import { JobCommunicationsTab } from "@/components/jobs/JobCommunicationsTab";
import { JobProfitTab } from "@/components/jobs/JobProfitTab";
import { Spinner } from "@/components/ui/spinner";

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
  name: string;
  status: string;
  stage: string;
  job_status?: { id: number; name: string; color?: string };
  job_stage?: { id: number; name: string };
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

interface JobDetailDrawerProps {
  jobId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabs = [
  { name: "Overview", slug: "overview", icon: ClipboardList },
  { name: "People", slug: "people", icon: Users },
  { name: "POs", slug: "purchase-orders", icon: ShoppingCart },
  { name: "Estimates", slug: "estimates", icon: FileText },
  { name: "Profit", slug: "profit", icon: TrendingUp },
  { name: "Activity", slug: "activity", icon: TrendingUp },
  { name: "Budget", slug: "budget", icon: DollarSign },
  { name: "Schedule", slug: "schedule", icon: Calendar },
  { name: "WHS", slug: "whs", icon: Shield },
  { name: "Rain", slug: "rain-log", icon: Cloud },
  { name: "Docs", slug: "documents", icon: FileText },
  { name: "Coms", slug: "coms", icon: MessageSquare },
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

export function JobDetailDrawer({ jobId, open, onOpenChange }: JobDetailDrawerProps) {
  const router = useRouter();
  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("overview");

  const loadJob = React.useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const data = await api.get<Job>(`/api/v1/jobs/${jobId}`);
      setJob(data);
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    if (open && jobId) {
      loadJob();
      setActiveTab("overview"); // Reset to overview when opening new job
    }
  }, [open, jobId, loadJob]);

  const handleOpenFullPage = () => {
    if (job) {
      const slug = slugifyJobTitle(job.name);
      router.push(`/jobs/${slug}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : !job ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Job not found</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-4 border-b shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl font-serif">{job.name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{job.stage || job.job_stage?.name}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {job.job_status?.name}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenFullPage}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Full Page
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{formatCurrency(job.contract_value || 0)}</p>
                  <p className="text-xs text-muted-foreground">Contract</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{formatCurrency(job.live_profit || 0)}</p>
                  <p className="text-xs text-muted-foreground">Profit</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{job.profit_percentage?.toFixed(1) || 0}%</p>
                  <p className="text-xs text-muted-foreground">Margin</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">
                    {job.start_date
                      ? new Date(job.start_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Start</p>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start px-4 py-2 border-b shrink-0 overflow-x-auto">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.slug} value={tab.slug} className="text-xs px-2">
                    <tab.icon className="h-3 w-3 mr-1" />
                    {tab.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  <TabsContent value="overview" className="mt-0">
                    <div className="space-y-4">
                      {/* Job Details */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Location</Label>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {job.location || "-"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Certifier Job #</Label>
                              <p className="text-sm">{job.certifier_job_no || "-"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Site Supervisor */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Site Supervisor</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(job.site_supervisor_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <p className="font-medium">{job.site_supervisor_name || "Not assigned"}</p>
                              {job.site_supervisor_email && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {job.site_supervisor_email}
                                </p>
                              )}
                              {job.site_supervisor_phone && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {job.site_supervisor_phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Contacts */}
                      {job.contacts && job.contacts.length > 0 && (
                        <Card>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm">Contacts</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {job.contacts.map((contact) => (
                                <div key={contact.id} className="flex items-start gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {getInitials(contact.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{contact.name}</p>
                                      {contact.is_primary && (
                                        <Badge variant="secondary" className="text-[10px] px-1">
                                          Primary
                                        </Badge>
                                      )}
                                    </div>
                                    {contact.company && (
                                      <p className="text-muted-foreground flex items-center gap-1">
                                        <Building2 className="h-3 w-3" />
                                        {contact.company}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="people" className="mt-0">
                    <JobPeopleTab jobId={job.id} onUpdate={loadJob} />
                  </TabsContent>

                  <TabsContent value="purchase-orders" className="mt-0">
                    <JobPurchaseOrdersTab jobId={job.id} jobTitle={job.name} />
                  </TabsContent>

                  <TabsContent value="estimates" className="mt-0">
                    <JobEstimatorTab jobId={job.id} job={job} />
                  </TabsContent>

                  <TabsContent value="profit" className="mt-0">
                    <JobProfitTab jobId={job.id} />
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    <JobActivityTab jobId={job.id} />
                  </TabsContent>

                  <TabsContent value="budget" className="mt-0">
                    <JobBudgetTab jobId={job.id} />
                  </TabsContent>

                  <TabsContent value="schedule" className="mt-0">
                    <Card>
                      <CardContent className="py-6 text-center">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          View the full Schedule Master for task management
                        </p>
                        <Button onClick={() => router.push(`/jobs/${job.id}/schedule/gantt-v2`)}>
                          Open Schedule
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="whs" className="mt-0">
                    <Card>
                      <CardContent className="py-6 text-center">
                        <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          WHS management for this job
                        </p>
                        <Button variant="outline" onClick={handleOpenFullPage}>
                          View in Full Page
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="rain-log" className="mt-0">
                    <RainLogTab jobId={job.id} />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0">
                    <JobDocumentsTab jobId={job.id} jobTitle={job.name} />
                  </TabsContent>

                  <TabsContent value="coms" className="mt-0">
                    <JobCommunicationsTab jobId={job.id} jobTitle={job.name} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
