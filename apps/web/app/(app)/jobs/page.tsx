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
            title: "Project Alpha - Commercial Building",
            job_number: "JOB-2024-001",
            status: "active",
            client_name: "Acme Corporation",
            address: "123 Main Street, Sydney NSW 2000",
            construction_stage: "Construction",
            created_at: "2024-01-15",
          },
          {
            id: 2,
            title: "Residential Complex - Phase 2",
            job_number: "JOB-2024-002",
            status: "in_progress",
            client_name: "Smith Holdings",
            address: "456 Park Avenue, Melbourne VIC 3000",
            construction_stage: "Framing",
            created_at: "2024-02-20",
          },
          {
            id: 3,
            title: "Office Renovation - Tech Hub",
            job_number: "JOB-2024-003",
            status: "on_hold",
            client_name: "TechStart Inc",
            address: "789 Innovation Drive, Brisbane QLD 4000",
            construction_stage: "Planning",
            created_at: "2024-03-01",
          },
          {
            id: 4,
            title: "Warehouse Extension",
            job_number: "JOB-2024-004",
            status: "completed",
            client_name: "Logistics Plus",
            address: "321 Industrial Way, Perth WA 6000",
            construction_stage: "Completed",
            created_at: "2024-01-05",
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Job
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
