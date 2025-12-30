"use client";

import * as React from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
// useSetLayoutMode moved to layout.tsx to prevent double flash
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { HierarchicalTabsList } from "@/components/ui/hierarchical-tabs-list";
// SSoT: Using unified EntityTabs API directly (Phase 5 - no adapter hooks)
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import {
  Phone,
  Mail,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  ShoppingCart,
  Cloud,
  MessageSquare,
  Settings,
  ClipboardList,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardCheck,
  Pencil,
  Save,
  X,
  FileSignature,
  Palette,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SortableList, SortableItem, DragHandle, reorderByPosition } from "@/components/ui/dnd";
import { useUserTabPreferences } from "@/lib/hooks/useUserTabPreferences";
import { api } from "@/lib/api";
import { DEBOUNCE_SEARCH_MS } from "@/lib/constants/timeout-constants";
import { safePercent } from "@/lib/utils";
import dynamic from "next/dynamic";
import { JobActivityTab } from "@/components/jobs/JobActivityTab";
import { JobContractTab } from "@/components/jobs/JobContractTab";
import { JobPeopleTab } from "@/components/jobs/JobPeopleTab";
import { RainLogTab } from "@/components/jobs/RainLogTab";
import { JobDocumentsTab } from "@/components/jobs/JobDocumentsTab";
import { JobPlansTab } from "@/components/jobs/JobPlansTab";
import { JobPurchaseOrdersTab } from "@/components/jobs/JobPurchaseOrdersTab";
import { JobEstimatorTab } from "@/components/jobs/JobEstimatorTab";
import { JobBudgetTab } from "@/components/jobs/JobBudgetTab";
import { JobBOQTab } from "@/components/jobs/JobBOQTab";
import { JobCommunicationsTab } from "@/components/jobs/JobCommunicationsTab";
import { JobProfitTab } from "@/components/jobs/JobProfitTab";
import { JobClaimStagesTab } from "@/components/jobs/JobClaimStagesTab";
import { JobScheduleTab } from "@/components/jobs/JobScheduleTab";
import { JobSitePresenceTab } from "@/components/jobs/JobSitePresenceTab";
import { RevitTab } from "@/components/jobs/RevitTab";
import { ColourSelectionBuilder } from "@/components/colours/ColourSelectionBuilder";
import { SpecificationBuilder } from "@/components/specifications/SpecificationBuilder";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityTab } from "@/lib/types/entity-tabs";

// =============================================================================
// REQUEST DEDUPLICATION - Prevents duplicate API calls that cause screen flashing
// =============================================================================
// Module-level cache for in-flight job requests. If the same job is requested
// while a fetch is in progress, reuse the existing promise instead of making
// a duplicate request.
// =============================================================================
const jobRequestCache = new Map<string, Promise<Job>>();

// SSoT: Job Tab Component Registry
// Maps tab_key → component. When tabs are renamed in admin, they auto-work.
// Special tabs (overview, whs, plans) have inline JSX and are excluded.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JOB_TAB_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "contract": JobContractTab,
  "specifications": SpecificationBuilder,
  "colours": ColourSelectionBuilder,
  "claims": JobClaimStagesTab,
  "profit": JobProfitTab,
  "budget": JobBudgetTab,
  "people": JobPeopleTab,
  "purchase-orders": JobPurchaseOrdersTab,
  "estimates": JobEstimatorTab,
  "boq": JobBOQTab,
  "activity": JobActivityTab,
  "schedule": JobScheduleTab,
  "site-presence": JobSitePresenceTab,
  "rain-log": RainLogTab,
  "documents": JobDocumentsTab,
  "coms": JobCommunicationsTab,
  "revit": RevitTab,
  "revit-dwg": RevitTab,
};

// Tabs that need special rendering (complex inline JSX or special behavior)
const SPECIAL_TABS = ["overview", "whs", "plans"];

// Dynamically import LocationMap to avoid SSR issues with Leaflet
const LocationMap = dynamic(
  () => import("@/components/jobs/LocationMap").then((mod) => mod.LocationMap),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" /> }
);

interface JobContact {
  id: number;
  contact_id: number;
  primary: boolean;
  role: string;
  contact: {
    id: number;
    display_name: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_phone?: string;
    company_name_or_trust?: string;
  };
}

interface Job {
  id: number;
  name: string;
  status: string;
  stage: string;
  job_type?: { id: number; name: string; icon?: string };
  job_type_id?: number;
  job_status?: { id: number; name: string; color?: string };
  job_status_id?: number;
  job_stage?: { id: number; name: string };
  job_stage_id?: number;
  contract_value: number;
  live_profit: number;
  profit_percentage: number;
  certifier_job_no?: string;
  xero_tracking_option_id?: string;
  xero_tracking_option_name?: string;
  start_date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  lot_number?: string;
  street_number?: string;
  street_name?: string;
  street_type?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  council?: string;
  site_supervisor_name?: string;
  site_supervisor_email?: string;
  site_supervisor_phone?: string;
  // Contract fields
  plan_number?: string;
  contract_price?: number;
  deposit?: number;
  prime_cost?: number;
  provisional_sums?: number;
  contract_date?: string;
  // Build schedule
  build_period?: string;
  stage_slab?: string;
  stage_frame?: string;
  stage_enclosed?: string;
  stage_fixing?: string;
  stage_practical?: string;
  stage_weather?: string;
  weekend_work?: string;
  // Important dates
  plan_date?: string;
  spec_date?: string;
  practical_completion_date?: string;
  warranty_end_date?: string;
  contacts?: JobContact[];
  estimator_analysis?: {
    job_summary?: string;
    key_points?: string[];
    estimated_scope?: {
      complexity?: string;
      duration_estimate?: string;
      key_trades?: string[];
      major_materials?: string[];
      potential_challenges?: string[];
    };
    recommendations?: string[];
    source?: string;
  };
}

