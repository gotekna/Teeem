"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/lib/constants/route-paths";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  Home,
  Calendar,
  DollarSign,
  Shield,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Clock,
  ChevronRight,
} from "lucide-react";

interface DashboardData {
  portfolio?: {
    property_count: number;
    total_value: number;
    total_annual_rent: number;
    total_annual_expenses: number;
    total_net_income: number;
    portfolio_yield: number | null;
    total_unrealised_gain: number;
  };
  properties?: PropertyData[];
  property?: PropertySummary;
  lease?: LeaseSummary | null;
  rent?: RentSummary | null;
  bond?: BondSummary | null;
  inspections?: InspectionSummary[];
  maintenance?: BillSummary[];
  bills?: BillSummary[];
}

interface PropertyData {
  property: PropertySummary;
  lease: LeaseSummary | null;
  rent: RentSummary | null;
  bond: BondSummary | null;
  financials?: Record<string, unknown>;
  valuations?: Record<string, unknown>;
  next_inspection?: InspectionSummary | null;
}

interface PropertySummary {
  id: number;
  property_code: string;
  name: string;
  street_address: string;
  full_address: string;
  suburb: string;
  bedrooms: number;
  bathrooms: number;
  weekly_rent: number;
  manager?: { name: string; email: string; phone: string };
}

interface LeaseSummary {
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number | null;
  expired: boolean;
}

interface RentSummary {
  weekly_rent: number;
  rent_frequency: string;
  annual_rent: number;
  sda?: { sda_weekly_rate: number; participant_contribution: number; ndia_payment: number } | null;
}

interface BondSummary {
  amount: number;
  lodged: boolean;
  reference: string | null;
}

interface InspectionSummary {
  id: number;
  inspection_type: string;
  status: string;
  scheduled_date: string;
  overall_condition: string;
  inspector: string;
  has_report: boolean;
}

interface BillSummary {
  id: number;
  bill_type: string;
  description: string;
  amount: number;
  status: string;
  bill_date: string;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "$0";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function PropertyDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const portalUser = getStorageItem<{ portal_type?: string } | null>(STORAGE_KEYS.PORTAL_USER, null);
  const isOwner = portalUser?.portal_type === "owner";

