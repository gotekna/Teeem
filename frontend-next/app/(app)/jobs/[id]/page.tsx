"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { HierarchicalTabsList } from "@/components/ui/hierarchical-tabs-list";
// SSoT: Using unified EntityTabs API directly (Phase 5 - no adapter hooks)
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
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
  Loader2,
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
  Map,
} from "lucide-react";
import { api } from "@/lib/api";
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
import { JobCommunicationsTab } from "@/components/jobs/JobCommunicationsTab";
import { JobProfitTab } from "@/components/jobs/JobProfitTab";
import { JobClaimStagesTab } from "@/components/jobs/JobClaimStagesTab";
import { JobScheduleTab } from "@/components/jobs/JobScheduleTab";
import { ColourSelectionBuilder } from "@/components/colours/ColourSelectionBuilder";
import { SpecificationBuilder } from "@/components/specifications/SpecificationBuilder";

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

    const timeoutId = setTimeout(searchSuburbs, 300);
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
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
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
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
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
  useSetLayoutMode("full-height");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Dynamic job tabs configuration - SSoT: unified EntityTabs API directly (Phase 5)
  const { tabs: jobTabs, loading: tabsLoading } = useEntityTabs({ scope: "job" });

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

  // Get tab from URL or default to "overview"
  const tabFromUrl = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = React.useState(tabFromUrl);

  // Helper: find first enabled child of a parent tab
  const findFirstChildTab = React.useCallback((tabKey: string): string | null => {
    const parentTab = jobTabs.find(t => t.tab_key === tabKey);
    if (parentTab?.children?.length) {
      const firstEnabledChild = parentTab.children.find(c => c.enabled);
      return firstEnabledChild?.tab_key || null;
    }
    return null;
  }, [jobTabs]);

  // Auto-select first child when landing on a parent tab
  React.useEffect(() => {
    if (jobTabs.length > 0) {
      const firstChild = findFirstChildTab(activeTab);
      if (firstChild) {
        setActiveTab(firstChild);
        const newUrl = `/jobs/${jobId}?tab=${firstChild}`;
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [jobTabs, activeTab, findFirstChildTab, jobId, router]);

  // Update URL when tab changes - keep numeric ID in URL
  const handleTabChange = React.useCallback((newTab: string) => {
    // If clicking a parent tab with children, select first child instead
    const firstChild = findFirstChildTab(newTab);
    const effectiveTab = firstChild || newTab;

    setActiveTab(effectiveTab);
    // Only add ?tab= for non-default tabs (cleaner URLs)
    const newUrl = effectiveTab === "overview"
      ? `/jobs/${jobId}`
      : `/jobs/${jobId}?tab=${effectiveTab}`;
    router.replace(newUrl, { scroll: false });
  }, [jobId, router, findFirstChildTab]);

  const loadJob = React.useCallback(async () => {
    try {
      const data = await api.get<Job>(`/api/v1/jobs/${jobId}`);
      setJob(data);
    } catch (error) {
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

  if (loading || tabsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
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
        {/* Header row - no pt-X, layout mode provides top padding */}
        <div className="px-3 pb-2 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">{job.name}</h1>
            <div className="flex items-center gap-2 mt-1 overflow-hidden">
              {/* Job Type - Status - Job Stage */}
              <span className="text-sm text-muted-foreground shrink-0">{job.job_type?.name || "No Type"}</span>
              <span className="text-sm text-muted-foreground shrink-0">-</span>
              <span className="text-sm text-muted-foreground shrink-0">{job.job_status?.name || "No Status"}</span>
              <span className="text-sm text-muted-foreground shrink-0">-</span>
              <span className="text-sm text-muted-foreground shrink-0">{job.job_stage?.name || job.stage || "No Stage"}</span>
              {/* Dates */}
              <span className="text-sm text-muted-foreground shrink-0">·</span>
              <span className="text-sm shrink-0">
                <span className="text-muted-foreground">Start:</span>{" "}
                <span className="font-medium">
                  {job.start_date
                    ? new Date(job.start_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })
                    : "-"}
                </span>
              </span>
              <span className="text-sm text-muted-foreground shrink-0">·</span>
              <span className="text-sm shrink-0">
                <span className="text-muted-foreground">PC:</span>{" "}
                <span className="font-medium">
                  {job.practical_completion_date
                    ? new Date(job.practical_completion_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })
                    : "-"}
                </span>
              </span>
              {/* Owners (clients) - truncated to prevent layout shift */}
              {(() => {
                const owners = job.contacts?.filter(c => c.role === "client") || [];
                if (owners.length === 0) return null;
                return (
                  <>
                    <span className="text-sm text-muted-foreground shrink-0">·</span>
                    <span className="text-sm truncate max-w-[300px]">
                      <span className="text-muted-foreground">Owner:</span>{" "}
                      {owners.map((o, idx) => (
                        <span key={o.contact_id}>
                          {idx > 0 && " & "}
                          <Link
                            href={`/contacts/${o.contact_id}?returnTo=/jobs/${jobId}?tab=${activeTab}`}
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
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Contract Value */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-md">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatCurrency(job.contract_price || job.contract_value || 0)}</span>
          </div>
          {/* Profit */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-md">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatCurrency(job.live_profit || 0)}</span>
            <span className="text-muted-foreground text-sm">({Number(job.profit_percentage ?? 0).toFixed(1)}%)</span>
          </div>
          <Button onClick={() => router.push(`/jobs/${jobId}/schedule`)}>
            Open Schedule Master
          </Button>
        </div>
      </div>

        {/* Tabs trigger */}
        <div className="px-3 pb-2">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <HierarchicalTabsList
              tabs={jobTabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </Tabs>
        </div>
      </div>

      {/* Tab content - scrollable */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 px-3 pb-6">
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                            <Loader2 className="h-4 w-4 animate-spin" />
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
                          <Loader2 className="h-4 w-4 animate-spin" />
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
                          <Loader2 className="h-4 w-4 animate-spin" />
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

        <TabsContent value="contract" className="mt-4">
          <JobContractTab job={job} onUpdate={loadJob} />
        </TabsContent>

        <TabsContent value="specifications" className="mt-4">
          <SpecificationBuilder jobId={job.id} jobTypeId={job.job_type_id} />
        </TabsContent>

        <TabsContent value="colours" className="mt-4">
          <ColourSelectionBuilder jobId={job.id} jobTypeId={job.job_type_id} />
        </TabsContent>

        <TabsContent value="claims" className="mt-4">
          <JobClaimStagesTab jobId={job.id} contractValue={job.contract_value} />
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          <JobPeopleTab jobId={job.id} onUpdate={loadJob} />
        </TabsContent>

        <TabsContent value="purchase-orders" className="mt-4">
          <JobPurchaseOrdersTab jobId={job.id} jobTitle={job.name} />
        </TabsContent>

        <TabsContent value="estimates" className="mt-4">
          <JobEstimatorTab jobId={job.id} job={job} />
        </TabsContent>

        <TabsContent value="profit" className="mt-4">
          <JobProfitTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <JobActivityTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <JobBudgetTab jobId={job.id} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 h-[calc(100vh-300px)]">
          <JobScheduleTab jobId={jobId} />
        </TabsContent>

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

        <TabsContent value="rain-log" className="mt-4">
          <RainLogTab jobId={job.id} />
        </TabsContent>

        {/* Plans tab renders fullscreen overlay - handled separately below */}
        <TabsContent value="plans" className="hidden" />

        <TabsContent value="documents" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} />
        </TabsContent>

        {/* Photo child tabs - all render JobDocumentsTab with initial category */}
        <TabsContent value="site-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="site-photo" />
        </TabsContent>
        <TabsContent value="client-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="client-photo" />
        </TabsContent>
        <TabsContent value="slab-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="slab-photo" />
        </TabsContent>
        <TabsContent value="frame-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="frame-photo" />
        </TabsContent>
        <TabsContent value="pc-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="pc-photo" />
        </TabsContent>
        <TabsContent value="enclosed-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="enclosed-photo" />
        </TabsContent>
        <TabsContent value="fixing-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="fixing-photo" />
        </TabsContent>
        <TabsContent value="supervisor-photo" className="mt-4">
          <JobDocumentsTab jobId={job.id} jobTitle={job.name} initialCategory="supervisor-photo" />
        </TabsContent>

        <TabsContent value="coms" className="mt-4">
          <JobCommunicationsTab jobId={job.id} jobTitle={job.name} />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Team settings will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Job settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Help & Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Help documentation will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plans tab - only mount when active, key forces fresh mount each time */}
      {activeTab === "plans" && (
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
