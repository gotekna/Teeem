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
  });
  const [sending, setSending] = useState(false);

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
        });
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New Trial Customer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
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
                  <Button
                    className="w-full"
                    onClick={handleSendInvite}
                    disabled={
                      sending ||
                      !inviteForm.name ||
                      !inviteForm.email ||
                      !inviteForm.company_name
                    }
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
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
