"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Package,
  Building2,
  Shield,
  Wrench,
  FileText,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";

// Tab definitions
const TABS = [
  { id: "details", name: "Details", icon: Package },
  { id: "insurance", name: "Insurance", icon: Shield },
  { id: "service", name: "Service History", icon: Wrench },
  { id: "documents", name: "Documents", icon: FileText },
];

interface Asset {
  id: number;
  name: string;
  asset_type: string;
  status: string;
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
  company?: {
    id: number;
    name: string;
  };
  asset_insurance?: {
    id: number;
    policy_number?: string;
    insurer?: string;
    renewal_date?: string;
    premium?: number;
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

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const [asset, setAsset] = React.useState<Asset | null>(null);
  const [serviceHistory, setServiceHistory] = React.useState<ServiceHistory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("details");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedAsset, setEditedAsset] = React.useState<Partial<Asset>>({});

  // Load asset data
  React.useEffect(() => {
    loadAsset();
     
  }, [assetId]);

  const loadAsset = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<{ asset: Asset }>(`/api/v1/assets/${assetId}`);
      setAsset(response.asset);
      setEditedAsset(response.asset);

      // Load service history
      try {
        const serviceResponse = await api.get<{ service_histories: ServiceHistory[] }>(
          `/api/v1/assets/${assetId}/service_histories`
        );
        setServiceHistory(serviceResponse.service_histories || []);
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive">{error || "Asset not found"}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                onClick={() => setActiveTab(tab.id)}
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
                <Label>Type</Label>
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
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="property">Property</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm capitalize">{asset.asset_type}</p>
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
    </div>
  );
}
