"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { TrendingUp, TrendingDown, ChevronRight, Building2 } from "lucide-react";

interface PortfolioValuation {
  total_properties: number;
  total_purchase_value: number;
  total_current_value: number;
  total_unrealised_gain: number;
  total_gain_pct: number | null;
  total_annual_rent: number;
  total_annual_expenses: number;
  total_net_income: number;
  portfolio_yield: number | null;
}

interface PropertyValuation {
  id: number;
  property_code: string;
  name: string;
  address: string;
  purchase_price: number | null;
  purchase_date: string | null;
  current_valuation: number | null;
  effective_value: number;
  gross_yield: number | null;
  net_yield: number | null;
  grm: number | null;
  unrealised_gain: number | null;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value}%`;
}

export default function ValuationsPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioValuation | null>(null);
  const [properties, setProperties] = useState<PropertyValuation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/api/v1/portal/property/valuations")
      .then((res) => {
        if (res.success) {
          setPortfolio(res.data.portfolio);
          setProperties(res.data.properties);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Property Valuations</h1>

      {/* Portfolio Summary */}
      {portfolio && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Purchase Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(portfolio.total_purchase_value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Current Portfolio Value</p>
                <p className="text-2xl font-bold">{formatCurrency(portfolio.total_current_value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  {portfolio.total_unrealised_gain >= 0
                    ? <TrendingUp className="h-5 w-5 text-green-600" />
                    : <TrendingDown className="h-5 w-5 text-red-600" />}
                  <div>
                    <p className="text-sm text-muted-foreground">Unrealised Gain</p>
                    <p className={`text-2xl font-bold ${portfolio.total_unrealised_gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(portfolio.total_unrealised_gain)}
                    </p>
                    {portfolio.total_gain_pct != null && (
                      <p className="text-xs text-muted-foreground">{portfolio.total_gain_pct > 0 ? "+" : ""}{portfolio.total_gain_pct}%</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Portfolio Net Yield</p>
                <p className="text-2xl font-bold text-green-600">{formatPct(portfolio.portfolio_yield)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(portfolio.total_net_income)}/yr net income
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Income vs Expense */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Annual Rent</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(portfolio.total_annual_rent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Annual Expenses</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(portfolio.total_annual_expenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className="text-xl font-bold">{formatCurrency(portfolio.total_net_income)}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Property Table */}
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2">Property</th>
                  <th className="text-right py-3 px-2">Purchase</th>
                  <th className="text-right py-3 px-2">Current Value</th>
                  <th className="text-right py-3 px-2">Gain/Loss</th>
                  <th className="text-right py-3 px-2">Gross Yield</th>
                  <th className="text-right py-3 px-2">Net Yield</th>
                  <th className="text-right py-3 px-2">GRM</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {properties.map((prop) => (
                  <tr
                    key={prop.id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/portal/property/valuations/${prop.id}`)}
                  >
                    <td className="py-3 px-2">
                      <p className="font-medium">{prop.address}</p>
                      <p className="text-xs text-muted-foreground">{prop.property_code}</p>
                    </td>
                    <td className="text-right py-3 px-2">{formatCurrency(prop.purchase_price)}</td>
                    <td className="text-right py-3 px-2 font-medium">{formatCurrency(prop.effective_value)}</td>
                    <td className="text-right py-3 px-2">
                      {prop.unrealised_gain != null ? (
                        <span className={prop.unrealised_gain >= 0 ? "text-green-600" : "text-red-600"}>
                          {prop.unrealised_gain >= 0 ? "+" : ""}{formatCurrency(prop.unrealised_gain)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="text-right py-3 px-2">{formatPct(prop.gross_yield)}</td>
                    <td className="text-right py-3 px-2 font-medium">{formatPct(prop.net_yield)}</td>
                    <td className="text-right py-3 px-2">{prop.grm != null ? `${prop.grm}x` : "—"}</td>
                    <td className="py-3 px-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
