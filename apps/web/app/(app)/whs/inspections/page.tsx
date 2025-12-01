"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

interface InspectionItem {
  id: number;
  name: string;
  status: "pass" | "fail" | "na";
  notes?: string;
}

interface Inspection {
  id: number;
  title: string;
  template_name: string;
  job_id: number;
  job_title: string;
  location: string;
  status: "scheduled" | "in_progress" | "completed" | "overdue";
  scheduled_date: string;
  completed_date?: string;
  inspector: string;
  score?: number;
  items_passed: number;
  items_failed: number;
  items_total: number;
  action_items: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-800"><ClipboardCheck className="h-3 w-3 mr-1" />In Progress</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    case "overdue":
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

export default function WHSInspectionsPage() {
  const [inspections, setInspections] = React.useState<Inspection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    const fetchInspections = async () => {
      try {
        const response = await api.get<{ inspections: Inspection[] }>("/api/v1/whs/inspections");
        setInspections(response.inspections || []);
      } catch (error) {
        // Mock data
        setInspections([
          {
            id: 1,
            title: "Weekly Site Safety Inspection",
            template_name: "General Site Safety Checklist",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            location: "Full site",
            status: "completed",
            scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            completed_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            inspector: "Sarah Wilson",
            score: 94,
            items_passed: 47,
            items_failed: 3,
            items_total: 50,
            action_items: 2,
          },
          {
            id: 2,
            title: "Scaffold Pre-Use Inspection",
            template_name: "Scaffold Safety Checklist",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            location: "Main scaffold",
            status: "completed",
            scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            completed_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            inspector: "Mike Johnson",
            score: 100,
            items_passed: 25,
            items_failed: 0,
            items_total: 25,
            action_items: 0,
          },
          {
            id: 3,
            title: "Monthly Fire Equipment Check",
            template_name: "Fire Safety Checklist",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            location: "Site office",
            status: "scheduled",
            scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            inspector: "David Brown",
            items_passed: 0,
            items_failed: 0,
            items_total: 15,
            action_items: 0,
          },
          {
            id: 4,
            title: "Electrical Safety Audit",
            template_name: "Electrical Safety Checklist",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            location: "Electrical room",
            status: "overdue",
            scheduled_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            inspector: "Emma Davis",
            items_passed: 0,
            items_failed: 0,
            items_total: 30,
            action_items: 0,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchInspections();
  }, []);

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch =
      inspection.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.inspector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || inspection.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: inspections.length,
    completed: inspections.filter((i) => i.status === "completed").length,
    scheduled: inspections.filter((i) => i.status === "scheduled").length,
    overdue: inspections.filter((i) => i.status === "overdue").length,
    avgScore: Math.round(
      inspections
        .filter((i) => i.score !== undefined)
        .reduce((sum, i) => sum + (i.score || 0), 0) /
        inspections.filter((i) => i.score !== undefined).length || 0
    ),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/whs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Site Inspections</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conduct and track workplace safety inspections
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Inspection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Inspections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
              {stats.avgScore}%
            </div>
            <p className="text-sm text-muted-foreground">Avg. Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inspections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inspections Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inspection</TableHead>
              <TableHead>Job Site</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Results</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInspections.length > 0 ? (
              filteredInspections.map((inspection) => (
                <TableRow key={inspection.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{inspection.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {inspection.template_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{inspection.job_title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {inspection.location}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {inspection.inspector}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(inspection.scheduled_date).toLocaleDateString("en-AU")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {inspection.status === "completed" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(inspection.score || 0)}`}>
                            {inspection.score}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({inspection.items_passed}/{inspection.items_total})
                          </span>
                        </div>
                        <Progress value={inspection.score} className="h-1.5 w-24" />
                        {inspection.action_items > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {inspection.action_items} action items
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {inspection.items_total} items
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(inspection.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      {inspection.status === "scheduled" || inspection.status === "overdue"
                        ? "Start"
                        : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No inspections found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
