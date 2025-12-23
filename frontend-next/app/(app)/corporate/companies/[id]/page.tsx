"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  DollarSign,
  Edit,
  Loader2,
  Briefcase,
  Heart,
  Landmark,
  FolderOpen,
  Banknote,
  Save,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
// Extracted components (Phase 4 migration)
import { CompanyDocumentsTab } from "@/components/corporate/CompanyDocumentsTab";
import { ATOSetupCard } from "@/components/corporate/ATOSetupCard";

// Dynamic tab rendering (SSoT: lib/tab-component-registry.ts)
// Individual components are lazy-loaded via OverviewTabRenderer and XeroTabRenderer
import { OverviewTabRenderer } from "@/components/corporate/OverviewTabRenderer";
import { XeroTabRenderer } from "@/components/xero/XeroTabRenderer";
// ActivityTab is used for main "activity-main" tab (not overview sub-tab)
import { ActivityTab } from "@/components/tabs";
// Shared types for corporate entities (SSoT for Company type)
import type { CorporateCompany } from "@/lib/types/corporate";

// SSoT: Using unified EntityTabs API directly (Phase 5 - no adapter hooks)
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { getIcon } from "@/lib/icon-map";

// =============================================================================
// TAB CONFIGURATION
// SSoT: GET /api/v1/entity_tabs?scope=corporate_entity (EntityTab model)
// Xero tabs are children of the Xero tab in corporate_entity scope (SSoT)
// Manage via: Admin > System > Entity Configuration
// Phase 5 Migration: Using XeroTabRenderer for dynamic Xero tab rendering
// =============================================================================

// SSoT: All tabs come from API only (EntityTabs database)
// NO FALLBACK ARRAYS - if API fails, show error so we can fix it
// Manage tabs via: Admin > System > Entity Configuration

// Company type alias - SSoT: CorporateCompany from @/lib/types/corporate
type Company = CorporateCompany;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

// NOTE: CompanyDocumentsTab and ATOSetupCard extracted to /components/corporate/
// See: CompanyDocumentsTab.tsx, ATOSetupCard.tsx

