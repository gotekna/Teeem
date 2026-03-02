"use client";

import * as React from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
// useSetLayoutMode moved to layout.tsx to prevent double flash
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import MultipleSelector, { Option as MultipleSelectorOption } from "@/components/ui/multiple-selector";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { HierarchicalTabsList } from "@/components/ui/hierarchical-tabs-list";
// SSoT: Using unified WarehouseFolders API directly (Phase 5 - no adapter hooks)
import { useWarehouseFolders } from "@/lib/hooks/useWarehouseFolders";
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
  Check,
  Save,
  X,
  FileSignature,
  Palette,
  MoreVertical,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SortableList, SortableItem, DragHandle, reorderByPosition } from "@/components/ui/dnd";
import { useUserTabPreferences } from "@/lib/hooks/useUserTabPreferences";
import { api } from "@/lib/api";
import { clearCachedRecords } from "@/lib/records-cache";
import { formatCurrency, getInitials } from "@/utils/formatters";
import { DEBOUNCE_SEARCH_MS } from "@/lib/constants/timeout-constants";
import { safePercent } from "@/lib/utils";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { JobSpreadsheetsSection } from "@/components/jobs/JobSpreadsheetsSection";
import { getTabComponent } from "@/lib/tab-component-registry";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";
import type { DocumentItem } from "@/components/warehouse/types";
import type { Job, JobType, JobStatus, JobStage } from "@/lib/types";

