"use client";

/**
 * HealthTab - Shows company health score and data completeness
 *
 * Extracted from corporate page for unified tab system.
 * Displays health score, issues, warnings, and data completeness.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  XCircle,
  CheckCircle,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Corporate } from "@/lib/types/corporate";

// Health status colors
const HEALTH_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  excellent: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  good: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  needs_attention: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
};

interface HealthData {
  company?: {
    id: number;
    name: string;
    health_score: number;
    health_status: string;
    issues?: string[];
    warnings?: string[];
    has_acn?: boolean;
    has_abn?: boolean;
    has_tfn?: boolean;
    has_registered_office?: boolean;
    has_corporate_key?: boolean;
    director_count?: number;
    bank_account_count?: number;
    shareholder_count?: number;
  };
  summary?: {
    total: number;
    excellent: number;
    good: number;
    needs_attention: number;
    critical: number;
    average_score: number;
  };
  allCompanies?: Array<{
    id: number;
    name: string;
    health_score: number;
    health_status: string;
    issues: string[];
    warnings: string[];
  }>;
}

function CompletionItem({ label, completed, value }: { label: string; completed?: boolean; value?: number }) {
  return (
    <div className="flex items-center space-x-2">
      {completed ? (
        <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
      ) : (
        <XCircle className="h-5 w-5 text-red-400" />
      )}
      <span className="text-sm text-muted-foreground">
        {label}
        {value !== undefined && value > 0 && <span className="ml-1 opacity-60">({value})</span>}
      </span>
    </div>
  );
}

interface HealthTabProps {
  company: Corporate;
  companyId?: string;
  entityId?: string;
  onUpdate?: () => void;
}

export function HealthTab({ company, onUpdate }: HealthTabProps) {
  const [healthData, setHealthData] = React.useState<HealthData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloading, setReloading] = React.useState(false);

  React.useEffect(() => {
    loadHealthReport();
  }, [company.id]);

  const loadHealthReport = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ companies: HealthData["allCompanies"]; summary: HealthData["summary"] }>("/api/v1/companies/health_report");
      const companyHealth = response.companies?.find((c) => c.id === company.id);
      setHealthData({
        company: companyHealth,
        summary: response.summary,
        allCompanies: response.companies,
      });
    } catch (error) {
      console.error("Failed to load health report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadFromSpreadsheet = async () => {
    try {
      setReloading(true);
      await api.post("/api/v1/companies/reload");
      await loadHealthReport();
      onUpdate?.();
    } catch (error) {
      console.error("Failed to reload:", error);
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  const companyHealth = healthData?.company;
  const colors = companyHealth ? HEALTH_STATUS_COLORS[companyHealth.health_status] || HEALTH_STATUS_COLORS.critical : HEALTH_STATUS_COLORS.critical;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={handleReloadFromSpreadsheet} disabled={reloading}>
          {reloading && <Spinner size={16} className="mr-2" />}
          {reloading ? "Reloading..." : "Reload from Spreadsheet"}
        </Button>
      </div>

      {/* Health Score Card */}
      {companyHealth && (
        <div className={cn("rounded-lg p-6 border", colors.bg, colors.border)}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={cn("text-lg font-medium", colors.text)}>Health Score: {companyHealth.health_score}%</h3>
              <p className={cn("text-sm mt-1 opacity-75", colors.text)}>
                Status: {(companyHealth.health_status || 'unknown').replace("_", " ").toUpperCase()}
              </p>
            </div>
            <div className={cn("text-5xl font-bold", colors.text)}>{companyHealth.health_score}</div>
          </div>
        </div>
      )}

      {/* Issues */}
      {companyHealth?.issues && companyHealth.issues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center mb-3">
            <XCircle className="h-5 w-5 mr-2" />
            Critical Issues ({companyHealth.issues.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-red-700 dark:text-red-400 flex items-start">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-1.5 mr-2" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {companyHealth?.warnings && companyHealth.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Warnings ({companyHealth.warnings.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start">
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-1.5 mr-2" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All Clear */}
      {companyHealth?.issues?.length === 0 && companyHealth?.warnings?.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            All checks passed - company data is complete
          </h4>
        </div>
      )}

      {/* Data Completeness */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-4">Data Completeness</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CompletionItem label="ACN" completed={companyHealth?.has_acn} />
            <CompletionItem label="ABN" completed={companyHealth?.has_abn} />
            <CompletionItem label="TFN" completed={companyHealth?.has_tfn} />
            <CompletionItem label="Registered Office" completed={companyHealth?.has_registered_office} />
            <CompletionItem label="Corporate Key" completed={companyHealth?.has_corporate_key} />
            <CompletionItem label="Directors" completed={(companyHealth?.director_count || 0) > 0} value={companyHealth?.director_count} />
            <CompletionItem label="Bank Accounts" completed={(companyHealth?.bank_account_count || 0) > 0} value={companyHealth?.bank_account_count} />
            <CompletionItem label="Shareholders" completed={(companyHealth?.shareholder_count || 0) > 0} value={companyHealth?.shareholder_count} />
          </div>
        </CardContent>
      </Card>

      {/* All Companies Summary */}
      {healthData?.summary && (
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            All Companies Overview
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{healthData.summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{healthData.summary.excellent}</div>
              <div className="text-xs text-muted-foreground">Excellent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{healthData.summary.good}</div>
              <div className="text-xs text-muted-foreground">Good</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{healthData.summary.needs_attention}</div>
              <div className="text-xs text-muted-foreground">Needs Attention</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{healthData.summary.critical}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <div className="text-sm text-muted-foreground">
              Average Health Score: <span className="font-medium">{healthData.summary.average_score}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthTab;