interface JobType {
  id: number;
  name: string;
  icon?: string;
}

interface JobStatus {
  id: number;
  name: string;
  color?: string;
}

interface JobStage {
  id: number;
  name: string;
}

// Static tabs removed - now using dynamic tabs from useJobTabs hook

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStageBadgeVariant(stage: string): "default" | "secondary" | "outline" {
  switch (stage?.toLowerCase()) {
    case "construction":
      return "default";
    case "planning":
    case "design":
      return "secondary";
    default:
      return "outline";
  }
}


// Suburb search interface
interface SuburbSearchResult {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
}

// Editable Address Details Card
function AddressDetailsCard({
  job,
  onSave,
}: {
  job: Job;
  onSave: (addressData: {
    lot_number?: string;
    plan_number?: string;
    street_number?: string;
    street_name?: string;
    street_type?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
    council?: string;
  }) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    lot_number: job.lot_number || "",
    plan_number: job.plan_number || "",
    street_number: job.street_number || "",
    street_name: job.street_name || "",
    street_type: job.street_type || "",
    suburb: job.suburb || "",
    postcode: job.postcode || "",
    state: job.state || "",
    council: job.council || "",
  });

  // Suburb search state
  const [suburbSearchQuery, setSuburbSearchQuery] = React.useState("");
  const [suburbSearchResults, setSuburbSearchResults] = React.useState<SuburbSearchResult[]>([]);
  const [suburbSearchLoading, setSuburbSearchLoading] = React.useState(false);
  const [showSuburbDropdown, setShowSuburbDropdown] = React.useState(false);
  const suburbInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Search suburbs when query changes
  React.useEffect(() => {
    const searchSuburbs = async () => {
      if (suburbSearchQuery.length < 2) {
        setSuburbSearchResults([]);
        return;
      }

      setSuburbSearchLoading(true);
      try {
        const response = await api.get<{ suburbs: SuburbSearchResult[] }>(
          `/api/v1/suburbs/search?q=${encodeURIComponent(suburbSearchQuery)}`
        );
        setSuburbSearchResults(response.suburbs || []);
      } catch (error) {
        console.error("Failed to search suburbs:", error);
        setSuburbSearchResults([]);
      } finally {
        setSuburbSearchLoading(false);
      }
    };

    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    const timeoutId = setTimeout(searchSuburbs, DEBOUNCE_SEARCH_MS);
    return () => clearTimeout(timeoutId);
  }, [suburbSearchQuery]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        suburbInputRef.current &&
        !suburbInputRef.current.contains(event.target as Node)
      ) {
        setShowSuburbDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuburbSelect = (suburb: SuburbSearchResult) => {
    setEditForm({
      ...editForm,
      suburb: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      council: suburb.council || "",
    });
    setSuburbSearchQuery("");
    setShowSuburbDropdown(false);
  };

  // Sync form when job prop changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditForm({
        lot_number: job.lot_number || "",
        plan_number: job.plan_number || "",
        street_number: job.street_number || "",
        street_name: job.street_name || "",
        street_type: job.street_type || "",
        suburb: job.suburb || "",
        postcode: job.postcode || "",
        state: job.state || "",
        council: job.council || "",
      });
    }
  }, [job, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editForm);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save address:", error);
      // Reset form on error
      setEditForm({
        lot_number: job.lot_number || "",
        plan_number: job.plan_number || "",
        street_number: job.street_number || "",
        street_name: job.street_name || "",
        street_type: job.street_type || "",
        suburb: job.suburb || "",
        postcode: job.postcode || "",
        state: job.state || "",
        council: job.council || "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      lot_number: job.lot_number || "",
      plan_number: job.plan_number || "",
      street_number: job.street_number || "",
      street_name: job.street_name || "",
      street_type: job.street_type || "",
      suburb: job.suburb || "",
      postcode: job.postcode || "",
      state: job.state || "",
      council: job.council || "",
    });
    setSuburbSearchQuery("");
    setShowSuburbDropdown(false);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Address Details</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {isEditing ? "Edit address manually or use the map above" : "Use the map above to search and select an address"}
            </p>
          </div>
          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Spinner size={12} className="mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-3 w-3 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Site/Land Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lot-number">Lot Number</Label>
            <Input
              id="lot-number"
              value={editForm.lot_number}
              onChange={(e) => setEditForm({ ...editForm, lot_number: e.target.value })}
              readOnly={!isEditing}
              placeholder="e.g., 5"
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>
          <div>
            <Label htmlFor="plan-number">Plan Number (RP/SP)</Label>
            <Input
              id="plan-number"
              value={editForm.plan_number}
              onChange={(e) => setEditForm({ ...editForm, plan_number: e.target.value })}
              readOnly={!isEditing}
              placeholder="e.g., RP123456"
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>
        </div>

        {/* Street Address */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="street-number">Street Number</Label>
            <Input
              id="street-number"
              value={editForm.street_number}
              onChange={(e) => setEditForm({ ...editForm, street_number: e.target.value })}
              readOnly={!isEditing}
              placeholder="e.g., 123"
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>
          <div>
            <Label htmlFor="street-name">Street Name</Label>
            <Input
              id="street-name"
              value={editForm.street_name}
              onChange={(e) => setEditForm({ ...editForm, street_name: e.target.value })}
              readOnly={!isEditing}
              placeholder="e.g., Alperton"
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>
          <div>
            <Label htmlFor="street-type">Street Type</Label>
            <Input
              id="street-type"
              value={editForm.street_type}
              onChange={(e) => setEditForm({ ...editForm, street_type: e.target.value })}
              readOnly={!isEditing}
              placeholder="e.g., Road"
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>
        </div>

        <div className="relative">
          <Label htmlFor="suburb">Suburb</Label>
          {isEditing ? (
            <div className="relative">
              <Input
                ref={suburbInputRef}
                id="suburb"
                value={suburbSearchQuery || editForm.suburb}
                onChange={(e) => {
                  setSuburbSearchQuery(e.target.value);
                  setShowSuburbDropdown(true);
                  // Also update the form directly if typing
                  setEditForm({ ...editForm, suburb: e.target.value });
                }}
                onFocus={() => {
                  if (suburbSearchQuery.length >= 2 || editForm.suburb.length >= 2) {
                    setShowSuburbDropdown(true);
                  }
                }}
                placeholder="Search suburb or postcode..."
                autoComplete="off"
              />
              {/* Suburb search dropdown */}
              {showSuburbDropdown && (suburbSearchResults.length > 0 || suburbSearchLoading) && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
                >
                  {suburbSearchLoading ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      <Spinner size={16} className="inline mr-2" />
                      Searching...
                    </div>
                  ) : (
                    suburbSearchResults.map((suburb) => (
                      <button
                        key={suburb.id}
                        type="button"
                        onClick={() => handleSuburbSelect(suburb)}
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between text-sm"
                      >
                        <span>
                          <span className="font-medium">{suburb.name}</span>
                          <span className="text-muted-foreground ml-2">{suburb.postcode}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {suburb.state}
                          {suburb.council && (
                            <span className="ml-1 text-green-600 dark:text-green-400">
                              ({suburb.council.replace(" Council", "").replace(" Regional", "").replace(" City", "")})
                            </span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <Input
              id="suburb"
              value={editForm.suburb}
              readOnly
              placeholder="Enter suburb"
              className="bg-muted/50"
            />
          )}
          {isEditing && (
            <p className="text-xs text-muted-foreground mt-1">
              Type to search suburbs - selecting will auto-fill postcode, state and council
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={editForm.state}
              readOnly
              placeholder="Auto-filled from suburb"
              className="bg-muted/50"
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">Auto-filled from suburb</p>
            )}
          </div>
          <div>
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={editForm.postcode}
              readOnly
              placeholder="Auto-filled from suburb"
              className="bg-muted/50"
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">Auto-filled from suburb</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="council">Local Authority (Council)</Label>
          <Input
            id="council"
            value={editForm.council || ""}
            readOnly
            placeholder="Auto-filled from suburb"
            className="bg-muted/50"
          />
          {isEditing && editForm.council && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Auto-filled from suburb lookup
            </p>
          )}
          {isEditing && !editForm.council && (
            <p className="text-xs text-muted-foreground mt-1">Auto-filled from suburb</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobDetailPage() {
  // Layout mode is now set in layout.tsx to prevent double flash on navigation
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Dynamic job tabs configuration - SSoT: unified EntityTabs API directly (Phase 5)
  const { tabs: jobTabs, loading: tabsLoading } = useEntityTabs({ scope: "job" });

  // User tab preferences (visibility, order, default tab)
  const {
    defaultTab: userDefaultTab,
    setDefaultTab,
    isTabHidden,
    toggleTab,
    tabOrder,
    setTabOrder,
  } = useUserTabPreferences("job");

  // Sort and filter tabs based on user preferences
  const orderedJobTabs = React.useMemo(() => {
    if (tabOrder.length === 0) return jobTabs;

    // Sort tabs by user's custom order, keeping unordered tabs at end
    const orderIndex: Record<string, number> = {};
    tabOrder.forEach((key, idx) => { orderIndex[key] = idx; });
    return [...jobTabs].sort((a, b) => {
      const orderA = orderIndex[a.tab_key] ?? 999;
      const orderB = orderIndex[b.tab_key] ?? 999;
      return orderA - orderB;
    });
  }, [jobTabs, tabOrder]);

  // Filter tabs based on visibility preferences
  const visibleJobTabs = React.useMemo(() => {
    return orderedJobTabs
      .filter((tab) => !isTabHidden(tab.tab_key))
      .map((tab) => ({
        ...tab,
        children: tab.children?.filter((child) => !isTabHidden(child.tab_key)),
      }));
  }, [orderedJobTabs, isTabHidden]);

  // Handle tab reorder from drag and drop
  const handleTabReorder = React.useCallback((newOrder: typeof jobTabs) => {
    const newTabOrder = newOrder.map((tab) => tab.tab_key);
    setTabOrder(newTabOrder);
  }, [setTabOrder]);

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Partial<Job>>({});
  const [saving, setSaving] = React.useState(false);

  // Lookup data for dropdowns
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);
  const [lookupLoading, setLookupLoading] = React.useState(false);

  // Xero tracking category state
  const [xeroTrackingOptions, setXeroTrackingOptions] = React.useState<{id: string, name: string}[]>([]);
  const [currentXeroOption, setCurrentXeroOption] = React.useState<{id: string, name: string} | null>(null);
  const [suggestedXeroMatch, setSuggestedXeroMatch] = React.useState<{id: string, name: string} | null>(null);
  const [linkingXero, setLinkingXero] = React.useState(false);

  // Get tab from URL - URL is SSoT for tab state (back button support)
  // Uses path-based structure: /jobs/{id}/{parent}/{child} for hierarchical tabs
  // Parse: /jobs/123/photo/site → { parent: "photo", child: "site" }
  const pathSegments = React.useMemo(() => {
    // Remove /jobs/{id} prefix and split remaining path
    const parts = pathname.replace(/^\/jobs\/[^/]+/, "").split("/").filter(Boolean);
    // Skip "edit" as it's handled separately
    if (parts[0] === "edit") {
      return { parent: null, child: null };
    }
    return {
      parent: parts[0] || null,
      child: parts[1] || null,
    };
  }, [pathname]);

  const tabFromUrl = pathSegments.parent;
  const subtabFromUrl = pathSegments.child;

  // Auto-redirect to default tab if no tab in URL (ensures URL reflects state for back button)
  React.useEffect(() => {
    if (!tabFromUrl && !tabsLoading && visibleJobTabs.length > 0) {
      const defaultTab = userDefaultTab || "overview";
      // Use replace to not add to history stack (user just opened the page)
      router.replace(`/jobs/${jobId}/${defaultTab}`, { scroll: false });
    }
  }, [tabFromUrl, tabsLoading, visibleJobTabs.length, userDefaultTab, jobId, router]);

  // Helper: find first enabled child of a parent tab
  const findFirstChildTab = React.useCallback((tabKey: string): string | null => {
    const parentTab = visibleJobTabs.find(t => t.tab_key === tabKey);
    if (parentTab?.children?.length) {
      const firstEnabledChild = parentTab.children.find(c => c.enabled);
      return firstEnabledChild?.tab_key || null;
    }
    return null;
  }, [visibleJobTabs]);

  // Helper: find parent of a child tab
  const findParentOfTab = React.useCallback((tabKey: string): string | null => {
    for (const tab of visibleJobTabs) {
      if (tab.children?.some(child => child.tab_key === tabKey)) {
        return tab.tab_key;
      }
    }
    return null;
  }, [visibleJobTabs]);

  // Helper: check if a tab is a parent with children
  const isParentTab = React.useCallback((tabKey: string): boolean => {
    const tab = visibleJobTabs.find(t => t.tab_key === tabKey);
    return !!(tab?.children?.length);
  }, [visibleJobTabs]);

  // Determine active tab (parent level) and active subtab (child level)
  // URL format: ?tab=parent&subtab=child
  const { activeParentTab, activeChildTab } = React.useMemo(() => {
    // Default parent tab
    const defaultParent = userDefaultTab || "overview";

    if (!tabFromUrl) {
      // No URL params - use defaults
      return { activeParentTab: defaultParent, activeChildTab: null };
    }

    // ULTRA FIX: Check if tabFromUrl is a PARENT tab FIRST
    // This prevents false positives when a parent's tab_key matches another parent's child
    // (e.g., "photo" parent vs "photo" child under "site" parent)
    const isParent = visibleJobTabs.some(t => t.tab_key === tabFromUrl);
    if (isParent) {
      // tabFromUrl IS a parent tab - use it directly
      return { activeParentTab: tabFromUrl, activeChildTab: subtabFromUrl || null };
    }

    // tabFromUrl is NOT a parent - check if it's a child (legacy URL support)
    const parent = findParentOfTab(tabFromUrl);
    if (parent) {
      return { activeParentTab: parent, activeChildTab: tabFromUrl };
    }

    // Fallback to default
    return { activeParentTab: defaultParent, activeChildTab: null };
  }, [tabFromUrl, subtabFromUrl, userDefaultTab, findParentOfTab, visibleJobTabs]);

  // The actual tab value for the Tabs component
  // If there's an active child, use that; otherwise use the parent
  const activeTab = activeChildTab || activeParentTab;

  // Derive the effective tab to display (handles default without URL redirect)
  // SSoT: Uses composite keys (parent__child) for children to prevent tab_key collisions
  // e.g., URL ?tab=photo&subtab=site → effectiveActiveTab = "photo__site"
  const effectiveActiveTab = React.useMemo(() => {
    // If we have an explicit child tab, use composite key to prevent collision
    // e.g., parent "Site" (tab_key=site) vs child "Site" under Photo (also tab_key=site)
    if (activeChildTab) return `${activeParentTab}__${activeChildTab}`;

    // If parent tab has children, use first child with composite key
    if (visibleJobTabs.length > 0) {
      const firstChild = findFirstChildTab(activeParentTab);
      if (firstChild) return `${activeParentTab}__${firstChild}`;
    }

    // Otherwise use the parent tab itself
    return activeParentTab;
  }, [activeChildTab, activeParentTab, visibleJobTabs, findFirstChildTab]);

  // SSoT: Collect all tabs that should be dynamically rendered
  // Includes parent tabs + all children, excluding special tabs (overview, whs, plans)
  // Children get a compositeKey (parent__child) to prevent tab_key collisions
  const allDynamicTabs = React.useMemo(() => {
    const tabs: (EntityTab & { compositeKey?: string })[] = [];
    for (const tab of visibleJobTabs) {
      // Add parent tab if it has a registered component and isn't special
      if (!SPECIAL_TABS.includes(tab.tab_key) && JOB_TAB_COMPONENTS[tab.tab_key]) {
        tabs.push(tab);
      }
      // Add all children with composite keys (parent__child)
      // This prevents collision when multiple parents have children with same tab_key
      // e.g., parent "Site" has child "site" AND parent "Photo" has child "site"
      if (tab.children) {
        for (const child of tab.children) {
          if (!SPECIAL_TABS.includes(child.tab_key)) {
            tabs.push({
              ...child,
              compositeKey: `${tab.tab_key}__${child.tab_key}`,
            });
          }
        }
      }
    }
    return tabs;
  }, [visibleJobTabs]);

  // Update URL when tab changes - URL is SSoT
  // Uses path-based structure: /jobs/{id}/{parent}/{child}
  // Exception: "schedule" tab stays inline (doesn't navigate to /schedule page)
  const handleTabChange = React.useCallback((newTab: string) => {
    // SSoT: Handle composite keys (parent__child) from HierarchicalTabsList
    // This is the ONLY reliable way to identify which parent a child belongs to
    // when multiple parents have children with the same tab_key (e.g., "site")
    if (newTab.includes("__")) {
      const [parent, child] = newTab.split("__");
      router.push(`/jobs/${jobId}/${parent}/${child}`, { scroll: false });
    } else if (isParentTab(newTab)) {
      // Clicked a parent tab with children - auto-select first child
      const firstChild = findFirstChildTab(newTab);
      if (firstChild) {
        router.push(`/jobs/${jobId}/${newTab}/${firstChild}`, { scroll: false });
      } else {
        router.push(`/jobs/${jobId}/${newTab}`, { scroll: false });
      }
    } else {
      // Check if clicked tab is a child of some parent
      const parentOfClickedTab = findParentOfTab(newTab);
      if (parentOfClickedTab) {
        // Clicked a child tab - include parent in path
        router.push(`/jobs/${jobId}/${parentOfClickedTab}/${newTab}`, { scroll: false });
      } else {
        // Clicked a standalone tab (no children, not a child)
        router.push(`/jobs/${jobId}/${newTab}`, { scroll: false });
      }
    }
  }, [jobId, router, findParentOfTab, isParentTab, findFirstChildTab]);

  const loadJob = React.useCallback(async () => {
    try {
      // Deduplicate in-flight requests - if same job is already being fetched, reuse the promise
      const cacheKey = `job-${jobId}`;
      let requestPromise = jobRequestCache.get(cacheKey);

      if (!requestPromise) {
        requestPromise = api.get<Job>(`/api/v1/jobs/${jobId}`);
        jobRequestCache.set(cacheKey, requestPromise);
      }

      const data = await requestPromise;

      // Clean up cache after request completes
      jobRequestCache.delete(cacheKey);

      setJob(data);
    } catch (error) {
      // Clean up cache on error too
      jobRequestCache.delete(`job-${jobId}`);
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Load lookup data for dropdowns - only when editing starts
  const loadLookupData = React.useCallback(async () => {
    setLookupLoading(true);
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ job_stages: JobStage[] }>("/api/v1/job_stages"),
      ]);
      setJobTypes(typesRes?.job_types || []);
      setJobStatuses(statusesRes?.job_statuses || []);
      setJobStages(stagesRes?.job_stages || []);
    } catch (error) {
      console.error("Failed to load lookup data:", error);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // Load Xero tracking options for this job
  const loadXeroTrackingOptions = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await api.get<{
        success: boolean;
        tracking_options: {id: string, name: string}[];
        current_option: {id: string, name: string} | null;
        suggested_match: {id: string, name: string} | null;
      }>(`/api/v1/jobs/${jobId}/xero_tracking_options`);

      if (response?.success) {
        setXeroTrackingOptions(response.tracking_options || []);
        setCurrentXeroOption(response.current_option);
        setSuggestedXeroMatch(response.suggested_match);
      }
    } catch (error) {
      console.error("Failed to load Xero tracking options:", error);
    }
  }, [jobId]);

  // Link job to Xero tracking option
  const handleLinkXero = async (optionId: string, optionName: string) => {
    if (!job) return;
    setLinkingXero(true);
    try {
      await api.post(`/api/v1/jobs/${job.id}/link_xero_tracking`, {
        tracking_option_id: optionId,
        tracking_option_name: optionName,
      });
      setCurrentXeroOption({ id: optionId, name: optionName });
      setJob({ ...job, xero_tracking_option_id: optionId, xero_tracking_option_name: optionName });
    } catch (error) {
      console.error("Failed to link Xero tracking:", error);
    } finally {
      setLinkingXero(false);
    }
  };

  React.useEffect(() => {
    if (jobId) {
      loadJob();
      loadXeroTrackingOptions();
    }
  }, [jobId, loadJob, loadXeroTrackingOptions]);

  // SSoT: Auto-start editing when /edit is in path (e.g., from jobs list page)
  // Also supports legacy ?edit=true query param for backward compatibility
  React.useEffect(() => {
    const isEditPath = pathname.endsWith("/edit");
    const hasEditQueryParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "true";

    if ((isEditPath || hasEditQueryParam) && job && !loading && !isEditing) {
      // Populate form and start editing
      setEditForm({
        name: job.name,
        contract_value: job.contract_value,
        certifier_job_no: job.certifier_job_no,
        start_date: job.start_date,
        location: job.location,
        job_type_id: job.job_type?.id || job.job_type_id,
        job_status_id: job.job_status?.id || job.job_status_id,
        job_stage_id: job.job_stage?.id || job.job_stage_id,
      });
      setIsEditing(true);
      // Load dropdown data for editing
      if (jobTypes.length === 0) {
        loadLookupData();
      }
      // Clean up URL by removing /edit or ?edit=true
      const cleanPath = pathname.replace(/\/edit$/, "");
      window.history.replaceState({}, "", cleanPath);
    }
  }, [pathname, job, loading, isEditing, jobTypes.length, loadLookupData]);

  // Start editing - populate form with current values and load lookup data
  const startEditing = async () => {
    if (job) {
      setEditForm({
        name: job.name,
        contract_value: job.contract_value,
        certifier_job_no: job.certifier_job_no,
        start_date: job.start_date,
        location: job.location,
        job_type_id: job.job_type?.id || job.job_type_id,
        job_status_id: job.job_status?.id || job.job_status_id,
        job_stage_id: job.job_stage?.id || job.job_stage_id,
      });
      setIsEditing(true);
      // Load dropdown data only when editing
      if (jobTypes.length === 0) {
        loadLookupData();
      }
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  // Save changes
  const saveChanges = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const updatedJob = await api.patch<Job>(`/api/v1/jobs/${job.id}`, {
        job: editForm,
      });
      setJob({ ...job, ...updatedJob });
      setIsEditing(false);
      setEditForm({});
      // Reload to get fresh data with associations
      loadJob();
    } catch (error) {
      console.error("Failed to save job:", error);
    } finally {
      setSaving(false);
    }
  };

  // SSoT: Show skeleton layout during loading to prevent flash/CLS
  // The skeleton matches the actual page structure so there's no jarring layout shift
  if (loading || tabsLoading) {
    return (
      <div className="h-full flex flex-col overflow-auto">
        {/* Skeleton header */}
        <div className="sticky top-0 z-40 bg-background">
          <div className="px-3 pb-2">
            {/* Row 1: Back + Title + Buttons skeleton */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 shrink-0">
                <BackButton fallbackHref="/jobs" className="shrink-0" />
                <Skeleton className="h-8 w-48" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-7 w-28" />
              </div>
            </div>
            {/* Row 2: Metadata skeleton */}
            <div className="flex items-center gap-2 mt-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          {/* Tabs skeleton */}
          <div className="border-b px-3">
            <div className="flex gap-2 py-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <BackButton fallbackHref="/jobs" label="Back" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Job not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Sticky header and tabs */}
      <div className="sticky top-0 z-40 bg-background">
        {/* Header section - no pt-X, layout mode provides top padding */}
        <div className="px-3 pb-2">
          {/* Row 1: Title + Buttons */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title - name wins, takes priority */}
            <div className="flex items-center gap-4 shrink-0">
              <BackButton fallbackHref="/jobs" className="shrink-0" />
              <h1 className="text-2xl font-bold tracking-tight font-serif">{job.name}</h1>
            </div>
            {/* Right: Buttons - can shrink/overflow when name is long */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {/* Contract Value */}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-sm">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{formatCurrency(job.contract_price || job.contract_value || 0)}</span>
              </div>
              {/* Profit */}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-sm">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{formatCurrency(job.live_profit || 0)}</span>
                <span className="text-muted-foreground text-xs">({safePercent(job.profit_percentage)})</span>
              </div>
              <Button size="sm" className="h-auto py-0.5 px-2 text-sm" onClick={() => router.push(`/jobs/${jobId}/schedule/gantt`)}>
                Open Schedule
              </Button>
              {/* Tab Preferences Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Tab preferences">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2">
                  {/* Header row */}
                  <div className="flex items-center gap-1 px-2 pb-2 text-xs font-medium text-muted-foreground">
                    <span className="w-7 text-center">#</span>
                    <span className="flex-1">Tab</span>
                    <span className="w-8 text-center">Show</span>
                    <span className="w-8 text-center">1st</span>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Sortable tab rows */}
                  <RadioGroup
                    value={userDefaultTab || "overview"}
                    onValueChange={(value) => setDefaultTab(value)}
                    className="gap-0"
                  >
                    <SortableList
                      items={orderedJobTabs}
                      onReorder={handleTabReorder}
                      className="py-1"
                    >
                      {orderedJobTabs.map((tab, index) => (
                        <SortableItem
                          key={tab.id}
                          id={tab.id}
                          position={index + 1}
                          editableBadge
                          maxPosition={orderedJobTabs.length}
                          onPositionChange={(newPos) => {
                            const reordered = reorderByPosition(orderedJobTabs, tab.id, newPos);
                            handleTabReorder(reordered);
                          }}
                          showHandle={true}
                          actions={
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={!isTabHidden(tab.tab_key)}
                                onCheckedChange={() => toggleTab(tab.tab_key)}
                              />
                              <RadioGroupItem
                                value={tab.tab_key}
                                disabled={isTabHidden(tab.tab_key)}
                              />
                            </div>
                          }
                        >
                          <span className="text-sm truncate">{tab.display_name}</span>
                        </SortableItem>
                      ))}
                    </SortableList>
                  </RadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Row 2: Metadata - full width */}
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{job.job_type?.name || "No Type"}</span>
            <span>-</span>
            <span>{job.job_status?.name || "No Status"}</span>
            <span>-</span>
            <span>{job.job_stage?.name || job.stage || "No Stage"}</span>
            <span>·</span>
            <span>
              Start:{" "}
              <span className="font-medium text-foreground">
                {job.start_date
                  ? new Date(job.start_date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })
                  : "-"}
              </span>
            </span>
            <span>·</span>
            <span>
              PC:{" "}
              <span className="font-medium text-foreground">
                {job.practical_completion_date
                  ? new Date(job.practical_completion_date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })
                  : "-"}
              </span>
            </span>
            {/* Owners (clients) */}
            {(() => {
              const owners = job.contacts?.filter(c => c.role === "client") || [];
              if (owners.length === 0) return null;
              return (
                <>
                  <span>·</span>
                  <span>
                    Owner:{" "}
                    {owners.map((o, idx) => (
                      <span key={o.contact_id}>
                        {idx > 0 && " & "}
                        <Link
                          href={`/contacts/${o.contact_id}?returnTo=${encodeURIComponent(`/jobs/${jobId}/${activeParentTab}${activeChildTab ? `/${activeChildTab}` : ''}`)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {o.contact.display_name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Tabs trigger */}
        <div className="px-3 pb-2">
          <Tabs value={effectiveActiveTab} onValueChange={handleTabChange}>
            <HierarchicalTabsList
              tabs={visibleJobTabs}
              activeTab={effectiveActiveTab}
              activeParentTab={activeParentTab}
              onTabChange={handleTabChange}
            />
          </Tabs>
        </div>
      </div>

      {/* Tab content - scrollable */}
      <Tabs value={effectiveActiveTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 px-3 pb-6">
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Job Details</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveChanges} disabled={saving}>
                      {saving ? (
                        <Spinner size={16} className="mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Job Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <Input value={job.name} readOnly />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from address components
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Type</Label>
                      {isEditing ? (
                        lookupLoading ? (
                          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                            <Spinner size={16} />
                            <span className="text-muted-foreground">{job.job_type?.name || "Loading..."}</span>
                          </div>
                        ) : (
                          <ComboboxDropdown
                            items={jobTypes.map((type) => ({ id: type.id.toString(), label: type.name }))}
                            selectedItem={editForm.job_type_id ? { id: editForm.job_type_id.toString(), label: jobTypes.find(t => t.id === editForm.job_type_id)?.name || "" } : undefined}
                            onSelect={(item) => setEditForm({ ...editForm, job_type_id: parseInt(item.id) })}
                            placeholder="Search job types..."
                          />
                        )
                      ) : (
                        <Input value={job.job_type?.name || "-"} readOnly />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Job Code</Label>
                      <Input value={`J${job.id}`} readOnly className="bg-muted/50 font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    {isEditing ? (
                      lookupLoading ? (
                        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                          <Spinner size={16} />
                          <span className="text-muted-foreground">{job.job_status?.name || "Loading..."}</span>
                        </div>
                      ) : (
                        <ComboboxDropdown
                          items={jobStatuses.map((status) => ({ id: status.id.toString(), label: status.name }))}
                          selectedItem={editForm.job_status_id ? { id: editForm.job_status_id.toString(), label: jobStatuses.find(s => s.id === editForm.job_status_id)?.name || "" } : undefined}
                          onSelect={(item) => setEditForm({ ...editForm, job_status_id: parseInt(item.id) })}
                          placeholder="Search statuses..."
                        />
                      )
                    ) : (
                      <Input value={job.job_status?.name || "-"} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Stage</Label>
                    {isEditing ? (
                      lookupLoading ? (
                        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                          <Spinner size={16} />
                          <span className="text-muted-foreground">{job.job_stage?.name || "Loading..."}</span>
                        </div>
                      ) : (
                        <ComboboxDropdown
                          items={jobStages.map((stage) => ({ id: stage.id.toString(), label: stage.name }))}
                          selectedItem={editForm.job_stage_id ? { id: editForm.job_stage_id.toString(), label: jobStages.find(s => s.id === editForm.job_stage_id)?.name || "" } : undefined}
                          onSelect={(item) => setEditForm({ ...editForm, job_stage_id: parseInt(item.id) })}
                          placeholder="Search job stages..."
                        />
                      )
                    ) : (
                      <Input value={job.job_stage?.name || "-"} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Certifier Job No</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.certifier_job_no || ""}
                        onChange={(e) => setEditForm({ ...editForm, certifier_job_no: e.target.value })}
                      />
                    ) : (
                      <Input value={job.certifier_job_no || ""} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Xero Job Category</Label>
                    {xeroTrackingOptions.length > 0 ? (
                      <ComboboxDropdown
                        items={xeroTrackingOptions.map((opt) => ({ id: opt.id, label: opt.name }))}
                        selectedItem={currentXeroOption ? { id: currentXeroOption.id, label: currentXeroOption.name } : undefined}
                        onSelect={(item) => handleLinkXero(item.id, item.label)}
                        placeholder={suggestedXeroMatch ? `Suggested: ${suggestedXeroMatch.name}` : "Select Xero job..."}
                        disabled={linkingXero}
                      />
                    ) : (
                      <Input value={currentXeroOption?.name || "Loading..."} readOnly />
                    )}
                    {!currentXeroOption && suggestedXeroMatch && (
                      <p className="text-xs text-muted-foreground">
                        Suggested match: {suggestedXeroMatch.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Map */}
            <div className="lg:col-span-1 h-full">
              <LocationMap
                jobId={job.id}
                location={job.location}
                latitude={job.latitude}
                longitude={job.longitude}
                lotNumber={job.lot_number}
                streetNumber={job.street_number}
                streetName={job.street_name}
                streetType={job.street_type}
                suburb={job.suburb}
                postcode={job.postcode}
                state={job.state}
                council={job.council}
                onLocationUpdate={(data) => {
                  // Update job state with new location data using functional update
                  console.log("Job page received location update:", data);
                  setJob((prevJob) => {
                    console.log("Previous job location:", prevJob?.location);
                    const newJob = prevJob ? { ...prevJob, ...data } : prevJob;
                    console.log("New job location:", newJob?.location);
                    return newJob;
                  });
                }}
              />
            </div>

            {/* Address Details */}
            <AddressDetailsCard
              job={job}
              onSave={async (addressData) => {
                try {
                  const response = await api.patch<Job>(`/api/v1/jobs/${job.id}`, {
                    job: {
                      lot_number: addressData.lot_number,
                      plan_number: addressData.plan_number,
                      street_number: addressData.street_number,
                      street_name: addressData.street_name,
                      street_type: addressData.street_type,
                      suburb: addressData.suburb,
                      postcode: addressData.postcode,
                      state: addressData.state,
                      council: addressData.council,
                    },
                  });

                  // Update job state with new data
                  setJob((prevJob) => prevJob ? { ...prevJob, ...response } : prevJob);
                } catch (error) {
                  console.error("Failed to update address:", error);
                  throw error;
                }
              }}
            />

          </div>
        </TabsContent>

        {/* SSoT: Dynamic tab rendering from EntityTabs + JOB_TAB_COMPONENTS registry */}
        {/* Child tabs use compositeKey (parent__child) to prevent tab_key collisions */}
        {allDynamicTabs.map((tab) => {
          // SSoT: Use compositeKey for children to prevent collision with same-named parent tabs
          const tabValue = tab.compositeKey || tab.tab_key;

          // SSoT: CAD category tabs render RevitTab for Revit/DWG/Datasmith files
          if (tab.is_cad_category) {
            return (
              <TabsContent key={tabValue} value={tabValue} className="mt-4">
                <RevitTab
                  jobId={job.id}
                  jobTitle={job.name}
                />
              </TabsContent>
            );
          }

          // Document/Photo tabs use JobDocumentsTab with initialCategory
          // SSoT: Pass composite key (parent__child) to disambiguate same-named categories
          // e.g., "photo__site" ensures Photo > Site photos shown, not Site > Site docs
          // Render JobDocumentsTab for:
          // 1. Photo categories (is_photo_category: true) - shows photo gallery
          // 2. Document categories with SharePoint (folder_path set) - shows document viewer
          if (tab.is_photo_category || tab.folder_path) {
            // SSoT: Find parent tab to pass its children as categories
            // This eliminates duplicate API call - parent already has the data from useEntityTabs
            const parentTab = visibleJobTabs.find(p =>
              p.children?.some(c => c.tab_key === tab.tab_key)
            );
            // Convert EntityTab children to DocumentCategory format
            const categories = parentTab?.children?.map(c => ({
              id: c.id,
              tab_key: c.tab_key,
              name: c.display_name,
              display_name: c.display_name,
              is_photo_category: c.is_photo_category,
              folder_path: c.folder_path ?? undefined,  // Convert null to undefined
              children: c.children?.map(gc => ({
                id: gc.id,
                tab_key: gc.tab_key,
                name: gc.display_name,
                display_name: gc.display_name,
                is_photo_category: gc.is_photo_category,
                folder_path: gc.folder_path ?? undefined,  // Convert null to undefined
              })),
            }));

            return (
              <TabsContent key={tabValue} value={tabValue} className="mt-4">
                <JobDocumentsTab
                  jobId={job.id}
                  jobTitle={job.name}
                  initialCategory={tabValue}
                  categories={categories}
                />
              </TabsContent>
            );
          }

          // Look up component from registry
          const Component = JOB_TAB_COMPONENTS[tab.tab_key];
          if (!Component) {
            // Tab exists in EntityTabs but no component registered - show placeholder
            return (
              <TabsContent key={tabValue} value={tabValue} className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{tab.display_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{tab.display_name} coming soon.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          }

          // Special handling for schedule tab (needs different height)
          const className = tab.tab_key === "schedule" ? "mt-4 h-[calc(100vh-300px)]" : "mt-4";

          return (
            <TabsContent key={tabValue} value={tabValue} className={className}>
              <Component
                jobId={job.id}
                job={job}
                jobTitle={job.name}
                onUpdate={loadJob}
                contractValue={job.contract_value}
              />
            </TabsContent>
          );
        })}

        {/* WHS tab - special inline JSX (complex state dependencies) */}
        <TabsContent value="whs" className="mt-4">
          <div className="space-y-6">
            {/* WHS Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Active SWMS</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">2</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Inducted Workers</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">8</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Inspections</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">3</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Open Incidents</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">0</p>
                </CardContent>
              </Card>
            </div>

            {/* SWMS for this job */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Safe Work Method Statements</CardTitle>
                <Button size="sm">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Create SWMS
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Excavation Works SWMS</p>
                        <p className="text-sm text-muted-foreground">Version 2 • 8 workers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                      <span className="text-sm text-muted-foreground">60 days remaining</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Concrete Pouring SWMS</p>
                        <p className="text-sm text-muted-foreground">Version 1 • Draft</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Draft</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inducted Workers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Inducted Workers</CardTitle>
                <Button size="sm" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Start Induction
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["James Wilson", "Mark Thompson", "Lisa Chen"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">General Site Induction</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Inducted</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 border rounded-lg border-orange-200 bg-orange-50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>TB</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Tom Bradley</p>
                        <p className="text-sm text-muted-foreground">Pending induction</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <Button size="sm">Start</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/inspections")}>
                <CheckCircle className="h-5 w-5 mb-2" />
                Run Inspection
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/incidents")}>
                <AlertTriangle className="h-5 w-5 mb-2" />
                Report Incident
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs/swms")}>
                <ClipboardCheck className="h-5 w-5 mb-2" />
                All SWMS
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push("/whs")}>
                <Shield className="h-5 w-5 mb-2" />
                WHS Dashboard
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Plans tab - hidden placeholder for Tabs component, actual content rendered outside */}
        <TabsContent value="plans" className="hidden" />
      </Tabs>

      {/* Plans tab - only mount when active, key forces fresh mount each time */}
      {effectiveActiveTab === "plans" && (
        <JobPlansTab
          key={`plans-${job.id}`}
          jobId={job.id}
          jobCode={String(job.id).padStart(4, "0")}
          jobTitle={job.name}
        />
      )}
    </div>
  );
}
