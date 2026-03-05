"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  Building2,
  AlertCircle,
  MapPin,
  Users,
  DollarSign,
  ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SdaProperty {
  id: number;
  address: string;
  suburb?: string;
  state?: string;
  sdaCategory: string;
  buildingType?: string;
  bedrooms?: number;
  maxResidents?: number;
  currentResidents?: number;
  enrolled: boolean;
  weeklyRate?: number;
  enrolmentStatus?: string;
  propertyCode?: string;
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
  const cls = SDA_CATEGORY_STYLES[category] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}
    >
      {category}
    </span>
  );
}

function EnrolmentStatusBadge({ enrolled, status }: { enrolled: boolean; status?: string }) {
  if (enrolled) {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-xs">
        Enrolled
      </Badge>
    );
  }
  if (status) {
    return (
      <Badge variant="secondary" className="text-xs">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Not Enrolled
    </Badge>
  );
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: SdaProperty }) {
  const occupancyPct =
    property.maxResidents && property.maxResidents > 0
      ? Math.round(((property.currentResidents ?? 0) / property.maxResidents) * 100)
      : null;

  return (
    <Card className="hover:bg-secondary/20 transition-colors cursor-pointer group">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Address row */}
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">
                  {property.address}
                </p>
                {(property.suburb || property.state) && (
                  <p className="text-xs text-muted-foreground">
                    {[property.suburb, property.state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2">
              <SdaCategoryBadge category={property.sdaCategory} />
              {property.buildingType && (
                <span className="text-xs text-muted-foreground">{property.buildingType}</span>
              )}
              {property.bedrooms && (
                <span className="text-xs text-muted-foreground">{property.bedrooms} bed</span>
              )}
              <EnrolmentStatusBadge
                enrolled={property.enrolled}
                status={property.enrolmentStatus}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {property.maxResidents !== undefined && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {property.currentResidents ?? 0}/{property.maxResidents}
                  {occupancyPct !== null && (
                    <span
                      className={
                        occupancyPct === 100
                          ? "text-green-600 dark:text-green-400"
                          : occupancyPct >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      ({occupancyPct}%)
                    </span>
                  )}
                </span>
              )}
              {property.weeklyRate !== undefined && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${property.weeklyRate.toLocaleString()}/wk
                </span>
              )}
            </div>
          </div>

          {/* Right action indicator */}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaPropertiesPage() {
  const [properties, setProperties] = useState<SdaProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await api.get<{ success: boolean; data: SdaProperty[] }>(
          "/api/v1/sda/properties"
        );
        if (res?.data) setProperties(res.data);
        else if (Array.isArray(res)) setProperties(res as SdaProperty[]);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Grouped by SDA category
  const categories = ["HPS", "FA", "IL", "Robust"];
  const byCategory = categories.reduce<Record<string, SdaProperty[]>>((acc, cat) => {
    acc[cat] = properties.filter((p) => p.sdaCategory === cat);
    return acc;
  }, {});
  const otherProps = properties.filter((p) => !categories.includes(p.sdaCategory));
  if (otherProps.length > 0) {
    byCategory["Other"] = otherProps;
  }

  const enrolledCount = properties.filter((p) => p.enrolled).length;
  const pendingCount = properties.filter((p) => !p.enrolled).length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4">
        {loading ? (
          <>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20" />
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{properties.length}</span> total properties
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-green-600 dark:text-green-400 font-mono">{enrolledCount}</span> enrolled
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{pendingCount}</span> pending
            </span>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-10 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load SDA properties</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setError(false);
                setLoading(true);
                api
                  .get<{ success: boolean; data: SdaProperty[] }>("/api/v1/sda/properties")
                  .then((res) => {
                    if (res?.data) setProperties(res.data);
                  })
                  .catch(() => setError(true))
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No SDA properties found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Properties enrolled in SDA will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory)
            .filter(([, props]) => props.length > 0)
            .map(([category, props]) => (
              <section key={category}>
                <div className="flex items-center gap-3 mb-3">
                  <SdaCategoryBadge category={category} />
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    {category === "HPS"
                      ? "High Physical Support"
                      : category === "FA"
                      ? "Fully Accessible"
                      : category === "IL"
                      ? "Improved Liveability"
                      : category === "Robust"
                      ? "Robust"
                      : category}
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono">({props.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {props.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
