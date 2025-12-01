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
  ted_number: string | null;
  stage: string | null;
  contract_value: number | null;
  live_profit: number | null;
  profit_percentage: number | null;
  start_date: string | null;
  location: string | null;
  site_supervisor_name: string | null;
  site_supervisor_email: string | null;
  site_supervisor_phone: string | null;
  design_name: string | null;
  created_at: string;
  updated_at: string;
}

const stageColors: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  "Deposit": "info",
  "Slab": "info",
  "Frame": "warning",
  "Lockup": "warning",
  "Fixtures": "success",
  "Completion": "success",
  "Quote": "default",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await api.get<{ jobs: Job[]; total: number }>('/api/v1/jobs');
        setJobs(response.jobs || []);
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
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.ted_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.site_supervisor_name?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="text-2xl font-bold font-mono text-blue-600">
              {jobs.filter((j) => j.stage === "Slab" || j.stage === "Frame").length}
            </div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-green-600">
              {jobs.filter((j) => j.stage === "Completion").length}
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-purple-600">
              ${jobs.reduce((sum, j) => sum + (j.contract_value || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Value</p>
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
              <TableHead>TED #</TableHead>
              <TableHead>Title / Location</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Contract Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono">{job.ted_number || "-"}</TableCell>
                <TableCell>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{job.location}</p>
                </TableCell>
                <TableCell>
                  {job.site_supervisor_name || "-"}
                  {job.site_supervisor_phone && (
                    <p className="text-xs text-muted-foreground">{job.site_supervisor_phone}</p>
                  )}
                </TableCell>
                <TableCell>
                  {job.stage ? (
                    <Pill variant={stageColors[job.stage] || "default"} size="sm">
                      {job.stage}
                    </Pill>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {job.contract_value ? `$${job.contract_value.toLocaleString()}` : "-"}
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
