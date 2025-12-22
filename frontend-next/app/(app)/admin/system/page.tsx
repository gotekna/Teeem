"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Calendar,
  CalendarDays,
  Users,
  ShieldCheck,
  Banknote,
  DollarSign,
  ClipboardCheck,
  Star,
  Wrench,
  BookOpen,
  Sparkles,
  BarChart,
  Loader2,
  ExternalLink,
  FileText,
  Tag,
  Palette,
  Mail,
  Map,
  Clock,
  Menu,
  Brain,
  Activity,
  Settings2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Import all tab components
import { SecurityTab } from "./components/SecurityTab";
import { PermissionsTab } from "./components/PermissionsTab";
import { CorporateTab } from "./components/CorporateTab";
import { HolidaysTab } from "./components/HolidaysTab";
import { WorkflowsTab } from "./components/WorkflowsTab";
import { FoldersTab } from "./components/FoldersTab";
import { JobSetupTab } from "./components/JobSetupTab";
import { WorkflowConfigTab } from "./components/WorkflowConfigTab";
import { DocSetupTab } from "./components/DocSetupTab";
import { ScheduleMasterTab } from "./components/ScheduleMasterTab";
import { MeetingTypesTab } from "./components/MeetingTypesTab";
import { SupervisorChecklistTab } from "./components/SupervisorChecklistTab";
import { GoldStandardTab } from "./components/GoldStandardTab";
import { DeveloperToolsTab } from "./components/DeveloperToolsTab";
import { UserManualTab } from "./components/UserManualTab";
import { InspiringQuotesTab } from "./components/InspiringQuotesTab";
import { PerformanceTab } from "./components/PerformanceTab";
import { DocumentTypesTab } from "./components/DocumentTypesTab";
import { ContactTypesTab } from "./components/ContactTypesTab";
// FoldersTabsConfigTab removed - use Entity Configuration > Corporate > Documents (SSoT)
import { WarehouseTab } from "./components/WarehouseTab";
import { BrandGuidelinesTab } from "./components/BrandGuidelinesTab";
import { DocumentTemplatesTab } from "./components/DocumentTemplatesTab";
import { EmailAccountsTab } from "./components/EmailAccountsTab";
import { PlansTab } from "./components/PlansTab";
import { SharePointTab } from "./components/SharePointTab";
import { ScheduledJobsTab } from "./components/ScheduledJobsTab";
import { NavigationTab } from "./components/NavigationTab";
// Old JobTabsConfigTab removed - jobs now use Entity Configuration > Jobs (EntityTab SSoT)
import { EntityConfigurationTab } from "./components/EntityConfigurationTab";
import { PdfFieldsTab } from "./components/PdfFieldsTab";
import { AiProcessingTab } from "./components/AiProcessingTab";
import { XeroHealthTab } from "./components/XeroHealthTab";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

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

const MAIN_TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "warehouse", label: "Warehouse", icon: BarChart },
  { id: "brand-guidelines", label: "Brand Guidelines", icon: Palette },
  { id: "contact-types", label: "Contacts", icon: Tag },
  { id: "components", label: "Components", icon: Star },
  { id: "developer-tools", label: "Developer Tools", icon: Wrench },
  { id: "navigation", label: "Navigation", icon: Menu },
  { id: "entity-config", label: "Entity Configuration", icon: Settings2 },
  { id: "plans", label: "Plans", icon: Map },
  { id: "schedule-master", label: "Schedule Master", icon: CalendarDays },
  { id: "meeting-types", label: "Meeting Types", icon: Calendar },
  { id: "whs", label: "WHS", icon: ShieldCheck },
  { id: "financial", label: "Financial", icon: Banknote },
  { id: "pricebook", label: "Price Book", icon: DollarSign },
  { id: "supervisor-checklist", label: "Supervisor Checklist", icon: ClipboardCheck },
  { id: "user-manual", label: "User Manual", icon: BookOpen },
  { id: "inspiring-quotes", label: "Inspiring Quotes", icon: Sparkles },
  { id: "performance", label: "Performance", icon: BarChart },
  { id: "scheduled-jobs", label: "Scheduled Jobs", icon: Clock },
  { id: "email-accounts", label: "Email Accounts", icon: Mail },
  { id: "pdf-fields", label: "PDF Fields", icon: FileText },
  { id: "ai-processing", label: "AI Processing", icon: Brain },
  { id: "xero-health", label: "Xero Health", icon: Activity },
];

