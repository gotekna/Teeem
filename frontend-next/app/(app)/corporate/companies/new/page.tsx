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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";

interface CompanyGroup {
  id: number;
  name: string;
}

export default function NewCompanyPage() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);

  // Form state
  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    entity_type: "Company",
    acn: "",
    abn: "",
    tfn: "",
    date_incorporated: "",
    purpose: "",
    status: "Active",
    registered_office_address: "",
    principal_place_of_business: "",
    is_trustee: false,
    trust_name: "",
    gst_registration_status: "",
    accounting_method: "",
    shares_on_issue: "",
    company_group_id: "",
  });

  // Load company groups for dropdown
  React.useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
        setCompanyGroups(response.data || []);
      } catch (error) {
        console.error("Failed to load company groups:", error);
      }
    };
    loadGroups();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Company name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        company: {
          ...formData,
          shares_on_issue: formData.shares_on_issue ? parseInt(formData.shares_on_issue) : null,
          company_group_id: formData.company_group_id ? parseInt(formData.company_group_id) : null,
        },
      };

      const response = await api.post<{ success: boolean; company: { id: number }; errors?: string[] }>(
        "/api/v1/companies",
        payload
      );

      if (response?.company?.id) {
        router.push(`/corporate/companies/${response.company.id}`);
      } else {
        router.push("/company-groups");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create company";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Add New Company</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new company, trust, superfund, or person entity
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => handleChange("code", e.target.value)}
                    placeholder="Short code (e.g., ABC)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity_type">Entity Type</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(v) => handleChange("entity_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Company">Company</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                      <SelectItem value="Superfund">Superfund</SelectItem>
                      <SelectItem value="Person">Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => handleChange("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Deregistered">Deregistered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_group_id">Company Group</Label>
                  <Select
                    value={formData.company_group_id}
                    onValueChange={(v) => handleChange("company_group_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_incorporated">Date Incorporated</Label>
                  <Input
                    id="date_incorporated"
                    type="date"
                    value={formData.date_incorporated}
                    onChange={(e) => handleChange("date_incorporated", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => handleChange("purpose", e.target.value)}
                  placeholder="Company purpose or description"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Registration Numbers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registration Numbers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="acn">ACN</Label>
                  <Input
                    id="acn"
                    value={formData.acn}
                    onChange={(e) => handleChange("acn", e.target.value)}
                    placeholder="000 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    value={formData.abn}
                    onChange={(e) => handleChange("abn", e.target.value)}
                    placeholder="00 000 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tfn">TFN</Label>
                  <Input
                    id="tfn"
                    value={formData.tfn}
                    onChange={(e) => handleChange("tfn", e.target.value)}
                    placeholder="000 000 000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trustee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trustee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_trustee"
                  checked={formData.is_trustee}
                  onCheckedChange={(checked) => handleChange("is_trustee", !!checked)}
                />
                <Label htmlFor="is_trustee" className="cursor-pointer">
                  This entity acts as a trustee
                </Label>
              </div>
              {formData.is_trustee && (
                <div className="space-y-2">
                  <Label htmlFor="trust_name">Trust Name</Label>
                  <Input
                    id="trust_name"
                    value={formData.trust_name}
                    onChange={(e) => handleChange("trust_name", e.target.value)}
                    placeholder="Name of the trust (ATF)"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Addresses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registered_office_address">Registered Office Address</Label>
                <Textarea
                  id="registered_office_address"
                  value={formData.registered_office_address}
                  onChange={(e) => handleChange("registered_office_address", e.target.value)}
                  placeholder="Full registered office address"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="principal_place_of_business">Principal Place of Business</Label>
                <Textarea
                  id="principal_place_of_business"
                  value={formData.principal_place_of_business}
                  onChange={(e) => handleChange("principal_place_of_business", e.target.value)}
                  placeholder="Full business address"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_registration_status">GST Status</Label>
                  <Select
                    value={formData.gst_registration_status}
                    onValueChange={(v) => handleChange("gst_registration_status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registered">Registered</SelectItem>
                      <SelectItem value="Not Registered">Not Registered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accounting_method">Accounting Method</Label>
                  <Select
                    value={formData.accounting_method}
                    onValueChange={(v) => handleChange("accounting_method", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Accruals">Accruals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shares_on_issue">Shares on Issue</Label>
                  <Input
                    id="shares_on_issue"
                    type="number"
                    value={formData.shares_on_issue}
                    onChange={(e) => handleChange("shares_on_issue", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-6">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Company
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
