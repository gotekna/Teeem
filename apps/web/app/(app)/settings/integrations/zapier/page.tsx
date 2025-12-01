"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Webhook,
  Clock,
  Activity,
} from "lucide-react";

interface ZapierStatus {
  connected: boolean;
  organization_name?: string;
  user_email?: string;
  connected_at?: string;
  active_webhooks_count: number;
  total_events_today: number;
}

interface ZapierWebhook {
  id: string;
  event: string;
  target_url: string;
  status: "active" | "paused" | "failed";
  last_triggered_at?: string;
  delivery_count: number;
}

interface ZapierActivityLog {
  id: string;
  event: string;
  timestamp: string;
  status: "success" | "failed";
  response_time_ms?: number;
}

// Mock data for development
const mockStatus: ZapierStatus = {
  connected: true,
  organization_name: "Teeem Demo",
  user_email: "admin@teeem.com.au",
  connected_at: "2024-01-15T10:00:00Z",
  active_webhooks_count: 5,
  total_events_today: 47,
};

const mockWebhooks: ZapierWebhook[] = [
  {
    id: "1",
    event: "contact.created",
    target_url: "https://hooks.zapier.com/hooks/catch/123/abc",
    status: "active",
    last_triggered_at: "2024-01-16T14:30:00Z",
    delivery_count: 23,
  },
  {
    id: "2",
    event: "job.status_changed",
    target_url: "https://hooks.zapier.com/hooks/catch/123/def",
    status: "active",
    last_triggered_at: "2024-01-16T12:15:00Z",
    delivery_count: 15,
  },
  {
    id: "3",
    event: "purchase_order.approved",
    target_url: "https://hooks.zapier.com/hooks/catch/123/ghi",
    status: "active",
    last_triggered_at: "2024-01-16T09:45:00Z",
    delivery_count: 8,
  },
];

const mockActivityLog: ZapierActivityLog[] = [
  { id: "1", event: "contact.created", timestamp: "2024-01-16T14:30:00Z", status: "success", response_time_ms: 150 },
  { id: "2", event: "job.status_changed", timestamp: "2024-01-16T12:15:00Z", status: "success", response_time_ms: 120 },
  { id: "3", event: "document.uploaded", timestamp: "2024-01-16T11:00:00Z", status: "success", response_time_ms: 200 },
  { id: "4", event: "purchase_order.approved", timestamp: "2024-01-16T09:45:00Z", status: "failed", response_time_ms: 5000 },
  { id: "5", event: "contact.updated", timestamp: "2024-01-16T08:30:00Z", status: "success", response_time_ms: 95 },
];

