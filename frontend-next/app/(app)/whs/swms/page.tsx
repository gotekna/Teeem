"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Copy,
  Eye,
  Edit,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { BackButton } from "@/components/ui/back-button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";

interface SWMS {
  id: number;
  name: string;
  job_id: number;
  job_title: string;
  description?: string;
  status: "draft" | "active" | "expired" | "archived";
  version: number;
  created_at: string;
  valid_until: string;
  approved_by?: string;
  approved_at?: string;
  workers_count: number;
  hazards_count: number;
  controls_count: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
    case "draft":
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Draft</Badge>;
    case "expired":
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
    case "archived":
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getDaysRemaining(validUntil: string): number {
  const now = new Date();
  const expiry = new Date(validUntil);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function WHSSWMSPage() {
  const [swmsList, setSwmsList] = React.useState<SWMS[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    const fetchSWMS = async () => {
      try {
        const response = await api.get<{ swms: SWMS[] }>("/api/v1/whs/swms");
        setSwmsList(response.swms || []);
      } catch {
        // Mock data
        setSwmsList([
          {
            id: 1,
            name: "Excavation Works SWMS",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            description: "Safe work method statement for excavation and earthworks",
            status: "active",
            version: 2,
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            approved_by: "Sarah Wilson",
            approved_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
            workers_count: 8,
            hazards_count: 12,
            controls_count: 24,
          },
          {
            id: 2,
            name: "Working at Heights SWMS",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            description: "Safe work procedures for elevated work platforms and scaffolding",
            status: "active",
            version: 1,
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 76 * 24 * 60 * 60 * 1000).toISOString(),
            approved_by: "Mike Johnson",
            approved_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
            workers_count: 5,
            hazards_count: 8,
            controls_count: 16,
          },
          {
            id: 3,
            name: "Concrete Pouring SWMS",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            description: "Safe work method for concrete delivery and placement",
            status: "draft",
            version: 1,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            workers_count: 0,
            hazards_count: 6,
            controls_count: 12,
          },
          {
            id: 4,
            name: "Electrical Installation SWMS",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            description: "Safe work procedures for electrical rough-in and fit-off",
            status: "expired",
            version: 3,
            created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
            valid_until: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            approved_by: "David Brown",
            approved_at: new Date(Date.now() - 118 * 24 * 60 * 60 * 1000).toISOString(),
            workers_count: 3,
            hazards_count: 10,
            controls_count: 20,
          },
          {
            id: 5,
            name: "Demolition Works SWMS",
            job_id: 89,
            job_title: "Office Renovation",
            description: "Safe work method for internal demolition",
            status: "active",
            version: 1,
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
            approved_by: "Emma Davis",
            approved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            workers_count: 4,
            hazards_count: 15,
            controls_count: 30,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSWMS();
  }, []);

  const filteredSWMS = swmsList.filter((swms) => {
    const matchesSearch =
      swms.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      swms.job_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || swms.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: swmsList.length,
    active: swmsList.filter((s) => s.status === "active").length,
    draft: swmsList.filter((s) => s.status === "draft").length,
    expired: swmsList.filter((s) => s.status === "expired").length,
    expiringSoon: swmsList.filter((s) => {
      if (s.status !== "active") return false;
      const days = getDaysRemaining(s.valid_until);
      return days > 0 && days <= 30;
    }).length,
  };

  if (loading) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/whs" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">SWMS Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Safe Work Method Statements
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create SWMS
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search SWMS..." className="flex-1 max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SWMS Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SWMS</TableHead>
              <TableHead>Job Site</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSWMS.length > 0 ? (
              filteredSWMS.map((swms) => {
                const daysRemaining = getDaysRemaining(swms.valid_until);
                const isExpiringSoon = swms.status === "active" && daysRemaining > 0 && daysRemaining <= 30;

                return (
                  <TableRow key={swms.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <ClipboardCheck className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5" />
                        <div>
                          <p className="font-medium">{swms.name}</p>
                          {swms.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {swms.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Version {swms.version}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{swms.job_title}</p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {swms.workers_count} workers
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{swms.hazards_count} hazards</span>
                          <span>•</span>
                          <span>{swms.controls_count} controls</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {swms.status === "active" || swms.status === "expired" ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {new Date(swms.valid_until).toLocaleDateString("en-AU")}
                          </div>
                          {swms.status === "active" && (
                            <div className="space-y-1">
                              <Progress
                                value={Math.max(0, Math.min(100, (daysRemaining / 90) * 100))}
                                className={`h-1.5 w-20 ${isExpiringSoon ? "[&>div]:bg-orange-500" : ""}`}
                              />
                              <p className={`text-xs ${isExpiringSoon ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}`}>
                                {daysRemaining} days remaining
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(swms.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Duplicate">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {swms.status === "draft" && (
                          <Button variant="ghost" size="icon" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="No SWMS found"
                    icon={<ClipboardCheck className="h-12 w-12" />}
                    action={{
                      label: "Create First SWMS",
                      onClick: () => {},
                    }}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
