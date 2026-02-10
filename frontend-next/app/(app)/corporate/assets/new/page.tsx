"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Save,
  Car,
  Wrench,
  Building2,
  Box,
  Hash,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface Company {
  id: number;
  name: string;
  code?: string;
}

interface User {
  id: number;
  full_name: string;
  email: string;
}

// Asset type codes for preview
const ASSET_TYPE_CODES: Record<string, string> = {
  vehicle: "VEH",
  equipment: "EQP",
  property: "PRO",
  other: "OTH",
};

interface NewAssetForm {
  name: string;
  asset_type: string;
  status: string;
  company_id: number | null;
  purchase_price?: string;
  purchase_date?: string;
  current_book_value?: string;
  make?: string;
  model?: string;
  description?: string;
  abbreviation?: string;
  // New fields
  serial_number?: string;
  registration_number?: string;
  location?: string;
  assigned_user_id?: number | null;
  // Property-specific
  address?: string;
  land_area_sqm?: string;
  building_area_sqm?: string;
  construction_date?: string;
}

const INITIAL_FORM: NewAssetForm = {
  name: "",
  asset_type: "equipment",
  status: "active",
  company_id: null,
  purchase_price: "",
  purchase_date: "",
  current_book_value: "",
  make: "",
  model: "",
  description: "",
  abbreviation: "",
  serial_number: "",
  registration_number: "",
  location: "",
  assigned_user_id: null,
  address: "",
  land_area_sqm: "",
  building_area_sqm: "",
  construction_date: "",
};

const ASSET_TYPE_ICONS: Record<string, React.ElementType> = {
  vehicle: Car,
  equipment: Wrench,
  property: Building2,
  other: Box,
};