// =============================================================================
// LAZY LOADED TAB COMPONENTS - Performance optimization
// =============================================================================
// Tab components are loaded on-demand when the tab is first activated.
// This significantly reduces initial bundle size and improves page load time.
// Each component is code-split into its own chunk.
// =============================================================================
const JobActivityTab = dynamic(() => import("@/components/jobs/JobActivityTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobContractTab = dynamic(() => import("@/components/jobs/JobContractTab").then(m => m.JobContractTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobPeopleTab = dynamic(() => import("@/components/jobs/JobPeopleTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const RainLogTab = dynamic(() => import("@/components/jobs/RainLogTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobDocumentsTab = dynamic(() => import("@/components/jobs/JobDocumentsTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobPlansTab = dynamic(() => import("@/components/jobs/JobPlansTab").then(m => m.JobPlansTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobPurchaseOrdersTab = dynamic(() => import("@/components/jobs/JobPurchaseOrdersTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobEstimatorTab = dynamic(() => import("@/components/jobs/JobEstimatorTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobQuoteTrackerTab = dynamic(() => import("@/components/jobs/JobQuoteTrackerTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobCustomQuotesTab = dynamic(() => import("@/components/jobs/JobCustomQuotesTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobQuoteReturnsTab = dynamic(() => import("@/components/jobs/JobQuoteReturnsTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobBudgetTab = dynamic(() => import("@/components/jobs/JobBudgetTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobBOQTab = dynamic(() => import("@/components/jobs/JobBOQTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobPriceAnalysisTab = dynamic(() => import("@/components/jobs/JobPriceAnalysisTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobCommunicationsTab = dynamic(() => import("@/components/jobs/JobCommunicationsTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobProfitTab = dynamic(() => import("@/components/jobs/JobProfitTab").then(m => m.JobProfitTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobClaimStagesTab = dynamic(() => import("@/components/jobs/JobClaimStagesTab").then(m => m.JobClaimStagesTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobExpensesTab = dynamic(() => import("@/components/jobs/JobExpensesTab").then(m => m.JobExpensesTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobScheduleTab = dynamic(() => import("@/components/jobs/JobScheduleTab").then(m => m.JobScheduleTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobSitePresenceTab = dynamic(() => import("@/components/jobs/JobSitePresenceTab").then(m => m.JobSitePresenceTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const RevitTab = dynamic(() => import("@/components/jobs/RevitTab").then(m => m.RevitTab), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobTenderTab = dynamic(() => import("@/components/jobs/JobTenderTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobTenderBuilderTab = dynamic(() => import("@/components/jobs/JobTenderBuilderTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const JobMarkupTab = dynamic(() => import("@/components/jobs/JobMarkupTab").then(m => m.default), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const ColourSelectionBuilder = dynamic(() => import("@/components/colours/ColourSelectionBuilder").then(m => m.ColourSelectionBuilder), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const SpecificationBuilder = dynamic(() => import("@/components/specifications/SpecificationBuilder").then(m => m.SpecificationBuilder), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const XeroBillsCard = dynamic(() => import("@/components/xero/XeroBillsCard"), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const XeroInvoicesCard = dynamic(() => import("@/components/xero/XeroInvoicesCard"), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const XeroJobProfitLossCard = dynamic(() => import("@/components/xero/XeroJobProfitLossCard"), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const WarehouseTreeBase = dynamic(() => import("@/components/warehouse/WarehouseTree").then(m => m.WarehouseTree), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
// Wrapper: Job warehouse tab - contextual view showing ALL related records
// Shows Job folders for THIS job + Contact folders for contacts on this job +
// Task folders for tasks on this job, etc.
function JobWarehouseTab(props: any) {
  const warehouseRouter = useRouter();
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mailboxTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileClick = React.useCallback((doc: DocumentItem) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      if (doc.fileUrl) window.open(doc.fileUrl, "_blank");
      clickTimer.current = null;
    }, 200);
  }, []);

  const handleFileDoubleClick = React.useCallback((doc: DocumentItem) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (doc.fileUrl) window.open(doc.fileUrl, "_blank");
  }, []);

  const handleMailboxClick = React.useCallback((email: string) => {
    if (mailboxTimer.current) clearTimeout(mailboxTimer.current);
    mailboxTimer.current = setTimeout(() => {
      warehouseRouter.push(`/email?mailbox=${encodeURIComponent(email)}`);
      mailboxTimer.current = null;
    }, 200);
  }, [warehouseRouter]);

  const handleMailboxDoubleClick = React.useCallback((link: string) => {
    if (mailboxTimer.current) { clearTimeout(mailboxTimer.current); mailboxTimer.current = null; }
    window.open(link, "_blank");
  }, []);

  return (
    <WarehouseTreeBase
      mode={{
        type: "context",
        entityType: "Job",
        entityId: props.jobId,
      }}
      onFileClick={handleFileClick}
      onFileDoubleClick={handleFileDoubleClick}
      onMailboxClick={handleMailboxClick}
      onMailboxDoubleClick={handleMailboxDoubleClick}
    />
  );
}

// Loading skeleton shown while tab component loads
function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

// =============================================================================
// REQUEST DEDUPLICATION - Prevents duplicate API calls that cause screen flashing
// =============================================================================
// Module-level cache for in-flight job requests. If the same job is requested
// while a fetch is in progress, reuse the existing promise instead of making
// a duplicate request.
// Cache entries expire after 30 seconds to prevent hanging on stale promises.
// =============================================================================
const jobRequestCache = new Map<string, { promise: Promise<Job>; timestamp: number }>();
const REQUEST_CACHE_TTL_MS = 30000; // 30 seconds max for in-flight requests

// Module-level cache for resolved job data.
// Prevents page-level skeleton flash when Next.js remounts the component
// during sub-tab navigation (catch-all [..tab] route changes).
// FRC (Feb 2026): Claims-XERO tab click caused full page skeleton because
// component remounted with loading=true and no cached data.
const jobDataCache = new Map<string, { data: Job; timestamp: number }>();
const JOB_DATA_CACHE_TTL_MS = 60000; // 60 seconds for resolved data

// SSoT: Job Tab Component Registry
// Maps tab_key → component. When tabs are renamed in admin, they auto-work.
// Special tabs (overview, whs, plans) have inline JSX and are excluded.
const JOB_TAB_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "contract": JobContractTab,
  "specifications": SpecificationBuilder,
  "colours": ColourSelectionBuilder,
  "claims": JobClaimStagesTab,
  "expenses": JobExpensesTab,
  "profit": JobProfitTab,
  "budget": JobBudgetTab,
  "people": JobPeopleTab,
  "purchase-orders": JobPurchaseOrdersTab,
  "estimates": JobEstimatorTab,
  "quote-tracker": JobQuoteTrackerTab,
  "custom-quotes": JobCustomQuotesTab,
  "quote-returns": JobQuoteReturnsTab,
  "boq": JobBOQTab,
  "price-analysis": JobPriceAnalysisTab,
  "activity": JobActivityTab,
  "schedule": JobScheduleTab,
  "site-presence": JobSitePresenceTab,
  "rain-log": RainLogTab,
  "documents": JobDocumentsTab,
  "coms": JobCommunicationsTab,
  "tender": JobTenderTab,
  "tenders": JobTenderTab,
  "tender-builder": JobTenderBuilderTab,
  "markup": JobMarkupTab,
  "pricing": JobMarkupTab,
  "revit": RevitTab,
  "revit-dwg": RevitTab,
  "warehouse": JobWarehouseTab,
  // Xero Finance tabs - bills/invoices linked to this job
  "bills": XeroBillsCard,
  "bills-xero": XeroBillsCard,
  "invoices": XeroInvoicesCard,
  "claims-xero": XeroInvoicesCard,
  "claims---xero": XeroInvoicesCard, // FRC: DB has triple dashes from "Claims - XERO" slugification
  // Xero P&L report filtered by job tracking category
  "p&l-xero": XeroJobProfitLossCard,
  "pl-xero": XeroJobProfitLossCard,
  "profit-loss-xero": XeroJobProfitLossCard,
};

// SSoT: Component Name Registry (FRC Feb 2026)
// Maps WarehouseFolder.component_name → same next/dynamic imports above.
// Defensive fallback when tab_key doesn't match (e.g., slugification produces
// unexpected keys like "claims---xero" from "Claims - XERO").
// Uses next/dynamic (not React.lazy) to avoid Suspense rendering freeze.
const COMPONENT_BY_NAME: Record<string, React.ComponentType<any>> = {
  "JobContractTab": JobContractTab,
  "SpecificationBuilder": SpecificationBuilder,
  "ColourSelectionBuilder": ColourSelectionBuilder,
  "JobClaimStagesTab": JobClaimStagesTab,
  "JobExpensesTab": JobExpensesTab,
  "JobProfitTab": JobProfitTab,
  "JobBudgetTab": JobBudgetTab,
  "JobPeopleTab": JobPeopleTab,
  "JobPurchaseOrdersTab": JobPurchaseOrdersTab,
  "JobEstimatorTab": JobEstimatorTab,
  "JobQuoteTrackerTab": JobQuoteTrackerTab,
  "JobCustomQuotesTab": JobCustomQuotesTab,
  "JobQuoteReturnsTab": JobQuoteReturnsTab,
  "JobBOQTab": JobBOQTab,
  "JobPriceAnalysisTab": JobPriceAnalysisTab,
  "JobActivityTab": JobActivityTab,
  "JobScheduleTab": JobScheduleTab,
  "JobSitePresenceTab": JobSitePresenceTab,
  "RainLogTab": RainLogTab,
  "JobDocumentsTab": JobDocumentsTab,
  "JobCommunicationsTab": JobCommunicationsTab,
  "JobTenderTab": JobTenderTab,
  "JobMarkupTab": JobMarkupTab,
  "RevitTab": RevitTab,
  "JobWarehouseTab": JobWarehouseTab,
  "XeroBillsCard": XeroBillsCard,
  "XeroInvoicesCard": XeroInvoicesCard,
  "XeroJobProfitLossCard": XeroJobProfitLossCard,
};

// Tabs that need special rendering (complex inline JSX or special behavior)
// "plan" included as guard against duplicate DB entries (plan vs plans SSoT fix Feb 2026)
const SPECIAL_TABS = ["overview", "whs", "plans", "plan"];

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

// Editable Description Card
function JobDescriptionCard({
  job,
  onSave,
}: {
  job: Job;
  onSave: (description: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [value, setValue] = React.useState(job.description || "");

  React.useEffect(() => {
    if (!isEditing) {
      setValue(job.description || "");
    }
  }, [job.description, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save description:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(job.description || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Description</CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a description for this job..."
            className="min-h-[100px] resize-y"
          />
        ) : (
          <p className={value ? "text-sm whitespace-pre-wrap" : "text-sm text-muted-foreground"}>
            {value || "No description added."}
          </p>
        )}
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

  // Use module-level cache to prevent skeleton flash on sub-tab navigation.
  // When Next.js remounts this component (catch-all route change), we instantly
  // show the cached job data instead of a loading skeleton.
  const cachedJobData = React.useMemo(() => {
    const cached = jobDataCache.get(`job-${jobId}`);
    if (cached && Date.now() - cached.timestamp < JOB_DATA_CACHE_TTL_MS) {
      return cached.data;
    }
    return null;
  }, [jobId]);

  const [job, setJob] = React.useState<Job | null>(cachedJobData);
  const [loading, setLoading] = React.useState(!cachedJobData);
  const [financeCounts, setFinanceCounts] = React.useState<Record<string, number>>({});

  // Dynamic job tabs configuration - SSoT: unified WarehouseFolders API directly (Phase 5)
  const { tabs: jobTabs, loading: tabsLoading } = useWarehouseFolders({ scope: "job" });

  // User tab preferences (visibility, order, default tab)
  const {
    defaultTab: userDefaultTab,
    setDefaultTab,
    isTabHidden,
    toggleTab,
    tabOrder,
    setTabOrder,
    resetToDefaults,
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

  // Job designs state (for ComboboxDropdown)
  const [jobDesigns, setJobDesigns] = React.useState<{id: number, name: string}[]>([]);

  // Xero tracking category state (multi-link)
  const [xeroTrackingOptions, setXeroTrackingOptions] = React.useState<{id: string, name: string}[]>([]);
  const [currentXeroOptions, setCurrentXeroOptions] = React.useState<{id: string, name: string, variant?: string, is_primary?: boolean}[]>([]);
  const [suggestedXeroMatch, setSuggestedXeroMatch] = React.useState<{id: string, name: string} | null>(null);
  const [linkingXero, setLinkingXero] = React.useState(false);

  // Choice columns state (Level, Dwelling Type) - SSoT: loaded from Column.available_choices via API
  const [levelChoices, setLevelChoices] = React.useState<string[]>([]);
  const [dwellingTypeChoices, setDwellingTypeChoices] = React.useState<{ value: string; description: string; displayLabel: string }[]>([]);
  const [editingChoices, setEditingChoices] = React.useState<{ field: 'level' | 'dwelling_type'; choices: string[] } | null>(null);
  const [newChoiceInput, setNewChoiceInput] = React.useState('');
  const [savingChoices, setSavingChoices] = React.useState(false);
  const [choiceColumnIds, setChoiceColumnIds] = React.useState<{ level?: number; dwelling_type?: number }>({});
  const [editingChoiceIndex, setEditingChoiceIndex] = React.useState<number | null>(null);
  const [editingChoiceValue, setEditingChoiceValue] = React.useState('');

  // Get tab from URL - URL is SSoT for tab state (back button support)
  // Uses path-based structure: /jobs/{id}/{parent}/{child} for hierarchical tabs
  // Parse: /jobs/123/photo/site → { parent: "photo", child: "site" }
  const pathSegments = React.useMemo(() => {
    // Remove /jobs/{id} prefix and split remaining path
    const parts = (pathname ?? "").replace(/^\/jobs\/[^/]+/, "").split("/").filter(Boolean);
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
      // Use history.replaceState to update URL without triggering React re-render
      // This prevents the double flash that occurred with router.replace
      window.history.replaceState(null, "", `/jobs/${jobId}/${defaultTab}`);
    }
  }, [tabFromUrl, tabsLoading, visibleJobTabs.length, userDefaultTab, jobId]);

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
    if (activeChildTab) {
      return `${activeParentTab}__${activeChildTab}`;
    }

    // If parent tab has children, use first child with composite key
    if (visibleJobTabs.length > 0) {
      const firstChild = findFirstChildTab(activeParentTab);
      if (firstChild) {
        return `${activeParentTab}__${firstChild}`;
      }
    }

    // Otherwise use the parent tab itself
    return activeParentTab;
  }, [activeChildTab, activeParentTab, visibleJobTabs, findFirstChildTab]);

  // SSoT: Collect all tabs that should be dynamically rendered
  // Includes parent tabs + all children, excluding special tabs (overview, whs, plans)
  // Children get a compositeKey (parent__child) to prevent tab_key collisions
  const allDynamicTabs = React.useMemo(() => {
    const tabs: (WarehouseFolder & { compositeKey?: string })[] = [];
    for (const tab of visibleJobTabs) {
      // Add parent tab if it has a registered component and isn't special
      // Fallback: check component_name in registry when tab_key doesn't match (tab renamed in admin)
      const hasComponent = JOB_TAB_COMPONENTS[tab.tab_key] || (tab.component_name ? getTabComponent(tab.component_name) : undefined);
      if (!SPECIAL_TABS.includes(tab.tab_key) && hasComponent) {
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
    // IGNORE: Parent tab values prefixed with __p__ come from Radix onValueChange
    // These are handled via onClick instead to avoid double-firing navigation
    if (newTab.startsWith("__p__")) {
      return;
    }

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
      // Clear stale cache entries to prevent hanging on dead promises
      const cacheKey = `job-${jobId}`;
      const cached = jobRequestCache.get(cacheKey);
      const now = Date.now();

      // Check if cached promise is stale (older than TTL)
      if (cached && now - cached.timestamp > REQUEST_CACHE_TTL_MS) {
        jobRequestCache.delete(cacheKey);
      }

      let requestPromise: Promise<Job>;
      const freshCached = jobRequestCache.get(cacheKey);

      if (freshCached) {
        requestPromise = freshCached.promise;
      } else {
        requestPromise = api.get<Job>(`/api/v1/jobs/${jobId}`);
        jobRequestCache.set(cacheKey, { promise: requestPromise, timestamp: now });
      }

      const response = await requestPromise;

      // Clean up cache after request completes
      jobRequestCache.delete(cacheKey);

      // API returns { success: true, data: {...} } envelope
      const jobData = (response as unknown as { data?: Job })?.data || response;
      setJob(jobData as Job);
      // Cache resolved data for sub-tab navigation (prevents skeleton flash on remount)
      jobDataCache.set(cacheKey, { data: jobData as Job, timestamp: Date.now() });
    } catch (error) {
      // Clean up cache on error too
      jobRequestCache.delete(`job-${jobId}`);
      console.error(`[JobPage] loadJob ERROR jobId=${jobId}:`, error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // SSoT: Unified callback for child tabs that mutate job data.
  // Clears Foundation cache so the Jobs list table shows fresh data,
  // then reloads the individual job detail.
  // FRC (Feb 2026): Previously child tabs only called loadJob (no cache clear),
  // so changes made on Contract/Settings/etc tabs didn't appear in the Jobs table
  // until the user manually refreshed.
  const handleJobUpdated = React.useCallback(() => {
    clearCachedRecords("jobs");
    loadJob();
  }, [loadJob]);

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
        current_options: {id: string, name: string, variant?: string, is_primary?: boolean}[];
        current_option: {id: string, name: string} | null;
        suggested_match: {id: string, name: string} | null;
      }>(`/api/v1/jobs/${jobId}/xero_tracking_options`);

      if (response?.success) {
        setXeroTrackingOptions(response.tracking_options || []);
        setCurrentXeroOptions(response.current_options || []);
        setSuggestedXeroMatch(response.suggested_match);
      }
    } catch (error) {
      console.error("Failed to load Xero tracking options:", error);
    }
  }, [jobId]);

  // Load job designs for ComboboxDropdown
  const loadJobDesigns = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; designs: { id: number; name: string }[] }>(
        "/api/v1/job_designs?active=true"
      );
      if (response?.success) {
        setJobDesigns(response.designs || []);
      }
    } catch (error) {
      console.error("Failed to load job designs:", error);
    }
  }, []);

  // Link job to multiple Xero tracking options
  const handleLinkXeroMulti = async (selected: {value: string, label: string}[]) => {
    if (!job) return;
    setLinkingXero(true);
    try {
      const trackingOptions = selected.map((opt, idx) => ({
        id: opt.value,
        name: opt.label,
        is_primary: idx === 0, // First selected is primary
      }));

      const response = await api.post<{
        success: boolean;
        current_options: {id: string, name: string, variant?: string, is_primary?: boolean}[];
      }>(`/api/v1/jobs/${job.id}/link_xero_tracking`, {
        tracking_options: trackingOptions,
      });

      if (response?.success && response.current_options) {
        setCurrentXeroOptions(response.current_options);
        // Update job with primary option for backward compat
        const primary = response.current_options.find(o => o.is_primary) || response.current_options[0];
        if (primary) {
          setJob({ ...job, xero_tracking_option_id: primary.id, xero_tracking_option_name: primary.name });
        }
      }
    } catch (error) {
      console.error("Failed to link Xero tracking:", error);
    } finally {
      setLinkingXero(false);
    }
  };

  // Load choice column data from Jobs foundation schema
  const loadChoiceColumns = React.useCallback(async () => {
    try {
      // Fetch schema for column IDs and level choices
      const schemaResponse = await api.get<{
        success: boolean;
        columns: { id: number; name: string; column_name: string; column_type: string; choices: string[] | null }[];
      }>('/api/v1/foundations/jobs/schema');

      if (schemaResponse?.success && schemaResponse.columns) {
        const levelCol = schemaResponse.columns.find(c => c.column_name === 'level');
        const dwellingCol = schemaResponse.columns.find(c => c.column_name === 'dwelling_type');

        if (levelCol?.choices) {
          setLevelChoices(levelCol.choices);
          setChoiceColumnIds(prev => ({ ...prev, level: levelCol.id }));
        }
        if (dwellingCol) {
          setChoiceColumnIds(prev => ({ ...prev, dwelling_type: dwellingCol.id }));
        }
      }

      // Fetch dwelling types with descriptions from dedicated endpoint (SSoT)
      const dwellingResponse = await api.get<{
        success: boolean;
        data: { value: string; description: string; displayLabel: string }[];
      }>('/api/v1/document_types/dwelling_types');

      if (dwellingResponse?.success && dwellingResponse.data) {
        setDwellingTypeChoices(dwellingResponse.data);
      }
    } catch (error) {
      console.error("Failed to load choice columns:", error);
    }
  }, []);

  // Save choices to the Column API
  const saveChoices = async () => {
    if (!editingChoices) return;

    const columnId = choiceColumnIds[editingChoices.field];
    if (!columnId) {
      console.error("Column ID not found for field:", editingChoices.field);
      return;
    }

    setSavingChoices(true);
    try {
      // FRC (Feb 2026): Was `/api/v1/columns/${columnId}` which 404'd because
      // columns are nested under foundations: /api/v1/foundations/:id/columns/:id
      await api.patch(`/api/v1/foundations/jobs/columns/${columnId}`, {
        column: { available_choices: editingChoices.choices }
      });

      // Update local state
      if (editingChoices.field === 'level') {
        setLevelChoices(editingChoices.choices);
      } else {
        // Reload dwelling types to get descriptions from SSoT API
        const dwellingResponse = await api.get<{
          success: boolean;
          data: { value: string; description: string; displayLabel: string }[];
        }>('/api/v1/document_types/dwelling_types');
        if (dwellingResponse?.success && dwellingResponse.data) {
          setDwellingTypeChoices(dwellingResponse.data);
        }
      }

      setEditingChoices(null);
      setNewChoiceInput('');
    } catch (error) {
      console.error("Failed to save choices:", error);
    } finally {
      setSavingChoices(false);
    }
  };

  // Add a choice to the editing list
  const addChoice = () => {
    if (!editingChoices || !newChoiceInput.trim()) return;
    if (editingChoices.choices.includes(newChoiceInput.trim())) return; // Prevent duplicates

    setEditingChoices({
      ...editingChoices,
      choices: [...editingChoices.choices, newChoiceInput.trim()]
    });
    setNewChoiceInput('');
  };

  // Remove a choice from the editing list
  const removeChoice = (choice: string) => {
    if (!editingChoices) return;
    setEditingChoices({
      ...editingChoices,
      choices: editingChoices.choices.filter(c => c !== choice)
    });
  };

  // Rename a choice in the editing list
  const renameChoice = (index: number, newValue: string) => {
    if (!editingChoices || !newValue.trim()) return;
    const trimmed = newValue.trim();
    // Prevent duplicates (allow same index = no actual rename)
    if (editingChoices.choices.some((c, i) => i !== index && c === trimmed)) return;
    const updated = [...editingChoices.choices];
    updated[index] = trimmed;
    setEditingChoices({ ...editingChoices, choices: updated });
    setEditingChoiceIndex(null);
    setEditingChoiceValue('');
  };

  React.useEffect(() => {
    if (jobId) {
      loadJob();
      loadXeroTrackingOptions();
      loadJobDesigns();
      loadChoiceColumns();
      // Finance sub-tab badge counts (lightweight, non-blocking)
      api.get<{ success: boolean; counts: Record<string, number> }>(`/api/v1/jobs/${jobId}/finance_counts`)
        .then(res => { if (res?.success) setFinanceCounts(res.counts); })
        .catch((err) => console.error("[JobPage] Failed to fetch finance counts:", err));
    }
  }, [jobId, loadJob, loadXeroTrackingOptions, loadJobDesigns, loadChoiceColumns]);

  // Safety timeout: if loading is stuck for 10 seconds, force it to false
  // This prevents permanent skeleton state from hanging API calls or cache issues
  React.useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.error(`[JobPage] SAFETY TIMEOUT - loading stuck for 10s, forcing loading=false for jobId=${jobId}`);
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading, jobId]);

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
        design_name: job.design_name,
        job_design_id: job.job_design_id || job.job_design?.id || null,
        start_date: job.start_date,
        location: job.location,
        job_type_id: job.job_type?.id || job.job_type_id,
        job_status_id: job.job_status?.id || job.job_status_id,
        job_stage_id: job.job_stage?.id || job.job_stage_id,
        level: job.level,
        dwelling_type: job.dwelling_type,
      });
      setIsEditing(true);
      // Load dropdown data for editing
      if (jobTypes.length === 0) {
        loadLookupData();
      }
      // Clean up URL by removing /edit or ?edit=true
      const cleanPath = (pathname ?? "").replace(/\/edit$/, "");
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
        design_name: job.design_name,
        job_design_id: job.job_design_id || job.job_design?.id || null,
        start_date: job.start_date,
        location: job.location,
        job_type_id: job.job_type?.id || job.job_type_id,
        job_status_id: job.job_status?.id || job.job_status_id,
        job_stage_id: job.job_stage?.id || job.job_stage_id,
        level: job.level,
        dwelling_type: job.dwelling_type,
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
      const response = await api.patch<{ success: boolean; data: Job }>(`/api/v1/jobs/${job.id}`, {
        job: editForm,
      });
      const updatedJob = response?.data || response;
      setJob({ ...job, ...(updatedJob as Job) });
      setIsEditing(false);
      setEditForm({});
      // SSoT: Clear Foundation cache so Jobs table shows fresh data
      clearCachedRecords("jobs");
      // Reload to get fresh data with associations
      loadJob();
    } catch (error) {
      console.error("Failed to save job:", error);
    } finally {
      setSaving(false);
    }
  };

  // SSoT: Show skeleton layout during job data loading to prevent flash/CLS
  // Only gate on job loading - tabs loading is handled inline (below) to prevent
  // tabsLoading hangs from blocking the entire page permanently
  if (loading) {
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
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs text-muted-foreground"
                    onClick={resetToDefaults}
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Reset to Default
                  </Button>
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
                          {o.contact?.display_name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Tabs trigger - show skeleton while tabs are loading */}
        <div className="px-3 pb-2">
          {tabsLoading && visibleJobTabs.length === 0 ? (
            <div className="flex gap-2 py-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          ) : (
            <Tabs value={effectiveActiveTab} onValueChange={handleTabChange}>
              <HierarchicalTabsList
                tabs={visibleJobTabs}
                activeTab={effectiveActiveTab}
                activeParentTab={activeParentTab}
                onTabChange={handleTabChange}
                badgeCounts={financeCounts}
              />
            </Tabs>
          )}
        </div>
      </div>

      {/* Tab content - scrollable (relative z-0 creates stacking context below sticky header z-40) */}
      <Tabs value={effectiveActiveTab} onValueChange={handleTabChange} className="relative z-0 flex-1 flex flex-col min-h-0 px-3 pb-6">
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
                  {/* Level & Dwelling Type - Choice columns */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Level</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit choices">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <button
                              className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted rounded-sm"
                              onClick={() => { setEditingChoiceIndex(null); setEditingChoiceValue(''); setEditingChoices({ field: 'level', choices: [...levelChoices] }); }}
                            >
                              <Settings className="h-3 w-3 inline mr-2" />
                              Edit Choices
                            </button>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {isEditing ? (
                        <ComboboxDropdown
                          items={levelChoices.map((c) => ({ id: c, label: c }))}
                          selectedItem={editForm.level ? { id: editForm.level, label: editForm.level } : undefined}
                          onSelect={(item) => setEditForm({ ...editForm, level: item.label })}
                          placeholder="Select level..."
                        />
                      ) : (
                        <Input value={job.level || "-"} readOnly />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Dwelling Type</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit choices">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <button
                              className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted rounded-sm"
                              onClick={() => { setEditingChoiceIndex(null); setEditingChoiceValue(''); setEditingChoices({ field: 'dwelling_type', choices: dwellingTypeChoices.map(c => c.value) }); }}
                            >
                              <Settings className="h-3 w-3 inline mr-2" />
                              Edit Choices
                            </button>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {isEditing ? (
                        <ComboboxDropdown
                          items={dwellingTypeChoices.map((c) => ({
                            id: c.value,
                            label: c.displayLabel  // SSoT: format from API
                          }))}
                          selectedItem={editForm.dwelling_type ? { id: editForm.dwelling_type, label: editForm.dwelling_type } : undefined}
                          onSelect={(item) => setEditForm({ ...editForm, dwelling_type: item.id })}
                          placeholder="Select dwelling type..."
                        />
                      ) : (
                        <Input value={job.dwelling_type || "-"} readOnly />
                      )}
                    </div>
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
                      <Input value={String(job.id)} readOnly className="bg-muted/50 font-mono" />
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
                    <Label>Design Name</Label>
                    {isEditing ? (
                      <ComboboxDropdown
                        items={jobDesigns.map(d => ({ id: String(d.id), label: d.name }))}
                        selectedItem={editForm.job_design_id ? {
                          id: String(editForm.job_design_id),
                          label: jobDesigns.find(d => d.id === editForm.job_design_id)?.name || editForm.design_name || ""
                        } : undefined}
                        onSelect={(item) => setEditForm({
                          ...editForm,
                          job_design_id: Number(item.id),
                          design_name: item.label,
                        })}
                        placeholder="Select design..."
                      />
                    ) : (
                      <Input value={job.job_design?.name || job.design_name || ""} readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Xero Link</Label>
                    {isEditing ? (
                      <MultipleSelector
                        options={xeroTrackingOptions.map(opt => ({ value: opt.id, label: opt.name }))}
                        value={currentXeroOptions.map(opt => ({ value: opt.id, label: opt.name }))}
                        onChange={(selected) => handleLinkXeroMulti(selected.map(s => ({ value: s.value, label: s.label })))}
                        placeholder={suggestedXeroMatch ? `Suggested: ${suggestedXeroMatch.name}` : "Search Xero tracking options..."}
                        disabled={linkingXero}
                        hidePlaceholderWhenSelected
                      />
                    ) : (
                      <Input value={(() => {
                        const xeroName = currentXeroOptions.map(o => o.name).join(", ") || job.xero_tracking_option_name || "";
                        // Strip leading letter prefix (e.g., "H332" → "332")
                        return xeroName.replace(/^[A-Za-z](?=\d)/, "");
                      })()} readOnly />
                    )}
                    {isEditing && currentXeroOptions.length === 0 && suggestedXeroMatch && (
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
                  setJob((prevJob) => {
                    const newJob = prevJob ? { ...prevJob, ...data } : prevJob;
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
                  const response = await api.patch<{ success: boolean; data: Job }>(`/api/v1/jobs/${job.id}`, {
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

                  // Update job state with new data (extract from { success, data } wrapper)
                  const jobData = response.data || response;
                  setJob((prevJob) => prevJob ? { ...prevJob, ...jobData } : prevJob);
                } catch (error) {
                  console.error("Failed to update address:", error);
                  throw error;
                }
              }}
            />

            {/* Description */}
            <JobDescriptionCard job={job} onSave={async (description) => {
              const response = await api.patch<{ success: boolean; data: Job }>(`/api/v1/jobs/${job.id}`, {
                job: { description },
              });
              const jobData = response.data || response;
              setJob((prevJob) => prevJob ? { ...prevJob, ...jobData } : prevJob);
            }} />

            {/* Spreadsheets */}
            <JobSpreadsheetsSection jobId={job.id} jobName={job.name} />

          </div>
        </TabsContent>

        {/* SSoT: Dynamic tab rendering from WarehouseFolders + JOB_TAB_COMPONENTS registry */}
        {/* Child tabs use compositeKey (parent__child) to prevent tab_key collisions */}
        {allDynamicTabs.map((tab) => {
          // SSoT: Use compositeKey for children to prevent collision with same-named parent tabs
          const tabValue = tab.compositeKey || tab.tab_key;

          // SSoT: CAD/Revit tabs render RevitTab for Revit/DWG/Datasmith files
          if (tab.tab_type === 'revit' || tab.is_cad_category) {
            return (
              <TabsContent key={tabValue} value={tabValue} className="mt-4">
                <RevitTab
                  jobId={job.id}
                  jobTitle={job.name}
                />
              </TabsContent>
            );
          }

          // SSoT: Component resolution order (FRC Feb 2026):
          // 1. tab_key → JOB_TAB_COMPONENTS (direct dynamic() import, most common)
          // 2. component_name → COMPONENT_BY_NAME (direct dynamic() import, SSoT fallback)
          // 3. component_name → TAB_COMPONENTS (React.lazy, last resort for unknown components)
          // Priority 2 prevents React.lazy freeze when tab_key has unexpected format
          // (e.g., "claims---xero" from "Claims - XERO" slugification)
          const Component = JOB_TAB_COMPONENTS[tab.tab_key]
            || (tab.component_name ? COMPONENT_BY_NAME[tab.component_name] : undefined)
            || (tab.component_name ? getTabComponent(tab.component_name) : undefined);
          if (Component) {
            const className = tab.tab_key === "schedule"
              ? "mt-4 h-[calc(100vh-300px)]"
              : tab.tab_key === "boq"
                ? "mt-0"  // BOQ has inner tabs - no extra gap so they feel connected to parent sub-tabs
                : "mt-4";
            return (
              <TabsContent key={tabValue} value={tabValue} className={className}>
                <React.Suspense fallback={<TabLoadingSkeleton />}>
                  <Component
                    jobId={job.id}
                    job={job}
                    jobTitle={job.name}
                    onUpdate={handleJobUpdated}
                    contractValue={job.contract_value}
                  />
                </React.Suspense>
              </TabsContent>
            );
          }

          // Document/Photo tabs use JobDocumentsTab with initialCategory
          // SSoT: Pass composite key (parent__child) to disambiguate same-named categories
          // e.g., "photo__site" ensures Photo > Site photos shown, not Site > Site docs
          // Render JobDocumentsTab for:
          // 1. Photo categories (tab_type='photo') - shows photo gallery
          // 2. Document categories (tab_type='document') - shows document viewer
          // 3. Any tab with folder_path set - backward compat for legacy config
          if (tab.tab_type === 'photo' || tab.tab_type === 'document' || tab.is_photo_category || tab.folder_path) {
            // SSoT: Find parent tab to pass its children as categories
            // This eliminates duplicate API call - parent already has the data from useWarehouseFolders
            const parentTab = visibleJobTabs.find(p =>
              p.children?.some(c => c.tab_key === tab.tab_key)
            );
            // Convert WarehouseFolder children to DocumentCategory format
            const categories = parentTab?.children?.map(c => ({
              id: c.id,
              tab_key: c.tab_key,
              name: c.display_name,
              display_name: c.display_name,
              tab_type: c.tab_type,
              is_photo_category: c.is_photo_category,
              folder_path: c.folder_path ?? undefined,  // Convert null to undefined
              children: c.children?.map(gc => ({
                id: gc.id,
                tab_key: gc.tab_key,
                name: gc.display_name,
                display_name: gc.display_name,
                tab_type: gc.tab_type,
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
                  storageFolderStatus={job.storage_folder_status}
                />
              </TabsContent>
            );
          }

          // Tab exists in WarehouseFolders but no component registered - show placeholder
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
        })}

        {/* WHS tab - special inline JSX (complex state dependencies) */}
        <TabsContent value="whs" className="mt-4">
          <div className="space-y-6">
            {/* WHS Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span className="text-sm text-muted-foreground">Active SWMS</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">2</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span className="text-sm text-muted-foreground">Inducted Workers</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">8</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span className="text-sm text-muted-foreground">Inspections</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">3</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
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
                      <ClipboardCheck className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                      <div>
                        <p className="font-medium">Excavation Works SWMS</p>
                        <p className="text-sm text-muted-foreground">Version 2 • 8 workers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Active</Badge>
                      <span className="text-sm text-muted-foreground">60 days remaining</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-blue-500 dark:text-blue-400" />
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
                        <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
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
                      <Clock className="h-4 w-4 text-orange-500 dark:text-orange-400" />
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

      {/* Edit Choices Dialog */}
      <Dialog open={!!editingChoices} onOpenChange={(open) => !open && setEditingChoices(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {editingChoices?.field === 'level' ? 'Level' : 'Dwelling Type'} Choices
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current choices list - clickable to select */}
            <div className="space-y-2">
              <Label>Click to select, or add/remove choices</Label>
              <div className="space-y-1">
                {editingChoices?.choices.map((choice, index) => {
                  const currentValue = editingChoices.field === 'level' ? editForm.level : editForm.dwelling_type;
                  const isSelected = currentValue === choice;
                  const isRenaming = editingChoiceIndex === index;
                  return (
                    <div
                      key={`${index}-${choice}`}
                      className={`flex items-center justify-between p-2 rounded-md transition-colors ${
                        isRenaming ? 'bg-muted' : isSelected
                          ? 'bg-primary text-primary-foreground cursor-pointer'
                          : 'bg-muted hover:bg-muted/80 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (isRenaming) return; // Don't select while renaming
                        // Select this choice and close the dialog
                        if (editingChoices.field === 'level') {
                          setEditForm({ ...editForm, level: choice });
                        } else {
                          setEditForm({ ...editForm, dwelling_type: choice });
                        }
                        // Enter edit mode if not already
                        if (!isEditing) {
                          setIsEditing(true);
                        }
                        setEditingChoices(null);
                      }}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editingChoiceValue}
                            onChange={(e) => setEditingChoiceValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameChoice(index, editingChoiceValue);
                              if (e.key === 'Escape') { setEditingChoiceIndex(null); setEditingChoiceValue(''); }
                            }}
                            className="h-7 text-sm"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700 shrink-0"
                            onClick={(e) => { e.stopPropagation(); renameChoice(index, editingChoiceValue); }}
                            disabled={!editingChoiceValue.trim()}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => { e.stopPropagation(); setEditingChoiceIndex(null); setEditingChoiceValue(''); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm">{choice}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 ${isSelected ? 'text-primary-foreground hover:text-primary-foreground/80' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChoiceIndex(index);
                                setEditingChoiceValue(choice);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 ${isSelected ? 'text-primary-foreground hover:text-primary-foreground/80' : 'text-destructive hover:text-destructive'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeChoice(choice);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {editingChoices?.choices.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No choices defined</p>
                )}
              </div>
            </div>

            {/* Add new choice */}
            <div className="space-y-2">
              <Label>Add New Choice</Label>
              <div className="flex gap-2">
                <Input
                  value={newChoiceInput}
                  onChange={(e) => setNewChoiceInput(e.target.value)}
                  placeholder="Enter new choice..."
                  onKeyDown={(e) => e.key === 'Enter' && addChoice()}
                />
                <Button variant="outline" size="icon" onClick={addChoice} disabled={!newChoiceInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingChoices(null)}>
              Cancel
            </Button>
            <Button onClick={saveChoices} disabled={savingChoices}>
              {savingChoices ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
