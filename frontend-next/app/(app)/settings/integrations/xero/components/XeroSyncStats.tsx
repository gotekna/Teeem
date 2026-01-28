"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  FileText,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Building2,
  Activity,
  ChevronRight,
  Eye,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface TenantContactStats {
  total_links: number;
  sync_enabled: number;
  pending_review: number;
  with_errors: number;
  cross_tenant_matches: number;
  last_synced_at: string | null;
}

interface TenantDocStats {
  invoices: number;
  bills: number;
  quotes: number;
  credit_notes: number;
  total: number;
  last_synced_at: string | null;
}

interface MatchBreakdown {
  exact_abn: number;
  exact_email: number;
  fuzzy_name: number;
  manual: number;
}

interface TenantRateLimits {
  daily_percentage: number;
  minute_percentage: number;
  is_limited: boolean;
}

interface TenantPdfSyncStats {
  total: number;
  synced: number;
  pending: number;
  percentage: number;
  last_synced_at: string | null;
  next_sync_at: string | null;
  schedule: string | null;
  blocker: {
    reason: string;
    detail: string;
    pending_count?: number;
    sync_mode?: string;
    daily_percentage?: number;
    resets_at?: string;
    resets_at_display?: string;
  } | null;
  breakdown: {
    bills: { total: number; synced: number };
    sales_invoices: { total: number; synced: number };
    credit_notes: { total: number; synced: number };
    quotes: { total: number; synced: number };
  } | null;
}

interface TenantDataSyncStats {
  total_in_database: number;
  linked_to_contacts: number;
  unlinked_count: number;
  last_synced_at: string | null;
  next_sync_at: string | null;
  schedule: string | null;
  blocker: {
    reason: string;
    detail: string;
    unlinked_count: number;
    unlinked_contact_count: number;
  } | null;
}

interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  is_primary: boolean;
  contacts: TenantContactStats;
  documents: TenantDocStats;
  match_breakdown: MatchBreakdown;
  rate_limits: TenantRateLimits | null;
  pdf_sync?: TenantPdfSyncStats;
  data_sync?: TenantDataSyncStats;
}

interface PendingReviewItem {
  id: number;
  contact_id: number;
  contact_name: string;
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
  external_contact_name: string;
  match_type: string;
  match_confidence: number;
  created_at: string;
}

interface GlobalStats {
  pending_reviews: {
    count: number;
    items: PendingReviewItem[];
  };
  cross_tenant: {
    contacts_linked_to_multiple_tenants: number;
    multi_tenant_contact_ids: number[];
  };
  match_breakdown: MatchBreakdown & { total: number };
  totals: {
    contacts_with_links: number;
    total_links: number;
    invoices: number;
    bills: number;
    quotes: number;
    credit_notes: number;
    all_documents: number;
  };
  recent_activity: {
    contact_syncs_24h: number;
    invoice_syncs_24h: number;
  };
}

interface SyncStatsData {
  tenant_count: number;
  tenants: TenantStats[];
  global: GlobalStats;
}

