"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Cost data - hardcoded (Heroku has no free billing API)
// Update these values when costs change
// ─────────────────────────────────────────────

const LAST_UPDATED = "February 2026";

interface DynoCost {
  app: string;
  dyno: string;
  size: string;
  cost: number;
  purpose: string;
  environment: string;
  note?: string;
}

interface DatabaseCost {
  name: string;
  plan: string;
  cost: number;
  usedBy: string;
  note?: string;
}

interface ServiceCost {
  name: string;
  cost: number | string;
  purpose: string;
  icon: React.ElementType;
  category: "hosting" | "ai" | "integration" | "payperuse";
  note?: string;
}

interface SavingsEntry {
  date: string;
  description: string;
  monthlySaved: number;
}

const DYNOS: DynoCost[] = [
  { app: "teeem-production", dyno: "web", size: "Standard-1X", cost: 25, purpose: "Production Rails API", environment: "Production" },
  { app: "teeem-production", dyno: "worker", size: "Standard-1X", cost: 0, purpose: "Scaled to 0 - shared worker handles jobs", environment: "Production", note: "Scaled to 0" },
  { app: "teeem-beta", dyno: "web", size: "Standard-1X", cost: 25, purpose: "Beta/UAT Rails API", environment: "Beta" },
  { app: "teeem-staging", dyno: "web", size: "Standard-1X", cost: 25, purpose: "Staging Rails API", environment: "Staging" },
  { app: "teeem-staging-worker", dyno: "web + worker", size: "Standard-2X", cost: 50, purpose: "Shared job processing (all envs)", environment: "Shared" },
  { app: "teeem-sam-dev", dyno: "web + worker", size: "Standard-1X x2", cost: 50, purpose: "Sam's dev environment", environment: "Sam Dev" },
  { app: "teeem-rob-dev", dyno: "web", size: "Standard-1X", cost: 25, purpose: "Rob's dev environment", environment: "Rob Dev" },
  { app: "teeem-jake-dev", dyno: "web", size: "Basic", cost: 7, purpose: "Jake's dev environment", environment: "Jake Dev" },
];

const DATABASES: DatabaseCost[] = [
  { name: "PRIMARY (shared)", plan: "Standard-0", cost: 50, usedBy: "All environments (staging/beta/prod)" },
  { name: "Sam Dev DB", plan: "Essential-1", cost: 9, usedBy: "teeem-sam-dev only" },
  { name: "Rob Dev DB", plan: "Mini", cost: 5, usedBy: "teeem-rob-dev only" },
];

const SERVICES: ServiceCost[] = [
  // ── Hosting & Storage ──
  { name: "Vercel (Pro)", cost: 20, purpose: "Next.js frontend hosting + edge CDN for all environments", icon: Globe, category: "hosting" },
  { name: "Wasabi Storage", cost: 7, purpose: "Primary S3-compatible document warehouse (jobs, emails, corporate docs)", icon: HardDrive, category: "hosting" },
  { name: "Backblaze B2", cost: "~5-10", purpose: "Disaster recovery backups - weekly mirror from Wasabi", icon: HardDrive, category: "hosting" },
  { name: "Webcentral", cost: "~15", purpose: "Domain registration & DNS for teeem.com.au", icon: Globe, category: "hosting", note: "Update with actual cost" },
  { name: "Cloudflare", cost: 0, purpose: "DNS management, email DNS provisioning, wildcard SSL (free tier)", icon: Shield, category: "hosting" },

  // ── AI & Machine Learning ──
  { name: "Anthropic (Claude)", cost: "~50-100", purpose: "AI summaries, email classification, plan review, writing assistant, invoice matching", icon: Bot, category: "ai" },
  { name: "AWS Rekognition", cost: "~1-5", purpose: "Face verification for site check-in/out (prevents buddy punching)", icon: ScanFace, category: "ai" },

  // ── Integrations (included/free) ──
  { name: "Xero API", cost: 0, purpose: "Contact/invoice sync via webhooks (included in Xero subscription)", icon: FileSpreadsheet, category: "integration" },
  { name: "Microsoft Graph", cost: 0, purpose: "Email sync (O365), SharePoint, calendar (included in M365)", icon: Mail, category: "integration" },
  { name: "Polaris Mail", cost: "TBD", purpose: "White-label email hosting - mailbox provisioning, aliases, billing", icon: Mail, category: "integration", note: "Email reseller" },
  { name: "Sentry", cost: 0, purpose: "Error tracking & performance monitoring (free tier: 5k errors/mo)", icon: AlertTriangle, category: "integration" },
  { name: "WeatherAPI", cost: 0, purpose: "Automatic rain log tracking for construction jobs (free tier: 100k calls/mo)", icon: CloudRain, category: "integration" },
  { name: "Cloudinary", cost: 0, purpose: "Product images, pricebook photos, image optimization (free tier: 25GB)", icon: Image, category: "integration" },
  { name: "Metabase", cost: 0, purpose: "Business intelligence dashboards (self-hosted on Heroku)", icon: BarChart3, category: "integration", note: "Runs on Heroku" },

  // ── Pay-per-use ──
  { name: "Stripe", cost: "fees only", purpose: "Payment processing - payment links, subscriptions, customer portal", icon: CreditCard, category: "payperuse" },
  { name: "Twilio", cost: "per msg", purpose: "SMS notifications - quote reminders, alerts", icon: MessageSquare, category: "payperuse" },
  { name: "Basiq", cost: "TBD", purpose: "Bank feed aggregation - account linking for financial tracking", icon: Landmark, category: "payperuse" },
];

