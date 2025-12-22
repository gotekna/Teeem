"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MergedRow {
  row_type: "Header" | "Section" | "Row" | "SummaryRow";
  title?: string;
  label?: string;
  company_values: Record<number, string>;
  total: number;
}

interface GroupCompany {
  id: number;
  name: string;
}

interface XeroGroupBalanceSheetCardProps {
  companyId: string;
}

/**
 * XeroGroupBalanceSheetCard - Group Balance Sheet side-by-side view
 *
 * Shows Balance Sheet data from all companies in the group side-by-side with totals.
 */
export function XeroGroupBalanceSheetCard({ companyId }: XeroGroupBalanceSheetCardProps) {
  const [rows, setRows] = React.useState<MergedRow[]>([]);
  const [companies, setCompanies] = React.useState<GroupCompany[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [asOfDate, setAsOfDate] = React.useState(new Date().toISOString().split("T")[0]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        companies: GroupCompany[];
        rows: MergedRow[];
        as_of_date: string;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/group/balance_sheet`, {
        params: { date: asOfDate },
      });

      if (response?.success) {
        setCompanies(response.companies);
        setRows(response.rows);
      } else {
        setError(response?.error || "Failed to load group Balance Sheet");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Format currency value
  const formatCurrency = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === "") return "-";
    const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Group Balance Sheet
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Combined Balance Sheet across all companies in this group
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As of:</span>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-40"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Load</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty State */}
        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">Select a date and click Load</p>
            <p className="text-sm">The report will show Balance Sheet data from all group companies side-by-side.</p>
          </div>
        )}

        {/* Report Table */}
        {!loading && rows.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">Account</TableHead>
                  {companies.map((company) => (
                    <TableHead key={company.id} className="text-right w-[150px]">
                      {company.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right w-[150px] font-bold bg-green-50 dark:bg-green-900/20">
                    TOTAL
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  if (row.row_type === "Header") {
                    return null;
                  }

                  if (row.row_type === "Section") {
                    return (
                      <TableRow key={idx} className="bg-muted/30">
                        <TableCell colSpan={companies.length + 2} className="font-semibold text-sm py-2">
                          {row.title}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const isSummary = row.row_type === "SummaryRow";

                  return (
                    <TableRow
                      key={idx}
                      className={cn(
                        isSummary && "bg-muted/20 font-semibold"
                      )}
                    >
                      <TableCell className={cn("text-sm", isSummary && "font-semibold")}>
                        {row.label || row.title || "-"}
                      </TableCell>
                      {companies.map((company) => (
                        <TableCell key={company.id} className="text-right text-sm tabular-nums">
                          {formatCurrency(row.company_values[company.id])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-sm tabular-nums font-semibold bg-green-50/50 dark:bg-green-900/10">
                        {formatCurrency(row.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroGroupBalanceSheetCard;
