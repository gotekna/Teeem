"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import {
  Package,
  Building2,
  Shield,
  Wrench,
  FileText,
  Save,
  X,
  TrendingDown,
  Gauge,
  Receipt,
  Calculator,
  Plus,
  Camera,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Image,
  Upload,
  Trash2,
  MoreVertical,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { format } from "date-fns";

// Tab definitions - base tabs always shown
const BASE_TABS = [
  { id: "details", name: "Details", icon: Package },
  { id: "photos", name: "Photos", icon: Image },
  { id: "depreciation", name: "Depreciation", icon: TrendingDown },
  { id: "insurance", name: "Insurance", icon: Shield },
  { id: "service", name: "Service History", icon: Wrench },
  { id: "expenses", name: "Expenses", icon: Receipt },
  { id: "documents", name: "Documents", icon: FileText },
];

// Odometer tab only for vehicles
const VEHICLE_TABS = [
  { id: "odometer", name: "Odometer", icon: Gauge },
];

interface AssetPhoto {
  id: number;
  filename: string;
  url: string;
  thumbnail_url: string;
  content_type: string;
  byte_size: number;
  created_at: string;
}

interface Asset {
  id: number;
  name: string;
  asset_type: string;
  status: string;
  asset_number?: string;
  serial_number?: string;
  registration_number?: string;
  location?: string;
  purchase_price?: number;
  purchase_date?: string;
  sale_date?: string;
  current_book_value?: number;
  make?: string;
  model?: string;
  description?: string;
  notes?: string;
  abbreviation?: string;
  display_name?: string;
  age_in_years?: number;
  total_maintenance_cost?: number;
  depreciation_amount?: number;
  odometer_reading?: number;
  hours_reading?: number;
  thumbnail_url?: string;
  photo_urls?: AssetPhoto[];
  photos_count?: number;
  assigned_user?: {
    id: number;
    full_name: string;
    email?: string;
  };
  corporate_company?: {
    id: number;
    name: string;
    code?: string;
  };
  company?: {
    id: number;
    name: string;
  };
  asset_insurance?: {
    id: number;
    policy_number?: string;
    insurer?: string;
    insurer_name?: string;
    renewal_date?: string;
    premium?: number;
    premium_amount?: number;
    status: string;
    days_until_renewal?: number;
    expired?: boolean;
    expiring_soon?: boolean;
  };
}

interface ServiceHistory {
  id: number;
  service_date: string;
  service_type: string;
  provider?: string;
  cost?: number;
  notes?: string;
  next_service_date?: string;
}

interface DepreciationProfile {
  id: number;
  depreciable_cost: number;
  residual_value?: number;
  book_method: string;
  tax_method: string;
  effective_life_years?: number;
  book_rate?: number;
  tax_rate?: number;
  depreciation_start_date: string;
  in_low_value_pool?: boolean;
  is_division_43?: boolean;
  division_43_rate?: number;
  instant_writeoff_applied?: boolean;
  current_book_wdv?: number;
  current_tax_wdv?: number;
  depreciable_amount?: number;
}

interface DepreciationSchedule {
  id: number;
  financial_year: string;
  period_start: string;
  period_end: string;
  days_held: number;
  days_in_year: number;
  book_opening_wdv: number;
  book_depreciation: number;
  book_closing_wdv: number;
  book_accumulated: number;
  tax_opening_wdv: number;
  tax_depreciation: number;
  tax_closing_wdv: number;
  tax_accumulated: number;
  status: string;
  book_method_applied?: string;
  tax_method_applied?: string;
}

interface DepreciationForecast {
  financial_year: string;
  book_depreciation: number;
  tax_depreciation: number;
  book_closing_wdv: number;
  tax_closing_wdv: number;
  book_accumulated: number;
  tax_accumulated: number;
}

interface OdometerReading {
  id: number;
  reading_date: string;
  odometer_km?: number;
  hours?: number;
  reading_type?: string;
  notes?: string;
  display_value?: string;
  distance_since_last?: number;
  user?: {
    id: number;
    full_name: string;
  };
}

interface AssetExpense {
  id: number;
  expense_date: string;
  expense_type: string;
  amount: number;
  description?: string;
  vendor?: string;
  reference?: string;
  user?: {
    id: number;
    full_name: string;
  };
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = params.id as string;

  // URL is SSoT for tab state (back button support)
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl || "details";

  const handleTabChange = React.useCallback((tabId: string) => {
    const url = tabId === "details"
      ? `/corporate/assets/${assetId}`
      : `/corporate/assets/${assetId}?tab=${tabId}`;
    router.push(url, { scroll: false });
  }, [assetId, router]);

  const [asset, setAsset] = React.useState<Asset | null>(null);
  const [serviceHistory, setServiceHistory] = React.useState<ServiceHistory[]>([]);
  const [depreciationProfile, setDepreciationProfile] = React.useState<DepreciationProfile | null>(null);
  const [depreciationSchedule, setDepreciationSchedule] = React.useState<DepreciationSchedule[]>([]);
  const [depreciationForecast, setDepreciationForecast] = React.useState<DepreciationForecast[]>([]);
  const [odometerReadings, setOdometerReadings] = React.useState<OdometerReading[]>([]);
  const [expenses, setExpenses] = React.useState<AssetExpense[]>([]);
  const [expenseTotals, setExpenseTotals] = React.useState<{ total: number; by_type: Record<string, number> }>({ total: 0, by_type: {} });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [calculating, setCalculating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedAsset, setEditedAsset] = React.useState<Partial<Asset>>({});
  const [showForecast, setShowForecast] = React.useState(false);

  // Asset types management
  const DEFAULT_ASSET_TYPES = ["vehicle", "equipment", "property", "other"];
  const [assetTypes, setAssetTypes] = React.useState<string[]>(DEFAULT_ASSET_TYPES);
  const [showTypesDialog, setShowTypesDialog] = React.useState(false);
  const [newTypeName, setNewTypeName] = React.useState("");

  // Load custom asset types from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem("asset_types");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssetTypes(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    const normalized = newTypeName.trim().toLowerCase().replace(/\s+/g, "_");
    if (assetTypes.includes(normalized)) return;

