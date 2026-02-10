"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
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
  HardDrive,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { FuzzyMatchReviewModal } from "./FuzzyMatchReviewModal";
import { FuzzyMatchReviewSheet } from "./FuzzyMatchReviewSheet";
import { XeroOrgContactsDrilldownSheet } from "./XeroOrgContactsDrilldownSheet";

// Card height for virtual scrolling (estimated average)
const CARD_HEIGHT = 420;
// Number of cards to render outside viewport
const OVERSCAN = 3;
// Threshold for enabling virtual scrolling
const VIRTUAL_THRESHOLD = 10;

// TenantCard component for virtual scrolling (extracted for reuse)
interface TenantCardProps {
  tenant: TenantStats;
  router: ReturnType<typeof useRouter>;
  onOpenReviewSheet: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface TenantContactStats {
  total_links: number;
  sync_enabled: number;
  pending_review: number;
  with_errors: number;
  unlinked: number;
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

interface TotalsSummary {
  total_all: number;
  active: number;
  voided_deleted: number;
  synced: number;
  pending: number;
}

interface BlobHealth {
  total_blobs: number;
  validated: number;
  missing_hash: number;
  file_missing: number;
  health_percentage: number;
  status: "healthy" | "needs_validation" | "files_missing" | "no_blobs";
}

// SSoT: sync_health comes from XeroSyncStatus.health_summary() - shows when sync JOB ran
// NOT the same as contacts.last_synced_at which only updates when individual records change
interface SyncHealthEntry {
  status: string | null;
  health_status: "green" | "yellow" | "red";
  stale: boolean;
  last_synced_at: string | null;
  age_seconds: number | null;
  age_minutes: number | null;
  next_sync_at: string | null;
  records_synced: number | null;
  last_error: string | null;
  message: string;
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
  totals_summary?: TotalsSummary;
  blob_health?: BlobHealth;
  // SSoT for "Synced X ago" - shows when sync JOB ran (from XeroSyncStatus)
  sync_health?: {
    invoices?: SyncHealthEntry;
    contacts?: SyncHealthEntry;
    pdfs?: SyncHealthEntry;
    bank_transactions?: SyncHealthEntry;
  };
  overall_sync_health?: "green" | "yellow" | "red";
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

// Safe date formatting helper - prevents crashes from invalid dates
function safeFormatDistance(dateString: string | null | undefined, options?: { addSuffix?: boolean }): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, options);
  } catch {
    return "—";
  }
}

