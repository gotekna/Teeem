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

interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  is_primary: boolean;
  contacts: TenantContactStats;
  documents: TenantDocStats;
  match_breakdown: MatchBreakdown;
  rate_limits: TenantRateLimits | null;
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
        setData(response.data);
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
                onClick={() => router.push("/contacts/filter/pending_review")}
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
                onClick={() => router.push("/contacts/filter/pending_review")}
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

                  {/* Pending Reviews Warning */}
                  {tenant.contacts.pending_review > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      <AlertTriangle className="h-3 w-3" />
                      {tenant.contacts.pending_review} pending review
                    </div>
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