  useEffect(() => {
    portalFetch("/api/v1/portal/property/dashboard")
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-10 text-muted-foreground">No data available</p>;

  if (isOwner && data.portfolio) {
    return <OwnerDashboard data={data} />;
  }

  return <TenantDashboard data={data} />;
}

function TenantDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const property = data.property;
  const lease = data.lease;
  const rent = data.rent;
  const bond = data.bond;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Property</h1>

      {/* Property Card */}
      {property && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{property.street_address}</h2>
                <p className="text-sm text-muted-foreground">{property.suburb}</p>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  {property.bedrooms && <span>{property.bedrooms} bed</span>}
                  {property.bathrooms && <span>{property.bathrooms} bath</span>}
                </div>
                {property.manager && (
                  <div className="mt-3 text-sm">
                    <p className="text-muted-foreground">Property Manager: <span className="text-foreground font-medium">{property.manager.name}</span></p>
                    <p className="text-muted-foreground">{property.manager.phone} | {property.manager.email}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rent */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Rent</p>
                <p className="text-2xl font-bold">{formatCurrency(rent?.weekly_rent)}</p>
                <p className="text-xs text-muted-foreground">/{rent?.rent_frequency || "weekly"}</p>
              </div>
            </div>
            {rent?.sda && (
              <div className="mt-3 text-xs space-y-1 border-t pt-2">
                <p>NDIA Payment: {formatCurrency(rent.sda.ndia_payment)}/wk</p>
                <p>Your Contribution: {formatCurrency(rent.sda.participant_contribution)}/wk</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bond */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Bond</p>
                <p className="text-2xl font-bold">{formatCurrency(bond?.amount)}</p>
                <Badge variant={bond?.lodged ? "default" : "secondary"} className="mt-1">
                  {bond?.lodged ? "Lodged" : "Not Lodged"}
                </Badge>
                {bond?.reference && <p className="text-xs text-muted-foreground mt-1">Ref: {bond.reference}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lease */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Lease</p>
                {lease ? (
                  <>
                    <p className="text-lg font-semibold">
                      {lease.days_remaining != null && lease.days_remaining > 0
                        ? `${lease.days_remaining} days left`
                        : lease.expired ? "Expired" : lease.type === "periodic" ? "Periodic" : "Active"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(lease.start_date)} — {lease.end_date ? formatDate(lease.end_date) : "Ongoing"}
                    </p>
                    {lease.expired && (
                      <Badge variant="destructive" className="mt-1">Expired</Badge>
                    )}
                  </>
                ) : <p className="text-muted-foreground">No active lease</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inspections */}
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(ROUTES.PORTAL.PROPERTY_INSPECTIONS)}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground">Inspections</p>
                <p className="text-2xl font-bold">{data.inspections?.length || 0}</p>
                <p className="text-xs text-muted-foreground">upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Inspections */}
      {data.inspections && data.inspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Inspections</span>
              <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.PORTAL.PROPERTY_INSPECTIONS)}>
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.inspections.map((inspection) => (
                <div key={inspection.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{inspection.inspection_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} Inspection</p>
                    <p className="text-sm text-muted-foreground">{formatDate(inspection.scheduled_date)}</p>
                    {inspection.inspector && <p className="text-xs text-muted-foreground">Inspector: {inspection.inspector}</p>}
                  </div>
                  <Badge variant={inspection.status === "scheduled" ? "outline" : "default"}>
                    {inspection.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance */}
      {data.maintenance && data.maintenance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Maintenance</span>
              <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.PORTAL.PROPERTY_MAINTENANCE)}>
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.maintenance.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{bill.description || "Maintenance"}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(bill.bill_date)}</p>
                  </div>
                  <div className="text-right">
                    {bill.amount > 0 && <p className="font-medium">{formatCurrency(bill.amount)}</p>}
                    <Badge variant="outline">{bill.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Maintenance Request */}
      <Card>
        <CardContent className="pt-6 text-center">
          <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Need something fixed?</p>
          <Button onClick={() => router.push(ROUTES.PORTAL.PROPERTY_MAINTENANCE)}>
            Submit Maintenance Request
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const portfolio = data.portfolio!;
  const properties = data.properties || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Property Portfolio</h1>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="text-2xl font-bold">{formatCurrency(portfolio.total_value)}</p>
            <p className="text-xs text-muted-foreground">{portfolio.property_count} properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual Net Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(portfolio.total_net_income)}</p>
            {portfolio.portfolio_yield != null && (
              <p className="text-xs text-muted-foreground">{portfolio.portfolio_yield}% net yield</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual Rent</p>
            <p className="text-2xl font-bold">{formatCurrency(portfolio.total_annual_rent)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(portfolio.total_annual_rent / 52)}/week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${portfolio.total_unrealised_gain >= 0 ? "text-green-600" : "text-red-600"}`} />
              <div>
                <p className="text-sm text-muted-foreground">Capital Gain</p>
                <p className={`text-2xl font-bold ${portfolio.total_unrealised_gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(portfolio.total_unrealised_gain)}
                </p>
                <p className="text-xs text-muted-foreground">unrealised</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(portfolio.total_annual_expenses)}</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${Math.min((portfolio.total_annual_expenses / portfolio.total_annual_rent) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {portfolio.total_annual_rent > 0
                ? `${((portfolio.total_annual_expenses / portfolio.total_annual_rent) * 100).toFixed(1)}% of rental income`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(ROUTES.PORTAL.PROPERTY_VALUATIONS)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valuations & CGT</p>
                <p className="text-lg font-semibold mt-1">View detailed analysis</p>
                <p className="text-xs text-muted-foreground">6 valuation methods, capital gains calculator</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property Cards */}
      <h2 className="text-lg font-semibold">Properties</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {properties.map((propData) => (
          <PropertyCard key={propData.property.id} data={propData} />
        ))}
      </div>
    </div>
  );
}

function PropertyCard({ data }: { data: PropertyData }) {
  const router = useRouter();
  const { property, lease, rent, bond, valuations } = data;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{property.street_address}</h3>
            <p className="text-sm text-muted-foreground">{property.suburb}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              {property.bedrooms && <span>{property.bedrooms} bed</span>}
              {property.bathrooms && <span>{property.bathrooms} bath</span>}
            </div>
          </div>
          <Badge variant="outline">{property.property_code}</Badge>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-3 text-center border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Rent</p>
            <p className="font-semibold">{formatCurrency(rent?.weekly_rent)}/wk</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Yield</p>
            <p className="font-semibold text-green-600">
              {(valuations as Record<string, unknown>)?.net_rental_yield != null
                ? `${(valuations as Record<string, unknown>).net_rental_yield}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bond</p>
            <p className="font-semibold">{formatCurrency(bond?.amount)}</p>
          </div>
        </div>

        {/* Lease Status */}
        {lease && (
          <div className="flex items-center justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">Lease</span>
            <div className="flex items-center gap-2">
              {lease.days_remaining != null && lease.days_remaining > 0 ? (
                <span className={lease.days_remaining < 60 ? "text-amber-600 font-medium" : ""}>
                  {lease.days_remaining} days remaining
                </span>
              ) : lease.expired ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <Badge variant="outline">{lease.type}</Badge>
              )}
            </div>
          </div>
        )}

        {/* SDA */}
        {rent?.sda && (
          <div className="text-xs border-t pt-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">NDIA Payment</span>
              <span className="font-medium">{formatCurrency(rent.sda.ndia_payment)}/wk</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Participant Contribution</span>
              <span>{formatCurrency(rent.sda.participant_contribution)}/wk</span>
            </div>
          </div>
        )}

        {/* Next Inspection */}
        {data.next_inspection && (
          <div className="flex items-center justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">Next Inspection</span>
            <span>{formatDate(data.next_inspection.scheduled_date)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