const COMPANY_TABS = [
  { id: "info", label: "Info" },
  { id: "security", label: "Security" },
  { id: "permissions", label: "Permissions" },
  { id: "corporate", label: "Corporate" },
  { id: "holidays", label: "Holidays" },
  { id: "workflows", label: "Workflows" },
  { id: "folders", label: "Folders" },
  { id: "sharepoint", label: "SharePoint" },
  { id: "job-setup", label: "Job Setup" },
  { id: "workflow-config", label: "Workflow Config" },
  { id: "doc-setup", label: "Doc Setup" },
  { id: "doc-templates", label: "Doc Templates" },
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

function CompanyInfoTab() {
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
    timezone: "Australia/Brisbane",
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
  const [originalSettings, setOriginalSettings] = React.useState<CompanySettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasChanges = React.useMemo(() => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get<CompanySettings>("/api/v1/company_settings");
      setSettings(response);
      setOriginalSettings(response);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
              Upload different logo variants for various uses. Recommended: PNG with transparent background.
            </p>
          </div>

          {/* Primary Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Primary Logo (Documents & Letterhead)</Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-white min-w-[180px] min-h-[80px] flex items-center justify-center">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Primary Logo" style={{ maxWidth: '150px', maxHeight: '60px' }} className="object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input type="file" id="logo_upload" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => handleChange("logo_url", event.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo_upload')?.click()}>
                    Choose File
                  </Button>
                  {settings.logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleChange("logo_url", "")} className="text-red-600">
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={settings.logo_url?.startsWith('data:') ? '' : (settings.logo_url || '')}
                  onChange={(e) => handleChange("logo_url", e.target.value)}
                  placeholder="Or enter URL..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Mobile Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Mobile Logo (Icon/Mark Only)</Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-white min-w-[80px] min-h-[80px] flex items-center justify-center">
                {settings.logo_mobile ? (
                  <img src={settings.logo_mobile} alt="Mobile Logo" style={{ maxWidth: '50px', maxHeight: '50px' }} className="object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input type="file" id="logo_mobile_upload" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => handleChange("logo_mobile", event.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo_mobile_upload')?.click()}>
                    Choose File
                  </Button>
                  {settings.logo_mobile && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleChange("logo_mobile", "")} className="text-red-600">
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={settings.logo_mobile?.startsWith('data:') ? '' : (settings.logo_mobile || '')}
                  onChange={(e) => handleChange("logo_mobile", e.target.value)}
                  placeholder="Or enter URL..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Dark Mode Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Dark Mode Logo (Light/White Version)</Label>
            <div className="flex items-start gap-4">
              <div className="border rounded-lg p-3 bg-slate-800 min-w-[180px] min-h-[80px] flex items-center justify-center">
                {settings.logo_dark ? (
                  <img src={settings.logo_dark} alt="Dark Mode Logo" style={{ maxWidth: '150px', maxHeight: '60px' }} className="object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input type="file" id="logo_dark_upload" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => handleChange("logo_dark", event.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo_dark_upload')?.click()}>
                    Choose File
                  </Button>
                  {settings.logo_dark && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleChange("logo_dark", "")} className="text-red-600">
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={settings.logo_dark?.startsWith('data:') ? '' : (settings.logo_dark || '')}
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
            This timezone will be used for calculating working days, displaying dates, and scheduling tasks.
          </p>
          <Select
            value={settings.timezone || "Australia/Brisbane"}
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
            Select which days are considered working days. Tasks will be scheduled only on selected days (unless locked).
            Holidays are managed in the Holidays tab above.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => (
              <div key={day} className="flex items-center gap-2">
                <Checkbox
                  id={day}
                  checked={settings.working_days?.[day] ?? true}
                  onCheckedChange={(checked) => {
                    const newWorkingDays = { ...settings.working_days, [day]: checked };
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
      </div>

      {/* Template Tags Reference */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
        <h3 className="font-semibold mb-3">Document Template Tags</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Use these tags in your document templates. They will be replaced with the values above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.display_name}}"}</span>
            <span className="text-xs text-muted-foreground/70">Company name</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.abn}}"}</span>
            <span className="text-xs text-muted-foreground/70">ABN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.qbcc_license}}"}</span>
            <span className="text-xs text-muted-foreground/70">QBCC License</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.phone}}"}</span>
            <span className="text-xs text-muted-foreground/70">Phone number</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.email}}"}</span>
            <span className="text-xs text-muted-foreground/70">Email</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.website}}"}</span>
            <span className="text-xs text-muted-foreground/70">Website</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.address}}"}</span>
            <span className="text-xs text-muted-foreground/70">Address</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.logo}}"}</span>
            <span className="text-xs text-muted-foreground/70">Primary logo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.logo_mobile}}"}</span>
            <span className="text-xs text-muted-foreground/70">Mobile logo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"{{builder.logo_dark}}"}</span>
            <span className="text-xs text-muted-foreground/70">Dark mode logo</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="text-muted-foreground mt-2">{description}</p>
      <p className="text-sm text-muted-foreground mt-4">
        This tab is being migrated from the React app.
      </p>
    </div>
  );
}

function CompanySettingsTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subtab = searchParams.get("subtab") || "info";

  const handleSubtabChange = (value: string) => {
    router.push(`/admin/system?tab=company&subtab=${value}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Company Settings</h2>
        <Link
          href="/corporate"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Go to Corporate Dashboard
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {COMPANY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-xs sm:text-sm whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="info">
            <CompanyInfoTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>
          <TabsContent value="corporate">
            <CorporateTab />
          </TabsContent>
          <TabsContent value="holidays">
            <HolidaysTab />
          </TabsContent>
          <TabsContent value="workflows">
            <WorkflowsTab />
          </TabsContent>
          <TabsContent value="folders">
            <FoldersTab />
          </TabsContent>
          <TabsContent value="sharepoint">
            <SharePointTab />
          </TabsContent>
          <TabsContent value="job-setup">
            <JobSetupTab />
          </TabsContent>
          <TabsContent value="workflow-config">
            <WorkflowConfigTab />
          </TabsContent>
          <TabsContent value="doc-setup">
            <DocSetupTab />
          </TabsContent>
          <TabsContent value="doc-templates">
            <DocumentTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Full-page tabs that hide the navigation
const FULL_PAGE_TABS = ["pdf-fields"];

function SystemAdminPageContent() {
  // Use full-height layout mode - tabs can use h-full
  useSetLayoutMode("full-height");

  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") || "company";

  const handleTabChange = (value: string) => {
    router.push(`/admin/system?tab=${value}`);
  };

  const isFullPage = FULL_PAGE_TABS.includes(currentTab);

  // Full-page mode for certain tabs (like PDF Fields)
  if (isFullPage) {
    return (
      <div className="flex flex-col h-full -m-4 -mb-16">
        {/* Minimal header with back button */}
        <div className="shrink-0 px-2 py-0.5 border-b bg-background flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/system?tab=company')}
            className="h-5 text-[10px] px-1"
          >
            ← Back
          </Button>
          <span className="text-[10px] text-muted-foreground">PDF Fields</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PdfFieldsTab />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">System Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure system settings, integrations, and developer tools
        </p>
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 justify-start shrink-0">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                ref={(el) => {
                  // Auto-scroll active tab into view on mount
                  if (isActive && el) {
                    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                  }
                }}
                className="text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5 data-[state=active]:bg-background"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-4 flex-1 min-h-0 [&>*]:h-full [&>*[data-state=inactive]]:hidden">
          <TabsContent value="company" className="overflow-auto">
            <CompanySettingsTab />
          </TabsContent>
          <TabsContent value="warehouse" className="flex-1 min-h-0 overflow-auto">
            <WarehouseTab />
          </TabsContent>
          <TabsContent value="brand-guidelines" className="flex-1 min-h-0 overflow-auto">
            <BrandGuidelinesTab />
          </TabsContent>
          <TabsContent value="contact-types" className="flex-1 min-h-0 overflow-auto">
            <ContactTypesTab />
          </TabsContent>
          <TabsContent value="plans" className="flex-1 min-h-0 overflow-auto">
            <PlansTab />
          </TabsContent>
          <TabsContent value="schedule-master" className="flex-1 min-h-0 overflow-auto">
            <ScheduleMasterTab />
          </TabsContent>
          <TabsContent value="meeting-types" className="flex-1 min-h-0 overflow-auto">
            <MeetingTypesTab />
          </TabsContent>
          <TabsContent value="whs" className="flex-1 min-h-0 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle>Workplace Health & Safety</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Configure WHS templates, settings, and compliance requirements for Queensland construction projects.
                </p>

                <div className="space-y-4">
                  <h3 className="font-semibold">WHS Modules</h3>
                  <div className="space-y-2">
                    <Link href="/whs/swms" className="flex items-center gap-2 text-primary hover:underline">
                      <FileText className="h-5 w-5" />
                      SWMS Management
                    </Link>
                    <Link href="/whs/inspections" className="flex items-center gap-2 text-primary hover:underline">
                      <ClipboardCheck className="h-5 w-5" />
                      Site Inspections & Templates
                    </Link>
                    <Link href="/whs/incidents" className="flex items-center gap-2 text-primary hover:underline">
                      <ShieldCheck className="h-5 w-5" />
                      Incident Reporting
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="financial" className="flex-1 min-h-0 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle>Financial Tracking & Reporting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Track income and expenses, generate financial reports, and export data for your accountant.
                </p>

                <div className="space-y-4">
                  <h3 className="font-semibold">Financial Modules</h3>
                  <div className="space-y-2">
                    <Link href="/financial" className="flex items-center gap-2 text-primary hover:underline">
                      <Banknote className="h-5 w-5" />
                      Transactions (Income & Expenses)
                    </Link>
                    <Link href="/financial" className="flex items-center gap-2 text-primary hover:underline">
                      <BarChart className="h-5 w-5" />
                      Financial Reports
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="pricebook" className="flex-1 min-h-0 overflow-auto">
            <PlaceholderTab title="Price Book" description="Price book configuration" />
          </TabsContent>
          <TabsContent value="supervisor-checklist" className="flex-1 min-h-0 overflow-auto">
            <SupervisorChecklistTab />
          </TabsContent>
          <TabsContent value="components" className="flex flex-col overflow-hidden -mx-4">
            <GoldStandardTab />
          </TabsContent>
          <TabsContent value="developer-tools" className="flex-1 min-h-0 overflow-auto">
            <DeveloperToolsTab />
          </TabsContent>
          <TabsContent value="navigation" className="flex-1 min-h-0 overflow-auto">
            <NavigationTab />
          </TabsContent>
          <TabsContent value="entity-config" className="flex-1 min-h-0 overflow-auto">
            <EntityConfigurationTab onClose={() => handleTabChange("company")} />
          </TabsContent>
          <TabsContent value="user-manual" className="flex-1 min-h-0 overflow-auto">
            <UserManualTab />
          </TabsContent>
          <TabsContent value="inspiring-quotes" className="flex-1 min-h-0 overflow-auto">
            <InspiringQuotesTab />
          </TabsContent>
          <TabsContent value="performance" className="flex-1 min-h-0 overflow-auto">
            <PerformanceTab />
          </TabsContent>
          <TabsContent value="scheduled-jobs" className="flex-1 min-h-0 overflow-auto">
            <ScheduledJobsTab />
          </TabsContent>
          <TabsContent value="email-accounts" className="min-h-0">
            <EmailAccountsTab />
          </TabsContent>
          <TabsContent value="pdf-fields" className="flex-1 min-h-0 overflow-auto">
            <PdfFieldsTab />
          </TabsContent>

          <TabsContent value="ai-processing" className="flex-1 min-h-0 overflow-auto">
            <AiProcessingTab />
          </TabsContent>
          <TabsContent value="xero-health" className="flex-1 min-h-0 overflow-auto">
            <XeroHealthTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SystemAdminPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">System Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system settings, integrations, and developer tools
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <SystemAdminPageContent />
    </Suspense>
  );
}
