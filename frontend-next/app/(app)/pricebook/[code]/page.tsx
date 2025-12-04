"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "@/components/ui/loader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  DollarSign,
  Building2,
  Tag,
  BarChart3,
  AlertTriangle,
  Clock,
  Shield,
  Plus,
  Pencil,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types
interface PriceHistory {
  id: number;
  old_price: number | null;
  new_price: number;
  date_effective: string | null;
  created_at: string;
  change_reason?: string;
  supplier?: {
    id: number;
    name: string;
  };
}

interface Supplier {
  id: number;
  name: string;
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
  image_file_id: string | null;
  qr_code_url: string | null;
  qr_code_file_id: string | null;
  default_supplier_id: number | null;
  default_supplier: Supplier | null;
  supplier: Supplier | null;
  requires_photo: boolean;
  requires_spec: boolean;
  photo_attached: boolean;
  spec_attached: boolean;
  gst_code: string | null;
  price_volatility: string | null;
  price_age_days: number | null;
  supplier_reliability: number;
  price_freshness?: {
    label: string;
    color: string;
  };
  risk?: {
    label: string;
    color: string;
    score: number;
  };
  price_histories?: PriceHistory[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function PriceBookItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [item, setItem] = useState<PriceBookItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPrices, setShowAllPrices] = useState(false);
  const [savingBooleans, setSavingBooleans] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; type: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [qrCodeError, setQrCodeError] = useState(false);

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [historyToDelete, setHistoryToDelete] = useState<PriceHistory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [historyToEdit, setHistoryToEdit] = useState<PriceHistory | null>(null);
  const [editFormData, setEditFormData] = useState({
    old_price: "",
    new_price: "",
    date_effective: "",
    change_reason: "",
  });

