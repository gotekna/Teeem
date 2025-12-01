"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  User,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface Incident {
  id: number;
  title: string;
  description: string;
  job_id: number;
  job_title: string;
  location: string;
  severity: "high" | "medium" | "low";
  status: "reported" | "investigating" | "resolved" | "closed";
  reported_at: string;
  reported_by: string;
  assigned_to?: string;
  resolution?: string;
  injury_type?: string;
  witnesses?: string[];
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge className="bg-orange-100 text-orange-800">Medium</Badge>;
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "reported":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Reported</Badge>;
    case "investigating":
      return <Badge className="bg-blue-100 text-blue-800"><Search className="h-3 w-3 mr-1" />Investigating</Badge>;
    case "resolved":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
    case "closed":
      return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WHSIncidentsPage() {
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [newIncidentOpen, setNewIncidentOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await api.get<{ incidents: Incident[] }>("/api/v1/whs/incidents");
        setIncidents(response.incidents || []);
      } catch (error) {
        // Mock data
        setIncidents([
          {
            id: 1,
            title: "Slip and fall near excavation",
            description: "Worker slipped on wet surface near excavation site. Minor bruising reported.",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            location: "Site B - Excavation Zone",
            severity: "medium",
            status: "investigating",
            reported_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            reported_by: "John Smith",
            assigned_to: "Sarah Wilson",
            injury_type: "Minor bruising",
          },
          {
            id: 2,
            title: "Near miss - falling debris",
            description: "Loose materials fell from scaffold. No injuries but near miss recorded.",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            location: "Main scaffold area",
            severity: "high",
            status: "resolved",
            reported_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            reported_by: "Mike Johnson",
            assigned_to: "David Brown",
            resolution: "Scaffold netting installed. Toolbox talk conducted with all workers.",
          },
          {
            id: 3,
            title: "Equipment malfunction",
            description: "Power tool overheated during operation. Tool isolated for inspection.",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            location: "Workshop",
            severity: "low",
            status: "closed",
            reported_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            reported_by: "Emma Davis",
            resolution: "Tool sent for repair. Replacement provided.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.reported_by.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => ["reported", "investigating"].includes(i.status)).length,
    high: incidents.filter((i) => i.severity === "high").length,
    thisMonth: incidents.filter((i) => {
      const date = new Date(i.reported_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
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
            <h1 className="text-2xl font-bold tracking-tight font-serif">Incident Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage workplace safety incidents
            </p>
          </div>
        </div>
        <Dialog open={newIncidentOpen} onOpenChange={setNewIncidentOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Report Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
              <DialogDescription>
                Document a workplace safety incident for investigation
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Incident Title</Label>
                <Input id="title" placeholder="Brief description of the incident" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="job">Job Site</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="42">Smith Residence - Foundation</SelectItem>
                      <SelectItem value="67">Commercial Fitout - Level 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="Specific location within the site" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed description of what happened..."
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="injury">Injury Type (if any)</Label>
                <Input id="injury" placeholder="e.g., Minor bruising, No injury" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewIncidentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setNewIncidentOpen(false)}>Submit Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-orange-600">{stats.open}</div>
            <p className="text-sm text-muted-foreground">Open Cases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{stats.high}</div>
            <p className="text-sm text-muted-foreground">High Severity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-sm text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
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
            <SelectItem value="reported">Reported</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Incidents Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Incident</TableHead>
              <TableHead>Job Site</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                        incident.severity === "high" ? "text-red-500" :
                        incident.severity === "medium" ? "text-orange-500" : "text-gray-400"
                      }`} />
                      <div>
                        <p className="font-medium">{incident.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {incident.description}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{incident.job_title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {incident.location}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">
                        {new Date(incident.reported_at).toLocaleDateString("en-AU")}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {incident.reported_by}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                  <TableCell>{getStatusBadge(incident.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No incidents found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
