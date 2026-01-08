"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { COMPANY_TIMEZONE } from "@/lib/timezone-utils";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Star, X, Check } from "lucide-react";

const TIMEZONES = [
  { value: "Australia/Brisbane", label: "Brisbane (AEST/AEDT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
  { value: "Australia/Darwin", label: "Darwin (ACST)" },
  { value: "Australia/Hobart", label: "Hobart (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "UTC", label: "UTC" },
];

interface CompanySettings {
  company_name: string;
  abn: string;
  qbcc_license: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  logo_url: string;
  logo_mobile: string;
  logo_dark: string;
  timezone: string;
  // Bank details for invoices
  bank_name: string;
  bank_bsb: string;
  bank_account_number: string;
  bank_account_name: string;
  working_days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface TradingName {
  id: number;
  name: string;
  abn?: string;
  address?: string;
  is_default?: boolean;
  is_active?: boolean;
}

interface XeroTenant {
  id: number;
  tenant_name: string;
  is_primary: boolean;
  status: string;
  status_display: string;
}

export default function CompanyInfoTab() {
  const [settings, setSettings] = React.useState<CompanySettings>({
    company_name: "",
    abn: "",
    qbcc_license: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    logo_url: "",
    logo_mobile: "",
    logo_dark: "",
    timezone: COMPANY_TIMEZONE,
    // Bank details
    bank_name: "",
    bank_bsb: "",
    bank_account_number: "",
    bank_account_name: "",
    working_days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
  });
  const [originalSettings, setOriginalSettings] =
    React.useState<CompanySettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Trading Names state
  const [tradingNames, setTradingNames] = React.useState<TradingName[]>([]);
  const [loadingTradingNames, setLoadingTradingNames] = React.useState(false);
  const [editingTradingName, setEditingTradingName] = React.useState<TradingName | null>(null);
  const [newTradingName, setNewTradingName] = React.useState<Partial<TradingName> | null>(null);
  const [savingTradingName, setSavingTradingName] = React.useState(false);

  // Xero Tenants state
  const [xeroTenants, setXeroTenants] = React.useState<XeroTenant[]>([]);
  const [loadingXero, setLoadingXero] = React.useState(false);
  const [savingXero, setSavingXero] = React.useState(false);

  const hasChanges = React.useMemo(() => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  React.useEffect(() => {
    loadSettings();
    loadTradingNames();
    loadXeroTenants();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get<{ success: boolean; data: CompanySettings }>(
        "/api/v1/company_settings"
      );
      setSettings(response.data);
      setOriginalSettings(response.data);
    } catch (error) {
      console.debug("Company settings unavailable:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put("/api/v1/company_settings", { company_setting: settings });
      setOriginalSettings(settings);
      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CompanySettings, value: string | object) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Trading Names CRUD
  const loadTradingNames = async () => {
    setLoadingTradingNames(true);
    try {
      const data = await api.get<{ success: boolean; records: TradingName[] }>(
        "/api/v1/foundations/trading_names/records"
      );
      if (data?.records) {
        setTradingNames(data.records);
      }
    } catch (error) {
      console.error("Failed to load trading names:", error);
    } finally {
      setLoadingTradingNames(false);
    }
  };

  const saveTradingName = async (tradingName: Partial<TradingName>) => {
    setSavingTradingName(true);
    try {
      if (tradingName.id) {
        // Update existing
        await api.put(`/api/v1/foundations/trading_names/records/${tradingName.id}`, {
          record: { name: tradingName.name, abn: tradingName.abn, address: tradingName.address }
        });
      } else {
        // Create new
        await api.post("/api/v1/foundations/trading_names/records", {
          record: { name: tradingName.name, abn: tradingName.abn, address: tradingName.address, is_active: true }
        });
      }
      await loadTradingNames();
      setEditingTradingName(null);
      setNewTradingName(null);
    } catch (error) {
      console.error("Failed to save trading name:", error);
    } finally {
      setSavingTradingName(false);
    }
  };

  const deleteTradingName = async (id: number) => {
    if (!confirm("Delete this trading name?")) return;
    try {
      await api.delete(`/api/v1/foundations/trading_names/records/${id}`);
      await loadTradingNames();
    } catch (error) {
      console.error("Failed to delete trading name:", error);
    }
  };

  const setDefaultTradingName = async (id: number) => {
    try {
      // Clear existing defaults
      for (const tn of tradingNames.filter(t => t.is_default)) {
        await api.put(`/api/v1/foundations/trading_names/records/${tn.id}`, {
          record: { is_default: false }
        });
      }
      // Set new default
      await api.put(`/api/v1/foundations/trading_names/records/${id}`, {
        record: { is_default: true }
      });
      await loadTradingNames();
    } catch (error) {
      console.error("Failed to set default:", error);
    }
  };

  // Xero Tenants CRUD
  const loadXeroTenants = async () => {
    setLoadingXero(true);
    try {
      const response = await api.get<{ success: boolean; tenants: XeroTenant[] }>(
        "/api/v1/xero/tenants"
      );
      if (response?.tenants) {
        setXeroTenants(response.tenants);
      }
    } catch (error) {
      console.error("Failed to load Xero tenants:", error);
    } finally {
      setLoadingXero(false);
    }
  };

  const setPrimaryXero = async (tenantId: number) => {
    setSavingXero(true);
    try {
      await api.post("/api/v1/xero/set_primary", { tenant_id: tenantId });
      await loadXeroTenants();
      setMessage({ type: "success", text: "Primary Xero account updated!" });
    } catch (error) {
      console.error("Failed to set primary Xero:", error);
      setMessage({ type: "error", text: "Failed to update primary Xero account" });
    } finally {
      setSavingXero(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sticky save bar when there are unsaved changes */}
      {hasChanges && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
          <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            You have unsaved changes
          </span>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? (
              <>
                <Spinner size={16} className="mr-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}

      {message && (
        <div
          className={cn(
            "rounded-md p-4",
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          )}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name</Label>
          <Input
            id="company_name"
            value={settings.company_name || ""}
            onChange={(e) => handleChange("company_name", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abn">ABN</Label>
          <Input
            id="abn"
            value={settings.abn || ""}
            onChange={(e) => handleChange("abn", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qbcc_license">QBCC License</Label>
          <Input
            id="qbcc_license"
            value={settings.qbcc_license || ""}
            onChange={(e) => handleChange("qbcc_license", e.target.value)}
            placeholder="e.g. 123456"
          />
          <p className="text-xs text-muted-foreground">
            Queensland Building and Construction Commission license number
          </p>
        </div>

        {/* Logo Variants Section */}
        <div className="space-y-6 p-4 border rounded-lg bg-muted/30">
          <div>
            <h3 className="font-semibold mb-1">Company Logos</h3>
            <p className="text-xs text-muted-foreground">
              Upload different logo variants for various uses. Recommended: PNG
              with transparent background.
            </p>
          </div>

          {/* Primary Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Primary Logo (Documents & Letterhead)
            </Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-white min-w-[180px] min-h-[80px] flex items-center justify-center">
                {settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="Primary Logo"
                    style={{ maxWidth: "150px", maxHeight: "60px" }}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="logo_upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) =>
                        handleChange("logo_url", event.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById("logo_upload")?.click()
                    }
                  >
                    Choose File
                  </Button>
                  {settings.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange("logo_url", "")}
                      className="text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={
                    settings.logo_url?.startsWith("data:")
                      ? ""
                      : settings.logo_url || ""
                  }
                  onChange={(e) => handleChange("logo_url", e.target.value)}
                  placeholder="Or enter URL..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Mobile Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Mobile Logo (Icon/Mark Only)
            </Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-white min-w-[80px] min-h-[80px] flex items-center justify-center">
                {settings.logo_mobile ? (
                  <img
                    src={settings.logo_mobile}
                    alt="Mobile Logo"
                    style={{ maxWidth: "50px", maxHeight: "50px" }}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="logo_mobile_upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) =>
                        handleChange(
                          "logo_mobile",
                          event.target?.result as string
                        );
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById("logo_mobile_upload")?.click()
                    }
                  >
                    Choose File
                  </Button>
                  {settings.logo_mobile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange("logo_mobile", "")}
                      className="text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={
                    settings.logo_mobile?.startsWith("data:")
                      ? ""
                      : settings.logo_mobile || ""
                  }
                  onChange={(e) => handleChange("logo_mobile", e.target.value)}
                  placeholder="Or enter URL..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Dark Mode Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Dark Mode Logo (Light/White Version)
            </Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-slate-800 min-w-[180px] min-h-[80px] flex items-center justify-center">
                {settings.logo_dark ? (
                  <img
                    src={settings.logo_dark}
                    alt="Dark Mode Logo"
                    style={{ maxWidth: "150px", maxHeight: "60px" }}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="logo_dark_upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) =>
                        handleChange("logo_dark", event.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById("logo_dark_upload")?.click()
                    }
                  >
                    Choose File
                  </Button>
                  {settings.logo_dark && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange("logo_dark", "")}
                      className="text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={
                    settings.logo_dark?.startsWith("data:")
                      ? ""
                      : settings.logo_dark || ""
                  }
                  onChange={(e) => handleChange("logo_dark", e.target.value)}
                  placeholder="Or enter URL..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <p className="text-sm text-muted-foreground">
            This timezone will be used for calculating working days, displaying
            dates, and scheduling tasks.
          </p>
          <Select
            value={settings.timezone || COMPANY_TIMEZONE}
            onValueChange={(value) => handleChange("timezone", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Working Days</Label>
          <p className="text-sm text-muted-foreground">
            Select which days are considered working days. Tasks will be
            scheduled only on selected days (unless locked). Holidays are managed
            in the Holidays tab above.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {(
              [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
              ] as const
            ).map((day) => (
              <div key={day} className="flex items-center gap-2">
                <Checkbox
                  id={day}
                  checked={settings.working_days?.[day] ?? true}
                  onCheckedChange={(checked) => {
                    const newWorkingDays = {
                      ...settings.working_days,
                      [day]: checked,
                    };
                    handleChange("working_days", newWorkingDays);
                  }}
                />
                <Label htmlFor={day} className="capitalize cursor-pointer">
                  {day}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Names Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Trading Names</h3>
              <p className="text-xs text-muted-foreground">
                Different company names used on invoices and documents
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewTradingName({ name: "", abn: "", address: "" })}
              disabled={newTradingName !== null}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {loadingTradingNames ? (
            <div className="flex justify-center py-4">
              <Spinner size={20} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* New trading name form */}
              {newTradingName && (
                <div className="flex items-center gap-2 p-2 bg-background rounded border">
                  <Input
                    placeholder="Trading name..."
                    value={newTradingName.name || ""}
                    onChange={(e) => setNewTradingName({ ...newTradingName, name: e.target.value })}
                    className="flex-1 h-8"
                    autoFocus
                  />
                  <Input
                    placeholder="ABN (optional)"
                    value={newTradingName.abn || ""}
                    onChange={(e) => setNewTradingName({ ...newTradingName, abn: e.target.value })}
                    className="w-32 h-8"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => saveTradingName(newTradingName)}
                    disabled={!newTradingName.name?.trim() || savingTradingName}
                  >
                    {savingTradingName ? <Spinner size={14} /> : <Check className="h-4 w-4 text-green-600" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setNewTradingName(null)}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* List of trading names */}
              {tradingNames.length === 0 && !newTradingName ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No trading names configured. Add one to get started.
                </p>
              ) : (
                tradingNames.map((tn) => (
                  <div key={tn.id} className="flex items-center gap-2 p-2 bg-background rounded border group">
                    {editingTradingName?.id === tn.id ? (
                      <>
                        <Input
                          value={editingTradingName.name || ""}
                          onChange={(e) => setEditingTradingName({ ...editingTradingName, name: e.target.value })}
                          className="flex-1 h-8"
                          autoFocus
                        />
                        <Input
                          placeholder="ABN"
                          value={editingTradingName.abn || ""}
                          onChange={(e) => setEditingTradingName({ ...editingTradingName, abn: e.target.value })}
                          className="w-32 h-8"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => saveTradingName(editingTradingName)}
                          disabled={!editingTradingName.name?.trim() || savingTradingName}
                        >
                          {savingTradingName ? <Spinner size={14} /> : <Check className="h-4 w-4 text-green-600" />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditingTradingName(null)}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{tn.name}</span>
                            {tn.is_default && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          {tn.abn && (
                            <span className="text-xs text-muted-foreground">ABN: {tn.abn}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!tn.is_default && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setDefaultTradingName(tn.id)}
                              title="Set as default"
                            >
                              <Star className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingTradingName(tn)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => deleteTradingName(tn.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={settings.email || ""}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={settings.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={settings.website || ""}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="https://www.example.com.au"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <textarea
            id="address"
            rows={3}
            value={settings.address || ""}
            onChange={(e) => handleChange("address", e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Bank Details Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div>
            <h3 className="font-semibold mb-1">Bank Details</h3>
            <p className="text-xs text-muted-foreground">
              Used on invoices and payment requests
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={settings.bank_name || ""}
                onChange={(e) => handleChange("bank_name", e.target.value)}
                placeholder="e.g. Commonwealth Bank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_bsb">BSB</Label>
              <Input
                id="bank_bsb"
                value={settings.bank_bsb || ""}
                onChange={(e) => handleChange("bank_bsb", e.target.value)}
                placeholder="e.g. 064-000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input
                id="bank_account_number"
                value={settings.bank_account_number || ""}
                onChange={(e) => handleChange("bank_account_number", e.target.value)}
                placeholder="e.g. 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account_name">Account Name</Label>
              <Input
                id="bank_account_name"
                value={settings.bank_account_name || ""}
                onChange={(e) => handleChange("bank_account_name", e.target.value)}
                placeholder="e.g. Tekna Homes Pty Ltd"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Template Tags Reference */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
        <h3 className="font-semibold mb-3">Document Template Tags</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Use these tags in your document templates. They will be replaced with
          the values above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.display_name}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">
              Company name
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.abn}}"}</span>
            <span className="text-xs text-muted-foreground/70">ABN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.qbcc_license}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">
              QBCC License
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.phone}}"}</span>
            <span className="text-xs text-muted-foreground/70">
              Phone number
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.email}}"}</span>
            <span className="text-xs text-muted-foreground/70">Email</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.website}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">Website</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.address}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">Address</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.logo}}"}</span>
            <span className="text-xs text-muted-foreground/70">
              Primary logo
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.logo_mobile}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">Mobile logo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {"{{builder.logo_dark}}"}
            </span>
            <span className="text-xs text-muted-foreground/70">
              Dark mode logo
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Spinner size={16} className="mr-2" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </form>
  );
}