  useEffect(() => {
    loadItem();
  }, [code]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const response = await api.get<PriceBookItem>(`/api/v1/pricebook/${code}`);
      setItem(response);
    } catch (err) {
      setError("Failed to load price book item");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (fileType: string) => {
    if (!item) return null;

    const fileIdField = `${fileType}_file_id` as keyof PriceBookItem;
    const urlField = `${fileType}_url` as keyof PriceBookItem;

    if (item[fileIdField]) {
      return `${API_URL}/api/v1/pricebook/${code}/proxy_image/${fileType}`;
    }

    return item[urlField] as string | null;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeAgo = (days: number | null | undefined) => {
    if (days === null || days === undefined) return "Unknown";
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months} ${months === 1 ? "month" : "months"} ago`;
    }
    const years = Math.floor(days / 365);
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  };

  const getActivePriceHistory = () => {
    if (item && item.default_supplier && item.price_histories) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultSupplierHistory = item.price_histories
        .filter((history) => history.supplier && history.supplier.id === item.default_supplier?.id)
        .filter((history) => {
          if (!history.date_effective) return true;
          const effectiveDate = new Date(history.date_effective);
          effectiveDate.setHours(0, 0, 0, 0);
          return effectiveDate <= today;
        })
        .sort((a, b) => {
          const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at);
          const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at);
          return dateB.getTime() - dateA.getTime();
        })[0];

      return defaultSupplierHistory;
    }
    return null;
  };

  const getDisplayPrice = () => {
    const activePriceHistory = getActivePriceHistory();
    if (activePriceHistory) {
      return activePriceHistory.new_price;
    }
    return item?.current_price;
  };

  const handleBooleanToggle = async (fieldName: string, currentValue: boolean) => {
    if (!item) return;
    const newValue = !currentValue;

    setItem((prev) => (prev ? { ...prev, [fieldName]: newValue } : null));

    try {
      setSavingBooleans(true);
      await api.patch(`/api/v1/pricebook/${code}`, {
        [fieldName]: newValue,
      });
    } catch (err) {
      console.error(`Failed to update ${fieldName}:`, err);
      setItem((prev) => (prev ? { ...prev, [fieldName]: currentValue } : null));
    } finally {
      setSavingBooleans(false);
    }
  };

  const handleDeletePriceHistory = (history: PriceHistory) => {
    setHistoryToDelete(history);
    setIsDeleteModalOpen(true);
  };

  const confirmDeletePriceHistory = async () => {
    if (!historyToDelete) return;

    try {
      await api.delete(`/api/v1/pricebook/${code}/price_histories/${historyToDelete.id}`);
      setIsDeleteModalOpen(false);
      setHistoryToDelete(null);
      await loadItem();
    } catch (err) {
      console.error("Failed to delete price history:", err);
      alert("Failed to delete price history. Please try again.");
    }
  };

  const handleEditPriceHistory = (history: PriceHistory) => {
    setHistoryToEdit(history);
    setEditFormData({
      old_price: history.old_price?.toString() || "",
      new_price: history.new_price.toString(),
      date_effective: history.date_effective || "",
      change_reason: history.change_reason || "",
    });
    setIsEditModalOpen(true);
  };

  const confirmEditPriceHistory = async () => {
    if (!historyToEdit) return;

    try {
      await api.patch(`/api/v1/pricebook/${id}/price_histories/${historyToEdit.id}`, editFormData);
      setIsEditModalOpen(false);
      setHistoryToEdit(null);
      await loadItem();
    } catch (err) {
      console.error("Failed to update price history:", err);
      alert("Failed to update price history. Please try again.");
    }
  };

  const getStatusBadge = (color: string) => {
    const colorClasses: Record<string, string> = {
      green: "bg-green-100 text-green-700",
      yellow: "bg-yellow-100 text-yellow-800",
      red: "bg-red-100 text-red-700",
      gray: "bg-gray-100 text-gray-600",
    };
    return colorClasses[color] || colorClasses.gray;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold">Error loading item</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6">
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activePriceHistory = getActivePriceHistory();

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{item.item_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Code: {item.item_code}</p>
            </div>
            <div className="flex gap-2">
              {item.price_freshness && (
                <Badge className={getStatusBadge(item.price_freshness.color)}>
                  {item.price_freshness.label}
                </Badge>
              )}
              {item.risk && (
                <Badge className={getStatusBadge(item.risk.color)}>{item.risk.label}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Pricing Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {item.default_supplier ? "Default Supplier Price" : "Current Price"}
                    </dt>
                    <dd className="mt-1">
                      <div className="text-2xl font-bold">
                        {getDisplayPrice() ? formatCurrency(getDisplayPrice()) : "No price set"}
                      </div>
                      {item.default_supplier && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          from {item.default_supplier.name}
                        </div>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Unit of Measure</dt>
                    <dd className="mt-1 text-lg">{item.unit_of_measure}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {item.default_supplier ? "Price Effective Date" : "Last Updated"}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(
                        activePriceHistory?.date_effective ||
                          activePriceHistory?.created_at ||
                          item.price_last_updated_at
                      )}
                      {item.price_age_days !== null && (
                        <span className="ml-2 text-muted-foreground">
                          ({formatTimeAgo(item.price_age_days)})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Price Volatility</dt>
                    <dd className="mt-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          item.price_volatility === "stable" && "bg-green-100 text-green-800",
                          item.price_volatility === "moderate" && "bg-yellow-100 text-yellow-800",
                          item.price_volatility === "volatile" && "bg-red-100 text-red-800"
                        )}
                      >
                        {item.price_volatility || "Unknown"}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Item Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Category</dt>
                    <dd className="mt-1 text-sm">{item.category || "Uncategorized"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Brand</dt>
                    <dd className="mt-1 text-sm">{item.brand || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">GST Code</dt>
                    <dd className="mt-1 text-sm">{item.gst_code || "-"}</dd>
                  </div>
                  {item.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                      <dd className="mt-1 text-sm">{item.notes}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Price History Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Price History
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllPrices(!showAllPrices)}
                    >
                      {showAllPrices ? "Hide Old Prices" : "Show All Prices"}
                    </Button>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Price
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {item.price_histories && item.price_histories.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Old Price</TableHead>
                        <TableHead>New Price</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead className="text-center">Default</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.price_histories.slice(0, showAllPrices ? undefined : 10).map((history) => {
                        const change = history.new_price - (history.old_price || 0);
                        const changePercent = history.old_price
                          ? ((change / history.old_price) * 100).toFixed(1)
                          : "0";
                        const isDefaultSupplier =
                          history.supplier?.id === item.default_supplier_id;
                        const isActive = activePriceHistory && history.id === activePriceHistory.id;

                        return (
                          <TableRow key={history.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {formatDate(history.date_effective || history.created_at)}
                                {isActive && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                    Active
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {history.old_price ? formatCurrency(history.old_price) : "-"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(history.new_price)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  change > 0 && "text-red-600",
                                  change < 0 && "text-green-600",
                                  change === 0 && "text-muted-foreground"
                                )}
                              >
                                {change > 0 ? "+" : ""}
                                {formatCurrency(change)}
                                {parseFloat(changePercent) !== 0 &&
                                  ` (${change > 0 ? "+" : ""}${changePercent}%)`}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {history.supplier && (
                                <Switch checked={isDefaultSupplier} disabled={isDefaultSupplier} />
                              )}
                            </TableCell>
                            <TableCell>
                              {history.supplier ? (
                                <Link
                                  href={`/contacts/${history.supplier.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {history.supplier.name}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditPriceHistory(history)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeletePriceHistory(history)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No price changes recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Data Quality Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Data Quality Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Needs Photo</Label>
                    <p className="text-xs text-muted-foreground">Item requires a product image</p>
                  </div>
                  <Checkbox
                    checked={item.requires_photo || false}
                    onCheckedChange={() => handleBooleanToggle("requires_photo", item.requires_photo)}
                    disabled={savingBooleans}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label>Needs Spec</Label>
                    <p className="text-xs text-muted-foreground">Item requires specification sheet</p>
                  </div>
                  <Checkbox
                    checked={item.requires_spec || false}
                    onCheckedChange={() => handleBooleanToggle("requires_spec", item.requires_spec)}
                    disabled={savingBooleans}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label>Photo Added</Label>
                    <p className="text-xs text-muted-foreground">Product photo has been uploaded</p>
                  </div>
                  <Checkbox
                    checked={item.photo_attached || false}
                    onCheckedChange={() => handleBooleanToggle("photo_attached", item.photo_attached)}
                    disabled={savingBooleans}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label>Spec Added</Label>
                    <p className="text-xs text-muted-foreground">Specification sheet has been uploaded</p>
                  </div>
                  <Checkbox
                    checked={item.spec_attached || false}
                    onCheckedChange={() => handleBooleanToggle("spec_attached", item.spec_attached)}
                    disabled={savingBooleans}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label>Pricing Review</Label>
                    <p className="text-xs text-muted-foreground">Price needs to be reviewed</p>
                  </div>
                  <Checkbox
                    checked={item.needs_pricing_review || false}
                    onCheckedChange={() =>
                      handleBooleanToggle("needs_pricing_review", item.needs_pricing_review)
                    }
                    disabled={savingBooleans}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Images Card */}
            {(item.image_url || item.image_file_id || item.qr_code_url || item.qr_code_file_id) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Product Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(item.image_url || item.image_file_id) && (
                    <div>
                      <div className="text-sm font-medium mb-2 flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        Product Photo
                      </div>
                      <div className="relative group">
                        {!imageError ? (
                          <>
                            <img
                              src={getImageUrl("image") || ""}
                              alt={item.item_name}
                              className="w-full rounded-lg border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ maxHeight: "300px" }}
                              onClick={() =>
                                setEnlargedImage({ url: getImageUrl("image") || "", type: "photo" })
                              }
                              onError={() => setImageError(true)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg cursor-pointer pointer-events-none">
                              <Search className="h-8 w-8 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-48 bg-muted rounded-lg border flex items-center justify-center">
                            <span className="text-sm text-muted-foreground">Image not available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(item.qr_code_url || item.qr_code_file_id) && (
                    <div>
                      <div className="text-sm font-medium mb-2 flex items-center gap-1">
                        <QrCode className="h-4 w-4" />
                        QR Code
                      </div>
                      <div className="relative group">
                        {!qrCodeError ? (
                          <>
                            <img
                              src={getImageUrl("qr_code") || ""}
                              alt={`QR Code for ${item.item_name}`}
                              className="w-full rounded-lg border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ maxHeight: "300px" }}
                              onClick={() =>
                                setEnlargedImage({ url: getImageUrl("qr_code") || "", type: "qr" })
                              }
                              onError={() => setQrCodeError(true)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg cursor-pointer pointer-events-none">
                              <Search className="h-8 w-8 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-48 bg-muted rounded-lg border flex items-center justify-center">
                            <span className="text-sm text-muted-foreground">QR code not available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Supplier Card */}
            {(item.default_supplier || item.supplier) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {item.default_supplier ? "Default Supplier" : "Supplier"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Link
                      href={`/contacts/${(item.default_supplier || item.supplier)?.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {(item.default_supplier || item.supplier)?.name}
                    </Link>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reliability:</span>
                      <div className="mt-1">
                        <div className="flex items-center">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${item.supplier_reliability}%` }}
                            />
                          </div>
                          <span className="ml-2 font-medium">{item.supplier_reliability}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Breakdown Card */}
            {item.risk && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Risk Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Overall Risk Score</span>
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

                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium mb-3">Risk Factors</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">Price Age: </span>
                          <span>{item.price_freshness?.label || "Unknown"}</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">Volatility: </span>
                          <span className="capitalize">{item.price_volatility || "Unknown"}</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">Supplier Reliability: </span>
                          <span>{item.supplier_reliability}%</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Image Enlargement Modal */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black/90">
          {enlargedImage && (
            <div className="relative">
              <img
                src={enlargedImage.url}
                alt={enlargedImage.type === "qr" ? "QR Code" : "Product Photo"}
                className="w-full h-auto rounded-lg"
                style={{ maxHeight: "90vh", objectFit: "contain" }}
              />
              <button
                onClick={() => setEnlargedImage(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                <div className="text-sm font-medium">
                  {enlargedImage.type === "qr" ? "QR Code" : "Product Photo"}: {item.item_name}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Price History</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this price history entry?
              {historyToDelete && (
                <>
                  {" "}
                  This will permanently remove the price change from{" "}
                  <span className="font-medium">
                    {historyToDelete.old_price ? formatCurrency(historyToDelete.old_price) : "N/A"}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">{formatCurrency(historyToDelete.new_price)}</span>
                  {historyToDelete.supplier && (
                    <>
                      {" "}
                      for <span className="font-medium">{historyToDelete.supplier.name}</span>
                    </>
                  )}
                  . This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeletePriceHistory}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price History Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Price History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="old_price">Old Price</Label>
              <Input
                id="old_price"
                type="number"
                step="0.01"
                value={editFormData.old_price}
                onChange={(e) => setEditFormData({ ...editFormData, old_price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new_price">New Price</Label>
              <Input
                id="new_price"
                type="number"
                step="0.01"
                value={editFormData.new_price}
                onChange={(e) => setEditFormData({ ...editFormData, new_price: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="date_effective">Date Effective</Label>
              <Input
                id="date_effective"
                type="date"
                value={editFormData.date_effective}
                onChange={(e) => setEditFormData({ ...editFormData, date_effective: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="change_reason">Change Reason</Label>
              <Textarea
                id="change_reason"
                rows={3}
                value={editFormData.change_reason}
                onChange={(e) => setEditFormData({ ...editFormData, change_reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEditPriceHistory}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
