"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mail,
  RefreshCw,
  CheckCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  Inbox,
  MailOpen,
  Clock,
  Database,
  HardDrive,
  Paperclip,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface MailboxStats {
  email: string;
  email_count: number;
  unread_count: number;
  attachment_count: number;
  blob_count: number;
  last_email_received_at: string | null;
  last_synced_at: string | null;
}

interface OrganizationStats {
  id: number;
  type: "microsoft" | "imap" | "orphaned";
  name: string;
  status: string;
  last_sync_at: string | null;
  total_emails: number;
  mailboxes: MailboxStats[];
  sync_config: {
    sync_all: boolean;
    sync_years?: number;
  };
}

interface StorageStats {
  total_blobs: number;
  total_size_bytes: number;
  email_attachments: number;
}

interface SyncDashboardData {
  total_emails: number;
  total_mailboxes: number;
  organizations: OrganizationStats[];
  storage?: StorageStats;
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface SyncProgress {
  orgId: number;
  orgName: string;
  orgType: "microsoft" | "imap";
  status: "syncing" | "success" | "error";
  error?: string;
  emailCount: number;
  startTime: number;
  completedInSeconds?: number;
}

export function EmailSyncDashboardTab() {
  const { toast } = useToast();
  const [data, setData] = useState<SyncDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set());
  const [syncingOrgId, setSyncingOrgId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Update elapsed time every second when syncing
  useEffect(() => {
    if (!syncProgress || syncProgress.status !== "syncing") {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - syncProgress.startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [syncProgress?.status, syncProgress?.startTime]);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: SyncDashboardData;
      }>("/api/v1/synced_emails/sync_dashboard");

      if (response.success) {
        setData(response.data);
        // Auto-expand all organizations on first load
        if (expandedOrgs.size === 0 && response.data.organizations.length > 0) {
          setExpandedOrgs(new Set(response.data.organizations.map(o => o.id)));
        }
      }
    } catch (error) {
      console.error("Failed to fetch sync dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [expandedOrgs.size]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSyncOrg = async (orgId: number, orgType: "microsoft" | "imap" | "orphaned", orgName: string) => {
    if (orgType === "orphaned") {
      toast({
        title: "Cannot Sync",
        description: "Orphaned mailboxes have no credential. Link them to an account first.",
        variant: "destructive",
      });
      return;
    }

    // Get current email count for this org
    const org = data?.organizations.find(o => o.id === orgId);
    const initialEmailCount = org?.total_emails || 0;

    // Open progress dialog
    setSyncProgress({
      orgId,
      orgName,
      orgType: orgType as "microsoft" | "imap",
      status: "syncing",
      emailCount: initialEmailCount,
      startTime: Date.now(),
    });

    setSyncingOrgId(orgId);
    try {
      if (orgType === "imap") {
        await api.post(`/api/v1/imap_credentials/${orgId}/sync`);
      } else {
        await api.post(`/api/v1/microsoft_app/${orgId}/sync`, { full_sync: true });
      }
      // Polling will update the status
    } catch (error) {
      console.error("Failed to trigger sync:", error);
      setSyncProgress(prev => prev ? { ...prev, status: "error", error: "Failed to trigger sync" } : null);
      setSyncingOrgId(null);
    }
  };

  // Poll sync status when syncing
  useEffect(() => {
    if (!syncProgress || syncProgress.status !== "syncing") return;

    const pollInterval = setInterval(async () => {
      try {
        if (syncProgress.orgType === "imap") {
          const response = await api.get<{
            success: boolean;
            data: {
              sync_status: string;
              sync_error: string | null;
              email_count: number;
            };
          }>(`/api/v1/imap_credentials/${syncProgress.orgId}/sync_status`);

          if (response.success) {
            const { sync_status, sync_error, email_count } = response.data;

            if (sync_status === "error") {
              const completedTime = Math.floor((Date.now() - syncProgress.startTime) / 1000);
              setSyncProgress(prev => prev ? { ...prev, status: "error", error: sync_error || "Unknown error", completedInSeconds: completedTime } : null);
              setSyncingOrgId(null);
              clearInterval(pollInterval);
            } else if (sync_status === "idle" || sync_status === "success") {
              const completedTime = Math.floor((Date.now() - syncProgress.startTime) / 1000);
              setSyncProgress(prev => prev ? { ...prev, status: "success", emailCount: email_count, completedInSeconds: completedTime } : null);
              setSyncingOrgId(null);
              clearInterval(pollInterval);
              // Refresh dashboard
              setTimeout(fetchDashboard, 1000);
            } else {
              // Still syncing, update email count
              setSyncProgress(prev => prev ? { ...prev, emailCount: email_count } : null);
            }
          }
        } else {
          // For MS365, we don't have a status endpoint yet, so just refresh after 30 seconds
          const elapsed = Date.now() - syncProgress.startTime;
          if (elapsed > 30000) {
            const completedTime = Math.floor(elapsed / 1000);
            setSyncProgress(prev => prev ? { ...prev, status: "success", completedInSeconds: completedTime } : null);
            setSyncingOrgId(null);
            clearInterval(pollInterval);
            fetchDashboard();
          }
        }
      } catch (error) {
        console.error("Failed to poll sync status:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [syncProgress?.orgId, syncProgress?.status, syncProgress?.orgType, syncProgress?.startTime, fetchDashboard]);

  const toggleOrgExpand = (orgId: number) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Unable to load sync dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.organizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No Microsoft 365 organizations connected.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect an organization in Admin &rarr; System &rarr; Connections
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards - Row 1: Email Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(data.total_emails)}</p>
                <p className="text-xs text-muted-foreground">Total Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.organizations.length}</p>
                <p className="text-xs text-muted-foreground">Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Inbox className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(data.total_mailboxes)}</p>
                <p className="text-xs text-muted-foreground">Mailboxes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Row 2: Storage Stats */}
      {data.storage && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <HardDrive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(data.storage.total_blobs)}</p>
                  <p className="text-xs text-muted-foreground">Storage Blobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatBytes(data.storage.total_size_bytes)}</p>
                  <p className="text-xs text-muted-foreground">Total Storage</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <Paperclip className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(data.storage.email_attachments)}</p>
                  <p className="text-xs text-muted-foreground">Email Attachments</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organization Cards */}
      {data.organizations.map(org => (
        <Card key={org.id}>
          <Collapsible
            open={expandedOrgs.has(org.id)}
            onOpenChange={() => toggleOrgExpand(org.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    {expandedOrgs.has(org.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      org.type === "orphaned"
                        ? "bg-yellow-100 dark:bg-yellow-900"
                        : org.type === "imap"
                        ? "bg-green-100 dark:bg-green-900"
                        : "bg-blue-100 dark:bg-blue-900"
                    }`}>
                      {org.type === "orphaned" ? (
                        <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      ) : org.type === "imap" ? (
                        <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base">{org.name}</CardTitle>
                      <CardDescription>
                        {formatNumber(org.total_emails)} emails across {org.mailboxes.length} mailboxes
                      </CardDescription>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-3">
                  <Badge variant={org.type === "orphaned" ? "destructive" : "outline"} className="text-xs">
                    {org.type === "orphaned" ? "⚠ Orphaned" : org.type === "imap" ? "IMAP" : "MS365"}
                  </Badge>
                  <Badge variant={org.status === "connected" ? "default" : org.status === "warning" ? "secondary" : "secondary"}>
                    {org.status === "connected" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      org.status
                    )}
                  </Badge>
                  {org.sync_config.sync_all && (
                    <Badge variant="outline" className="text-xs">
                      Sync All
                    </Badge>
                  )}
                  {org.type !== "orphaned" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncOrg(org.id, org.type, org.name);
                            }}
                            disabled={syncingOrgId === org.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-1 ${syncingOrgId === org.id ? "animate-spin" : ""}`}
                            />
                            Sync
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Trigger a full sync of all mailboxes</p>
                          <p className="text-xs text-muted-foreground">This may take several minutes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent>
                {org.mailboxes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No mailboxes synced yet. Click Sync to start.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                      <TableHeader>
                        <TableRow className="border-b">
                          <TableHead className="text-left py-2 font-medium text-muted-foreground">
                            Mailbox
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Mail className="h-4 w-4" />
                              Emails
                            </div>
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <MailOpen className="h-4 w-4" />
                              Unread
                            </div>
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Paperclip className="h-4 w-4" />
                              Attachments
                            </div>
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <HardDrive className="h-4 w-4" />
                              Blobs
                            </div>
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-4 w-4" />
                              Last Email
                            </div>
                          </TableHead>
                          <TableHead className="text-right py-2 font-medium text-muted-foreground">
                            Last Synced
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {org.mailboxes.map(mailbox => (
                          <TableRow key={mailbox.email} className="border-b last:border-b-0 hover:bg-muted/50">
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Mail className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-medium">{mailbox.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <span className="font-mono">{formatNumber(mailbox.email_count)}</span>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {mailbox.unread_count > 0 ? (
                                <Badge variant="secondary" className="font-mono">
                                  {formatNumber(mailbox.unread_count)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {mailbox.attachment_count > 0 ? (
                                <span className="font-mono">{formatNumber(mailbox.attachment_count)}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {mailbox.blob_count > 0 ? (
                                <span className={`font-mono ${mailbox.blob_count < mailbox.attachment_count ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                                  {formatNumber(mailbox.blob_count)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {mailbox.last_email_received_at ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="cursor-default">
                                      <span className="text-muted-foreground">
                                        {formatDistanceToNow(new Date(mailbox.last_email_received_at), { addSuffix: true })}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {format(new Date(mailbox.last_email_received_at), "PPpp")}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {mailbox.last_synced_at ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="cursor-default">
                                      <span className="text-muted-foreground">
                                        {formatDistanceToNow(new Date(mailbox.last_synced_at), { addSuffix: true })}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {format(new Date(mailbox.last_synced_at), "PPpp")}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {/* Refresh button */}
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="sm" onClick={() => fetchDashboard()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Dashboard
        </Button>
      </div>

      {/* Sync Progress Dialog */}
      <Dialog open={syncProgress !== null} onOpenChange={(open) => !open && syncProgress?.status !== "syncing" && setSyncProgress(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syncProgress?.status === "syncing" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  Syncing Emails
                </>
              ) : syncProgress?.status === "success" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Sync Complete
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Sync Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {syncProgress?.orgName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {syncProgress?.status === "syncing" && (
              <>
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="h-10 w-10 text-blue-500 animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Fetching emails from server...
                  </p>
                  <p className="text-lg font-semibold">
                    {formatNumber(syncProgress.emailCount)} emails
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Elapsed: {elapsedSeconds}s</span>
                    <span>~{Math.max(1, Math.ceil(syncProgress.emailCount / 500))} min estimated</span>
                  </div>
                  <Progress value={undefined} className="h-2" />
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  This dialog will update automatically. You can close it and the sync will continue in the background.
                </p>
              </>
            )}

            {syncProgress?.status === "success" && (
              <div className="text-center space-y-4">
                <div className="h-20 w-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {formatNumber(syncProgress.emailCount)} emails synced
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Completed in {syncProgress.completedInSeconds || 0} seconds
                  </p>
                </div>
                <Button onClick={() => setSyncProgress(null)}>
                  Close
                </Button>
              </div>
            )}

            {syncProgress?.status === "error" && (
              <div className="text-center space-y-4">
                <div className="h-20 w-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    Sync Failed
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {syncProgress.error || "An unknown error occurred"}
                  </p>
                </div>
                <Button onClick={() => setSyncProgress(null)} variant="outline">
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
