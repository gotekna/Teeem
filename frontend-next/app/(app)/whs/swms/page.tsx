"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { BackButton } from "@/components/ui/back-button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
      } catch (err) {
        console.error("[SWMS] failed to fetch SWMS list:", err);
        setSwmsList([]);
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
                    title="No SWMS records yet"
                    description="Create your first Safe Work Method Statement to get started"
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