export default function CompanyDetailPage() {
  useSetLayoutMode("full-height");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [overviewSubTab, setOverviewSubTab] = React.useState("info");

  // Company edit sheet state
  const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    name: "",
    acn: "",
    abn: "",
    status: "",
    entity_type: "",
    date_incorporated: "",
    registered_office_address: "",
    principal_place_of_business: "",
    purpose: "",
  });

  // Company edit handlers
  const openEditSheet = () => {
    if (company) {
      setEditFormData({
        name: company.name || "",
        acn: company.acn || "",
        abn: company.abn || "",
        status: company.status || "active",
        entity_type: company.entity_type || "Company",
        date_incorporated: company.date_incorporated || "",
        registered_office_address: company.registered_office_address || "",
        principal_place_of_business: company.principal_place_of_business || "",
        purpose: company.purpose || "",
      });
      setIsEditSheetOpen(true);
    }
  };

  const handleSaveCompany = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/api/v1/companies/${companyId}`, { company: editFormData });
      setIsEditSheetOpen(false);
      loadCompany();
    } catch (error) {
      console.error("Failed to save company:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const [documentCounts, setDocumentCounts] = React.useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = React.useState<{ score: number; status: string } | null>(null);

  // SSoT: Entity type normalization for tab filtering
  const normalizedEntityType = React.useMemo(() => {
    if (!company) return undefined;
    const entityType = company.entity_type || "Company";
    // Normalize entity type (handle lowercase from legacy data)
    if (entityType.toLowerCase() === "company") return "Company";
    if (entityType.toLowerCase() === "trust") return "Trust";
    if (entityType.toLowerCase() === "superfund") return "Superfund";
    if (entityType.toLowerCase() === "charity") return "Charity";
    return entityType;
  }, [company]);

  // SSoT: Using unified EntityTabs API directly (Phase 5 - no adapter hooks)
  const { tabs: entityTabs } = useEntityTabs({
    scope: "corporate_entity",
    entityType: normalizedEntityType,
  });

  // Split tabs by group - SSoT: tab_group field from EntityTabs database
  const entityOverviewTabs = React.useMemo(() => {
    return entityTabs
      .filter((t) => t.tab_group === "overview")
      .map((t) => ({ id: t.tab_key, name: t.display_name }));
  }, [entityTabs]);

  const documentFolderTabs = React.useMemo(() => {
    return entityTabs
      .filter((t) => t.tab_group === "documents")
      .map((t) => {
        // Some tabs need "-docs" suffix to avoid conflicts with other tabs
        const needsDocsSuffix = ["assets", "dividends", "loans", "minutes"].includes(t.tab_key);
        return {
          id: needsDocsSuffix ? `${t.tab_key}-docs` : t.tab_key,
          name: t.display_name,
          icon: t.icon_name,
        };
      });
  }, [entityTabs]);

  const entityMainTabs = React.useMemo(() => {
    return entityTabs
      .filter((t) => t.tab_group === "main")
      .map((t) => ({
        id: t.tab_key,
        name: t.display_name,
        icon: t.icon_name,
        component: t.component_name,
      }));
  }, [entityTabs]);

  // Map folder names to icons
  const getFolderIcon = (folderName: string) => {
    const iconMap: Record<string, any> = {
      'ADVICE': Briefcase,
      'ASIC': FileText,
      'ASSETS': Briefcase,
      'ATO': FileText,
      'BANK': Landmark,
      'XERO': RefreshCw,
      'COMPANY': Building2,
      'DIVIDENDS': DollarSign,
      'FINANCIALS': FileText,
      'GENERAL': FolderOpen,
      'INSURANCE': Heart,
      'LOANS': Banknote,
      'MINUTES': FileText,
      'REGISTRY': FileText,
      'TRUST': Users,
      'PAYROLL': DollarSign,
      'SUPERANNUATION': DollarSign,
      'CONTRACTS': FileText,
      'COMPLIANCE': CheckCircle,
    };
    return iconMap[folderName] || FileText;
  };

  // REMOVED: loadEntityTabs - now using useEntityTabs hook directly (SSoT)
  // REMOVED: loadXeroTabs - now using XeroTabRenderer with useEntityTabs (SSoT)

  // Load company details
  const loadCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; company: Company }>(
        `/api/v1/companies/${companyId}`
      );
      setCompany(response.company);
      // SSoT: Entity tabs now loaded via useEntityTabs hook directly (Phase 5)
      // The hook automatically refetches when company.entity_type changes
    } catch (error) {
      console.error("Failed to load company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load document counts for tabs
  const loadDocumentCounts = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; counts: Record<string, number> }>(
        `/api/v1/company_documents/counts`,
        { params: { company_id: companyId } }
      );
      setDocumentCounts(response.counts || {});
    } catch (error) {
      console.error("Failed to load document counts:", error);
    }
  }, [companyId]);

  // Load health score for header badge (fast endpoint - loads only this company)
  const loadHealthScore = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; health: { health_score: number; health_status: string } }>(
        `/api/v1/companies/${companyId}/health`
      );
      if (response.health) {
        setHealthScore({ score: response.health.health_score, status: response.health.health_status });
      }
    } catch (error) {
      console.error("Failed to load health score:", error);
    }
  }, [companyId]);

  // SSoT: Document tabs from API only (EntityTabs database, group: documents)
  // Convert string icon names to Lucide components
  const computedDocumentTabs = React.useMemo(() => {
    return documentFolderTabs.map(tab => ({
      ...tab,
      icon: tab.id === "xero" ? RefreshCw : getFolderIcon(tab.name.toUpperCase()),
    }));
  }, [documentFolderTabs]);

  // SSoT: Overview sub-tabs from CorporateEntityTab API only
  // Returns entity-specific tabs (e.g., Company gets Directors/Shareholdings, Charity gets Directors/Members)
  // No fallback - database is SSoT via Admin > System > Entity Configuration
  const computedOverviewTabs = React.useMemo(() => {
    return entityOverviewTabs;
  }, [entityOverviewTabs]);

  React.useEffect(() => {
    loadCompany();
    loadDocumentCounts();
    loadHealthScore();
    // SSoT: Xero tabs now rendered via XeroTabRenderer (Phase 5)
  }, [loadCompany, loadDocumentCounts, loadHealthScore]);

  // Handle tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    // Redirect Data tab to data warehouse page with company filter
    if (tabId === "data-main") {
      router.push(`/data-warehouse?company_id=${companyId}`);
      return;
    }
    setActiveTab(tabId);
    router.push(`/corporate/companies/${companyId}?tab=${tabId}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "deregistered":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getCompanyGroup = () => {
    if (typeof company.company_group === "string") {
      return company.company_group.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return company.company_group?.name || company.group_name || null;
  };

  const getSharePointUrl = () => {
    if (company.sharepoint_folder_url) return company.sharepoint_folder_url;
    return "https://gotekna-my.sharepoint.com/personal/robert_tekna_com_au/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Frobert%5Ftekna%5Fcom%5Fau%2FDocuments%2FAccounts%20%2D%20Internal%2FCorporate%20File";
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Sticky header and tabs - matches Job detail page layout */}
      <div className="sticky top-0 z-10 bg-background">
        {/* Header row - no card, inline back button like job detail */}
        <div className="px-3 pb-2 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/corporate")} className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-serif">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {company.formatted_acn && (
                  <span className="text-sm text-muted-foreground">ACN: {company.formatted_acn}</span>
                )}
                {company.formatted_abn && (
                  <>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">ABN: {company.formatted_abn}</span>
                  </>
                )}
                {getCompanyGroup() && (
                  <>
                    <span className="text-sm text-muted-foreground">·</span>
                    <Badge variant="secondary">{getCompanyGroup()}</Badge>
                  </>
                )}
                <Badge className={getStatusColor(company.status)}>
                  {company.status || "active"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Health Score Badge */}
            {healthScore && (
              <button
                onClick={() => {
                  setActiveTab("overview");
                  setOverviewSubTab("health");
                }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted",
                  healthScore.status === "excellent" && "text-green-700 dark:text-green-300",
                  healthScore.status === "good" && "text-blue-700 dark:text-blue-300",
                  healthScore.status === "needs_attention" && "text-yellow-700 dark:text-yellow-300",
                  healthScore.status === "critical" && "text-red-700 dark:text-red-300"
                )}
              >
                <span className="font-semibold">{healthScore.score}%</span>
                <span className="text-xs text-muted-foreground uppercase">Health</span>
              </button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={getSharePointUrl()} target="_blank" rel="noopener noreferrer">
                <FolderOpen className="h-4 w-4 mr-2" />
                SharePoint
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={openEditSheet}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Main Tabs - inside sticky header */}
        {/* SSoT: Main tabs (Overview) from API, document tabs from API */}
        <div className="border-b px-3 shrink-0">
        <div className="flex flex-wrap gap-1 pb-2">
          {/* Main tabs from API (Overview, etc.) - SSoT: tab_group='main' */}
          {entityMainTabs.map((tab) => {
            const Icon = tab.icon ? getIcon(tab.icon) : Building2;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
          {/* Fallback Overview button if API hasn't loaded main tabs yet */}
          {entityMainTabs.length === 0 && (
            <button
              onClick={() => handleTabChange("overview")}
              className={cn(
                "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Overview
            </button>
          )}
          {computedDocumentTabs.map((tab) => {
            const Icon = tab.icon;
            // Map tab id to count key (handle naming differences)
            const countKey = tab.id === "assets-docs" ? "assets-docs" :
                            tab.id === "dividends-docs" ? "dividends-docs" :
                            tab.id === "loans-docs" ? "loans-docs" :
                            tab.id === "minutes-docs" ? "minutes-docs" :
                            tab.id;
            const count = documentCounts[countKey] || 0;
            const showCount = !["documents-main", "data-main", "activity-main"].includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
                {showCount && count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Tab Content - scrollable area below sticky header */}
      <div className="flex-1 min-h-0 px-3 pb-3 overflow-auto">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Sub-tabs - SSoT: From CorporateEntityTab API based on entity type */}
              <div className="border-b">
                <nav className="-mb-px flex gap-6">
                  {computedOverviewTabs.map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setOverviewSubTab(subTab.id)}
                      className={cn(
                        "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                        overviewSubTab === subTab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {subTab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Overview Sub-tab Content - Dynamic rendering from registry */}
              <OverviewTabRenderer
                tabKey={overviewSubTab}
                company={company}
                companyId={companyId}
                onUpdate={loadCompany}
                renderInfoPrefix={<ATOSetupCard company={company} />}
              />
            </div>
          )}

          {/* XERO Tab - Dynamic rendering via XeroTabRenderer (SSoT) */}
          {activeTab === "xero" && company && (
            <XeroTabRenderer
              companyId={companyId}
              companyName={company?.name}
              company={company}
              onRefresh={loadCompany}
              DocumentsTabComponent={CompanyDocumentsTab}
            />
          )}

          {/* Document Category Tabs */}
          {computedDocumentTabs.find(t => t.id === activeTab)?.name && activeTab !== "activity-main" && activeTab !== "documents-main" && activeTab !== "data-main" && activeTab !== "xero" && (
            <>
              <CompanyDocumentsTab
                companyId={companyId}
                company={company}
                category={computedDocumentTabs.find(t => t.id === activeTab)?.name}
              />
            </>
          )}

          {activeTab === "documents-main" && (
            <CompanyDocumentsTab companyId={companyId} company={company} category="all" />
          )}
          {/* Data tab redirects to /admin/system?tab=data-warehouse&company_id={id} */}
          {activeTab === "activity-main" && <ActivityTab />}
      </div>

      {/* Company Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Company</SheetTitle>
            <SheetDescription>
              Update company details. Changes will be saved immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Company Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-acn">ACN</Label>
                <Input
                  id="edit-acn"
                  value={editFormData.acn}
                  onChange={(e) => setEditFormData({ ...editFormData, acn: e.target.value })}
                  placeholder="000 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-abn">ABN</Label>
                <Input
                  id="edit-abn"
                  value={editFormData.abn}
                  onChange={(e) => setEditFormData({ ...editFormData, abn: e.target.value })}
                  placeholder="00 000 000 000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deregistered">Deregistered</SelectItem>
                    <SelectItem value="struck_off">Struck Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-entity-type">Entity Type</Label>
                <Select
                  value={editFormData.entity_type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, entity_type: value })}
                >
                  <SelectTrigger id="edit-entity-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                    <SelectItem value="Superfund">Superfund</SelectItem>
                    <SelectItem value="Charity">Charity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date-incorporated">Date Incorporated</Label>
              <Input
                id="edit-date-incorporated"
                type="date"
                value={editFormData.date_incorporated}
                onChange={(e) => setEditFormData({ ...editFormData, date_incorporated: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-registered-office">Registered Office Address</Label>
              <Textarea
                id="edit-registered-office"
                value={editFormData.registered_office_address}
                onChange={(e) => setEditFormData({ ...editFormData, registered_office_address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ppob">Principal Place of Business</Label>
              <Textarea
                id="edit-ppob"
                value={editFormData.principal_place_of_business}
                onChange={(e) => setEditFormData({ ...editFormData, principal_place_of_business: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purpose">Purpose</Label>
              <Textarea
                id="edit-purpose"
                value={editFormData.purpose}
                onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                rows={3}
                placeholder="Company purpose or activities..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCompany} disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
