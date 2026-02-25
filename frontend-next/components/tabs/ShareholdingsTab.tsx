"use client";

/**
 * ShareholdingsTab - Shows shareholding history for a company
 *
 * Extracted from corporate page for unified tab system.
 * Displays current and former shareholders with share details.
 * Two sub-tabs: Current Shareholding (active only) and Shareholding History (all records).
 */

import * as React from "react";
import { differenceInMonths, differenceInYears, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { api } from "@/lib/api";
import type { Corporate, Shareholding } from "@/lib/types/corporate";

interface ShareholdingsTabProps {
  company: Corporate;
  companyId?: string;
  entityId?: string;
}

export function ShareholdingsTab({ company, companyId }: ShareholdingsTabProps) {
  const [shareholders, setShareholders] = React.useState<Shareholding[]>([]);
  const [loading, setLoading] = React.useState(true);

  const effectiveCompanyId = companyId || String(company.id);

  React.useEffect(() => {
    const loadShareholders = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { shareholdings: Shareholding[] } }>(
          `/api/v1/companies/${effectiveCompanyId}/shareholders`
        );
        setShareholders(response.data?.shareholdings || []);
      } catch (error) {
        console.error("Failed to load shareholders:", error);
      } finally {
        setLoading(false);
      }
    };
    loadShareholders();
  }, [effectiveCompanyId]);

  const currentShareholders = shareholders.filter(sh => !sh.disposal_date);
  const formerShareholders = shareholders.filter(sh => sh.disposal_date);

  const formatDuration = (acquiredDate?: string, disposedDate?: string) => {
    if (!acquiredDate) return "-";
    const start = new Date(acquiredDate);
    const end = disposedDate ? new Date(disposedDate) : new Date();
    const years = differenceInYears(end, start);
    const months = differenceInMonths(end, start) % 12;
    if (years === 0 && months === 0) return "< 1 month";
    const parts: string[] = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    return parts.join(" ");
  };

  const renderShareholderRow = (sh: Shareholding) => {
    const isCurrent = !sh.disposal_date;
    return (
      <TableRow key={sh.id} className={isCurrent ? "hover:bg-muted/30" : "hover:bg-muted/30 opacity-60"}>
        <TableCell className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              isCurrent
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-muted dark:bg-card text-muted-foreground"
            }`}>
              {sh.shareholder_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
            </div>
            <div>
              <p className="text-sm font-medium">{sh.shareholder_name}</p>
              {sh.beneficially_held && (
                <p className="text-xs text-muted-foreground">Beneficial: {sh.beneficial_owner}</p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 text-sm capitalize">{sh.share_class || "Ordinary"}</TableCell>
        <TableCell className="px-4 py-3 text-sm text-right font-mono">{sh.number_of_shares.toLocaleString()}</TableCell>
        <TableCell className="px-4 py-3 text-sm text-right">{sh.percentage}%</TableCell>
        <TableCell className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), DATE_DISPLAY) : "-"}</TableCell>
        <TableCell className="px-4 py-3 text-sm">{isCurrent ? "-" : (sh.disposal_date ? format(new Date(sh.disposal_date), DATE_DISPLAY) : "-")}</TableCell>
        <TableCell className="px-4 py-3">
          {isCurrent ? (
            <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300">Current</Badge>
          ) : (
            <Badge variant="secondary">Former</Badge>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderCurrentTable = () => {
    if (currentShareholders.length === 0) {
      return <p className="text-sm text-muted-foreground py-4">No current shareholders recorded</p>;
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Shareholder</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Class</TableHead>
              <TableHead className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Shares</TableHead>
              <TableHead className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">%</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Acquired</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Disposed</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {currentShareholders.map(renderShareholderRow)}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderHistoryTable = () => {
    const sorted = [...shareholders].sort((a, b) => {
      if (!a.acquisition_date && !b.acquisition_date) return 0;
      if (!a.acquisition_date) return 1;
      if (!b.acquisition_date) return -1;
      return new Date(b.acquisition_date).getTime() - new Date(a.acquisition_date).getTime();
    });

    if (sorted.length === 0) {
      return <p className="text-sm text-muted-foreground py-4">No shareholding records found</p>;
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Shareholder</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Class</TableHead>
              <TableHead className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Shares</TableHead>
              <TableHead className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">%</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Acquired</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Disposed</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Duration</TableHead>
              <TableHead className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {sorted.map((sh) => {
              const isCurrent = !sh.disposal_date;
              return (
                <TableRow key={sh.id} className={isCurrent ? "hover:bg-muted/30" : "hover:bg-muted/30 opacity-60"}>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCurrent
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-muted dark:bg-card text-muted-foreground"
                      }`}>
                        {sh.shareholder_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sh.shareholder_name}</p>
                        {sh.beneficially_held && (
                          <p className="text-xs text-muted-foreground">Beneficial: {sh.beneficial_owner}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm capitalize">{sh.share_class || "Ordinary"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-right font-mono">{sh.number_of_shares.toLocaleString()}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-right">{sh.percentage}%</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), DATE_DISPLAY) : "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{sh.disposal_date ? format(new Date(sh.disposal_date), DATE_DISPLAY) : "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{formatDuration(sh.acquisition_date, sh.disposal_date)}</TableCell>
                  <TableCell className="px-4 py-3">
                    {isCurrent ? (
                      <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                    ) : (
                      <Badge variant="secondary">Former</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Shareholdings</h3>
        {company.shares_on_issue && (
          <span className="text-sm text-muted-foreground">
            {company.shares_on_issue.toLocaleString()} shares on issue
          </span>
        )}
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Shareholding</TabsTrigger>
          <TabsTrigger value="history">Shareholding History</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          {renderCurrentTable()}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {renderHistoryTable()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ShareholdingsTab;
