"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Landmark,
  Wallet,
  Building2,
  Users,
  AlertTriangle,
  TrendingUp,
  Calendar,
} from "lucide-react";

interface Tenancy {
  id: number;
  tenancy_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  rent_frequency: string;
  bond_amount: number | null;
  bond_lodged: boolean;
  sda_plan_number: string | null;
  sda_weekly_rate: number | null;
  participant_rent_contribution: number | null;
  ndia_payment_amount: number | null;
  sda_participant_contact?: { id: number; display_name: string } | null;
  notes: string | null;
}

interface Property {
  id: number;
  street_address: string;
  suburb: string | null;
  sda_category: string | null;
  sda_enrolled: boolean;
  sda_building_type?: string | null;
  weekly_rent_amount: number | null;
  bedrooms: number | null;
}

interface PropertyRentTabProps {
  property: Property;
  tenancies: Tenancy[];
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "$0";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function sdaCategoryLabel(cat: string | null) {
  if (!cat) return "—";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function PropertyRentTab({ property, tenancies }: PropertyRentTabProps) {
  const activeTenancy = tenancies.find((t) => t.status === "active");
  const isSda = property.sda_enrolled;
  const isSdaTenancy = activeTenancy?.tenancy_type === "sda";

  // Potential income = SDA rate or weekly rent on property
  const potentialWeekly = isSda && isSdaTenancy
    ? (activeTenancy?.sda_weekly_rate || property.weekly_rent_amount || 0)
    : (property.weekly_rent_amount || activeTenancy?.weekly_rent || 0);

  // Actual income
  const actualWeekly = activeTenancy?.weekly_rent || 0;
  const actualSdaWeekly = isSdaTenancy
    ? (activeTenancy?.ndia_payment_amount || 0) + (activeTenancy?.participant_rent_contribution || 0)
    : 0;
  const effectiveActual = isSda && isSdaTenancy ? actualSdaWeekly : actualWeekly;

  const incomeGap = potentialWeekly - effectiveActual;
  const occupancyRate = potentialWeekly > 0 ? Math.round((effectiveActual / potentialWeekly) * 100) : 0;

  // Days remaining on lease
  const daysRemaining = activeTenancy?.end_date
    ? Math.ceil((new Date(activeTenancy.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* SDA Badge */}
      {isSda && (
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">SDA Property</Badge>
          {property.sda_category && (
            <span className="text-sm text-muted-foreground">
              {sdaCategoryLabel(property.sda_category)}
            </span>
          )}
        </div>
      )}

      {/* Income Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Potential Income</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(potentialWeekly)}/wk</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(potentialWeekly * 52)} / year</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Actual Income</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(effectiveActual)}/wk</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(effectiveActual * 52)} / year</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Income Gap</p>
            <p className={`text-2xl font-bold ${incomeGap > 0 ? "text-amber-600" : "text-green-600"}`}>
              {incomeGap > 0 ? `-${formatCurrency(incomeGap)}/wk` : "None"}
            </p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${occupancyRate >= 80 ? "bg-green-500" : occupancyRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{occupancyRate}% utilisation</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Lease</p>
            </div>
            {activeTenancy ? (
              <>
                <p className="text-lg font-semibold">
                  {daysRemaining != null && daysRemaining > 0
                    ? `${daysRemaining} days left`
                    : daysRemaining != null && daysRemaining <= 0
                    ? "Expired"
                    : "Ongoing"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(activeTenancy.start_date)} — {activeTenancy.end_date ? formatDate(activeTenancy.end_date) : "Ongoing"}
                </p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">No active lease</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SDA Payment Breakdown */}
      {isSdaTenancy && activeTenancy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SDA Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">Total Weekly</p>
                </div>
                <p className="text-xl font-bold">{formatCurrency(actualSdaWeekly)}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium text-muted-foreground">NDIA Payment</p>
                </div>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(activeTenancy.ndia_payment_amount)}</p>
                <p className="text-xs text-muted-foreground">per week (government)</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-muted-foreground">Participant Contribution</p>
                </div>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(activeTenancy.participant_rent_contribution)}</p>
                <p className="text-xs text-muted-foreground">per week (rent subsidy)</p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-medium text-muted-foreground">SDA Rate</p>
                </div>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(activeTenancy.sda_weekly_rate)}</p>
                <p className="text-xs text-muted-foreground">approved rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Tenant Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          {activeTenancy ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Lease Type</p>
                  <Badge variant="outline" className="mt-1">
                    {activeTenancy.tenancy_type === "sda" ? "SDA" : activeTenancy.tenancy_type === "fixed_term" ? "Fixed Term" : "Periodic"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rent</p>
                  <p className="font-medium">{formatCurrency(activeTenancy.weekly_rent)} / {activeTenancy.rent_frequency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bond</p>
                  <p className="font-medium">
                    {formatCurrency(activeTenancy.bond_amount)}
                    {activeTenancy.bond_lodged ? (
                      <Badge variant="default" className="ml-2 text-xs">Lodged</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2 text-xs">Not Lodged</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lease Period</p>
                  <p className="font-medium">
                    {formatDate(activeTenancy.start_date)} — {activeTenancy.end_date ? formatDate(activeTenancy.end_date) : "Ongoing"}
                  </p>
                </div>
              </div>

              {/* SDA Participant */}
              {isSdaTenancy && activeTenancy.sda_participant_contact && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-medium">SDA Participant</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{activeTenancy.sda_participant_contact.display_name}</p>
                    </div>
                    {activeTenancy.sda_plan_number && (
                      <div>
                        <p className="text-sm text-muted-foreground">NDIS Plan Number</p>
                        <p className="font-medium">{activeTenancy.sda_plan_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">No active tenant — property is vacant</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Tenancies */}
      {tenancies.filter((t) => t.status !== "active").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous Tenancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tenancies
                .filter((t) => t.status !== "active")
                .map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t.tenancy_type === "sda" ? "SDA" : t.tenancy_type === "fixed_term" ? "Fixed Term" : "Periodic"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">{t.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(t.start_date)} — {t.end_date ? formatDate(t.end_date) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(t.weekly_rent)}/{t.rent_frequency}</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
