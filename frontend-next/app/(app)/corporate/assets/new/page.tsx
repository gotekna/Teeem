"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";

interface Company {
  id: number;
  name: string;
}

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
};

export default function NewAssetPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<NewAssetForm>(INITIAL_FORM);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load companies for dropdown
  React.useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ companies: Company[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (err) {
      console.error("Failed to load companies:", err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Add Asset</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new company asset
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Asset Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

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
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Asset Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g., Toyota Hilux SR5"
              />
            </div>

            {/* Type and Status */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.asset_type}
                  onValueChange={(value) => updateForm("asset_type", value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateForm("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disposed">Disposed</SelectItem>
                    <SelectItem value="under_repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Make and Model */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={form.make || ""}
                  onChange={(e) => updateForm("make", e.target.value)}
                  placeholder="e.g., Toyota"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={form.model || ""}
                  onChange={(e) => updateForm("model", e.target.value)}
                  placeholder="e.g., Hilux SR5"
                />
              </div>
            </div>

            {/* Abbreviation */}
            <div className="space-y-2">
              <Label htmlFor="abbreviation">Abbreviation</Label>
              <Input
                id="abbreviation"
                value={form.abbreviation || ""}
                onChange={(e) => updateForm("abbreviation", e.target.value.toUpperCase())}
                placeholder="e.g., HILUX-01"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Uppercase letters, numbers, and hyphens only
              </p>
            </div>

            {/* Purchase Info */}
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
                <Label htmlFor="purchase_price">Purchase Price</Label>
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
                <Label htmlFor="book_value">Current Book Value</Label>
                <Input
                  id="book_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.current_book_value || ""}
                  onChange={(e) => updateForm("current_book_value", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Additional details about this asset..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create Asset
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