export default function ZapierIntegrationPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<ZapierStatus | null>(null);
  const [webhooks, setWebhooks] = React.useState<ZapierWebhook[]>([]);
  const [activityLog, setActivityLog] = React.useState<ZapierActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: Replace with actual API calls when backend is ready
        // const statusData = await api.zapier.getStatus();
        // const webhooksData = await api.zapier.getWebhooks();
        // const activityData = await api.zapier.getActivityLog({ limit: 5 });

        // Using mock data for now
        setStatus(mockStatus);
        setWebhooks(mockWebhooks);
        setActivityLog(mockActivityLog);
      } catch (error) {
        console.error("Failed to fetch Zapier data:", error);
        setStatus({ connected: false, active_webhooks_count: 0, total_events_today: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // TODO: Replace with actual API call
      // const { url } = await api.zapier.getAuthUrl();
      // window.location.href = url;

      // For demo, simulate redirect
      alert("This will redirect to Zapier OAuth flow once backend is ready");
    } catch (error) {
      console.error("Failed to get Zapier auth URL:", error);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // TODO: Replace with actual API call
      // await api.zapier.disconnect();
      setStatus({ connected: false, active_webhooks_count: 0, total_events_today: 0 });
      setWebhooks([]);
    } catch (error) {
      console.error("Failed to disconnect Zapier:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatEventName = (event: string) => {
    return event
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" → ");
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Zapier Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Teeem with 5,000+ apps through Zapier
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                <img
                  src="https://logo.clearbit.com/zapier.com"
                  alt="Zapier"
                  className="h-8 w-8 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <Zap className="h-6 w-6 text-orange-600 hidden" />
              </div>
              <div>
                <CardTitle>Zapier</CardTitle>
                <CardDescription>Automation & integration platform</CardDescription>
              </div>
            </div>
            {status?.connected ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.connected ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{status.organization_name || "Unknown"}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Connected Since</p>
                  <p className="font-medium">
                    {status.connected_at
                      ? new Date(status.connected_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Unknown"}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Active Webhooks</p>
                  <p className="font-medium">{status.active_webhooks_count}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Events Today</p>
                  <p className="font-medium">{status.total_events_today}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? "animate-spin" : ""}`} />
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
                <Button variant="outline" asChild>
                  <a href="https://zapier.com/app/zaps" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Zaps
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Not Connected</AlertTitle>
                <AlertDescription>
                  Connect your Zapier account to automate workflows between Teeem and 5,000+ other apps.
                </AlertDescription>
              </Alert>

              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Connect to Zapier
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Webhooks - only show when connected */}
      {status?.connected && webhooks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Active Webhooks</CardTitle>
                <CardDescription>Triggers currently sending data to Zapier</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="text-right">Deliveries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">
                      {formatEventName(webhook.event)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={webhook.status === "active" ? "default" : "destructive"}
                        className={
                          webhook.status === "active"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : ""
                        }
                      >
                        {webhook.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {webhook.last_triggered_at
                        ? formatTimeAgo(webhook.last_triggered_at)
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">{webhook.delivery_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - only show when connected */}
      {status?.connected && activityLog.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest webhook deliveries</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityLog.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {formatEventName(log.event)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(log.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {log.response_time_ms}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Available Triggers & Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Available Triggers & Actions</CardTitle>
          <CardDescription>What you can automate with the Zapier integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Triggers */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                Triggers (Start a Zap when...)
              </h3>
              <div className="space-y-2">
                {[
                  "New Contact Created",
                  "Contact Updated",
                  "New Job Created",
                  "Job Status Changed",
                  "New Purchase Order",
                  "Purchase Order Approved",
                  "New Estimate",
                  "Estimate Approved",
                  "Document Uploaded",
                  "Document Verified",
                ].map((trigger) => (
                  <div
                    key={trigger}
                    className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {trigger}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Actions (Do this in Teeem)
              </h3>
              <div className="space-y-2">
                {[
                  "Create Contact",
                  "Update Contact",
                  "Create Job",
                  "Update Job Status",
                  "Create Purchase Order",
                  "Create Estimate",
                  "Find Contact",
                  "Find Job",
                  "Find Purchase Order",
                  "Find Document",
                ].map((action) => (
                  <div
                    key={action}
                    className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted"
                  >
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    {action}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Popular Zap Ideas */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Automations</CardTitle>
          <CardDescription>Get started with these common workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="p-2 bg-blue-100 rounded">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.46 6c-.85.38-1.78.64-2.75.76 1-.6 1.76-1.55 2.12-2.68-.93.55-1.96.95-3.06 1.17-.88-.94-2.13-1.53-3.51-1.53-2.66 0-4.81 2.16-4.81 4.81 0 .38.04.75.13 1.1-4-.2-7.58-2.11-9.96-5.02-.42.72-.66 1.56-.66 2.46 0 1.68.85 3.16 2.14 4.02-.79-.02-1.53-.24-2.18-.6v.06c0 2.35 1.67 4.31 3.88 4.76-.4.1-.83.16-1.27.16-.31 0-.62-.03-.92-.08.63 1.96 2.45 3.39 4.61 3.43-1.69 1.32-3.83 2.1-6.15 2.1-.4 0-.8-.02-1.19-.07 2.19 1.4 4.78 2.22 7.57 2.22 9.07 0 14.02-7.52 14.02-14.02 0-.21 0-.42-.01-.63.96-.69 1.79-1.56 2.45-2.55z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Post to Slack on New Job</p>
                <p className="text-sm text-muted-foreground">
                  Notify your team channel when a new job is created
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="p-2 bg-green-100 rounded">
                <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.7 3H4.3A1.3 1.3 0 0 0 3 4.3v15.4A1.3 1.3 0 0 0 4.3 21h15.4a1.3 1.3 0 0 0 1.3-1.3V4.3A1.3 1.3 0 0 0 19.7 3zm-1.8 15.8H6V16h11.9v2.8zM18 14.2H6v-2.8h12v2.8zm0-4.6H6V6.8h12v2.8z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Add Contacts to Google Sheets</p>
                <p className="text-sm text-muted-foreground">
                  Log every new contact to a spreadsheet
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="p-2 bg-purple-100 rounded">
                <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Email on PO Approval</p>
                <p className="text-sm text-muted-foreground">
                  Send email to supplier when PO is approved
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="p-2 bg-orange-100 rounded">
                <svg className="h-5 w-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Sync Documents to Dropbox</p>
                <p className="text-sm text-muted-foreground">
                  Backup uploaded documents to cloud storage
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
