"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  Clock,
  TrendingUp,
  Plus,
  RefreshCw,
  Mail,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Eye,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";
import { formatDistanceToNow } from "date-fns";

interface TenantUsage {
  total_users: number;
  active_today: number;
  active_week: number;
  last_activity: string | null;
  jobs_count: number;
  contacts_count: number;
}

interface TenantRow {
  id: number;
  name: string;
  slug: string;
  company_name: string | null;
  tier: string;
  trial_status: string;
  trial_days_remaining: number | null;
  trial_ends_at: string | null;
  created_at: string;
  onboarding_complete: boolean;
  usage: TenantUsage;
}

interface DashboardSummary {
  total: number;
  on_trial: number;
  trial_expiring_7_days: number;
  trial_expired: number;
  converted: number;
  active_today: number;
}

interface DashboardData {
  summary: DashboardSummary;
  tenants: TenantRow[];
}

interface InviteForm {
  name: string;
  email: string;
  company_name: string;
  personal_message: string;
  sent_from_user_id: number | null;
}

interface AvailableSender {
  id: number;
  name: string;
  email: string;
}

export default function AdminTenantsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    name: "",
    email: "",
    company_name: "",
    personal_message: "",
    sent_from_user_id: null,
  });
  const [sending, setSending] = useState(false);
  const [availableSenders, setAvailableSenders] = useState<AvailableSender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [previewTab, setPreviewTab] = useState<"form" | "preview">("form");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: DashboardData }>(
        "/api/v1/admin/tenants/dashboard"
      );
      if (res?.success) {
        setData(res.data);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
      setError("Failed to load tenant dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load available senders when invite dialog opens
  useEffect(() => {
    if (inviteOpen && availableSenders.length === 0 && !loadingSenders) {
      setLoadingSenders(true);
      api
        .get<{ success: boolean; data: AvailableSender[] }>(
          "/api/v1/admin/trial_invitations/available_senders"
        )
        .then((res) => {
          if (res?.success) {
            setAvailableSenders(res.data);
            // Default to first sender (current user or first in list)
            if (res.data.length > 0 && !inviteForm.sent_from_user_id) {
              setInviteForm((f) => ({ ...f, sent_from_user_id: res.data[0].id }));
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSenders(false));
    }
  }, [inviteOpen, availableSenders.length, loadingSenders, inviteForm.sent_from_user_id]);

  const handleSendInvite = async () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.company_name) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/api/v1/admin/trial_invitations",
        { invitation: inviteForm }
      );
      if (res?.success) {
        toast({
          title: "Invitation sent!",
          description: `Email sent to ${inviteForm.email}`,
        });
        setInviteOpen(false);
        setInviteForm({
          name: "",
          email: "",
          company_name: "",
          personal_message: "",
          sent_from_user_id: availableSenders[0]?.id || null,
        });
        setPreviewTab("form");
      }
    } catch (err) {
      console.error("Failed to send invitation:", err);
      toast({
        title: "Failed to send",
        description: "Check the form and try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleExtendTrial = async (tenantId: number, days: number) => {
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/api/v1/admin/tenants/${tenantId}/extend_trial`,
        { days }
      );
      if (res?.success) {
        toast({ title: "Trial extended", description: res.message });
        loadData();
      }
    } catch (err) {
      console.error("Failed to extend trial:", err);
      toast({
        title: "Failed to extend trial",
        variant: "destructive",
      });
    }
  };

  // Get the selected sender for preview
  const selectedSender = availableSenders.find(
    (s) => s.id === inviteForm.sent_from_user_id
  );

  const getStatusBadge = (status: string, daysRemaining: number | null) => {
    if (status === "active" && daysRemaining !== null && daysRemaining <= 7) {
      return (
        <Badge variant="destructive">
          {daysRemaining}d left
        </Badge>
      );
    }

    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      none: "outline",
      active: "secondary",
      expired: "destructive",
      converted: "default",
      cancelled: "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading tenant dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadData} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const { summary, tenants } = data || { summary: null, tenants: [] };

  return (
    <TablePage>
      <div className="space-y-6 px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tenant Management</h1>
            <p className="text-muted-foreground">
              Monitor all tenancies, trials, and usage
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Invite Trial Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Invite New Trial Customer</DialogTitle>
                </DialogHeader>
                <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "form" | "preview")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="form">
                      <Mail className="h-4 w-4 mr-2" />
                      Compose
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="form" className="space-y-4 pt-4">
                    {/* Send From dropdown */}
                    <div>
                      <Label>Send From</Label>
                      <Select
                        value={inviteForm.sent_from_user_id?.toString() || ""}
                        onValueChange={(v) =>
                          setInviteForm((f) => ({
                            ...f,
                            sent_from_user_id: v ? parseInt(v) : null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingSenders ? "Loading..." : "Select sender..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSenders.map((sender) => (
                            <SelectItem key={sender.id} value={sender.id.toString()}>
                              {sender.name} ({sender.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        The invitation will appear to come from this person
                      </p>
                    </div>

                    <div>
                      <Label>Contact Name *</Label>
                      <Input
                        value={inviteForm.name}
                        onChange={(e) =>
                          setInviteForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) =>
                          setInviteForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <Label>Company Name *</Label>
                      <Input
                        value={inviteForm.company_name}
                        onChange={(e) =>
                          setInviteForm((f) => ({
                            ...f,
                            company_name: e.target.value,
                          }))
                        }
                        placeholder="Smith Builders Pty Ltd"
                      />
                    </div>
                    <div>
                      <Label>Personal Message (optional)</Label>
                      <Textarea
                        value={inviteForm.personal_message}
                        onChange={(e) =>
                          setInviteForm((f) => ({
                            ...f,
                            personal_message: e.target.value,
                          }))
                        }
                        placeholder="Add a personal note to the invitation..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setPreviewTab("preview")}
                        disabled={!inviteForm.name || !inviteForm.email || !inviteForm.company_name}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleSendInvite}
                        disabled={
                          sending ||
                          !inviteForm.name ||
                          !inviteForm.email ||
                          !inviteForm.company_name
                        }
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="pt-4">
                    {/* Email Preview */}
                    <div className="border rounded-lg overflow-hidden">
                      {/* Email header */}
                      <div className="bg-muted/50 p-4 border-b space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium w-16">From:</span>
                          <span className="text-muted-foreground">
                            {selectedSender
                              ? `${selectedSender.name} <${selectedSender.email}>`
                              : "TEEEM <hello@teeem.com.au>"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium w-16">To:</span>
                          <span className="text-muted-foreground">
                            {inviteForm.email || "recipient@example.com"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium w-16">Subject:</span>
                          <span>You&apos;re invited to try TEEEM free for 30 days</span>
                        </div>
                      </div>

                      {/* Email body preview */}
                      <div className="p-6 bg-white dark:bg-gray-900">
                        <div className="max-w-lg mx-auto space-y-4">
                          <h2 className="text-xl font-bold">
                            You&apos;re Invited to Try TEEEM!
                          </h2>
                          <p>
                            Hi {inviteForm.name || "[Contact Name]"},
                          </p>
                          <p>
                            {selectedSender?.name || "The TEEEM team"} has invited you to try TEEEM
                            for your company, <strong>{inviteForm.company_name || "[Company Name]"}</strong>.
                          </p>
                          <p>
                            TEEEM is a complete project management platform for builders. Start your
                            <strong> 30-day free trial</strong> today - no credit card required.
                          </p>

                          {inviteForm.personal_message && (
                            <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary">
                              <p className="italic">&ldquo;{inviteForm.personal_message}&rdquo;</p>
                              <p className="text-sm text-muted-foreground mt-2">
                                — {selectedSender?.name || "The TEEEM Team"}
                              </p>
                            </div>
                          )}

                          <div className="pt-4">
                            <div className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium">
                              Start Your Free Trial →
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            This invitation expires in 7 days.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setPreviewTab("form")}
                      >
                        Back to Edit
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleSendInvite}
                        disabled={
                          sending ||
                          !inviteForm.name ||
                          !inviteForm.email ||
                          !inviteForm.company_name
                        }
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Total Tenants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> On Trial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.on_trial}
                </div>
              </CardContent>
            </Card>

            <Card
              className={
                summary.trial_expiring_7_days > 0 ? "border-amber-500" : ""
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.trial_expiring_7_days}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Converted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summary.converted}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Active Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.active_today}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Expired
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.trial_expired}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tenants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tenants ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-center">Jobs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No tenants found. Invite your first trial customer to get
                      started.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {tenant.company_name || tenant.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tenant.slug}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(
                          tenant.trial_status,
                          tenant.trial_days_remaining
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">
                          {tenant.usage.active_week}
                        </span>
                        <span className="text-muted-foreground">
                          /{tenant.usage.total_users}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tenant.usage.last_activity ? (
                          formatDistanceToNow(
                            new Date(tenant.usage.last_activity),
                            { addSuffix: true }
                          )
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {tenant.usage.jobs_count}
                      </TableCell>
                      <TableCell>
                        {new Date(tenant.created_at).toLocaleDateString(
                          "en-AU"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {tenant.trial_status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExtendTrial(tenant.id, 7)}
                            >
                              +7 days
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TablePage>
  );
}
