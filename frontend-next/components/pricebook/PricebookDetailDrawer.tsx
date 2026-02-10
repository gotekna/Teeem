"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Tag,
  AlertTriangle,
  ExternalLink,
  Package,
  BarChart3,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyPricebookCode } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateWithFallback } from "@/utils/formatters";

interface Supplier {
  id: number;
  name: string;
}

interface PriceHistory {
  id: number;
  old_price: number | null;
  new_price: number;
  date_effective: string | null;
  created_at: string;
  supplier?: Supplier;
}

interface PriceBookItem {
  id: number;
  item_code: string;
  item_name: string;
  category: string;
  unit_of_measure: string;
  current_price: number;
  brand: string | null;
  notes: string | null;
  is_active: boolean;
  needs_pricing_review: boolean;
  price_last_updated_at: string | null;
  image_url: string | null;
  image_presigned_url?: string | null;
  default_supplier_id: number | null;
  default_supplier: Supplier | null;
  requires_photo: boolean;
  requires_spec: boolean;
  gst_code: string | null;
  price_volatility: string | null;
  price_age_days: number | null;
  supplier_reliability: number;
  price_freshness?: { label: string; color: string };
  risk?: { label: string; color: string; score: number };
  price_histories?: PriceHistory[];
}

interface PricebookDetailDrawerProps {
  itemId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStatusBadgeClass = (color: string) => {
  const colorClasses: Record<string, string> = {
    green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    yellow: "bg-status-warning text-status-warning-foreground",
    red: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    gray: "bg-muted text-muted-foreground",
  };
  return colorClasses[color] || colorClasses.gray;
};

export function PricebookDetailDrawer({ itemId, open, onOpenChange }: PricebookDetailDrawerProps) {
  const router = useRouter();
  const [item, setItem] = React.useState<PriceBookItem | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadItem = React.useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    try {
      const response = await api.get<PriceBookItem>(`/api/v1/pricebook/${itemId}`);
      setItem(response);
    } catch (error) {
      console.error("Failed to fetch pricebook item:", error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => {
    if (open && itemId) {
      loadItem();
    }
  }, [open, itemId, loadItem]);

  const handleOpenFullPage = () => {
    if (item) {
      const slug = slugifyPricebookCode(item.item_code);
      router.push(`/pricebook/${slug}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : !item ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Item not found</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-4 border-b shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl font-serif">{item.item_name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">
                      {item.item_code}
                    </Badge>
                    {item.price_freshness && (
                      <Badge className={getStatusBadgeClass(item.price_freshness.color)}>
                        {item.price_freshness.label}
                      </Badge>
                    )}
                    {item.needs_pricing_review && (
                      <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Review Needed</Badge>
                    )}
                    {!item.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenFullPage}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Full Page
                </Button>
              </div>

              {/* Price Display */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-3xl font-bold font-mono">{formatCurrency(item.current_price)}</p>
                    <p className="text-xs text-muted-foreground">per {item.unit_of_measure}</p>
                  </div>
                  {item.default_supplier && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Default Supplier</p>
                      <p className="text-sm font-medium">{item.default_supplier.name}</p>
                    </div>
                  )}
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Item Details */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Item Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p>{item.category || "Uncategorized"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Brand</p>
                        <p>{item.brand || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">GST Code</p>
                        <p>{item.gst_code || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Updated</p>
                        <p>{formatDateWithFallback(item.price_last_updated_at, "Never")}</p>
                      </div>
                    </div>
                    {item.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Notes</p>
                        <p>{item.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Requirements */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {item.requires_photo && (
                        <Badge variant="outline" className="gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Needs Photo
                        </Badge>
                      )}
                      {item.requires_spec && (
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          Needs Spec
                        </Badge>
                      )}
                      {!item.requires_photo && !item.requires_spec && (
                        <span className="text-sm text-muted-foreground">No special requirements</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Analysis */}
                {item.risk && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Risk Score</span>
                          <span className="text-sm font-medium">{item.risk.score}/100</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              item.risk.score < 25 && "bg-green-500",
                              item.risk.score >= 25 && item.risk.score < 50 && "bg-yellow-500",
                              item.risk.score >= 50 && item.risk.score < 75 && "bg-yellow-600",
                              item.risk.score >= 75 && "bg-red-500"
                            )}
                            style={{ width: `${item.risk.score}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Volatility</p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              item.price_volatility === "stable" && "bg-status-success text-status-success-foreground",
                              item.price_volatility === "moderate" && "bg-status-warning text-status-warning-foreground",
                              item.price_volatility === "volatile" && "bg-status-error text-status-error-foreground"
                            )}
                          >
                            {item.price_volatility || "Unknown"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Supplier Reliability</p>
                          <p className="font-medium">{item.supplier_reliability}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Price History */}
                {item.price_histories && item.price_histories.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Recent Price History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {item.price_histories.slice(0, 5).map((history) => {
                          const change = history.new_price - (history.old_price || 0);
                          return (
                            <div
                              key={history.id}
                              className="flex items-center justify-between p-2 border rounded text-sm"
                            >
                              <div>
                                <p className="font-medium">{formatCurrency(history.new_price)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateWithFallback(history.date_effective || history.created_at, "Never")}
                                </p>
                              </div>
                              <div className="text-right">
                                <span
                                  className={cn(
                                    "text-sm",
                                    change > 0 && "text-red-600 dark:text-red-400",
                                    change < 0 && "text-green-600 dark:text-green-400",
                                    change === 0 && "text-muted-foreground"
                                  )}
                                >
                                  {change > 0 ? "+" : ""}
                                  {formatCurrency(change)}
                                </span>
                                {history.supplier && (
                                  <p className="text-xs text-muted-foreground">{history.supplier.name}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {item.price_histories.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full" onClick={handleOpenFullPage}>
                            View all {item.price_histories.length} price changes
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Image */}
                {(item.image_presigned_url || item.image_url) && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Product Image
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <img
                        src={item.image_presigned_url || item.image_url || ""}
                        alt={item.item_name}
                        className="w-full rounded-lg border object-cover"
                        style={{ maxHeight: "200px" }}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
