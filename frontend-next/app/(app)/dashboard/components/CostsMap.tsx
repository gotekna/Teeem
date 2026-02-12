"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Server,
  Database,
  Globe,
  Cloud,
  TrendingDown,
  DollarSign,
  HardDrive,
  Bot,
  FileSpreadsheet,
  Mail,
  Shield,
  CreditCard,
  MessageSquare,
  Landmark,
  CloudRain,
  Image,
  ScanFace,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Power,
  ChevronRight,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ─────────────────────────────────────────────
// Display-only constants (stays in frontend)
// ─────────────────────────────────────────────

const PAYMENT_METHODS = {
  heroku: "Heroku Account",
  vercel: "Vercel Account",
  wasabi: "Wasabi Account",
  backblaze: "Backblaze Account",
  webcentral: "Webcentral Account",
  anthropic: "Anthropic Account",
  aws: "AWS Account",
  twilio: "Twilio Account",
  stripe: "Stripe Account",
  polaris: "Polaris Account",
  basiq: "Basiq Account",
  free: null,
} as const;

type PaymentMethodKey = keyof typeof PAYMENT_METHODS;

// Map service names to icons (display-only, no API equivalent)
const SERVICE_ICONS: Record<string, React.ElementType> = {
  "Vercel (Pro)": Globe,
  "Wasabi Storage": HardDrive,
  "Backblaze B2": HardDrive,
  "Webcentral": Globe,
  "Cloudflare": Shield,
  "Anthropic (Claude)": Bot,
  "AWS Rekognition": ScanFace,
  "Xero API": FileSpreadsheet,
  "Microsoft Graph": Mail,
  "Polaris Mail": Mail,
  "Sentry": AlertTriangle,
  "WeatherAPI": CloudRain,
  "Cloudinary": Image,
  "Metabase": BarChart3,
  "Stripe": CreditCard,
  "Twilio": MessageSquare,
  "Basiq": Landmark,
};

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  hosting: { label: "Hosting & Storage", description: "Infrastructure that runs and stores TEEEM" },
  ai: { label: "AI & Machine Learning", description: "Variable cost - scales with usage" },
  integration: { label: "Integrations", description: "Third-party APIs (most included/free tier)" },
  payperuse: { label: "Pay-per-use", description: "Transaction-based billing" },
};

// ─────────────────────────────────────────────
// Types (from API response)
// ─────────────────────────────────────────────

interface DynoCost {
  app: string;
  dyno: string;
  size: string;
  quantity: number;
  cost: number;
  unitCost: number;
  purpose: string;
  environment: string;
  scaledDown?: boolean;
}

interface AddonCost {
  app: string;
  name: string;
  addonServiceName: string;
  plan: string;
  cost: number | null;
  state: string;
  environment: string;
}

interface ExternalService {
  name: string;
  cost: number | string;
  purpose: string;
  category: string;
  paidBy: string;
  note?: string;
}

interface SavingsEntry {
  date: string;
  description: string;
  monthlySaved: number;
}

interface InfrastructureData {
  dynos: DynoCost[];
  addons: AddonCost[];
  externalServices: ExternalService[];
  savingsHistory: SavingsEntry[];
  fetchedAt: string | null;
  cached: boolean;
  error?: string;
  errors?: string[];
}

interface VercelLineItem {
  name: string;
  amount: number;
  quantity: number;
  unit: string | null;
  group: string;
}

interface VercelBillingData {
  success: boolean;
  plan?: string;
  currentPeriod?: {
    periodStart: string;
    periodEnd: string;
    minutesUsed: number;
    minutesCost: number;
    allocationCost: number;
    overageCost: number;
    totalCost: number;
    amountDue: number;
    dueDate: string;
    teamSeats: number;
  };
  currentInvoice?: {
    number: string;
    total: number;
    status: string;
    createdAt: string;
  };
  previousInvoice?: {
    number: string;
    total: number;
    status: string;
  };
  buildMinutes?: { cost: number; minutes: number };
  previousBuildMinutes?: { cost: number; minutes: number };
  teamSeats?: number;
  fetchedAt?: string;
  error?: string;
}

interface BreakdownProject {
  name: string;
  minutes: number;
  deploys: number;
}

interface BreakdownDay {
  date: string;
  dayLabel: string;
  minutes: number;
  deploys: number;
  projects: BreakdownProject[];
}

interface BreakdownWeek {
  weekNum: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  minutes: number;
  deploys: number;
  days: BreakdownDay[];
}

