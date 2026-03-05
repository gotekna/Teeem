"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { TrendingUp, TrendingDown, Calculator, DollarSign, Percent, Building2, BarChart3 } from "lucide-react";

interface ValuationData {
  property: {
    id: number; property_code: string; name: string; address: string;
    bedrooms: number; bathrooms: number; land_area_sqm: number; floor_area_sqm: number;
    year_built: number; construction_type: string;
  };
  purchase: {
    price: number | null; date: string | null; stamp_duty: number; legal_fees: number;
    other_costs: number; capital_improvements: number; total_cost_base: number;
  };
  current_value: { valuation: number | null; valuation_date: string | null; effective_value: number };
  income: {
    weekly_rent: number; rent_frequency: string; annual_gross_rent: number;
    annual_expenses: number; annual_net_income: number;
    sda: { sda_weekly_rate: number; participant_contribution: number; ndia_payment: number } | null;
  };
  expenses: {
    management_fee_pct: number; vacancy_rate_pct: number; annual_insurance: number;
    annual_council_rates: number; annual_water_rates: number; annual_body_corporate: number;
    annual_other: number; total: number;
  };
  valuations: {
    gross_rental_yield: number | null; net_rental_yield: number | null; cap_rate: number | null;
    gross_rent_multiplier: number | null; cost_approach: number | null; dcf_10yr: number | null;
  };
  capital_gains: {
    unrealised_gain: number | null; total_cost_base: number; held_over_12_months: boolean;
    cgt_discount_eligible: boolean; estimated_cgt_at_37pct: number | null; estimated_cgt_at_45pct: number | null;
  };
}

function portalFetch(path: string, options?: RequestInit) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
  }).then((r) => r.json());
}

