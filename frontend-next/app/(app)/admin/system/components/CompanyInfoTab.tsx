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
import { useConfirm } from "@/contexts/ConfirmationContext";

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

// API Environment options (SSoT: CorporateCompanySetting::VALID_API_ENVIRONMENTS)
const API_ENVIRONMENTS = [
  {
    value: "production",
    label: "Production (Recommended)",
    description: "Stable, live data - for everyday use",
  },
  {
    value: "beta",
    label: "Beta",
    description: "New features, early access - may have minor issues",
  },
  {
    value: "staging",
    label: "Staging",
    description: "Internal testing only - not for production use",
  },
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
  // API Environment (production backend is "router")
  api_environment: string;
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
  const { confirm } = useConfirm();
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
    // API Environment
    api_environment: "production",
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
    if (!(await confirm("Delete this trading name?"))) return;
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

        {/* API Environment Section */}
        <div className="space-y-2">
          <Label>Environment</Label>
          <p className="text-sm text-muted-foreground">
            Select which backend environment this company uses. Change takes effect on next login.
          </p>
          <Select
            value={settings.api_environment || "production"}
            onValueChange={(value) => handleChange("api_environment", value)}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              {API_ENVIRONMENTS.map((env) => (
                <SelectItem key={env.value} value={env.value}>
                  <div className="flex flex-col">
                    <span>{env.label}</span>
                    <span className="text-xs text-muted-foreground">{env.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {settings.api_environment && settings.api_environment !== "production" && (
            <div className={cn(
              "mt-2 p-3 rounded-md text-sm",
              settings.api_environment === "staging"
                ? "bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800"
                : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800"
            )}>
              <strong>Warning:</strong> You are using a non-production environment.
              {settings.api_environment === "staging" && " Staging is for internal testing only."}
              {settings.api_environment === "beta" && " Beta may have experimental features."}
            </div>
          )}
        </div>

        {/* Primary Xero Account Section */}
        <div className="space-y-2">
          <Label>Primary Xero Account</Label>
          <p className="text-sm text-muted-foreground">
            Select which Xero organization to use for job tracking categories and syncing
          </p>
          {loadingXero ? (
            <div className="flex items-center gap-2">
              <Spinner size={16} />
              <span className="text-sm text-muted-foreground">Loading Xero accounts...</span>
            </div>
          ) : xeroTenants.length > 0 ? (
            <Select
              value={xeroTenants.find(t => t.is_primary)?.id?.toString() || ""}
              onValueChange={(value) => setPrimaryXero(parseInt(value))}
              disabled={savingXero}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select Xero organization" />
              </SelectTrigger>
              <SelectContent>
                {xeroTenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{tenant.tenant_name}</span>
                      {tenant.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          Current
                        </span>
                      )}
                      {tenant.status !== "connected" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                          {tenant.status}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Xero connections found. Connect to Xero in the Connections tab.
            </p>
          )}
          {savingXero && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size={14} />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {/* Note: Logos are managed in Brand Colors tab */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Company logos are managed in the <strong>Brand Colors</strong> tab above.
          </p>
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
              <h3 className="text-sm font-semibold">Trading Names</h3>
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
                    {savingTradingName ? <Spinner size={14} /> : <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
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
                          {savingTradingName ? <Spinner size={14} /> : <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
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
                            <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
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
            <h3 className="text-sm font-semibold mb-1">Bank Details</h3>
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
                placeholder="e.g. Teeem Homes Pty Ltd"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Template Tags Reference */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
        <h3 className="text-sm font-semibold mb-3">Document Template Tags</h3>
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
