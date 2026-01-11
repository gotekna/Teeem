"use client";

/**
 * ShareholdingsTab - Shows shareholding history for a company
 *
 * Extracted from corporate page for unified tab system.
 * Displays current and former shareholders with share details.
 */

import * as React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { api } from "@/lib/api";
import type { CorporateCompany, Shareholding } from "@/lib/types/corporate";

interface ShareholdingsTabProps {
  company: CorporateCompany;
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

  // Separate current and former shareholders
  const currentShareholders = shareholders.filter(sh => !sh.disposal_date);
  const formerShareholders = shareholders.filter(sh => sh.disposal_date);

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
        <h3 className="text-lg font-medium">Shareholding History</h3>
        {company.shares_on_issue && (
          <span className="text-sm text-muted-foreground">
            {company.shares_on_issue.toLocaleString()} shares on issue
          </span>
        )}
      </div>

      {shareholders.length > 0 ? (
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
              {/* Current shareholders first */}
              {currentShareholders.map((sh) => (
                <TableRow key={sh.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-medium">
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
                  <TableCell className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">-</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {/* Former shareholders */}
              {formerShareholders.map((sh) => (
                <TableRow key={sh.id} className="hover:bg-muted/30 opacity-60">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted dark:bg-gray-800 flex items-center justify-center text-muted-foreground text-xs font-medium">
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
                  <TableCell className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{sh.disposal_date ? format(new Date(sh.disposal_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="secondary">Former</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">No shareholders recorded</p>
      )}
    </div>
  );
}

export default ShareholdingsTab;
