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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scalingDyno, setScalingDyno] = useState<string | null>(null); // "app:dyno" key
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get<{ success: boolean; data: InfrastructureData }>(
        "/api/v1/heroku/infrastructure",
        refresh ? { params: { refresh: "true" } } : {}
      );

      if (response?.success && response.data) {
        setData(response.data);
        setError(response.data.error || null);
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

  // Group dynos by environment
  const envGroups: Record<string, { dynos: DynoCost[]; total: number }> = {};
  data.dynos.forEach((d) => {
    if (!envGroups[d.environment]) envGroups[d.environment] = { dynos: [], total: 0 };
    envGroups[d.environment].dynos.push(d);
    envGroups[d.environment].total += d.cost;
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
                  const isDevApp = group.dynos.some((d) => DEV_APPS.includes(d.app));
                  const appName = group.dynos[0]?.app;
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
                          {activeDynos.length > 0
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
                                <th className="py-1.5 px-3 font-medium text-xs">Dyno</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Size</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Qty</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Cost</th>
                                <th className="py-1.5 px-3 font-medium text-xs">Purpose</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.dynos.map((d) => {
                                const isDev = DEV_APPS.includes(d.app);
                                const isScaling = scalingDyno === `${d.app}:${d.dyno}`;
                                return (
                                  <tr
                                    key={`${d.app}-${d.dyno}`}
                                    className={cn("border-b border-border last:border-0", d.scaledDown && "opacity-50")}
                                  >
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