export function XeroSyncStats() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SyncStatsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: SyncStatsData }>("/api/v1/xero/sync_stats");
      if (response.success) {
        // Enrich tenant data with PDF sync stats and data sync stats
        const enrichedTenants = await Promise.all(
          response.data.tenants.map(async (tenant) => {
            try {
              const pdfResponse = await api.get<{ success: boolean; data: any }>(
                `/api/v1/xero/pdf_sync_status?tenant_id=${tenant.tenant_id}`
              );
              if (pdfResponse.success && pdfResponse.data) {
                const stage1 = pdfResponse.data.stage1_data_sync;
                const stage2 = pdfResponse.data.stage2_pdf_download || pdfResponse.data;
                return {
                  ...tenant,
                  data_sync: stage1 ? {
                    total_in_database: stage1.total_in_database || 0,
                    linked_to_contacts: stage1.linked_to_contacts || 0,
                    unlinked_count: stage1.unlinked_count || 0,
                    last_synced_at: stage1.last_synced_at || null,
                    next_sync_at: stage1.next_sync_at || null,
                    schedule: stage1.schedule || null,
                    blocker: stage1.blocker || null,
                  } : undefined,
                  pdf_sync: {
                    total: stage2.total_to_sync || 0,
                    synced: stage2.downloaded || 0,
                    pending: stage2.pending || 0,
                    percentage: stage2.progress_percentage || 0,
                    last_synced_at: stage2.last_synced_at || null,
                    next_sync_at: stage2.next_sync_at || null,
                    schedule: stage2.schedule || null,
                    blocker: stage2.blocker || null,
                    breakdown: stage2.breakdown || null,
                  },
                };
              }
            } catch (e) {
              console.error(`Failed to fetch PDF sync for ${tenant.tenant_name}:`, e);
            }
            return tenant;
          })
        );
        setData({ ...response.data, tenants: enrichedTenants });
        setError(null);
      } else {
        setError("Failed to fetch sync stats");
      }
    } catch (err) {
      console.error("Failed to fetch sync stats:", err);
      setError("Failed to load sync statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSyncContacts = async () => {
    setSyncing("contacts");
    try {
      await api.post("/api/v1/xero/sync_contacts");
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      console.error("Failed to sync contacts:", err);
    } finally {
      setSyncing(null);
    }
  };

  const handleFullImport = async () => {
    setSyncing("full");
    try {
      await api.post("/api/v1/xero/full_import");
      // Refresh data after import
      await fetchData();
    } catch (err) {
      console.error("Failed to run full import:", err);
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Spinner size={32} className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-muted-foreground">{error || "No data available"}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { global, tenants } = data;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Common sync operations</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {global.pending_reviews.count > 0 && (
              <Button
                variant="default"
                onClick={() => router.push("/contacts/quality-review")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Review {global.pending_reviews.count} Pending Matches
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSyncContacts}
              disabled={syncing !== null}
            >
              {syncing === "contacts" ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Sync All Contacts
            </Button>
            <Button
              variant="outline"
              onClick={handleFullImport}
              disabled={syncing !== null}
            >
              {syncing === "full" ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Full Import (Contacts + Invoices)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Global Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contacts Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base">Contacts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{global.totals.contacts_with_links.toLocaleString()}</span>
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {global.totals.total_links.toLocaleString()} links
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cross-tenant</span>
                  <span className="font-medium">{global.cross_tenant.contacts_linked_to_multiple_tenants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Synced (24h)</span>
                  <span className="font-medium">{global.recent_activity.contact_syncs_24h}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded">
                <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-base">Documents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{global.totals.all_documents.toLocaleString()}</span>
                <Badge className="bg-status-success text-status-success-foreground">
                  {global.recent_activity.invoice_syncs_24h} synced today
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-medium">{global.totals.invoices.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bills</span>
                  <span className="font-medium">{global.totals.bills.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quotes</span>
                  <span className="font-medium">{global.totals.quotes.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Match Quality */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded">
                <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-base">Match Quality</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {global.match_breakdown.total > 0
                    ? Math.round(((global.match_breakdown.exact_abn + global.match_breakdown.exact_email) / global.match_breakdown.total) * 100)
                    : 0}%
                </span>
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  auto-matched
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ABN match</span>
                  <span className="font-medium">{global.match_breakdown.exact_abn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email match</span>
                  <span className="font-medium">{global.match_breakdown.exact_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuzzy (review)</span>
                  <span className="font-medium text-amber-600">{global.match_breakdown.fuzzy_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manual</span>
                  <span className="font-medium">{global.match_breakdown.manual}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reviews Alert */}
      {global.pending_reviews.count > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base text-amber-800">
                  {global.pending_reviews.count} Fuzzy Matches Need Review
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => router.push("/contacts/quality-review")}
              >
                Review All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {global.pending_reviews.items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.contact_name || "Unknown"}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{item.external_contact_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.tenant_name} &bull; {Math.round((item.match_confidence || 0) * 100)}% confidence
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/contacts/${item.contact_id}`)}
                  >
                    Review
                  </Button>
                </div>
              ))}
              {global.pending_reviews.count > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{global.pending_reviews.count - 5} more pending reviews
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Tenant Stats - 2 Column Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Xero Organizations</h3>
          <Badge className="bg-muted text-muted-foreground">{tenants.length} connected</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenants
            .sort((a, b) => {
              if (a.is_primary) return -1;
              if (b.is_primary) return 1;
              return a.tenant_name.localeCompare(b.tenant_name);
            })
            .map((tenant) => (
              <Card
                key={tenant.tenant_id}
                className={`${
                  tenant.is_primary
                    ? "border-cyan-300 bg-cyan-50/50"
                    : tenant.rate_limits?.is_limited
                    ? "border-amber-300 bg-amber-50/50"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">{tenant.tenant_name}</CardTitle>
                      {tenant.is_primary && (
                        <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 text-xs">Primary</Badge>
                      )}
                    </div>
                    <Badge
                      className={`text-xs ${
                        tenant.status === "connected"
                          ? "bg-status-success text-status-success-foreground"
                          : "bg-status-warning text-status-warning-foreground"
                      }`}
                    >
                      {tenant.status === "connected" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {tenant.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stage 1 & Stage 2 Progress */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Stage 1: Xero Data */}
                    <div className="p-2 bg-muted/30 rounded border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Stage 1</span>
                        <span className="text-xs font-medium text-green-600">100%</span>
                      </div>
                      <div className="text-sm font-medium">Xero Data</div>
                      <Progress value={100} className="h-1.5 mt-1 [&>div]:bg-green-500" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {tenant.documents.total.toLocaleString()} / {tenant.documents.total.toLocaleString()}
                      </div>
                      {/* Stage 1 Timing */}
                      {tenant.data_sync && (
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
                          <span>
                            Last: {tenant.data_sync.last_synced_at
                              ? formatDistanceToNow(new Date(tenant.data_sync.last_synced_at), { addSuffix: false })
                              : "—"}
                          </span>
                          <span>
                            Next: {tenant.data_sync.next_sync_at
                              ? formatDistanceToNow(new Date(tenant.data_sync.next_sync_at), { addSuffix: false })
                              : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Stage 2: PDF Sync */}
                    <div className="p-2 bg-muted/30 rounded border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Stage 2</span>
                        <span className={`text-xs font-medium ${(tenant.pdf_sync?.percentage || 0) >= 100 ? "text-green-600" : "text-blue-600"}`}>
                          {tenant.pdf_sync?.percentage?.toFixed(1) || 0}%
                        </span>
                      </div>
                      <div className="text-sm font-medium">PDF Sync</div>
                      <Progress
                        value={tenant.pdf_sync?.percentage || 0}
                        className={`h-1.5 mt-1 ${(tenant.pdf_sync?.percentage || 0) >= 100 ? "[&>div]:bg-green-500" : "[&>div]:bg-blue-500"}`}
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {(tenant.pdf_sync?.synced || 0).toLocaleString()} / {(tenant.pdf_sync?.total || tenant.documents.total).toLocaleString()}
                      </div>
                      {/* Stage 2 Timing */}
                      {tenant.pdf_sync && (
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
                          <span>
                            Last: {tenant.pdf_sync.last_synced_at
                              ? formatDistanceToNow(new Date(tenant.pdf_sync.last_synced_at), { addSuffix: false })
                              : "—"}
                          </span>
                          <span>
                            Next: {tenant.pdf_sync.next_sync_at
                              ? formatDistanceToNow(new Date(tenant.pdf_sync.next_sync_at), { addSuffix: false })
                              : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {tenant.data_sync?.schedule && (
                      <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {tenant.data_sync.schedule}
                      </span>
                    )}
                    {tenant.pdf_sync?.schedule && (
                      <span className="bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">
                        {tenant.pdf_sync.schedule}
                      </span>
                    )}
                  </div>

                  {/* Stage 1 Blocker - Unlinked Contacts */}
                  {tenant.data_sync?.blocker && (
                    <button
                      onClick={() => router.push(`/settings/integrations/xero?tab=contacts&sheet=unlinked`)}
                      className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors w-full text-left border border-amber-200 dark:border-amber-800"
                    >
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{tenant.data_sync.blocker.reason}</span>
                      <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />
                    </button>
                  )}

                  {/* Stage 2 Blocker - Rate Limiting / Catching Up */}
                  {tenant.pdf_sync?.blocker && (
                    <div className={`text-xs p-2 rounded border ${
                      tenant.pdf_sync.blocker.sync_mode === "rate_limited"
                        ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                        : tenant.pdf_sync.blocker.sync_mode === "catching_up"
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      <div className="flex items-center gap-2">
                        {tenant.pdf_sync.blocker.sync_mode === "rate_limited" ? (
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <Activity className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="font-medium">{tenant.pdf_sync.blocker.reason}</span>
                      </div>
                      <div className="text-[10px] mt-1 opacity-80">{tenant.pdf_sync.blocker.detail}</div>
                      {tenant.pdf_sync.blocker.resets_at_display && (
                        <div className="text-[10px] mt-1">
                          Resets: {tenant.pdf_sync.blocker.resets_at_display}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDF Breakdown by Type */}
                  {tenant.pdf_sync?.breakdown && (
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="text-center p-1 bg-muted/30 rounded">
                        <div className="font-medium">{tenant.pdf_sync.breakdown.bills.synced}/{tenant.pdf_sync.breakdown.bills.total}</div>
                        <div className="text-muted-foreground">Bills</div>
                      </div>
                      <div className="text-center p-1 bg-muted/30 rounded">
                        <div className="font-medium">{tenant.pdf_sync.breakdown.sales_invoices.synced}/{tenant.pdf_sync.breakdown.sales_invoices.total}</div>
                        <div className="text-muted-foreground">Invoices</div>
                      </div>
                      <div className="text-center p-1 bg-muted/30 rounded">
                        <div className="font-medium">{tenant.pdf_sync.breakdown.quotes.synced}/{tenant.pdf_sync.breakdown.quotes.total}</div>
                        <div className="text-muted-foreground">Quotes</div>
                      </div>
                      <div className="text-center p-1 bg-muted/30 rounded">
                        <div className="font-medium">{tenant.pdf_sync.breakdown.credit_notes.synced}/{tenant.pdf_sync.breakdown.credit_notes.total}</div>
                        <div className="text-muted-foreground">Credits</div>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold">{tenant.contacts.total_links}</div>
                      <div className="text-xs text-muted-foreground">Contacts</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold">{tenant.documents.total}</div>
                      <div className="text-xs text-muted-foreground">Documents</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold">{tenant.contacts.cross_tenant_matches}</div>
                      <div className="text-xs text-muted-foreground">Shared</div>
                    </div>
                  </div>

                  {/* Document breakdown */}
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>{tenant.documents.invoices} invoices</span>
                    <span>{tenant.documents.bills} bills</span>
                    <span>{tenant.documents.quotes} quotes</span>
                  </div>

                  {/* Rate Limits */}
                  {tenant.rate_limits && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Daily API</span>
                        <span className={`font-medium ${tenant.rate_limits.daily_percentage >= 80 ? "text-amber-600" : ""}`}>
                          {tenant.rate_limits.daily_percentage}%
                        </span>
                      </div>
                      <Progress
                        value={tenant.rate_limits.daily_percentage}
                        className={`h-2 ${tenant.rate_limits.daily_percentage >= 80 ? "[&>div]:bg-amber-500" : ""}`}
                      />
                    </div>
                  )}

                  {/* Pending Reviews Warning - Clickable to review page */}
                  {tenant.contacts.pending_review > 0 && (
                    <button
                      onClick={() => router.push("/contacts/quality-review")}
                      className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer transition-colors w-full text-left"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {tenant.contacts.pending_review} pending review
                    </button>
                  )}

                  {/* Last Sync */}
                  {tenant.contacts.last_synced_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Synced {formatDistanceToNow(new Date(tenant.contacts.last_synced_at), { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
