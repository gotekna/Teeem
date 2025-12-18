"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import {
  FileText,
  Mail,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle,
  Plus,
  Eye,
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { EmailPlansModal } from "@/components/plans/EmailPlansModal";

interface PlanType {
  id: number;
  code: string;
  name: string;
  category_name: string;
}

interface Revision {
  id: number;
  job_plan_id: number;
  revision: string;
  revision_label: string;
  revision_date: string | null;
  issued_date: string | null;
  is_on_issue: boolean;
  has_file: boolean;
  sharepoint_file_id: string | null;
  sharepoint_web_url: string | null;
  file_name: string | null;
  file_size: number | null;
  formatted_file_size: string | null;
  notes: string | null;
  issued_by: { id: number; name: string } | null;
}

interface JobPlan {
  id: number;
  job_id: number;
  job_plan_tab_id: number | null;
  plan_type_id: number | null;
  variant_suffix: string | null;
  display_name: string;
  plan_type: PlanType | null;
  current_revision: Revision | null;
  revision_count: number;
}

interface PlanTab {
  id: number;
  name: string;
  code: string | null;
  plan_count: number;
  on_issue_count: number;
  children: PlanTab[];
}

interface JobPlansTabProps {
  jobId: number;
  jobTitle: string;
}

export function JobPlansTab({ jobId, jobTitle }: JobPlansTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("on-issue");
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [tabs, setTabs] = useState<PlanTab[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<JobPlan | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = activeSubTab === "on-issue"
        ? `/api/v1/jobs/${jobId}/job_plans/on_issue`
        : `/api/v1/jobs/${jobId}/job_plans`;

      const response = await api.get(endpoint) as { success: boolean; data?: JobPlan[]; error?: string };

      if (response.success) {
        setPlans(response.data || []);
      } else {
        setError(response.error || "Failed to load plans");
      }
    } catch (err) {
      setError("Failed to load plans");
      console.error("Error fetching plans:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, activeSubTab]);

  // Fetch tabs (categories)
  const fetchTabs = useCallback(async () => {
    try {
      const response = await api.get(`/api/v1/jobs/${jobId}/job_plans/tabs`) as { success: boolean; data?: PlanTab[] };
      if (response.success) {
        setTabs(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching tabs:", err);
    }
  }, [jobId]);

  useEffect(() => {
    fetchPlans();
    fetchTabs();
  }, [fetchPlans, fetchTabs]);

  // Toggle plan selection
  const togglePlanSelection = (planId: number) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  // Select all plans
  const selectAllPlans = () => {
    if (selectedPlanIds.length === plans.length) {
      setSelectedPlanIds([]);
    } else {
      setSelectedPlanIds(plans.map((p) => p.id));
    }
  };

  // Get PDF preview URL
  const getPdfPreviewUrl = (revision: Revision | null) => {
    if (!revision?.sharepoint_file_id) return null;
    return `${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${revision.sharepoint_file_id}&preview=true`;
  };

  // Render plans table
  const renderPlansTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="mb-4">{error}</p>
          <Button variant="outline" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg mb-2">No plans found</p>
          <p className="text-sm">
            {activeSubTab === "on-issue"
              ? "No plans are currently on issue"
              : "Upload plans to get started"}
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={selectedPlanIds.length === plans.length && plans.length > 0}
                  onCheckedChange={selectAllPlans}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Sheet</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Revision</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={`border-t hover:bg-muted/30 cursor-pointer ${
                  selectedPlan?.id === plan.id ? "bg-muted/50" : ""
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedPlanIds.includes(plan.id)}
                    onCheckedChange={() => togglePlanSelection(plan.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{plan.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {plan.plan_type?.category_name || "-"}
                </td>
                <td className="px-4 py-3">
                  {plan.current_revision ? (
                    <Badge variant="outline">
                      {plan.current_revision.revision_label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {plan.current_revision?.revision_date || "-"}
                </td>
                <td className="px-4 py-3">
                  {plan.current_revision?.is_on_issue ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      On Issue
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {plan.current_revision?.sharepoint_web_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(plan.current_revision!.sharepoint_web_url!, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render preview panel
  const renderPreviewPanel = () => {
    if (!selectedPlan) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p>Select a plan to preview</p>
        </div>
      );
    }

    const previewUrl = getPdfPreviewUrl(selectedPlan.current_revision);

    if (!previewUrl) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p className="mb-2">{selectedPlan.display_name}</p>
          <p className="text-sm">No file attached</p>
          {selectedPlan.current_revision?.sharepoint_web_url && (
            <Button
              className="mt-4"
              onClick={() => window.open(selectedPlan.current_revision!.sharepoint_web_url!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in SharePoint
            </Button>
          )}
        </div>
      );
    }

    return (
      <PDFViewer
        url={previewUrl}
        fallbackUrl={selectedPlan.current_revision?.sharepoint_web_url || undefined}
        className="h-full"
      />
    );
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header with actions */}
      <div className="px-4 pb-4 flex items-center justify-between shrink-0">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="on-issue">On Issue</TabsTrigger>
            <TabsTrigger value="all">All Plans</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {selectedPlanIds.length > 0 && (
            <Button variant="outline" onClick={() => setShowEmailModal(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Email ({selectedPlanIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      {tabs.length > 0 && (
        <div className="px-4 pb-4 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Badge variant="outline" className="cursor-pointer whitespace-nowrap">
              All ({plans.length})
            </Badge>
            {tabs.map((tab) => (
              <Badge
                key={tab.id}
                variant="outline"
                className="cursor-pointer whitespace-nowrap"
              >
                {tab.name} ({tab.on_issue_count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main content: table + preview */}
      <div className="flex-1 flex gap-4 px-4 min-h-0">
        {/* Plans table */}
        <div className="flex-1 overflow-auto">
          {renderPlansTable()}
        </div>

        {/* Preview panel */}
        <Card className="w-[400px] shrink-0 flex flex-col">
          <CardHeader className="py-3 shrink-0">
            <CardTitle className="text-sm font-medium">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {renderPreviewPanel()}
          </CardContent>
        </Card>
      </div>

      {/* Email Plans Modal */}
      <EmailPlansModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        jobId={jobId}
        jobTitle={jobTitle}
        selectedPlans={plans.filter(p => selectedPlanIds.includes(p.id))}
        onSent={() => {
          setSelectedPlanIds([]);
        }}
      />
    </div>
  );
}