interface StorageProviderBilling {
  success: boolean;
  error?: string;
  provider?: string;
  bucket?: string;
  totalBytes?: number;
  totalObjects?: number;
  totalSizeGB?: number;
  totalSizeTB?: number;
  billableTB?: number;
  estimatedCost?: number;
  ratePerTB?: number;
  minimumTB?: number;
  freeGB?: number;
  sampled?: boolean;
  byPrefix?: Array<{ name: string; count: number; sizeGB: number }>;
}

interface StorageBillingData {
  success: boolean;
  wasabi?: StorageProviderBilling;
  backblaze?: StorageProviderBilling;
  fetchedAt?: string;
  cached?: boolean;
  error?: string;
}

interface VercelBreakdownData {
  success: boolean;
  periodStart?: string;
  periodEnd?: string;
  totalMinutes?: number;
  totalDeploys?: number;
  estimatedCost?: number;
  ratePerMinute?: number;
  weeks?: BreakdownWeek[];
  fetchedAt?: string;
  cached?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function CostBadge({ cost }: { cost: number | string | null }) {
  if (cost === null) return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800")}>
      Unknown
    </span>
  );

  const numCost = typeof cost === "string" ? (cost === "TBD" ? -1 : 100) : cost;
  const color =
    numCost === -1
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
      : numCost === 0
        ? "bg-muted text-muted-foreground border-border"
        : numCost < 10
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
          : numCost <= 50
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"
            : numCost <= 100
              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";

  const label =
    typeof cost === "string"
      ? cost === "TBD" ? "TBD" : `$${cost}/mo`
      : cost === 0 ? "Free" : `$${cost}/mo`;

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border", color)}>
      {label}
    </span>
  );
}

function PaymentBadge({ paidBy }: { paidBy: string }) {
  const method = PAYMENT_METHODS[paidBy as PaymentMethodKey];
  if (!method) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/50 text-muted-foreground">
      <CreditCard className="h-2.5 w-2.5" />
      {method}
    </span>
  );
}