export default function NewAssetPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<NewAssetForm>(INITIAL_FORM);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load companies and users for dropdowns
  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        api.get<{ companies: Company[] }>("/api/v1/companies"),
        api.get<{ users: User[] }>("/api/v1/users"),
      ]);
      setCompanies(companiesRes.companies || []);
      setUsers(usersRes.users || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Generate preview asset number
  const previewAssetNumber = React.useMemo(() => {
    const company = companies.find((c) => c.id === form.company_id);
    const companyCode = company?.code || "XXX";
    const typeCode = ASSET_TYPE_CODES[form.asset_type] || "OTH";
    return `${companyCode}-${typeCode}-001`;
  }, [form.company_id, form.asset_type, companies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.name.trim()) {
      setError("Asset name is required");
      return;
    }
    if (!form.company_id) {
      setError("Please select a company");
      return;
    }

    try {
      setSaving(true);

      // Prepare data for API
      const assetData = {
        name: form.name.trim(),
        asset_type: form.asset_type,
        status: form.status,
        company_id: form.company_id,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date: form.purchase_date || null,
        current_book_value: form.current_book_value
          ? parseFloat(form.current_book_value)
          : null,
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        description: form.description?.trim() || null,
        abbreviation: form.abbreviation?.trim().toUpperCase() || null,
        serial_number: form.serial_number?.trim() || null,
        registration_number: form.registration_number?.trim().toUpperCase() || null,
        location: form.location?.trim() || null,
        assigned_user_id: form.assigned_user_id || null,
        // Property-specific
        address: form.address?.trim() || null,
        land_area_sqm: form.land_area_sqm ? parseFloat(form.land_area_sqm) : null,
        building_area_sqm: form.building_area_sqm ? parseFloat(form.building_area_sqm) : null,
        construction_date: form.construction_date || null,
      };

      const response = await api.post<{ asset: { id: number } }>("/api/v1/assets", {
        asset: assetData,
      });

      // Navigate to the new asset
      if (response?.asset?.id) {
        router.push(`/corporate/assets/${response.asset.id}`);
      }
    } catch (err) {
      console.error("Failed to create asset:", err);
      setError("Failed to create asset. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: keyof NewAssetForm, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isProperty = form.asset_type === "property";
  const isVehicle = form.asset_type === "vehicle";

  if (loading) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <BackButton fallbackHref="/corporate/assets" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Add Asset</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new company asset for tracking and depreciation
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Asset Identification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Asset Identification
            </CardTitle>
            <CardDescription>
              Select the owning company and asset type. Asset number will be auto-generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Selection */}
            <div className="space-y-2">
              <Label htmlFor="company">
                Company <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.company_id?.toString() || ""}
                onValueChange={(value) => updateForm("company_id", parseInt(value))}
              >
                <SelectTrigger id="company">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.code && <span className="text-muted-foreground mr-2">[{company.code}]</span>}
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Type with Icons */}
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(ASSET_TYPE_ICONS).map(([type, Icon]) => (
                  <Button
                    key={type}
                    type="button"
                    variant={form.asset_type === type ? "default" : "outline"}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => updateForm("asset_type", type)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs capitalize">{type}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Auto-generated Asset Number Preview */}
            {form.company_id && (
              <div className="p-3 bg-muted rounded-md">
                <Label className="text-xs text-muted-foreground">Asset Number (auto-generated)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-lg font-mono">
                    {previewAssetNumber}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (actual number assigned on save)
                  </span>
                </div>
              </div>
            )}

            {/* Asset Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Asset Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder={isProperty ? "e.g., 123 Smith Street Office" : isVehicle ? "e.g., Toyota Hilux SR5" : "e.g., Excavator CAT 320"}
              />
            </div>

            {/* Abbreviation */}
            <div className="space-y-2">
              <Label htmlFor="abbreviation">Abbreviation (optional)</Label>
              <Input
                id="abbreviation"
                value={form.abbreviation || ""}
                onChange={(e) => updateForm("abbreviation", e.target.value.toUpperCase())}
                placeholder="e.g., HILUX-01"
                className="uppercase font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Short reference code for quick identification
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Physical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Physical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Make and Model (for vehicles/equipment) */}
            {!isProperty && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={form.make || ""}
                    onChange={(e) => updateForm("make", e.target.value)}
                    placeholder={isVehicle ? "e.g., Toyota" : "e.g., Caterpillar"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={form.model || ""}
                    onChange={(e) => updateForm("model", e.target.value)}
                    placeholder={isVehicle ? "e.g., Hilux SR5" : "e.g., 320 Next Gen"}
                  />
                </div>
              </div>
            )}

            {/* Serial Number and Registration */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  value={form.serial_number || ""}
                  onChange={(e) => updateForm("serial_number", e.target.value)}
                  placeholder="e.g., ABC123456"
                />
              </div>
              {isVehicle && (
                <div className="space-y-2">
                  <Label htmlFor="registration_number">Registration Number</Label>
                  <Input
                    id="registration_number"
                    value={form.registration_number || ""}
                    onChange={(e) => updateForm("registration_number", e.target.value.toUpperCase())}
                    placeholder="e.g., 123-ABC"
                    className="uppercase"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location || ""}
                onChange={(e) => updateForm("location", e.target.value)}
                placeholder="e.g., Brisbane Office, Site A, Warehouse 2"
              />
            </div>

            {/* User Assignment */}
            <div className="space-y-2">
              <Label htmlFor="assigned_user">Assigned To</Label>
              <Select
                value={form.assigned_user_id?.toString() || "__none__"}
                onValueChange={(value) => updateForm("assigned_user_id", value && value !== "__none__" ? parseInt(value) : null)}
              >
                <SelectTrigger id="assigned_user">
                  <SelectValue placeholder="Select user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Who has this asset assigned to them
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Property Details (conditional) */}
        {isProperty && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Property Address</Label>
                <Input
                  id="address"
                  value={form.address || ""}
                  onChange={(e) => updateForm("address", e.target.value)}
                  placeholder="e.g., 123 Smith Street, Brisbane QLD 4000"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="land_area">Land Area (sqm)</Label>
                  <Input
                    id="land_area"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.land_area_sqm || ""}
                    onChange={(e) => updateForm("land_area_sqm", e.target.value)}
                    placeholder="e.g., 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="building_area">Building Area (sqm)</Label>
                  <Input
                    id="building_area"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.building_area_sqm || ""}
                    onChange={(e) => updateForm("building_area_sqm", e.target.value)}
                    placeholder="e.g., 200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="construction_date">Construction Date</Label>
                <Input
                  id="construction_date"
                  type="date"
                  value={form.construction_date || ""}
                  onChange={(e) => updateForm("construction_date", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for Division 43 depreciation rate (2.5% after 27 Feb 1992, 4% before)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase & Valuation */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase & Valuation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={form.purchase_date || ""}
                  onChange={(e) => updateForm("purchase_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price ($)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchase_price || ""}
                  onChange={(e) => updateForm("purchase_price", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="book_value">Current Book Value ($)</Label>
                <Input
                  id="book_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.current_book_value || ""}
                  onChange={(e) => updateForm("current_book_value", e.target.value)}
                  placeholder="Auto-calculated from depreciation"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateForm("status", value)}
              >
                <SelectTrigger id="status" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="under_repair">Under Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Additional details about this asset..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Note about depreciation */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
          <p className="font-medium text-blue-900 dark:text-blue-100">
            Depreciation Settings
          </p>
          <p className="text-blue-700 dark:text-blue-300 mt-1">
            Depreciation profile will be auto-configured based on asset type. You can customize
            depreciation method, effective life, and other settings after creating the asset
            in the Depreciation tab.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/corporate/assets")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Create Asset
          </Button>
        </div>
      </form>
    </div>
  );
}