function fmt(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function pct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value}%`;
}

export default function PropertyValuationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);

  // DCF Calculator state
  const [dcfParams, setDcfParams] = useState({
    discount_rate: 8, rental_growth: 3, expense_growth: 2.5,
    hold_years: 10, exit_cap_rate: 6,
  });
  const [dcfResult, setDcfResult] = useState<number | null>(null);
  const [cgtParams, setCgtParams] = useState({ marginal_tax_rate: 37, selling_costs: 0 });
  const [cgtResult, setCgtResult] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    portalFetch(`/api/v1/portal/property/valuations/${id}`)
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const runCalculation = async () => {
    setCalculating(true);
    const res = await portalFetch(`/api/v1/portal/property/valuations/${id}/calculate`, {
      method: "POST",
      body: JSON.stringify({
        discount_rate: dcfParams.discount_rate / 100,
        rental_growth: dcfParams.rental_growth / 100,
        expense_growth: dcfParams.expense_growth / 100,
        hold_years: dcfParams.hold_years,
        exit_cap_rate: dcfParams.exit_cap_rate / 100,
        marginal_tax_rate: cgtParams.marginal_tax_rate / 100,
        selling_costs: cgtParams.selling_costs,
      }),
    });
    if (res.success) {
      setDcfResult(res.data.dcf_value);
      setCgtResult(res.data.estimated_cgt);
    }
    setCalculating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-10 text-muted-foreground">Property not found</p>;

  const { property, purchase, current_value, income, expenses, valuations, capital_gains } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/portal/property/valuations" />
        <div>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <p className="text-sm text-muted-foreground">
            {property.property_code} | {property.bedrooms} bed, {property.bathrooms} bath
            {property.year_built ? ` | Built ${property.year_built}` : ""}
          </p>
        </div>
      </div>

      {/* Value Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Purchase Price</p>
            <p className="text-2xl font-bold">{fmt(purchase.price)}</p>
            {purchase.date && <p className="text-xs text-muted-foreground">Purchased {new Date(purchase.date).toLocaleDateString("en-AU")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-2xl font-bold">{fmt(current_value.effective_value)}</p>
            {current_value.valuation_date && <p className="text-xs text-muted-foreground">Valued {new Date(current_value.valuation_date).toLocaleDateString("en-AU")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {(capital_gains.unrealised_gain ?? 0) >= 0
                ? <TrendingUp className="h-5 w-5 text-green-600" />
                : <TrendingDown className="h-5 w-5 text-red-600" />}
              <div>
                <p className="text-sm text-muted-foreground">Capital Gain</p>
                <p className={`text-2xl font-bold ${(capital_gains.unrealised_gain ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(capital_gains.unrealised_gain)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6 Valuation Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Valuation Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ValuationMethod
              title="Gross Rental Yield"
              value={pct(valuations.gross_rental_yield)}
              formula="Annual Rent / Property Value x 100"
              description="Before expenses. Higher = better cash flow."
              benchmark="AU Average: 3-6%"
            />
            <ValuationMethod
              title="Net Rental Yield"
              value={pct(valuations.net_rental_yield)}
              formula="(Rent - Expenses) / Value x 100"
              description="After all expenses. The true return."
              benchmark="AU Average: 1.5-4%"
            />
            <ValuationMethod
              title="Cap Rate"
              value={pct(valuations.cap_rate)}
              formula="Net Operating Income / Value x 100"
              description="Industry standard for comparing properties."
              benchmark="Brisbane: ~4.5%"
            />
            <ValuationMethod
              title="Gross Rent Multiplier"
              value={valuations.gross_rent_multiplier ? `${valuations.gross_rent_multiplier}x` : "—"}
              formula="Property Value / Annual Gross Rent"
              description="Years of rent to pay off property. Lower = better."
              benchmark="Good: 15-20x"
            />
            <ValuationMethod
              title="Cost Approach"
              value={fmt(valuations.cost_approach)}
              formula="Land + Building - Depreciation"
              description="Replacement cost method. Good for newer builds."
              benchmark={property.construction_type || "—"}
            />
            <ValuationMethod
              title="DCF (10-Year)"
              value={fmt(valuations.dcf_10yr)}
              formula="Sum of discounted future cash flows"
              description="Most sophisticated method. Projects future value."
              benchmark="Discount rate: 8%"
            />
          </div>
        </CardContent>
      </Card>

      {/* Income & Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-green-600">Income</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Weekly Rent" value={fmt(income.weekly_rent)} />
            <Row label="Frequency" value={income.rent_frequency} />
            <Row label="Annual Gross Rent" value={fmt(income.annual_gross_rent)} bold />
            {income.sda && (
              <>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">SDA Breakdown</p>
                </div>
                <Row label="NDIA Payment" value={`${fmt(income.sda.ndia_payment)}/wk`} />
                <Row label="Participant Contribution" value={`${fmt(income.sda.participant_contribution)}/wk`} />
                <Row label="SDA Weekly Rate" value={`${fmt(income.sda.sda_weekly_rate)}/wk`} />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-red-600">Expenses</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Management Fee" value={`${expenses.management_fee_pct || 0}% (${fmt(income.annual_gross_rent * (expenses.management_fee_pct || 0) / 100)})`} />
            <Row label="Vacancy Allowance" value={`${expenses.vacancy_rate_pct || 0}%`} />
            <Row label="Insurance" value={fmt(expenses.annual_insurance)} />
            <Row label="Council Rates" value={fmt(expenses.annual_council_rates)} />
            <Row label="Water Rates" value={fmt(expenses.annual_water_rates)} />
            <Row label="Body Corporate" value={fmt(expenses.annual_body_corporate)} />
            <Row label="Other" value={fmt(expenses.annual_other)} />
            <div className="border-t pt-2">
              <Row label="Total Annual Expenses" value={fmt(expenses.total)} bold />
            </div>
            <div className="border-t pt-2">
              <Row label="Net Annual Income" value={fmt(income.annual_net_income)} bold green />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CGT Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Capital Gains Tax Estimate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Row label="Purchase Price" value={fmt(purchase.price)} />
              <Row label="Stamp Duty" value={fmt(purchase.stamp_duty)} />
              <Row label="Legal Fees" value={fmt(purchase.legal_fees)} />
              <Row label="Other Acquisition Costs" value={fmt(purchase.other_costs)} />
              <Row label="Capital Improvements" value={fmt(purchase.capital_improvements)} />
              <div className="border-t pt-2">
                <Row label="Total Cost Base" value={fmt(capital_gains.total_cost_base)} bold />
              </div>
              <div className="border-t pt-2">
                <Row label="Current Value" value={fmt(current_value.effective_value)} />
                <Row label="Unrealised Gain" value={fmt(capital_gains.unrealised_gain)} bold green={capital_gains.unrealised_gain != null && capital_gains.unrealised_gain >= 0} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">CGT Discount</p>
                {capital_gains.held_over_12_months ? (
                  <Badge variant="default" className="bg-green-600">50% CGT Discount Eligible</Badge>
                ) : (
                  <Badge variant="secondary">Held less than 12 months - no discount</Badge>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Estimated Tax Payable</p>
                <div className="space-y-1">
                  <Row label="At 37% marginal rate" value={fmt(capital_gains.estimated_cgt_at_37pct)} />
                  <Row label="At 45% marginal rate" value={fmt(capital_gains.estimated_cgt_at_45pct)} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom DCF Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Custom DCF Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground">Discount Rate (%)</label>
              <Input type="number" value={dcfParams.discount_rate} onChange={(e) => setDcfParams({ ...dcfParams, discount_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rental Growth (%/yr)</label>
              <Input type="number" value={dcfParams.rental_growth} onChange={(e) => setDcfParams({ ...dcfParams, rental_growth: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expense Growth (%/yr)</label>
              <Input type="number" value={dcfParams.expense_growth} onChange={(e) => setDcfParams({ ...dcfParams, expense_growth: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hold Period (years)</label>
              <Input type="number" value={dcfParams.hold_years} onChange={(e) => setDcfParams({ ...dcfParams, hold_years: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Exit Cap Rate (%)</label>
              <Input type="number" value={dcfParams.exit_cap_rate} onChange={(e) => setDcfParams({ ...dcfParams, exit_cap_rate: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground">Marginal Tax Rate (%)</label>
              <Input type="number" value={cgtParams.marginal_tax_rate} onChange={(e) => setCgtParams({ ...cgtParams, marginal_tax_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Estimated Selling Costs ($)</label>
              <Input type="number" value={cgtParams.selling_costs} onChange={(e) => setCgtParams({ ...cgtParams, selling_costs: Number(e.target.value) })} />
            </div>
          </div>
          <Button onClick={runCalculation} disabled={calculating}>
            {calculating ? "Calculating..." : "Calculate"}
          </Button>

          {(dcfResult != null || cgtResult != null) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {dcfResult != null && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground">DCF Estimated Value</p>
                  <p className="text-3xl font-bold text-primary">{fmt(dcfResult)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dcfParams.hold_years}-year projection at {dcfParams.discount_rate}% discount rate</p>
                </div>
              )}
              {cgtResult != null && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-muted-foreground">Estimated CGT Payable</p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{fmt(cgtResult)}</p>
                  <p className="text-xs text-muted-foreground mt-1">At {cgtParams.marginal_tax_rate}% marginal rate{cgtParams.selling_costs > 0 ? `, $${cgtParams.selling_costs} selling costs` : ""}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ValuationMethod({ title, value, formula, description, benchmark }: {
  title: string; value: string; formula: string; description: string; benchmark: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{formula}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <p className="text-xs text-primary mt-1">{benchmark}</p>
    </div>
  );
}

function Row({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${green ? "text-green-600" : ""}`}>{value}</span>
    </div>
  );
}
