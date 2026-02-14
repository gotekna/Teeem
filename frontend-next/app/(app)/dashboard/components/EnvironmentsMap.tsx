"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server,
  Monitor,
  Globe,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Cpu,
  HardDrive,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_TIMEOUT_EXTERNAL } from "@/lib/constants/timeout-constants";

interface EnvironmentStatus {
  name: string;
  type: "web" | "worker";
  herokuApp: string;
  branch: string;
  backendUrl: string;
  frontendUrl?: string;
  vercelProject?: string;
  description: string;
  version?: string;
  status: "checking" | "online" | "offline" | "unknown";
  responseTime?: number;
}

const ENVIRONMENTS: EnvironmentStatus[] = [
  {
    name: "Production",
    type: "web",
    herokuApp: "teeem-production",
    branch: "Live",
    backendUrl: "https://teeem-production-121159e1ff9d.herokuapp.com",
    frontendUrl: "https://teeem.vercel.app",
    vercelProject: "teeem-production",
    description: "Live customer-facing environment",
    status: "checking",
  },
  {
    name: "Beta",
    type: "web",
    herokuApp: "teeem-beta",
    branch: "Beta",
    backendUrl: "https://teeem-beta-6e3e9cb59225.herokuapp.com",
    frontendUrl: "https://teeem-beta.vercel.app",
    vercelProject: "teeem-beta",
    description: "UAT / early adopter testing",
    status: "checking",
  },
  {
    name: "Staging",
    type: "web",
    herokuApp: "teeem-staging",
    branch: "Staging",
    backendUrl: "https://teeem-staging-d60a657ed68a.herokuapp.com",
    frontendUrl: "https://teeem-staging.vercel.app",
    vercelProject: "teeem-staging",
    description: "Active development & internal testing",
    status: "checking",
  },
  {
    name: "Shared Worker",
    type: "worker",
    herokuApp: "teeem-shared-worker",
    branch: "Staging",
    backendUrl: "https://teeem-shared-worker-18a27334000e.herokuapp.com",
    description: "Background jobs for ALL environments (shared DB = shared queue). Worker-only Standard-2X dyno (no web).",
    status: "checking",
  },
];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "online":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "offline":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "checking":
      return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    online: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    offline: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    checking: "bg-muted text-muted-foreground border-border",
    unknown: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border", variants[status] || variants.unknown)}>
      <StatusIcon status={status} />
      {status === "checking" ? "Checking..." : status === "unknown" ? "Not Created" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function EnvironmentsMap() {
  const [environments, setEnvironments] = useState<EnvironmentStatus[]>(ENVIRONMENTS);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkEnvironments = useCallback(async () => {
    setIsChecking(true);
    const updated = await Promise.all(
      environments.map(async (env) => {
        if (!env.backendUrl || env.status === "unknown") return env;

        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_EXTERNAL);
          const res = await fetch(`${env.backendUrl}/version`, {
            signal: controller.signal,
            mode: "cors",
          });
          clearTimeout(timeout);
          const elapsed = Date.now() - start;

          if (res.ok) {
            const data = await res.json();
            return {
              ...env,
              status: "online" as const,
              version: data.version || data.v || "?",
              responseTime: elapsed,
            };
          }
          return { ...env, status: "offline" as const, responseTime: elapsed };
        } catch {
          return { ...env, status: "offline" as const, responseTime: Date.now() - start };
        }
      })
    );
    setEnvironments(updated);
    setLastChecked(new Date());
    setIsChecking(false);
  }, [environments]);

  useEffect(() => {
    checkEnvironments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webApps = environments.filter((e) => e.type === "web");
  const workerApps = environments.filter((e) => e.type === "worker");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Environment Status</h3>
          <p className="text-sm text-muted-foreground">
            Live status of all TEEEM environments
            {lastChecked && (
              <span className="ml-2">
                (checked {lastChecked.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkEnvironments}
          disabled={isChecking}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isChecking && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Pipeline Diagram */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Deployment Pipeline
          </CardTitle>
          <CardDescription>Code flows from Staging through Beta to Production</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 py-4 flex-wrap">
            {/* Staging */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "px-4 py-2 rounded-lg border-2 text-center min-w-[120px]",
                environments[2]?.status === "online"
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                  : "border-muted bg-muted/50"
              )}>
                <div className="text-xs text-muted-foreground">Staging</div>
                <div className="font-mono text-sm font-bold">
                  v{environments[2]?.version || "..."}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Staging branch</Badge>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

            {/* Beta */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "px-4 py-2 rounded-lg border-2 text-center min-w-[120px]",
                environments[1]?.status === "online"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-muted bg-muted/50"
              )}>
                <div className="text-xs text-muted-foreground">Beta</div>
                <div className="font-mono text-sm font-bold">
                  v{environments[1]?.version || "..."}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Beta branch</Badge>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

            {/* Production */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "px-4 py-2 rounded-lg border-2 text-center min-w-[120px]",
                environments[0]?.status === "online"
                  ? "border-primary bg-primary/5"
                  : "border-muted bg-muted/50"
              )}>
                <div className="text-xs text-muted-foreground">Production</div>
                <div className="font-mono text-sm font-bold">
                  v{environments[0]?.version || "..."}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Live branch</Badge>
            </div>
          </div>

          {/* Version match indicator */}
          {environments[0]?.version && environments[1]?.version && environments[2]?.version && (
            <div className="text-center mt-2">
              {environments[0].version === environments[1].version &&
               environments[1].version === environments[2].version ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All environments in sync
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Versions differ - deploy may be in progress
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Web Applications */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Web Applications
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {webApps.map((env) => (
            <Card key={env.herokuApp} className="relative overflow-hidden">
              {env.name === "Production" && (
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded-bl">
                  Live
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    {env.name}
                  </CardTitle>
                  <StatusBadge status={env.status} />
                </div>
                <CardDescription>{env.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Backend Version</span>
                    <div className="font-mono font-bold">{env.version ? `v${env.version}` : "..."}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Response Time</span>
                    <div className="font-mono font-bold">
                      {env.responseTime ? `${env.responseTime}ms` : "..."}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Heroku App</span>
                    <div className="font-mono text-[11px]">{env.herokuApp}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Git Branch</span>
                    <div className="font-mono text-[11px]">{env.branch}</div>
                  </div>
                </div>

                <div className="pt-2 border-t space-y-1.5">
                  {env.frontendUrl && (
                    <a
                      href={env.frontendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Monitor className="h-3 w-3" />
                      {env.frontendUrl.replace("https://", "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <a
                    href={env.backendUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Server className="h-3 w-3" />
                    {env.backendUrl.replace("https://", "").split(".")[0]}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Worker Applications */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          Worker Applications
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {workerApps.map((env) => (
            <Card key={env.herokuApp} className={cn(env.status === "unknown" && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    {env.name}
                  </CardTitle>
                  <StatusBadge status={env.status} />
                </div>
                <CardDescription>{env.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Heroku App</span>
                    <div className="font-mono text-[11px]">{env.herokuApp}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Git Branch</span>
                    <div className="font-mono text-[11px]">{env.branch}</div>
                  </div>
                  {env.version && (
                    <div>
                      <span className="text-muted-foreground">Version</span>
                      <div className="font-mono font-bold">v{env.version}</div>
                    </div>
                  )}
                  {env.responseTime && (
                    <div>
                      <span className="text-muted-foreground">Response Time</span>
                      <div className="font-mono font-bold">{env.responseTime}ms</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Infrastructure Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Shared Infrastructure
          </CardTitle>
          <CardDescription>
            Resources shared across environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Database className="h-4 w-4 text-blue-500" />
                PostgreSQL Database
              </div>
              <p className="text-xs text-muted-foreground">
                Staging, Beta, and Production all share the <strong>same production database</strong>.
                One shared worker processes jobs for all environments. Only local dev uses a separate database.
              </p>
              <Badge variant="outline" className="text-[10px]">Heroku Postgres</Badge>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <HardDrive className="h-4 w-4 text-purple-500" />
                Wasabi S3 Storage
              </div>
              <p className="text-xs text-muted-foreground">
                Document warehouse with content-hash deduplication.
                Shared across all environments via WarehouseProvider.
              </p>
              <Badge variant="outline" className="text-[10px]">S3 Compatible</Badge>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Globe className="h-4 w-4 text-green-500" />
                Vercel Frontend
              </div>
              <p className="text-xs text-muted-foreground">
                Each environment has its own Vercel project that auto-deploys
                when its designated branch is pushed.
              </p>
              <Badge variant="outline" className="text-[10px]">Auto-deploy on push</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deploy Commands Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Deploy Commands
          </CardTitle>
          <CardDescription>
            Slash commands for deploying to each environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Command</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Target</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Scope</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/s</code></td>
                  <td className="py-2 pr-4">Staging</td>
                  <td className="py-2 pr-4">This chat</td>
                  <td className="py-2 font-sans">Deploy this chat&apos;s changes to staging</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/sa</code></td>
                  <td className="py-2 pr-4">Staging</td>
                  <td className="py-2 pr-4">All changes</td>
                  <td className="py-2 font-sans">Deploy all pending changes to staging</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/b</code></td>
                  <td className="py-2 pr-4">Staging + Beta</td>
                  <td className="py-2 pr-4">This chat</td>
                  <td className="py-2 font-sans">Deploy to staging and beta</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/ba</code></td>
                  <td className="py-2 pr-4">Staging + Beta</td>
                  <td className="py-2 pr-4">All changes</td>
                  <td className="py-2 font-sans">Deploy all to staging and beta</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/p</code></td>
                  <td className="py-2 pr-4">All three</td>
                  <td className="py-2 pr-4">This chat</td>
                  <td className="py-2 font-sans">Full pipeline: staging → beta → production</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/pa</code></td>
                  <td className="py-2 pr-4">All three</td>
                  <td className="py-2 pr-4">All changes</td>
                  <td className="py-2 font-sans">Full pipeline with all pending changes</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="px-1.5 py-0.5 rounded bg-muted">/live</code></td>
                  <td className="py-2 pr-4">Sync all</td>
                  <td className="py-2 pr-4">Bidirectional</td>
                  <td className="py-2 font-sans">Merge all branches so environments are identical</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