    const updated = [...assetTypes, normalized];
    setAssetTypes(updated);
    localStorage.setItem("asset_types", JSON.stringify(updated));
    setNewTypeName("");
  };

  const handleRemoveType = (typeToRemove: string) => {
    // Don't allow removing default types
    if (DEFAULT_ASSET_TYPES.includes(typeToRemove)) return;

    const updated = assetTypes.filter(t => t !== typeToRemove);
    setAssetTypes(updated);
    localStorage.setItem("asset_types", JSON.stringify(updated));
  };

  // Compute tabs based on asset type
  const TABS = React.useMemo(() => {
    if (!asset) return BASE_TABS;
    if (asset.asset_type === "vehicle") {
      // Insert odometer tab after depreciation
      const depIndex = BASE_TABS.findIndex(t => t.id === "depreciation");
      return [
        ...BASE_TABS.slice(0, depIndex + 1),
        ...VEHICLE_TABS,
        ...BASE_TABS.slice(depIndex + 1),
      ];
    }
    return BASE_TABS;
  }, [asset?.asset_type]);

  // Load asset data
  React.useEffect(() => {
    loadAsset();
  }, [assetId]);

  // Load tab-specific data when tab changes
  React.useEffect(() => {
    if (!asset) return;

    if (activeTab === "depreciation") {
      loadDepreciationData();
    } else if (activeTab === "odometer") {
      loadOdometerData();
    } else if (activeTab === "expenses") {
      loadExpensesData();
    }
  }, [activeTab, asset?.id]);

  const loadAsset = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<{ asset: Asset }>(`/api/v1/assets/${assetId}`);
      setAsset(response.asset);
      setEditedAsset(response.asset);

      // Load service history
      try {
        const serviceResponse = await api.get<{ service_history: ServiceHistory[] }>(
          `/api/v1/assets/${assetId}/service_history`
        );
        setServiceHistory(serviceResponse.service_history || []);
      } catch {
        // Service history endpoint may not exist
        setServiceHistory([]);
      }
    } catch (err) {
      console.error("Failed to load asset:", err);
      setError("Failed to load asset");
    } finally {
      setLoading(false);
    }
  };

  const loadDepreciationData = async () => {
    try {
      // Load depreciation profile
      const profileResponse = await api.get<{ depreciation_profile: DepreciationProfile | null }>(
        `/api/v1/assets/${assetId}/depreciation_profile`
      );
      setDepreciationProfile(profileResponse.depreciation_profile);

      // Load depreciation schedule
      const scheduleResponse = await api.get<{ depreciation_schedule: DepreciationSchedule[] }>(
        `/api/v1/assets/${assetId}/depreciation_schedule`
      );
      setDepreciationSchedule(scheduleResponse.depreciation_schedule || []);
    } catch (err) {
      console.error("Failed to load depreciation data:", err);
    }
  };

  const loadOdometerData = async () => {
    try {
      const response = await api.get<{ odometer_readings: OdometerReading[] }>(
        `/api/v1/assets/${assetId}/odometer_readings`
      );
      setOdometerReadings(response.odometer_readings || []);
    } catch (err) {
      console.error("Failed to load odometer data:", err);
    }
  };

  const loadExpensesData = async () => {
    try {
      const response = await api.get<{ expenses: AssetExpense[]; totals: { total: number; by_type: Record<string, number> } }>(
        `/api/v1/assets/${assetId}/expenses`
      );
      setExpenses(response.expenses || []);
      setExpenseTotals(response.totals || { total: 0, by_type: {} });
    } catch (err) {
      console.error("Failed to load expenses data:", err);
    }
  };

  const calculateDepreciation = async (allYears = false) => {
    try {
      setCalculating(true);
      await api.post(`/api/v1/assets/${assetId}/calculate_depreciation`, {
        all_years: allYears,
      });
      await loadDepreciationData();
    } catch (err) {
      console.error("Failed to calculate depreciation:", err);
    } finally {
      setCalculating(false);
    }
  };

  const loadForecast = async () => {
    try {
      const response = await api.get<{ forecasts: DepreciationForecast[] }>(
        `/api/v1/assets/${assetId}/depreciation_forecast?years=10`
      );
      setDepreciationForecast(response.forecasts || []);
      setShowForecast(true);
    } catch (err) {
      console.error("Failed to load forecast:", err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.patch<{ asset: Asset }>(`/api/v1/assets/${assetId}`, {
        asset: editedAsset,
      });
      setAsset(response.asset);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save asset:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedAsset(asset || {});
    setIsEditing(false);
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "disposed":
        return <Badge className="bg-gray-100 text-gray-800">Disposed</Badge>;
      case "under_repair":
        return <Badge className="bg-yellow-100 text-yellow-800">Under Repair</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive">{error || "Asset not found"}</p>
        <BackButton fallbackHref="/corporate/assets" label="Go Back" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/corporate/assets" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {asset.display_name || asset.name}
              </h1>
              {getStatusBadge(asset.status)}
            </div>
            {asset.company && (
              <p className="text-sm text-muted-foreground mt-1">
                <Building2 className="inline h-4 w-4 mr-1" />
                {asset.company.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit Asset</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                className="flex items-center gap-2"
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Tab Content */}
      {activeTab === "details" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Thumbnail Preview */}
              {asset.thumbnail_url ? (
                <div
                  className="relative w-full h-48 rounded-lg overflow-hidden bg-muted cursor-pointer group"
                  onClick={() => handleTabChange("photos")}
                >
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.display_name || asset.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-white text-sm flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      {asset.photos_count || 1} photo{(asset.photos_count || 1) > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleTabChange("photos")}
                >
                  <Camera className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No photos yet</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Asset Name</Label>
                {isEditing ? (
                  <Input
                    value={editedAsset.name || ""}
                    onChange={(e) =>
                      setEditedAsset({ ...editedAsset, name: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">{asset.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Type</Label>
                  {isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowTypesDialog(true)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Manage Types
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {isEditing ? (
                  <Select
                    value={editedAsset.asset_type}
                    onValueChange={(value) =>
                      setEditedAsset({ ...editedAsset, asset_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm capitalize">{asset.asset_type?.replace(/_/g, " ")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                {isEditing ? (
                  <Select
                    value={editedAsset.status}
                    onValueChange={(value) =>
                      setEditedAsset({ ...editedAsset, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                      <SelectItem value="under_repair">Under Repair</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  getStatusBadge(asset.status)
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Make</Label>
                  {isEditing ? (
                    <Input
                      value={editedAsset.make || ""}
                      onChange={(e) =>
                        setEditedAsset({ ...editedAsset, make: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm">{asset.make || "-"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  {isEditing ? (
                    <Input
                      value={editedAsset.model || ""}
                      onChange={(e) =>
                        setEditedAsset({ ...editedAsset, model: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm">{asset.model || "-"}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                {isEditing ? (
                  <Textarea
                    value={editedAsset.description || ""}
                    onChange={(e) =>
                      setEditedAsset({ ...editedAsset, description: e.target.value })
                    }
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{asset.description || "-"}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Price</Label>
                  <p className="text-sm font-medium">
                    {formatCurrency(asset.purchase_price)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Current Book Value</Label>
                  <p className="text-sm font-medium">
                    {formatCurrency(asset.current_book_value)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <p className="text-sm">{formatDate(asset.purchase_date)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <p className="text-sm">
                    {asset.age_in_years ? `${asset.age_in_years} years` : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Depreciation</Label>
                  <p className="text-sm text-red-600">
                    {formatCurrency(asset.depreciation_amount)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Total Maintenance</Label>
                  <p className="text-sm">
                    {formatCurrency(asset.total_maintenance_cost)}
                  </p>
                </div>
              </div>

              {asset.sale_date && (
                <div className="space-y-2">
                  <Label>Sale Date</Label>
                  <p className="text-sm">{formatDate(asset.sale_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "insurance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Insurance Details</CardTitle>
          </CardHeader>
          <CardContent>
            {asset.asset_insurance ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {asset.asset_insurance.expired ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : asset.asset_insurance.expiring_soon ? (
                    <Badge className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Policy Number</Label>
                    <p className="text-sm">
                      {asset.asset_insurance.policy_number || "-"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Insurer</Label>
                    <p className="text-sm">{asset.asset_insurance.insurer || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Renewal Date</Label>
                    <p className="text-sm">
                      {formatDate(asset.asset_insurance.renewal_date)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Premium</Label>
                    <p className="text-sm">
                      {formatCurrency(asset.asset_insurance.premium)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No insurance information available</p>
                <Button variant="outline" className="mt-4">
                  Add Insurance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "service" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Service History</CardTitle>
            <Button size="sm">Add Service Record</Button>
          </CardHeader>
          <CardContent>
            {serviceHistory.length > 0 ? (
              <div className="space-y-4">
                {serviceHistory.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{service.service_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(service.service_date)}
                        {service.provider && ` • ${service.provider}`}
                      </p>
                      {service.notes && (
                        <p className="text-sm mt-2">{service.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(service.cost)}</p>
                      {service.next_service_date && (
                        <p className="text-sm text-muted-foreground">
                          Next: {formatDate(service.next_service_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No service history available</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Documents</CardTitle>
            <Button size="sm">Upload Document</Button>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents attached to this asset</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Photos {asset.photos_count ? `(${asset.photos_count})` : ""}
            </CardTitle>
            <Button size="sm" onClick={() => document.getElementById("photo-upload")?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const formData = new FormData();
                Array.from(files).forEach((file) => {
                  formData.append("photos[]", file);
                });

                try {
                  await api.patch(`/api/v1/assets/${assetId}`, formData);
                  loadAsset(); // Reload to get new photos
                } catch (err) {
                  console.error("Failed to upload photos:", err);
                }
                e.target.value = ""; // Reset input
              }}
            />
          </CardHeader>
          <CardContent>
            {asset.photo_urls && asset.photo_urls.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {asset.photo_urls.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={photo.thumbnail_url || photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => window.open(photo.url, "_blank")}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(photo.url, "_blank")}
                      >
                        View
                      </Button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">{photo.filename}</p>
                      <p className="text-white/70 text-xs">
                        {(photo.byte_size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No photos yet</p>
                <p className="text-sm mb-4">
                  Upload photos to help identify and document this asset
                </p>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Add First Photo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Depreciation Tab */}
      {activeTab === "depreciation" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Purchase Cost</span>
                </div>
                <p className="text-2xl font-bold mt-2">{formatCurrency(asset.purchase_price)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Book WDV</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(depreciationProfile?.current_book_wdv || asset.current_book_value)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tax WDV</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(depreciationProfile?.current_tax_wdv || asset.current_book_value)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Accumulated</span>
                </div>
                <p className="text-2xl font-bold mt-2 text-red-600">
                  {formatCurrency(depreciationSchedule.length > 0
                    ? depreciationSchedule[depreciationSchedule.length - 1]?.book_accumulated
                    : 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Depreciation Profile */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Depreciation Profile</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => calculateDepreciation(true)}
                  disabled={calculating}
                >
                  {calculating ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Calculate All Years
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadForecast}
                >
                  10-Year Forecast
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {depreciationProfile ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Book Method</Label>
                    <p className="text-sm font-medium capitalize">
                      {depreciationProfile.book_method?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Method</Label>
                    <p className="text-sm font-medium capitalize">
                      {depreciationProfile.tax_method?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Effective Life</Label>
                    <p className="text-sm font-medium">
                      {depreciationProfile.effective_life_years} years
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Depreciable Cost</Label>
                    <p className="text-sm font-medium">
                      {formatCurrency(depreciationProfile.depreciable_cost)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Residual Value</Label>
                    <p className="text-sm font-medium">
                      {formatCurrency(depreciationProfile.residual_value)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Depreciation Start</Label>
                    <p className="text-sm font-medium">
                      {formatDate(depreciationProfile.depreciation_start_date)}
                    </p>
                  </div>
                  {depreciationProfile.is_division_43 && (
                    <div className="space-y-2">
                      <Label>Division 43 Rate</Label>
                      <p className="text-sm font-medium">
                        {depreciationProfile.division_43_rate}%
                      </p>
                    </div>
                  )}
                  {depreciationProfile.in_low_value_pool && (
                    <div className="space-y-2">
                      <Label>Low Value Pool</Label>
                      <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                    </div>
                  )}
                  {depreciationProfile.instant_writeoff_applied && (
                    <div className="space-y-2">
                      <Label>Instant Write-off</Label>
                      <Badge className="bg-green-100 text-green-800">Applied</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No depreciation profile set up</p>
                  <Button variant="outline" className="mt-4">
                    Set Up Depreciation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Depreciation Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Depreciation Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {depreciationSchedule.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Financial Year</TableHead>
                        <TableHead className="text-right">Days Held</TableHead>
                        <TableHead className="text-right">Book Opening</TableHead>
                        <TableHead className="text-right">Book Dep.</TableHead>
                        <TableHead className="text-right">Book Closing</TableHead>
                        <TableHead className="text-right">Tax Opening</TableHead>
                        <TableHead className="text-right">Tax Dep.</TableHead>
                        <TableHead className="text-right">Tax Closing</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depreciationSchedule.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">{schedule.financial_year}</TableCell>
                          <TableCell className="text-right">{schedule.days_held}</TableCell>
                          <TableCell className="text-right">{formatCurrency(schedule.book_opening_wdv)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(schedule.book_depreciation)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(schedule.book_closing_wdv)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(schedule.tax_opening_wdv)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(schedule.tax_depreciation)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(schedule.tax_closing_wdv)}</TableCell>
                          <TableCell>
                            {schedule.status === "finalized" ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Finalized
                              </Badge>
                            ) : (
                              <Badge variant="outline">{schedule.status}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No depreciation calculated yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => calculateDepreciation(true)}
                    disabled={calculating}
                  >
                    {calculating ? (
                      <Spinner size={16} className="mr-2" />
                    ) : (
                      <Calculator className="h-4 w-4 mr-2" />
                    )}
                    Calculate Depreciation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forecast (shown on demand) */}
          {showForecast && depreciationForecast.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">10-Year Forecast</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowForecast(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Financial Year</TableHead>
                        <TableHead className="text-right">Book Dep.</TableHead>
                        <TableHead className="text-right">Book WDV</TableHead>
                        <TableHead className="text-right">Book Accumulated</TableHead>
                        <TableHead className="text-right">Tax Dep.</TableHead>
                        <TableHead className="text-right">Tax WDV</TableHead>
                        <TableHead className="text-right">Tax Accumulated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depreciationForecast.map((forecast) => (
                        <TableRow key={forecast.financial_year}>
                          <TableCell className="font-medium">{forecast.financial_year}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(forecast.book_depreciation)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(forecast.book_closing_wdv)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(forecast.book_accumulated)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(forecast.tax_depreciation)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(forecast.tax_closing_wdv)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(forecast.tax_accumulated)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Odometer Tab (Vehicles Only) */}
      {activeTab === "odometer" && asset.asset_type === "vehicle" && (
        <div className="space-y-6">
          {/* Current Reading Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Current Odometer</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Reading
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-sm text-muted-foreground">Odometer</p>
                  <p className="text-3xl font-bold">
                    {asset.odometer_reading?.toLocaleString() || "—"} km
                  </p>
                </div>
                {asset.hours_reading && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hours</p>
                    <p className="text-3xl font-bold">
                      {asset.hours_reading?.toLocaleString() || "—"} hrs
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reading History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reading History</CardTitle>
            </CardHeader>
            <CardContent>
              {odometerReadings.length > 0 ? (
                <div className="space-y-4">
                  {odometerReadings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          {reading.reading_type === "photo" ? (
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Gauge className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {reading.display_value || `${reading.odometer_km?.toLocaleString()} km`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(reading.reading_date)}
                            {reading.user && ` • ${reading.user.full_name}`}
                          </p>
                        </div>
                      </div>
                      {reading.distance_since_last && reading.distance_since_last > 0 && (
                        <Badge variant="outline">
                          +{reading.distance_since_last.toLocaleString()} km
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No odometer readings recorded</p>
                  <Button variant="outline" className="mt-4">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Odometer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {/* Expense Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                </div>
                <p className="text-2xl font-bold mt-2">{formatCurrency(expenseTotals.total)}</p>
              </CardContent>
            </Card>
            {Object.entries(expenseTotals.by_type).slice(0, 3).map(([type, amount]) => (
              <Card key={type}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground capitalize">{type}</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(amount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Expense List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Expense History</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Recorded By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{formatDate(expense.expense_date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {expense.expense_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{expense.description || "-"}</TableCell>
                          <TableCell>{expense.vendor || "-"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {expense.user?.full_name || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No expenses recorded for this asset</p>
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost of Ownership Summary */}
          {(expenses.length > 0 || (asset.total_maintenance_cost ?? 0) > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Cost of Ownership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Purchase Price</span>
                    <span className="font-medium">{formatCurrency(asset.purchase_price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Maintenance Costs</span>
                    <span className="font-medium">{formatCurrency(asset.total_maintenance_cost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Other Expenses</span>
                    <span className="font-medium">{formatCurrency(expenseTotals.total)}</span>
                  </div>
                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="font-semibold">Total Cost of Ownership</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(
                        (asset.purchase_price || 0) +
                        (asset.total_maintenance_cost || 0) +
                        expenseTotals.total
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Manage Asset Types Dialog */}
      <Dialog open={showTypesDialog} onOpenChange={setShowTypesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Asset Types</DialogTitle>
            <DialogDescription>
              Add or remove asset types. Default types cannot be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add new type */}
            <div className="flex gap-2">
              <Input
                placeholder="New type name..."
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddType();
                  }
                }}
              />
              <Button onClick={handleAddType} disabled={!newTypeName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* List of types */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {assetTypes.map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-2 rounded border bg-muted/50"
                >
                  <span className="capitalize">{type.replace(/_/g, " ")}</span>
                  {!DEFAULT_ASSET_TYPES.includes(type) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveType(type)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypesDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
