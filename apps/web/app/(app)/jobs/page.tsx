"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader } from "@/components/ui/loader";
import { Plus, Search, Filter } from "lucide-react";

interface Job {
  id: number;
  title: string;
  job_number: string;
  status: string;
  client_name: string;
  address: string;
  construction_stage: string;
  created_at: string;
}

const statusColors: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  active: "success",
  "in_progress": "info",
  completed: "success",
  on_hold: "warning",
  cancelled: "error",
  draft: "default",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadJobs = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await api.get('/api/v1/jobs');
        // setJobs(response.jobs);

        // Mock data for now
        setJobs([
          {
            id: 1,
            title: "Harrison Residence - Custom Home",
            job_number: "JOB-2024-001",
            status: "active",
            client_name: "Michael & Sarah Harrison",
            address: "42 Riverside Drive, Bulimba QLD 4171",
            construction_stage: "Framing",
            created_at: "2024-09-15",
          },
          {
            id: 2,
            title: "Coastal Views Duplex",
            job_number: "JOB-2024-002",
            status: "active",
            client_name: "Patterson Developments",
            address: "18 Ocean Parade, Mermaid Beach QLD 4218",
            construction_stage: "Slab",
            created_at: "2024-10-01",
          },
          {
            id: 3,
            title: "Thompson Family Home - Renovation",
            job_number: "JOB-2024-003",
            status: "in_progress",
            client_name: "David Thompson",
            address: "156 Queensport Road, Murarrie QLD 4172",
            construction_stage: "Internal Fit-out",
            created_at: "2024-08-20",
          },
          {
            id: 4,
            title: "Greenfield Estate - Lot 45",
            job_number: "JOB-2024-004",
            status: "active",
            client_name: "James & Emily Chen",
            address: "45 Greenfield Circuit, Springfield QLD 4300",
            construction_stage: "Lock-up",
            created_at: "2024-07-10",
          },
          {
            id: 5,
            title: "Ascot Terrace - Townhouse",
            job_number: "JOB-2024-005",
            status: "on_hold",
            client_name: "Ascot Property Group",
            address: "8/22 Lancaster Road, Ascot QLD 4007",
            construction_stage: "Planning",
            created_at: "2024-11-01",
          },
          {
            id: 6,
            title: "Industrial Shed - BrisWest",
            job_number: "JOB-2024-006",
            status: "active",
            client_name: "BrisWest Logistics Pty Ltd",
            address: "Unit 3, 89 Industrial Avenue, Wacol QLD 4076",
            construction_stage: "Steel Erection",
            created_at: "2024-10-15",
          },
          {
            id: 7,
            title: "Roberts Granny Flat",
            job_number: "JOB-2024-007",
            status: "completed",
            client_name: "Margaret Roberts",
            address: "14 Jacaranda Street, Kenmore QLD 4069",
            construction_stage: "Completed",
            created_at: "2024-06-01",
          },
          {
            id: 8,
            title: "Waverly Heights - New Build",
            job_number: "JOB-2024-008",
            status: "active",
            client_name: "Tom & Jessica Miller",
            address: "27 Hillcrest Avenue, Camp Hill QLD 4152",
            construction_stage: "Roof",
            created_at: "2024-08-05",
          },
          {
            id: 9,
            title: "Commercial Fit-out - Queen St",
            job_number: "JOB-2024-009",
            status: "in_progress",
            client_name: "CBD Medical Centre",
            address: "Level 5, 120 Queen Street, Brisbane QLD 4000",
            construction_stage: "Services Rough-in",
            created_at: "2024-09-20",
          },
          {
            id: 10,
            title: "Poolside Pavilion - Johnson",
            job_number: "JOB-2024-010",
            status: "draft",
            client_name: "Richard Johnson",
            address: "89 Esplanade, Sandgate QLD 4017",
            construction_stage: "Quoting",
            created_at: "2024-11-15",
          },
        ]);
      } catch (error) {
        console.error("Failed to load jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your construction projects and jobs
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-green-600">
              {jobs.filter((j) => j.status === "active" || j.status === "in_progress").length}
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-yellow-600">
              {jobs.filter((j) => j.status === "on_hold").length}
            </div>
            <p className="text-xs text-muted-foreground">On Hold</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono">
              {jobs.filter((j) => j.status === "completed").length}
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Jobs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono">{job.job_number}</TableCell>
                <TableCell>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{job.address}</p>
                </TableCell>
                <TableCell>{job.client_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{job.construction_stage}</Badge>
                </TableCell>
                <TableCell>
                  <Pill variant={statusColors[job.status] || "default"} size="sm">
                    {job.status.replace("_", " ")}
                  </Pill>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/jobs/${job.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