// TenantCard - Extracted for use in virtual scrolling
// Renders a single tenant organization card with stats
function TenantCard({ tenant, router, onOpenReviewSheet }: TenantCardProps) {
  return (
    <Card
      className={`h-full ${
        tenant.is_primary
          ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-700 dark:bg-cyan-950/30"
          : tenant.rate_limits?.is_limited
          ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30"
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
        {/* Stats Grid - Compact version */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">{tenant.contacts.total_links}</div>
            <div className="text-xs text-muted-foreground">Contacts</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">{tenant.documents.total}</div>
            <div className="text-xs text-muted-foreground">Documents</div>
          </div>
          {tenant.contacts.unlinked > 0 ? (
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{tenant.contacts.unlinked}</div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Unlinked</div>
            </div>
          ) : (
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
              <div className="text-lg font-bold text-green-700 dark:text-green-400">✓</div>
              <div className="text-xs text-green-600 dark:text-green-500">All Linked</div>
            </div>
          )}
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

        {/* PDF Sync Progress - Compact */}
        {tenant.pdf_sync && (
          <div className="p-2 bg-muted/30 rounded border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">PDF Sync</span>
              <span className={`text-xs font-medium ${(tenant.pdf_sync?.percentage || 0) >= 100 ? "text-green-600" : "text-blue-600"}`}>
                {tenant.pdf_sync?.percentage?.toFixed(1) || 0}%
              </span>
            </div>
            <Progress
              value={tenant.pdf_sync?.percentage || 0}
              className={`h-1.5 ${(tenant.pdf_sync?.percentage || 0) >= 100 ? "[&>div]:bg-green-500" : "[&>div]:bg-blue-500"}`}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {(tenant.pdf_sync?.synced || 0).toLocaleString()} / {(tenant.pdf_sync?.total || tenant.documents.total).toLocaleString()}
            </div>
          </div>
        )}

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
          <button
            onClick={onOpenReviewSheet}
            className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer transition-colors w-full text-left"
          >
            <AlertTriangle className="h-3 w-3" />
            {tenant.contacts.pending_review} pending review
          </button>
        )}

        {/* Last Sync */}
        {tenant.sync_health?.contacts?.last_synced_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                tenant.sync_health.contacts.health_status === "green" && "bg-green-500",
                tenant.sync_health.contacts.health_status === "yellow" && "bg-yellow-500",
                tenant.sync_health.contacts.health_status === "red" && "bg-red-500"
              )}
              title={tenant.sync_health.contacts.message}
            />
            <Clock className="h-3 w-3" />
            Synced {safeFormatDistance(tenant.sync_health?.contacts?.last_synced_at, { addSuffix: true })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function XeroSyncStats() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SyncStatsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [selectedReviewItem, setSelectedReviewItem] = React.useState<PendingReviewItem | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = React.useState(false);
  const [contactsDrilldownOpen, setContactsDrilldownOpen] = React.useState(false);

  // Search/filter state for large tenant lists (Scale to 15k feature)
  const [searchQuery, setSearchQuery] = React.useState("");
  // Track expanded tenant cards for lazy-loading PDF details
  const [expandedTenants, setExpandedTenants] = React.useState<Set<string>>(new Set());
  // Ref for virtual scroller container
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Light-weight callback to update pending count without refetching everything
  const handleReviewed = React.useCallback(() => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        global: {
          ...prev.global,
          pending_reviews: {
            ...prev.global.pending_reviews,
            count: Math.max(0, prev.global.pending_reviews.count - 1),
          },
        },
      };
    });
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      // Fetch sync_stats and global pdf_sync_status in parallel
      const [response, globalPdfResponse] = await Promise.all([
        api.get<{ success: boolean; data: SyncStatsData }>("/api/v1/xero/sync_stats"),
        api.get<{ success: boolean; data: any }>("/api/v1/xero/pdf_sync_status"), // No tenant_id = global
      ]);

      if (response.success) {
        // Extract global totals and blob health (single call, not aggregated)
        let globalTotals: TotalsSummary | undefined;
        let globalBlobHealth: BlobHealth | undefined;
        if (globalPdfResponse.success && globalPdfResponse.data) {
          globalTotals = globalPdfResponse.data.totals_summary;
          globalBlobHealth = globalPdfResponse.data.blob_health;
        }

        // Enrich tenant data with PDF sync stats (per-tenant for detailed view)
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

        // Store global totals on the first tenant (for the overview card to access)
        // This is a workaround - ideally we'd have a separate state for global stats
        if (enrichedTenants.length > 0 && globalTotals) {
          enrichedTenants[0] = {
            ...enrichedTenants[0],
            totals_summary: globalTotals,
            blob_health: globalBlobHealth,
          };
        }

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

  const { global: rawGlobal, tenants } = data;

  // Defensive: ensure tenants is always an array
  const safeTenants = Array.isArray(tenants) ? tenants : [];

  // Defensive: ensure global has all required properties with safe defaults
  const global: GlobalStats = {
    pending_reviews: {
      count: rawGlobal?.pending_reviews?.count ?? 0,
      items: Array.isArray(rawGlobal?.pending_reviews?.items) ? rawGlobal.pending_reviews.items : [],
    },
    cross_tenant: {
      contacts_linked_to_multiple_tenants: rawGlobal?.cross_tenant?.contacts_linked_to_multiple_tenants ?? 0,
      multi_tenant_contact_ids: rawGlobal?.cross_tenant?.multi_tenant_contact_ids ?? [],
    },
    match_breakdown: {
      exact_abn: rawGlobal?.match_breakdown?.exact_abn ?? 0,
      exact_email: rawGlobal?.match_breakdown?.exact_email ?? 0,
      fuzzy_name: rawGlobal?.match_breakdown?.fuzzy_name ?? 0,
      manual: rawGlobal?.match_breakdown?.manual ?? 0,
      total: rawGlobal?.match_breakdown?.total ?? 0,
    },
    totals: {
      contacts_with_links: rawGlobal?.totals?.contacts_with_links ?? 0,
      total_links: rawGlobal?.totals?.total_links ?? 0,
      invoices: rawGlobal?.totals?.invoices ?? 0,
      bills: rawGlobal?.totals?.bills ?? 0,
      quotes: rawGlobal?.totals?.quotes ?? 0,
      credit_notes: rawGlobal?.totals?.credit_notes ?? 0,
      all_documents: rawGlobal?.totals?.all_documents ?? 0,
    },
    recent_activity: {
      contact_syncs_24h: rawGlobal?.recent_activity?.contact_syncs_24h ?? 0,
      invoice_syncs_24h: rawGlobal?.recent_activity?.invoice_syncs_24h ?? 0,
    },
  };

  // Filter tenants by search query (Scale to 15k feature)
  const filteredTenants = React.useMemo(() => {
    if (!searchQuery.trim()) return safeTenants;
    const query = searchQuery.toLowerCase();
    return safeTenants.filter(
      (t) =>
        t.tenant_name?.toLowerCase().includes(query) ||
        t.tenant_id?.toLowerCase().includes(query)
    );
  }, [safeTenants, searchQuery]);

  // Sort filtered tenants: primary first, then alphabetically
  const sortedTenants = React.useMemo(() => {
    return [...filteredTenants].sort((a, b) => {
      if (a.is_primary) return -1;
      if (b.is_primary) return 1;
      return (a.tenant_name || "").localeCompare(b.tenant_name || "");
    });
  }, [filteredTenants]);

  // Virtual scrolling for large tenant lists
  // Only enable when tenant count exceeds threshold for better performance
  const useVirtualScroll = sortedTenants.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: useVirtualScroll ? sortedTenants.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: OVERSCAN,
  });

  // Helper to toggle tenant expansion
  const toggleTenantExpansion = React.useCallback((tenantId: string) => {
    setExpandedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) {
        next.delete(tenantId);
      } else {
        next.add(tenantId);
      }
      return next;
    });
  }, []);

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
                onClick={() => setReviewSheetOpen(true)}
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
        {/* Contacts Stats - Clickable */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors group"
          onClick={() => setContactsDrilldownOpen(true)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-base">Contacts</CardTitle>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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

      {/* Sync Status & Storage Health - Global stats (single API call) */}
      {(() => {
        // Use global stats from first tenant (stored there by fetchData)
        const globalTotals = tenants[0]?.totals_summary;
        const globalBlobHealth = tenants[0]?.blob_health;

        // Only show if we have data
        if (!globalTotals && !globalBlobHealth) return null;

        const blobHealthPct = globalBlobHealth?.total_blobs && globalBlobHealth.total_blobs > 0
          ? Math.round((globalBlobHealth.validated / globalBlobHealth.total_blobs) * 100)
          : 100;
        const blobStatus = globalBlobHealth?.file_missing && globalBlobHealth.file_missing > 0 ? "files_missing"
          : globalBlobHealth?.missing_hash && globalBlobHealth.missing_hash > 0 ? "needs_validation"
          : "healthy";
        const syncPct = globalTotals?.active && globalTotals.active > 0
          ? Math.round(((globalTotals.synced || 0) / globalTotals.active) * 100)
          : 0;

        return (
          <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/50 rounded">
                  <HardDrive className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <CardTitle className="text-base">Sync Overview & Storage Health</CardTitle>
                {blobStatus === "healthy" && globalBlobHealth && globalBlobHealth.total_blobs > 0 && (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    All Blobs Validated
                  </Badge>
                )}
                {blobStatus === "needs_validation" && globalBlobHealth && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {globalBlobHealth.missing_hash} Need Validation
                  </Badge>
                )}
                {blobStatus === "files_missing" && globalBlobHealth && (
                  <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {globalBlobHealth.file_missing} Files Missing
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Total All */}
                <div className="text-center p-3 bg-white dark:bg-background rounded border">
                  <div className="text-2xl font-bold">{(globalTotals?.total_all || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total (All)</div>
                </div>
                {/* Active */}
                <div className="text-center p-3 bg-white dark:bg-background rounded border">
                  <div className="text-2xl font-bold">{(globalTotals?.active || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                  {globalTotals && globalTotals.voided_deleted > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      ({globalTotals.voided_deleted} voided/deleted)
                    </div>
                  )}
                </div>
                {/* Synced */}
                <div className="text-center p-3 bg-white dark:bg-background rounded border">
                  <div className="text-2xl font-bold text-green-600">{(globalTotals?.synced || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Synced</div>
                  <Progress value={syncPct} className="h-1 mt-1 [&>div]:bg-green-500" />
                  <div className="text-[10px] text-muted-foreground mt-1">{syncPct}%</div>
                </div>
                {/* Pending */}
                <div className="text-center p-3 bg-white dark:bg-background rounded border">
                  <div className={`text-2xl font-bold ${(globalTotals?.pending || 0) > 0 ? "text-blue-600" : "text-green-600"}`}>
                    {(globalTotals?.pending || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                {/* Blob Health */}
                <div className={`text-center p-3 rounded border ${
                  blobStatus === "healthy" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" :
                  blobStatus === "needs_validation" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" :
                  "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                }`}>
                  <div className={`text-2xl font-bold ${
                    blobStatus === "healthy" ? "text-green-600" :
                    blobStatus === "needs_validation" ? "text-amber-600" : "text-red-600"
                  }`}>
                    {blobHealthPct}%
                  </div>
                  <div className="text-xs text-muted-foreground">Blobs Validated</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {globalBlobHealth?.validated || 0}/{globalBlobHealth?.total_blobs || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
                onClick={() => setReviewSheetOpen(true)}
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
                    onClick={() => {
                      setSelectedReviewItem(item);
                      setReviewModalOpen(true);
                    }}
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

      {/* Per-Tenant Stats - 2 Column Grid with Search and Virtual Scrolling */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Xero Organizations</h3>
            <Badge className="bg-muted text-muted-foreground">{tenants.length} connected</Badge>
            {searchQuery && filteredTenants.length !== tenants.length && (
              <Badge variant="outline" className="text-xs">
                {filteredTenants.length} shown
              </Badge>
            )}
          </div>
          {/* Search input for large tenant lists */}
          {tenants.length > 5 && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          )}
        </div>

        {/* Virtual scrolling container for large lists */}
        {useVirtualScroll ? (
          <div
            ref={scrollContainerRef}
            className="h-[800px] overflow-auto rounded-lg border"
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const tenant = sortedTenants[virtualRow.index];
                return (
                  <div
                    key={tenant.tenant_id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: "8px",
                    }}
                  >
                    <TenantCard
                      tenant={tenant}
                      router={router}
                      onOpenReviewSheet={() => setReviewSheetOpen(true)}
                      isExpanded={expandedTenants.has(tenant.tenant_id)}
                      onToggleExpand={() => toggleTenantExpansion(tenant.tenant_id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Standard grid for smaller tenant counts */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTenants.map((tenant) => (
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
                              ? safeFormatDistance(tenant.data_sync?.last_synced_at, { addSuffix: false })
                              : "—"}
                          </span>
                          <span>
                            Next: {tenant.data_sync.next_sync_at
                              ? safeFormatDistance(tenant.data_sync?.next_sync_at, { addSuffix: false })
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
                              ? safeFormatDistance(tenant.pdf_sync?.last_synced_at, { addSuffix: false })
                              : "—"}
                          </span>
                          <span>
                            Next: {tenant.pdf_sync.next_sync_at
                              ? safeFormatDistance(tenant.pdf_sync?.next_sync_at, { addSuffix: false })
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
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold">{tenant.contacts.total_links}</div>
                      <div className="text-xs text-muted-foreground">Contacts</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold">{tenant.documents.total}</div>
                      <div className="text-xs text-muted-foreground">Documents</div>
                    </div>
                    {tenant.contacts.unlinked > 0 ? (
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
                        <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{tenant.contacts.unlinked}</div>
                        <div className="text-xs text-amber-600 dark:text-amber-500">Unlinked</div>
                      </div>
                    ) : (
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">✓</div>
                        <div className="text-xs text-green-600 dark:text-green-500">All Linked</div>
                      </div>
                    )}
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

                  {/* Pending Reviews Warning - Clickable to open review sheet */}
                  {tenant.contacts.pending_review > 0 && (
                    <button
                      onClick={() => setReviewSheetOpen(true)}
                      className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer transition-colors w-full text-left"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {tenant.contacts.pending_review} pending review
                    </button>
                  )}

                  {/* Last Sync - SSoT: sync_health shows when sync JOB ran (not when records changed) */}
                  {tenant.sync_health?.contacts?.last_synced_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          tenant.sync_health.contacts.health_status === "green" && "bg-green-500",
                          tenant.sync_health.contacts.health_status === "yellow" && "bg-yellow-500",
                          tenant.sync_health.contacts.health_status === "red" && "bg-red-500"
                        )}
                        title={tenant.sync_health.contacts.message}
                      />
                      <Clock className="h-3 w-3" />
                      Synced {safeFormatDistance(tenant.sync_health?.contacts?.last_synced_at, { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fuzzy Match Review Modal */}
      <FuzzyMatchReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        item={selectedReviewItem}
        onReviewed={handleReviewed}
      />

      {/* Review All Sheet */}
      <FuzzyMatchReviewSheet
        open={reviewSheetOpen}
        onOpenChange={setReviewSheetOpen}
        onReviewed={handleReviewed}
      />

      {/* Contacts Drilldown Sheet */}
      <XeroOrgContactsDrilldownSheet
        isOpen={contactsDrilldownOpen}
        onClose={() => setContactsDrilldownOpen(false)}
        tenants={tenants}
        totalContacts={global.totals.contacts_with_links}
        onLinkChanged={fetchData}
      />
    </div>
  );
}
