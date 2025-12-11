"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  FileText,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                onClick={() => router.push("/contacts?filter=pending_review")}
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base">Contacts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{global.totals.contacts_with_links.toLocaleString()}</span>
                <Badge className="bg-blue-100 text-blue-800">
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
                <FileText className="h-4 w-4 text-green-600" />
              </div>
              <CardTitle className="text-base">Documents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{global.totals.all_documents.toLocaleString()}</span>
                <Badge className="bg-green-100 text-green-800">
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
                <Link2 className="h-4 w-4 text-purple-600" />
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
                <Badge className="bg-purple-100 text-purple-800">
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
        <Card className="border-amber-200 bg-amber-50">
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
                onClick={() => router.push("/contacts?filter=pending_review")}
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
                  className="flex items-center justify-between p-2 bg-white rounded border border-amber-200"
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

      {/* Per-Tenant Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Per-Organization Stats</CardTitle>
          </div>
          <CardDescription>
            Sync status for each connected Xero organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenants
              .sort((a, b) => {
                if (a.is_primary) return -1;
                if (b.is_primary) return 1;
                return a.tenant_name.localeCompare(b.tenant_name);
              })
              .map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className={`p-4 rounded-lg border ${
                    tenant.is_primary
                      ? "bg-cyan-50 border-cyan-200"
                      : tenant.rate_limits?.is_limited
                      ? "bg-amber-50 border-amber-200"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tenant.tenant_name}</span>
                      {tenant.is_primary && (
                        <Badge className="bg-cyan-100 text-cyan-800 text-xs">Primary</Badge>
                      )}
                      {tenant.rate_limits?.is_limited && (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          Rate Limited
                        </Badge>
                      )}
                    </div>
                    <Badge
                      className={
                        tenant.status === "connected"
                          ? "bg-green-100 text-green-800"
                          : tenant.status === "degraded"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      {tenant.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Contacts */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Contacts</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tenant.contacts.total_links}</span>
                        {tenant.contacts.pending_review > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs">
                            {tenant.contacts.pending_review} review
                          </Badge>
                        )}
                      </div>
                      {tenant.contacts.last_synced_at && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(tenant.contacts.last_synced_at), { addSuffix: true })}
                        </div>
                      )}
                    </div>

                    {/* Documents */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Documents</div>
                      <div className="font-semibold">{tenant.documents.total}</div>
                      <div className="text-xs text-muted-foreground">
                        {tenant.documents.invoices}I / {tenant.documents.bills}B / {tenant.documents.quotes}Q
                      </div>
                    </div>

                    {/* Cross-tenant */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Cross-tenant</div>
                      <div className="font-semibold">{tenant.contacts.cross_tenant_matches}</div>
                      <div className="text-xs text-muted-foreground">shared contacts</div>
                    </div>

                    {/* Rate Limits */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">API Usage</div>
                      {tenant.rate_limits ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={tenant.rate_limits.daily_percentage}
                              className={`h-2 flex-1 ${
                                tenant.rate_limits.daily_percentage >= 80 ? "[&>div]:bg-amber-500" : ""
                              }`}
                            />
                            <span className="text-xs font-medium">{tenant.rate_limits.daily_percentage}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">daily limit</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No data</span>
                      )}
                    </div>
                  </div>

                  {/* Match breakdown for tenant */}
                  <div className="mt-3 pt-3 border-t border-dashed">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">Match types:</span>
                      {tenant.match_breakdown.exact_abn > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ABN: {tenant.match_breakdown.exact_abn}
                        </span>
                      )}
                      {tenant.match_breakdown.exact_email > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Email: {tenant.match_breakdown.exact_email}
                        </span>
                      )}
                      {tenant.match_breakdown.fuzzy_name > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Fuzzy: {tenant.match_breakdown.fuzzy_name}
                        </span>
                      )}
                      {tenant.match_breakdown.manual > 0 && (
                        <span>Manual: {tenant.match_breakdown.manual}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
