"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlTabs } from "@/hooks/useUrlTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Search,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle,
  Archive,
  Calendar,
  User,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { CaseProposalsTab } from "@/components/cases/case-proposals-tab";
import { useToast } from "@/components/ui/use-toast";

interface CaseItem {
  id: number;
  case_number: string;
  title: string;
  case_type: string;
  formatted_case_type: string;
  status: string;
  formatted_status: string;
  priority: string;
  formatted_priority: string;
  deadline: string | null;
  overdue: boolean;
  days_until_deadline: number | null;
  primary_entity_name: string | null;
  assigned_to: string | null;
  created_by: string | null;
  actions_count: number;
  documents_count: number;
  created_at: string;
}

interface CaseTypes {
  case_types: Record<string, string>;
  statuses: Record<string, string>;
  priorities: Record<string, string>;
}

export default function CasesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useUrlTabs("cases");
  const [loading, setLoading] = React.useState(true);
  const [cases, setCases] = React.useState<CaseItem[]>([]);
  const [types, setTypes] = React.useState<CaseTypes | null>(null);
  const [meta, setMeta] = React.useState<{ total: number; open: number; overdue: number }>({
    total: 0,
    open: 0,
    overdue: 0,
  });

  // Pending proposals count for tab badge
  const [pendingProposals, setPendingProposals] = React.useState(0);

  // Filters
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  // Load case types
  React.useEffect(() => {
    const loadTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: CaseTypes }>("/api/v1/cases/types");
        setTypes(response.data);
      } catch (error) {
        console.error("Failed to load case types:", error);
      }
    };
    loadTypes();
  }, []);

  // Load cases
  React.useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (typeFilter !== "all") params.append("case_type", typeFilter);
        if (priorityFilter !== "all") params.append("priority", priorityFilter);

        const response = await api.get<{
          success: boolean;
          data: CaseItem[];
          meta: { total: number; open: number; overdue: number };
        }>(`/api/v1/cases?${params.toString()}`);

        setCases(response.data || []);
        setMeta(response.meta || { total: 0, open: 0, overdue: 0 });
      } catch (error) {
        console.error("Failed to load cases:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(loadCases, 300);
    return () => clearTimeout(debounce);
  }, [search, statusFilter, typeFilter, priorityFilter]);

  // Delete case handler
  const handleDeleteCase = async (caseId: number, caseTitle: string, e: React.MouseEvent) => {
    // Stop propagation to prevent navigating to case detail
    e.stopPropagation();

    const confirmed = confirm(
      `Are you sure you want to delete "${caseTitle}"?\n\nThis action cannot be undone. All case data, documents, emails, and relationships will be permanently deleted.`
    );

    if (!confirmed) return;

    try {
      const response = await api.delete<{ success: boolean }>(`/api/v1/cases/${caseId}`);

      if (response?.success) {
        toast({
          title: "Success",
          description: "Case deleted successfully",
        });
        // Refresh the cases list
        setCases(cases.filter((c) => c.id !== caseId));
        // Update meta counts
        setMeta({
          ...meta,
          total: meta.total - 1,
          open: meta.open - 1,
        });
      }
    } catch (error) {
      console.error("Failed to delete case:", error);
      toast({
        title: "Error",
        description: "Failed to delete case",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <Briefcase className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "review":
        return <AlertTriangle className="h-4 w-4" />;
      case "closed":
        return <CheckCircle className="h-4 w-4" />;
      case "archived":
        return <Archive className="h-4 w-4" />;
      default:
        return <Briefcase className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "in_progress":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "review":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "closed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "archived":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "normal":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "low":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCaseTypeColor = (type: string) => {
    switch (type) {
      case "ato_audit":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "legal_dispute":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "director_investigation":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "compliance_review":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "due_diligence":
        return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Investigations, audits, and compliance reviews
          </p>
        </div>
        <Button onClick={() => router.push("/cases/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Tabs for Cases and Proposals */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="cases" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Cases
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Email Proposals
            {pendingProposals > 0 && (
              <Badge className="ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0">
                {pendingProposals}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-6 mt-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cases..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {types?.statuses &&
                      Object.entries(types.statuses).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Case Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {types?.case_types &&
                      Object.entries(types.case_types).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {types?.priorities &&
                      Object.entries(types.priorities).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cases List */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No cases found</p>
                  <p className="text-sm mt-1">Create a new case to get started</p>
                </div>
              ) : (
                <div className="divide-y">
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/cases/${c.id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-muted-foreground">
                              {c.case_number}
                            </span>
                            <Badge className={getCaseTypeColor(c.case_type)}>
                              {c.formatted_case_type}
                            </Badge>
                            <Badge className={getPriorityColor(c.priority)}>
                              {c.formatted_priority}
                            </Badge>
                          </div>
                          <h3 className="font-medium truncate">{c.title}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {c.primary_entity_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {c.primary_entity_name}
                              </span>
                            )}
                            {c.deadline && (
                              <span
                                className={`flex items-center gap-1 ${
                                  c.overdue ? "text-red-600" : ""
                                }`}
                              >
                                <Calendar className="h-3 w-3" />
                                {format(new Date(c.deadline), "d MMM yyyy")}
                                {c.overdue && " (Overdue)"}
                              </span>
                            )}
                            <span>
                              {c.actions_count} actions · {c.documents_count} docs
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(c.status)}>
                            {getStatusIcon(c.status)}
                            <span className="ml-1">{c.formatted_status}</span>
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteCase(c.id, c.title, e)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Proposals Tab */}
        <TabsContent value="proposals" className="mt-6">
          <CaseProposalsTab onPendingCountChange={setPendingProposals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