function StorageDetailCard({ data, label }: { data: StorageProviderBilling; label: string }) {
  if (!data.success) return null;
  const usageBarPct = data.minimumTB
    ? Math.min(((data.totalSizeTB || 0) / data.minimumTB) * 100, 100)
    : 0;

  return (
    <div className="mt-2 border border-border rounded p-2.5 bg-muted/30 space-y-1.5">
      {/* Usage summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label} Storage</span>
        <span className="font-mono font-medium">${data.estimatedCost?.toFixed(2)}/mo</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{data.totalSizeGB?.toLocaleString()} GB &middot; {data.totalObjects?.toLocaleString()} objects</span>
        <span>@ ${data.ratePerTB}/TB/month</span>
      </div>
      {/* Usage bar (for Wasabi with 1TB minimum) */}
      {data.minimumTB && (
        <div className="space-y-0.5">
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all",
                usageBarPct > 90 ? "bg-amber-500" : "bg-blue-500"
              )}
              style={{ width: `${usageBarPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{data.totalSizeTB?.toFixed(3)} TB used</span>
            <span>{data.minimumTB} TB minimum (billed as {data.billableTB?.toFixed(3)} TB)</span>
          </div>
        </div>
      )}
      {/* Free tier info for Backblaze */}
      {data.freeGB != null && (
        <div className="text-[10px] text-muted-foreground">
          First {data.freeGB} GB free &middot; {data.totalSizeGB != null && data.totalSizeGB > data.freeGB
            ? `${(data.totalSizeGB - data.freeGB).toFixed(2)} GB billable`
            : "Within free tier"}
        </div>
      )}
      {/* Top folders by size */}
      {data.byPrefix && data.byPrefix.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-border">
          <span className="text-[10px] text-muted-foreground font-medium">Top folders:</span>
          {data.byPrefix.slice(0, 5).map((p) => (
            <div key={p.name} className="flex items-center text-[10px] gap-2">
              <span className="text-muted-foreground w-28 truncate">{p.name}/</span>
              <span className="font-mono">{p.sizeGB} GB</span>
              <span className="text-muted-foreground">({p.count.toLocaleString()} files)</span>
            </div>
          ))}
        </div>
      )}
      {data.sampled && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">Sampled (100k+ objects, actual size may be higher)</p>
      )}
    </div>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const DEV_APPS = ["teeem-sam-dev", "teeem-rob-dev", "teeem-jake-dev"];

export default function CostsMap() {
  const [data, setData] = useState<InfrastructureData | null>(null);
  const [vercelBilling, setVercelBilling] = useState<VercelBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scalingDyno, setScalingDyno] = useState<string | null>(null); // "app:dyno" key
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [breakdown, setBreakdown] = useState<VercelBreakdownData | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [cycleExpanded, setCycleExpanded] = useState(false);
  const [storageBilling, setStorageBilling] = useState<StorageBillingData | null>(null);
  const [storageBillingLoading, setStorageBillingLoading] = useState(false);
  const [storageBillingVisible, setStorageBillingVisible] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const [infraResponse, vercelResponse] = await Promise.all([
        api.get<{ success: boolean; data: InfrastructureData }>(
          "/api/v1/heroku/infrastructure",
          refresh ? { params: { refresh: "true" } } : {}
        ),
        api.get<{ success: boolean; data: VercelBillingData }>(
          "/api/v1/heroku/vercel_billing",
          refresh ? { params: { refresh: "true" } } : {}
        ).catch(() => null),
      ]);

      if (infraResponse?.success && infraResponse.data) {
        // Update Vercel external service cost with real data
        const vercelData = vercelResponse?.data;
        if (vercelData?.success) {
          setVercelBilling(vercelData);
          // Use current period (upcoming) amount if available, else last paid invoice
          const realCost = Math.round(
            vercelData.currentPeriod?.amountDue ?? vercelData.currentInvoice?.total ?? 0
          );
          infraResponse.data.externalServices = infraResponse.data.externalServices.map((s) =>
            s.name === "Vercel (Pro)" ? { ...s, cost: realCost } : s
          );
        }
        setData(infraResponse.data);
        setError(infraResponse.data.error || null);
      } else {
        setError("Failed to load infrastructure data");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load infrastructure data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleScaleDyno = useCallback(async (app: string, dyno: string, currentQty: number) => {
    const newQty = currentQty > 0 ? 0 : 1;
    const action = newQty === 0 ? "scale down (stop)" : "scale up (start)";
    if (!confirm(`${action} ${dyno} dyno on ${app}?`)) return;

    const key = `${app}:${dyno}`;
    setScalingDyno(key);

    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        "/api/v1/heroku/scale",
        { app, dyno, quantity: newQty }
      );

      if (response?.success) {
        // Optimistic update
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            dynos: prev.dynos.map((d) =>
              d.app === app && d.dyno === dyno
                ? { ...d, quantity: newQty, cost: d.unitCost * newQty, scaledDown: newQty === 0 }
                : d
            ),
          };
        });
      } else {
        alert(`Failed to scale: ${response?.error || "Unknown error"}`);
      }
    } catch (e) {
      alert(`Failed to scale: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setScalingDyno(null);
    }
  }, []);

  const fetchBreakdown = useCallback(async (refresh = false) => {
    setBreakdownLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: VercelBreakdownData }>(
        "/api/v1/heroku/vercel_usage_breakdown",
        refresh ? { params: { refresh: "true" } } : {}
      );
      if (response?.data) {
        setBreakdown(response.data);
      }
    } catch {
      setBreakdown({ success: false, error: "Failed to load breakdown" });
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  const toggleBreakdown = useCallback(() => {
    if (!breakdownVisible && !breakdown) {
      fetchBreakdown();
    }
    setBreakdownVisible((v) => !v);
  }, [breakdownVisible, breakdown, fetchBreakdown]);

  const toggleWeek = useCallback((weekNum: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  }, []);

  const fetchStorageBilling = useCallback(async (refresh = false) => {
    setStorageBillingLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: StorageBillingData }>(
        "/api/v1/heroku/storage_billing",
        refresh ? { params: { refresh: "true" } } : {}
      );
      if (response?.data) {
        setStorageBilling(response.data);
        // Update external services costs with real data
        if (response.data.wasabi?.estimatedCost != null) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              externalServices: prev.externalServices.map((s) =>
                s.name === "Wasabi Storage" ? { ...s, cost: response.data.wasabi!.estimatedCost! } : s
              ),
            };
          });
        }
        if (response.data.backblaze?.estimatedCost != null) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              externalServices: prev.externalServices.map((s) =>
                s.name === "Backblaze B2" ? { ...s, cost: response.data.backblaze!.estimatedCost! } : s
              ),
            };
          });
        }
      }
    } catch {
      setStorageBilling({ success: false, error: "Failed to load storage billing" });
    } finally {
      setStorageBillingLoading(false);
    }
  }, []);

  const toggleStorageDetail = useCallback((provider: string) => {
    if (!storageBilling) {
      fetchStorageBilling();
    }
    setStorageBillingVisible((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, [storageBilling, fetchStorageBilling]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-sm text-muted-foreground">Loading infrastructure data...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error || "No data available"}</p>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Derive databases and redis from addons, deduplicating shared addons
  const rawDatabases = data.addons.filter((a) => a.addonServiceName === "heroku-postgresql");
  const rawRedis = data.addons.filter((a) => a.addonServiceName === "heroku-redis");
  const otherAddons = data.addons.filter(
    (a) => a.addonServiceName !== "heroku-postgresql" && a.addonServiceName !== "heroku-redis"
  );

  // Deduplicate: same addon name = same database attached to multiple apps
  type UniqueAddon = AddonCost & { environments: string[] };
  function deduplicateAddons(addons: AddonCost[]): UniqueAddon[] {
    const map = new Map<string, UniqueAddon>();
    const result: UniqueAddon[] = [];
    addons.forEach((a) => {
      const existing = map.get(a.name);
      if (existing) {
        existing.environments.push(a.environment);
      } else {
        const entry = { ...a, environments: [a.environment] };
        map.set(a.name, entry);
        result.push(entry);
      }
    });
    return result;
  }

  const databases = deduplicateAddons(rawDatabases);
  const redis = deduplicateAddons(rawRedis);

  const totalDynos = data.dynos.reduce((sum, d) => sum + d.cost, 0);
  const totalDatabases = databases.reduce((sum, d) => sum + (d.cost ?? 0), 0);
  const totalRedis = redis.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const totalOtherAddons = otherAddons.reduce((sum, a) => sum + (a.cost ?? 0), 0);
  const totalHeroku = totalDynos + totalDatabases + totalRedis + totalOtherAddons;
  const fixedExternal = data.externalServices
    .filter((s) => typeof s.cost === "number")
    .reduce((sum, s) => sum + (s.cost as number), 0);
  const totalFixed = totalHeroku + fixedExternal;
  const totalSaved = data.savingsHistory.reduce((sum, s) => sum + s.monthlySaved, 0);

  // Group dynos by environment, merging dev apps into one group
  const DEV_ENVIRONMENTS = ["Sam Dev", "Rob Dev", "Jake Dev"];
  const envGroups: Record<string, { dynos: DynoCost[]; total: number }> = {};
  data.dynos.forEach((d) => {
    const groupKey = DEV_ENVIRONMENTS.includes(d.environment) ? "Dev Apps" : d.environment;
    if (!envGroups[groupKey]) envGroups[groupKey] = { dynos: [], total: 0 };
    envGroups[groupKey].dynos.push(d);
    envGroups[groupKey].total += d.cost;
  });

  // Group external services by category
  const servicesByCategory = data.externalServices.reduce<Record<string, ExternalService[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Infrastructure Costs</h3>
          <p className="text-sm text-muted-foreground">
            Monthly cost breakdown across all services and environments.
            {data.fetchedAt && (
              <> Last fetched: {formatTimestamp(data.fetchedAt)}{data.cached && " (cached)"}</>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Error/warning banner */}
      {(error || data.errors?.length) && (
        <div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
          <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error || data.errors?.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Monthly Summary
          </CardTitle>
          <CardDescription>Fixed costs (excludes variable AI/pay-per-use)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-2xl font-bold">${totalFixed}</div>
              <div className="text-xs text-muted-foreground">Total Fixed/mo</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">${totalDynos}</div>
              <div className="text-xs text-muted-foreground">Heroku Dynos</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">${totalDatabases + totalRedis}</div>
              <div className="text-xs text-muted-foreground">Databases & Redis</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <div className="text-xl font-bold text-orange-700 dark:text-orange-300">${fixedExternal}</div>
              <div className="text-xs text-muted-foreground">External (fixed)</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-xl font-bold text-green-700 dark:text-green-300">-${totalSaved}</div>
              <div className="text-xs text-muted-foreground">Recent Savings/mo</div>
            </div>
          </div>

          {/* Breakdown bar */}
          {totalFixed > 0 && (
            <div className="mt-4">
              <div className="flex h-3 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500"
                  style={{ width: `${(totalDynos / totalFixed) * 100}%` }}
                  title={`Dynos: $${totalDynos}`}
                />
                <div
                  className="bg-purple-500"
                  style={{ width: `${((totalDatabases + totalRedis) / totalFixed) * 100}%` }}
                  title={`Databases & Redis: $${totalDatabases + totalRedis}`}
                />
                <div
                  className="bg-orange-500"
                  style={{ width: `${(fixedExternal / totalFixed) * 100}%` }}
                  title={`External: $${fixedExternal}`}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Dynos ({Math.round((totalDynos / totalFixed) * 100)}%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />DB & Redis ({Math.round(((totalDatabases + totalRedis) / totalFixed) * 100)}%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />External ({Math.round((fixedExternal / totalFixed) * 100)}%)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heroku Dynos - Grouped by App */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Heroku Dynos
            <Badge variant="outline" className="ml-auto font-mono">${totalDynos}/mo</Badge>
          </CardTitle>
          <CardDescription>
            Compute instances grouped by app (click to expand)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.dynos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No dynos found (HEROKU_API_KEY may not be configured)</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(envGroups)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([env, group]) => {
                  const isExpanded = expandedApps.has(env);
                  const activeDynos = group.dynos.filter((d) => d.quantity > 0);
                  const isDevGroup = env === "Dev Apps";
                  const isDevApp = isDevGroup || group.dynos.some((d) => DEV_APPS.includes(d.app));
                  // For dev group summary, show which apps have web dynos running
                  const devAppSummary = isDevGroup
                    ? [...new Set(group.dynos.filter((d) => d.dyno === "web").map((d) => {
                        const running = d.quantity > 0;
                        return `${d.environment}${running ? "" : " (off)"}`;
                      }))]
                    : [];
                  const toggleExpand = () => {
                    setExpandedApps((prev) => {
                      const next = new Set(prev);
                      if (next.has(env)) next.delete(env);
                      else next.add(env);
                      return next;
                    });
                  };

                  return (
                    <div key={env} className="border border-border rounded-lg overflow-hidden">
                      {/* Collapsed summary row */}
                      <button
                        onClick={toggleExpand}
                        className="flex items-center w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      >
                        <ChevronRight className={cn("h-4 w-4 mr-2 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        <span className="font-medium text-sm flex-1">{env}</span>
                        <span className="text-xs text-muted-foreground mr-3">
                          {isDevGroup
                            ? devAppSummary.join(", ")
                            : activeDynos.length > 0
                              ? activeDynos.map((d) => `${d.dyno} (${d.size})`).join(", ")
                              : "all stopped"}
                        </span>
                        {isDevApp && (
                          <span className="mr-2">
                            {activeDynos.length > 0 ? (
                              <Power className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Power className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </span>
                        )}
                        <CostBadge cost={group.total} />
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left bg-muted/30">
                                {isDevGroup && <th className="py-1.5 px-3 font-medium text-xs">App</th>}
                                <th className="py-1.5 px-3 font-medium text-xs">Dyno</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Size</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Qty</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Cost</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Purpose</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.dynos
                                .filter((d) => !isDevGroup || d.dyno === "web" || d.dyno === "worker")
                                .map((d) => {
                                const isDev = DEV_APPS.includes(d.app);
                                const isScaling = scalingDyno === `${d.app}:${d.dyno}`;
                                return (
                                  <tr
                                    key={`${d.app}-${d.dyno}`}
                                    className={cn("border-b border-border last:border-0", d.scaledDown && "opacity-50")}
                                  >
                                    {isDevGroup && (
                                      <td className="py-1.5 px-3 text-xs font-medium">{d.environment}</td>
                                    )}
                                    <td className="py-1.5 px-3 text-xs">{d.dyno}</td>
                                    <td className="py-1.5 px-3 text-xs font-mono">{d.size}</td>
                                    <td className="py-1.5 px-3 text-xs font-mono">
                                      <span className="inline-flex items-center gap-1.5">
                                        {d.quantity}
                                        {isDev && d.dyno === "web" && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleScaleDyno(d.app, d.dyno, d.quantity); }}
                                            disabled={isScaling}
                                            className={cn(
                                              "inline-flex items-center justify-center rounded p-0.5 transition-colors",
                                              d.scaledDown
                                                ? "text-muted-foreground hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                                                : "text-green-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30",
                                              isScaling && "animate-pulse"
                                            )}
                                            title={d.scaledDown ? "Start dyno" : "Stop dyno"}
                                          >
                                            <Power className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-3">
                                      <CostBadge cost={d.cost} />
                                    </td>
                                    <td className="py-1.5 px-3 text-xs text-muted-foreground">
                                      {d.purpose}
                                      {d.scaledDown && (
                                        <span className="ml-1.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">(stopped)</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heroku Databases */}
      {databases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Heroku Databases
              <Badge variant="outline" className="ml-auto font-mono">${totalDatabases}/mo</Badge>
            </CardTitle>
            <CardDescription>PostgreSQL databases (shared addons shown once with all attached apps)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Apps</th>
                    <th className="pb-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.map((d, i) => (
                    <tr key={d.name} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                      <td className="py-2 pr-4 font-medium text-xs">{d.name}</td>
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.plan.replace("heroku-postgresql:", "")}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <CostBadge cost={d.cost} />
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {d.environments.map((env) => (
                            <Badge key={env} variant="outline" className="text-[10px]">{env}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-xs">
                        <Badge variant={d.state === "provisioned" ? "outline" : "destructive"} className="text-[10px]">
                          {d.state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heroku Redis */}
      {redis.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Heroku Redis
              <Badge variant="outline" className="ml-auto font-mono">${totalRedis}/mo</Badge>
            </CardTitle>
            <CardDescription>Redis instances for caching and job queues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Apps</th>
                    <th className="pb-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {redis.map((r, i) => (
                    <tr key={r.name} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                      <td className="py-2 pr-4 font-medium text-xs">{r.name}</td>
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.plan.replace("heroku-redis:", "")}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <CostBadge cost={r.cost} />
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {r.environments.map((env) => (
                            <Badge key={env} variant="outline" className="text-[10px]">{env}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-xs">
                        <Badge variant={r.state === "provisioned" ? "outline" : "destructive"} className="text-[10px]">
                          {r.state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Heroku Addons */}
      {otherAddons.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Other Heroku Addons
              <Badge variant="outline" className="ml-auto font-mono">${totalOtherAddons}/mo</Badge>
            </CardTitle>
            <CardDescription>Scheduler, Papertrail, SendGrid, etc.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">Addon</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">App</th>
                  </tr>
                </thead>
                <tbody>
                  {otherAddons.map((a, i) => (
                    <tr key={a.name} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                      <td className="py-2 pr-4 text-xs">
                        <span className="font-medium">{a.addonServiceName}</span>
                        <span className="text-muted-foreground ml-1">({a.name})</span>
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.plan.split(":")[1] || a.plan}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <CostBadge cost={a.cost} />
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{a.environment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* External Services - by category */}
      {(["hosting", "ai", "integration", "payperuse"] as const).map((cat) => {
        const services = servicesByCategory[cat];
        if (!services?.length) return null;
        const meta = CATEGORY_LABELS[cat];
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                {meta.label}
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {services.map((s) => {
                  const Icon = SERVICE_ICONS[s.name] || Cloud;
                  const isVercel = s.name === "Vercel (Pro)" && vercelBilling?.success;
                  return (
                    <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{s.name}</span>
                          <CostBadge cost={s.cost} />
                          {s.note && (
                            <Badge variant="outline" className="text-[10px]">{s.note}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.purpose}</p>
                        {/* Vercel billing detail */}
                        {isVercel && vercelBilling && (
                          <div className="mt-2 space-y-1.5">
                            {/* Current billing cycle */}
                            {vercelBilling.currentPeriod?.periodStart && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Billing Cycle:</span>
                                <span className="font-mono font-medium">
                                  {new Date(vercelBilling.currentPeriod.periodStart).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Brisbane" })}
                                  {" — "}
                                  {new Date(vercelBilling.currentPeriod.periodEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Brisbane" })}
                                </span>
                              </div>
                            )}
                            {/* Current period build minutes */}
                            {vercelBilling.currentPeriod && vercelBilling.currentPeriod.minutesUsed > 0 && (
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="text-muted-foreground">Build Minutes:</span>
                                <span className="font-mono font-medium">
                                  {vercelBilling.currentPeriod.minutesUsed.toLocaleString()} min
                                </span>
                                <span className="text-muted-foreground">
                                  (${vercelBilling.currentPeriod.minutesCost.toFixed(2)} overage + ${vercelBilling.currentPeriod.allocationCost.toFixed(2)} included)
                                </span>
                                {vercelBilling.buildMinutes && (
                                  <span className={cn(
                                    "text-[10px] font-medium",
                                    vercelBilling.currentPeriod.minutesUsed < vercelBilling.buildMinutes.minutes
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  )}>
                                    last month: {vercelBilling.buildMinutes.minutes.toLocaleString()} min
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Team seats */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Team Seats:</span>
                              <span className="font-mono font-medium">
                                {vercelBilling.currentPeriod?.teamSeats ?? vercelBilling.teamSeats ?? 1}
                              </span>
                              <span className="text-muted-foreground">(1 included + ${((vercelBilling.currentPeriod?.teamSeats ?? vercelBilling.teamSeats ?? 1) - 1) * 20}/mo additional)</span>
                            </div>
                            {/* Current period charge */}
                            {vercelBilling.currentPeriod && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Current Charges:</span>
                                <span className="font-mono font-medium">
                                  ${vercelBilling.currentPeriod.amountDue.toFixed(2)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">in progress</Badge>
                                {vercelBilling.currentInvoice && (
                                  <span className="text-[10px] text-muted-foreground">
                                    (last month: ${vercelBilling.currentInvoice.total.toFixed(2)} {vercelBilling.currentInvoice.status})
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Fallback: show last invoice if no current period */}
                            {!vercelBilling.currentPeriod && vercelBilling.currentInvoice && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Invoice:</span>
                                <span className="font-mono font-medium">
                                  ${vercelBilling.currentInvoice.total.toFixed(2)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {vercelBilling.currentInvoice.status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Build minutes breakdown (lazy-loaded on click) */}
                        {isVercel && vercelBilling && (
                          <div className="mt-2">
                            <button
                              onClick={toggleBreakdown}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Calendar className="h-3 w-3" />
                              {breakdownVisible ? "Hide Breakdown" : "View Build Minutes Breakdown"}
                              {breakdownLoading && <Spinner className="h-3 w-3" />}
                            </button>

                            {breakdownVisible && breakdownLoading && !breakdown && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Spinner className="h-3 w-3" />
                                Loading build minutes breakdown...
                              </div>
                            )}
                            {breakdownVisible && breakdown && (
                              <div className="mt-2 space-y-1">
                                {breakdown.error && (
                                  <p className="text-xs text-red-500">{breakdown.error}</p>
                                )}

                                {/* Level 1: Billing Cycle (collapsible → weeks) */}
                                {breakdown.periodStart && breakdown.periodEnd && (
                                  <div className="border border-border rounded overflow-hidden">
                                    <button
                                      onClick={() => setCycleExpanded((v) => !v)}
                                      className="flex items-center w-full px-2.5 py-2 text-left hover:bg-muted/50 transition-colors text-xs"
                                    >
                                      {cycleExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                      )}
                                      <span className="font-medium mr-2">
                                        {new Date(breakdown.periodStart + "T00:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                                        {" – "}
                                        {new Date(breakdown.periodEnd + "T00:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                      <span className="text-muted-foreground mr-auto text-[11px]">
                                        {breakdown.totalMinutes?.toLocaleString()} min &middot; {breakdown.totalDeploys?.toLocaleString()} deploys
                                      </span>
                                      <span className="font-mono font-medium">
                                        ${breakdown.estimatedCost?.toFixed(2) ?? "—"}
                                      </span>
                                    </button>

                                    {/* Level 2: Weeks (inside expanded billing cycle) */}
                                    {cycleExpanded && (
                                      <div className="border-t border-border">
                                        <div className="px-2.5 py-1 text-[10px] text-muted-foreground bg-muted/30">
                                          @ ${breakdown.ratePerMinute ?? 0.014}/min (standard machine)
                                        </div>
                                        {breakdown.weeks?.map((week) => {
                                          const isWeekExpanded = expandedWeeks.has(week.weekNum);
                                          return (
                                            <div key={week.weekNum} className="border-t border-border">
                                              <button
                                                onClick={() => toggleWeek(week.weekNum)}
                                                className="flex items-center w-full px-2.5 py-1.5 pl-7 text-left hover:bg-muted/50 transition-colors text-xs"
                                              >
                                                {isWeekExpanded ? (
                                                  <ChevronDown className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                                                ) : (
                                                  <ChevronRight className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                                                )}
                                                <span className="font-medium mr-2">{week.label}</span>
                                                <span className="text-muted-foreground mr-auto text-[11px]">
                                                  {new Date(week.periodStart + "T00:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                                                  {" – "}
                                                  {new Date(week.periodEnd + "T00:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                                                </span>
                                                <span className="font-mono font-medium">{week.minutes.toLocaleString()} min</span>
                                                <span className="text-muted-foreground ml-1.5 shrink-0">({week.deploys})</span>
                                              </button>

                                              {/* Level 3: Days (inside expanded week) */}
                                              {isWeekExpanded && (
                                                <div className="border-t border-border bg-muted/20">
                                                  {week.days.map((day) => (
                                                    <div key={day.date} className="px-2.5 py-1.5 pl-14 border-b border-border last:border-0">
                                                      <div className="flex items-center text-xs gap-2">
                                                        <span className="text-muted-foreground w-[70px] shrink-0">{day.dayLabel}</span>
                                                        <span className="font-mono font-medium w-16 shrink-0">{day.minutes} min</span>
                                                        <span className="text-muted-foreground w-14 shrink-0">{day.deploys} dep</span>
                                                        <div className="flex-1 flex flex-wrap gap-1">
                                                          {day.projects.map((p) => (
                                                            <span key={p.name} className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-muted border border-border">
                                                              {p.name}: {p.minutes}m
                                                            </span>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Last month invoice (non-expandable, just totals) */}
                                {vercelBilling.currentInvoice && (
                                  <div className="border border-border rounded px-2.5 py-2 text-xs flex items-center opacity-60">
                                    <span className="text-muted-foreground mr-1.5">Previous:</span>
                                    <span className="font-medium mr-auto">
                                      {vercelBilling.buildMinutes ? `${vercelBilling.buildMinutes.minutes.toLocaleString()} min` : "—"}
                                    </span>
                                    <span className="font-mono font-medium">
                                      ${vercelBilling.currentInvoice.total.toFixed(2)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] ml-1.5">{vercelBilling.currentInvoice.status}</Badge>
                                  </div>
                                )}

                                {breakdown.cached && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-muted-foreground">Cached data</span>
                                    <button
                                      onClick={() => fetchBreakdown(true)}
                                      className="text-[10px] text-primary hover:underline"
                                      disabled={breakdownLoading}
                                    >
                                      Refresh
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Storage detail for Wasabi */}
                        {s.name === "Wasabi Storage" && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleStorageDetail("wasabi")}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <HardDrive className="h-3 w-3" />
                              {storageBillingVisible.wasabi ? "Hide Storage Detail" : "View Storage Detail"}
                              {storageBillingLoading && !storageBilling && <Spinner className="h-3 w-3" />}
                            </button>
                            {storageBillingVisible.wasabi && storageBillingLoading && !storageBilling && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Spinner className="h-3 w-3" />
                                Scanning storage buckets...
                              </div>
                            )}
                            {storageBillingVisible.wasabi && storageBilling?.wasabi && (
                              <StorageDetailCard data={storageBilling.wasabi} label="Wasabi" />
                            )}
                            {storageBillingVisible.wasabi && storageBilling?.wasabi?.success === false && (
                              <p className="text-xs text-red-500 mt-1">{storageBilling.wasabi.error}</p>
                            )}
                          </div>
                        )}
                        {/* Storage detail for Backblaze */}
                        {s.name === "Backblaze B2" && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleStorageDetail("backblaze")}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <HardDrive className="h-3 w-3" />
                              {storageBillingVisible.backblaze ? "Hide Storage Detail" : "View Storage Detail"}
                              {storageBillingLoading && !storageBilling && <Spinner className="h-3 w-3" />}
                            </button>
                            {storageBillingVisible.backblaze && storageBillingLoading && !storageBilling && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Spinner className="h-3 w-3" />
                                Scanning storage buckets...
                              </div>
                            )}
                            {storageBillingVisible.backblaze && storageBilling?.backblaze && (
                              <StorageDetailCard data={storageBilling.backblaze} label="Backblaze B2" />
                            )}
                            {storageBillingVisible.backblaze && storageBilling?.backblaze?.success === false && (
                              <p className="text-xs text-red-500 mt-1">{storageBilling.backblaze.error}</p>
                            )}
                          </div>
                        )}
                        {s.paidBy !== "free" && (
                          <div className="mt-1">
                            <PaymentBadge paidBy={s.paidBy} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Payment Methods Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </CardTitle>
          <CardDescription>Which account/card pays for what</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Services</th>
                  <th className="pb-2 font-medium text-right">Est. Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const methodMap: Record<string, { services: string[]; fixedTotal: number; hasVariable: boolean }> = {};

                  // Add Heroku (dynos + addons)
                  const herokuLabel = PAYMENT_METHODS.heroku;
                  if (herokuLabel) {
                    methodMap[herokuLabel] = {
                      services: ["All Heroku Dynos", "All Heroku Addons"],
                      fixedTotal: totalHeroku,
                      hasVariable: false,
                    };
                  }

                  // Add external services
                  data.externalServices.forEach((s) => {
                    const method = PAYMENT_METHODS[s.paidBy as PaymentMethodKey];
                    if (!method) return;
                    if (!methodMap[method]) methodMap[method] = { services: [], fixedTotal: 0, hasVariable: false };
                    methodMap[method].services.push(s.name);
                    if (typeof s.cost === "number") {
                      methodMap[method].fixedTotal += s.cost;
                    } else {
                      methodMap[method].hasVariable = true;
                    }
                  });

                  return Object.entries(methodMap)
                    .sort((a, b) => b[1].fixedTotal - a[1].fixedTotal)
                    .map(([method, mData], i) => (
                      <tr key={method} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                        <td className="py-2 pr-4">
                          <span className="inline-flex items-center gap-1.5 font-medium text-xs">
                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                            {method}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {mData.services.join(", ")}
                        </td>
                        <td className="py-2 text-right">
                          <span className="font-mono text-xs font-medium">
                            ${mData.fixedTotal}{mData.hasVariable ? "+" : ""}/mo
                          </span>
                        </td>
                      </tr>
                    ));
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Savings History */}
      {data.savingsHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              Recent Savings
              <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                -${totalSaved}/mo (${totalSaved * 12}/yr)
              </Badge>
            </CardTitle>
            <CardDescription>Cost optimizations and cleanup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.savingsHistory.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <Badge variant="outline" className="shrink-0 text-xs">{s.date}</Badge>
                  <span className="text-sm flex-1">{s.description}</span>
                  <span className="font-mono text-sm font-medium text-green-700 dark:text-green-400 shrink-0">
                    -${s.monthlySaved}/mo
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
