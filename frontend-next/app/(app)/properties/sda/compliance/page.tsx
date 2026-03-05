"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  FileQuestion,
  ShieldCheck,
  RefreshCw,
  Download,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocStatus = "valid" | "expiring" | "expired" | "missing";

interface DocumentCompliance {
  status: DocStatus;
  expiresAt?: string;
  uploadedAt?: string;
}

interface ComplianceProperty {
  id: number;
  address: string;
  suburb?: string;
  sdaCategory: string;
  complianceScore: number;
  documents: {
    sda_assessment?: DocumentCompliance;
    fire_safety?: DocumentCompliance;
    building_cert?: DocumentCompliance;
    occupancy_cert?: DocumentCompliance;
    insurance?: DocumentCompliance;
    photos?: DocumentCompliance;
  };
}

// ─── Document column config ───────────────────────────────────────────────────

const DOC_COLUMNS: { key: keyof ComplianceProperty["documents"]; label: string }[] = [
  { key: "sda_assessment", label: "Assessment" },
  { key: "fire_safety", label: "Fire Safety" },
  { key: "building_cert", label: "Building Cert" },
  { key: "occupancy_cert", label: "Occupancy" },
  { key: "insurance", label: "Insurance" },
  { key: "photos", label: "Photos" },
];

// ─── Doc Status Badge ─────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<
  DocStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  valid: {
    label: "Valid",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  expiring: {
    label: "Expiring",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  expired: {
    label: "Expired",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
  missing: {
    label: "Missing",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-500 dark:text-gray-400",
    icon: FileQuestion,
  },
};

function DocStatusCell({ compliance }: { compliance?: DocumentCompliance }) {
  if (!compliance) {
    const cfg = DOC_STATUS_CONFIG.missing;
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center justify-center`} title="Missing">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
          <Icon className="h-3 w-3" />
          <span className="hidden lg:inline">{cfg.label}</span>
        </span>
      </div>
    );
  }

  const cfg = DOC_STATUS_CONFIG[compliance.status];
  const Icon = cfg.icon;
  const tooltip =
    compliance.expiresAt
      ? `Expires: ${compliance.expiresAt}`
      : compliance.uploadedAt
      ? `Uploaded: ${compliance.uploadedAt}`
      : cfg.label;

  return (
    <div className="flex items-center justify-center" title={tooltip}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
      >
        <Icon className="h-3 w-3" />
        <span className="hidden lg:inline">{cfg.label}</span>
      </span>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30"
      : score >= 70
      ? "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30"
      : "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30";

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold font-mono ${color}`}>
      {score}%
    </span>
  );
}

// ─── SDA Category Badge ───────────────────────────────────────────────────────

const SDA_CATEGORY_STYLES: Record<string, string> = {
  HPS: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  FA: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  IL: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  Robust:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

function SdaCategoryBadge({ category }: { category: string }) {
  const cls =
    SDA_CATEGORY_STYLES[category] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border ${cls}`}
    >
      {category}
    </span>
  );
}

// ─── Portfolio Summary ────────────────────────────────────────────────────────

function PortfolioSummary({ properties }: { properties: ComplianceProperty[] }) {
  const avgScore =
    properties.length > 0
      ? Math.round(properties.reduce((sum, p) => sum + p.complianceScore, 0) / properties.length)
      : 0;

  // Count all document statuses across portfolio
  let validCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let missingCount = 0;

  properties.forEach((p) => {
    DOC_COLUMNS.forEach(({ key }) => {
      const doc = p.documents[key];
      if (!doc || doc.status === "missing") missingCount++;
      else if (doc.status === "valid") validCount++;
      else if (doc.status === "expiring") expiringCount++;
      else if (doc.status === "expired") expiredCount++;
    });
  });

  const total = validCount + expiringCount + expiredCount + missingCount;

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-background to-secondary/30">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-wrap items-center gap-6">
          {/* Portfolio score */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Portfolio Score</p>
            <div
              className={`text-3xl font-bold font-mono ${
                avgScore >= 90
                  ? "text-green-600 dark:text-green-400"
                  : avgScore >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {avgScore}%
            </div>
          </div>

          <div className="w-px h-10 bg-border hidden sm:block" />

          {/* Document breakdown */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                <span className="font-semibold font-mono">{validCount}</span>
                <span className="text-muted-foreground ml-1 text-xs">valid</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>
                <span className="font-semibold font-mono">{expiringCount}</span>
                <span className="text-muted-foreground ml-1 text-xs">expiring</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>
                <span className="font-semibold font-mono">{expiredCount}</span>
                <span className="text-muted-foreground ml-1 text-xs">expired</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-gray-400" />
              <span>
                <span className="font-semibold font-mono">{missingCount}</span>
                <span className="text-muted-foreground ml-1 text-xs">missing</span>
              </span>
            </div>
          </div>

          {/* Action items */}
          {(expiringCount > 0 || expiredCount > 0) && (
            <>
              <div className="w-px h-10 bg-border hidden sm:block" />
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Action Required</p>
                  <p className="text-muted-foreground">
                    {expiredCount > 0 && `${expiredCount} expired`}
                    {expiredCount > 0 && expiringCount > 0 && ", "}
                    {expiringCount > 0 && `${expiringCount} expiring soon`}
                    {" "}({Math.round(((expiredCount + expiringCount) / total) * 100)}% of total)
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Compliance Matrix Table ───────────────────────────────────────────────────

function ComplianceTable({ properties, loading }: { properties: ComplianceProperty[]; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">
                  Property
                </th>
                {DOC_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </td>
                    {DOC_COLUMNS.map((col) => (
                      <td key={col.key} className="px-2 py-3">
                        <div className="flex justify-center">
                          <Skeleton className="h-6 w-16 rounded" />
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Skeleton className="h-6 w-12 rounded" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={DOC_COLUMNS.length + 2} className="px-4 py-12 text-center">
                    <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No compliance data available</p>
                  </td>
                </tr>
              ) : (
                properties.map((property) => (
                  <tr
                    key={property.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    {/* Property */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SdaCategoryBadge category={property.sdaCategory} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[150px]">
                            {property.address}
                          </p>
                          {property.suburb && (
                            <p className="text-xs text-muted-foreground">{property.suburb}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Document columns */}
                    {DOC_COLUMNS.map((col) => (
                      <td key={col.key} className="px-2 py-3">
                        <DocStatusCell compliance={property.documents[col.key]} />
                      </td>
                    ))}

                    {/* Score */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <ScoreBadge score={property.complianceScore} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {!loading && properties.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {Object.entries(DOC_STATUS_CONFIG).map(([status, cfg]) => {
              const Icon = cfg.icon;
              return (
                <span key={status} className={`flex items-center gap-1 ${cfg.text}`}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaCompliancePage() {
  const [properties, setProperties] = useState<ComplianceProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: ComplianceProperty[] }>(
        "/api/v1/sda/compliance"
      );
      if (res?.data) setProperties(res.data);
      else if (Array.isArray(res)) setProperties(res as ComplianceProperty[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Compliance matrix for{" "}
          <span className="font-semibold text-foreground font-mono">{properties.length}</span>{" "}
          SDA properties
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompliance}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load compliance data</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchCompliance}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Portfolio summary */}
          {!loading && properties.length > 0 && (
            <PortfolioSummary properties={properties} />
          )}
          {loading && (
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <Skeleton className="h-3 w-28 mb-1.5" />
                    <Skeleton className="h-8 w-14" />
                  </div>
                  <div className="flex gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-20" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance matrix */}
          <ComplianceTable properties={properties} loading={loading} />
        </>
      )}
    </div>
  );
}