const SAVINGS_HISTORY: SavingsEntry[] = [
  { date: "Feb 2026", description: "Destroyed orphan HEROKU_POSTGRESQL_RED (Essential-2)", monthlySaved: 20 },
  { date: "Feb 2026", description: "Destroyed orphan QUEUE_DATABASE (Essential-1)", monthlySaved: 9 },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  hosting: { label: "Hosting & Storage", description: "Infrastructure that runs and stores TEEEM" },
  ai: { label: "AI & Machine Learning", description: "Variable cost - scales with usage" },
  integration: { label: "Integrations", description: "Third-party APIs (most included/free tier)" },
  payperuse: { label: "Pay-per-use", description: "Transaction-based billing" },
};

function CostBadge({ cost }: { cost: number | string }) {
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

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function CostsMap() {
  const totalDynos = DYNOS.reduce((sum, d) => sum + d.cost, 0);
  const totalDatabases = DATABASES.reduce((sum, d) => sum + d.cost, 0);
  const totalHeroku = totalDynos + totalDatabases;
  const fixedExternal = SERVICES.filter((s) => typeof s.cost === "number").reduce(
    (sum, s) => sum + (s.cost as number),
    0
  );
  const totalFixed = totalHeroku + fixedExternal;
  const totalSaved = SAVINGS_HISTORY.reduce((sum, s) => sum + s.monthlySaved, 0);

  // Group dynos by environment
  const envGroups: Record<string, { dynos: DynoCost[]; total: number }> = {};
  DYNOS.forEach((d) => {
    if (!envGroups[d.environment]) envGroups[d.environment] = { dynos: [], total: 0 };
    envGroups[d.environment].dynos.push(d);
    envGroups[d.environment].total += d.cost;
  });

  // Group services by category
  const servicesByCategory = SERVICES.reduce<Record<string, ServiceCost[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Infrastructure Costs</h3>
        <p className="text-sm text-muted-foreground">
          Monthly cost breakdown across all services and environments.
          Last updated: {LAST_UPDATED}
        </p>
      </div>

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
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">${totalDatabases}</div>
              <div className="text-xs text-muted-foreground">Databases</div>
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
          <div className="mt-4">
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-blue-500"
                style={{ width: `${(totalDynos / totalFixed) * 100}%` }}
                title={`Dynos: $${totalDynos}`}
              />
              <div
                className="bg-purple-500"
                style={{ width: `${(totalDatabases / totalFixed) * 100}%` }}
                title={`Databases: $${totalDatabases}`}
              />
              <div
                className="bg-orange-500"
                style={{ width: `${(fixedExternal / totalFixed) * 100}%` }}
                title={`External: $${fixedExternal}`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Dynos ({Math.round((totalDynos / totalFixed) * 100)}%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Databases ({Math.round((totalDatabases / totalFixed) * 100)}%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />External ({Math.round((fixedExternal / totalFixed) * 100)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heroku Dynos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Heroku Dynos
            <Badge variant="outline" className="ml-auto font-mono">${totalDynos}/mo</Badge>
          </CardTitle>
          <CardDescription>Compute instances running the Rails backend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">App</th>
                  <th className="pb-2 font-medium">Dyno</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Cost</th>
                  <th className="pb-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {DYNOS.map((d, i) => (
                  <tr key={i} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                    <td className="py-2 pr-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.app}</code>
                    </td>
                    <td className="py-2 pr-4 text-xs">{d.dyno}</td>
                    <td className="py-2 pr-4 text-xs font-mono">{d.size}</td>
                    <td className="py-2 pr-4">
                      <CostBadge cost={d.cost} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {d.purpose}
                      {d.note && (
                        <Badge variant="outline" className="ml-2 text-[10px]">{d.note}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Heroku Databases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Heroku Databases
            <Badge variant="outline" className="ml-auto font-mono">${totalDatabases}/mo</Badge>
          </CardTitle>
          <CardDescription>PostgreSQL databases (staging/beta/prod share one DB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Database</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Cost</th>
                  <th className="pb-2 font-medium">Used By</th>
                </tr>
              </thead>
              <tbody>
                {DATABASES.map((d, i) => (
                  <tr key={i} className={cn("border-b border-border last:border-0", i % 2 === 0 && "bg-muted/30")}>
                    <td className="py-2 pr-4 font-medium text-xs">{d.name}</td>
                    <td className="py-2 pr-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.plan}</code>
                    </td>
                    <td className="py-2 pr-4">
                      <CostBadge cost={d.cost} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{d.usedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                {services.map((s) => (
                  <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <s.icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.name}</span>
                        <CostBadge cost={s.cost} />
                        {s.note && (
                          <Badge variant="outline" className="text-[10px]">{s.note}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Cost by Environment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Cost by Environment
          </CardTitle>
          <CardDescription>Heroku dyno costs grouped by environment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(envGroups)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([env, group]) => (
                <div key={env} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{env}</span>
                    <CostBadge cost={group.total} />
                  </div>
                  <div className="space-y-0.5">
                    {group.dynos.map((d, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground">
                        {d.dyno} ({d.size}){d.note ? ` - ${d.note}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Savings History */}
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
            {SAVINGS_HISTORY.map((s, i) => (
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
    </div>
  );
}
