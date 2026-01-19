"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrencyWhole } from "@/utils/formatters";

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

interface XeroGroupPLCardProps {
  companyId: string;
}

/**
 * XeroGroupPLCard - Group Profit & Loss side-by-side view
 *
 * Shows P&L data from all companies in the group side-by-side with totals.
 */
export function XeroGroupPLCard({ companyId }: XeroGroupPLCardProps) {
  const [rows, setRows] = React.useState<MergedRow[]>([]);
  const [companies, setCompanies] = React.useState<GroupCompany[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        companies: GroupCompany[];
        rows: MergedRow[];
        from_date: string;
        to_date: string;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/group/profit_loss`, {
        params: { from_date: dateRange.from, to_date: dateRange.to },
      });

      if (response?.success) {
        setCompanies(response.companies);
        setRows(response.rows);
      } else {
        setError(response?.error || "Failed to load group P&L");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Format currency value (0 decimals, "-" for null)
  const formatCurrency = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === "") return "-";
    const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return String(value);
    return formatCurrencyWhole(num);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Group Profit & Loss
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Combined P&L across all companies in this group
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-36"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
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
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        )}

        {/* Empty State */}
        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">Select a date range and click Load</p>
            <p className="text-sm">The report will show P&L data from all group companies side-by-side.</p>
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
                  <TableHead className="text-right w-[150px] font-bold bg-blue-50 dark:bg-blue-900/20">
                    TOTAL
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  if (row.row_type === "Header") {
                    return null; // Skip headers - column names are already in table header
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
                      <TableCell className="text-right text-sm tabular-nums font-semibold bg-blue-50/50 dark:bg-blue-900/10">
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

export default XeroGroupPLCard;
