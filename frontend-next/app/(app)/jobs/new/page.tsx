"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";

// Dynamically import LocationMapSelector to avoid SSR issues
const LocationMapSelector = dynamic(
  () => import("@/components/jobs/LocationMapSelector").then((mod) => mod.LocationMapSelector),
  { ssr: false }
);

interface JobFormData {
  title: string;
  job_number: string;
  site_supervisor_name: string;
  address: string;
  description: string;
  job_type_id: string;
  job_status_id: string;
  job_stage_id: string;
  contract_value: string;
  latitude: number | null;
  longitude: number | null;
}

interface JobType {
  id: number;
  name: string;
}

interface JobStatus {
  id: number;
  name: string;
}

interface JobStage {
  id: number;
  name: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [loadingLookups, setLoadingLookups] = React.useState(true);
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);

  const [formData, setFormData] = React.useState<JobFormData>({
    title: "",
    job_number: "",
    site_supervisor_name: "",
    address: "",
    description: "",
    job_type_id: "",
    job_status_id: "",
    job_stage_id: "",
    contract_value: "",
    latitude: null,
    longitude: null,
  });

  // Load job types, statuses, and stages
  React.useEffect(() => {
    const loadLookupData = async () => {
      try {
        setLoadingLookups(true);
        const [typesData, statusesData] = await Promise.all([
          api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
          api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        ]);

        setJobTypes(typesData?.job_types || []);
        setJobStatuses(statusesData?.job_statuses || []);

        // Set default values if available
        if (typesData?.job_types && typesData.job_types.length > 0) {
          setFormData(prev => ({ ...prev, job_type_id: typesData.job_types[0].id.toString() }));
        }
        if (statusesData?.job_statuses && statusesData.job_statuses.length > 0) {
          // Default to "Enquiry" if it exists
          const enquiryStatus = statusesData.job_statuses.find(s => s.name === "Enquiry");
          const defaultStatus = enquiryStatus || statusesData.job_statuses[0];
          setFormData(prev => ({ ...prev, job_status_id: defaultStatus.id.toString() }));
        }
      } catch (error) {
        console.error("Failed to load lookup data:", error);
      } finally {
        setLoadingLookups(false);
      }
    };

    loadLookupData();
  }, []);

  // Load stages when type and status are selected
  React.useEffect(() => {
    const loadStages = async () => {
      if (!formData.job_type_id || !formData.job_status_id) {
        setJobStages([]);
        setFormData(prev => ({ ...prev, job_stage_id: "" }));
        return;
      }

      try {
        const stagesData = await api.get<{ stages: JobStage[] }>(
          `/api/v1/job_types/${formData.job_type_id}/statuses/${formData.job_status_id}/stages`
        );

        setJobStages(stagesData?.stages || []);

        // Set first stage as default if available
        if (stagesData?.stages && stagesData.stages.length > 0) {
          setFormData(prev => ({ ...prev, job_stage_id: stagesData.stages[0].id.toString() }));
        } else {
          setFormData(prev => ({ ...prev, job_stage_id: "" }));
        }
      } catch (error) {
        console.error("Failed to load stages:", error);
        setJobStages([]);
        setFormData(prev => ({ ...prev, job_stage_id: "" }));
      }
    };

    loadStages();
  }, [formData.job_type_id, formData.job_status_id]);

  const handleChange = (field: keyof JobFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (data: {
    location?: string;
    latitude?: number;
    longitude?: number;
    title?: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      address: data.location || prev.address,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      title: data.title || prev.title,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post<{ id: number }>("/api/v1/jobs", {
        job: {
          title: formData.title,
          job_number: formData.job_number,
          site_supervisor_name: formData.site_supervisor_name,
          location: formData.address,
          latitude: formData.latitude,
          longitude: formData.longitude,
          description: formData.description,
          job_type_id: formData.job_type_id ? parseInt(formData.job_type_id) : null,
          job_status_id: formData.job_status_id ? parseInt(formData.job_status_id) : null,
          job_stage_id: formData.job_stage_id ? parseInt(formData.job_stage_id) : null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : 0,
        },
      });

      // Navigate to the new job
      router.push(`/jobs/${response?.id || 1}`);
    } catch (error) {
      console.error("Failed to create job:", error);
      // For demo purposes, navigate to jobs list
      router.push("/jobs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">New Job</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new construction project
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>Basic information about the job</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Smith Residence - New Build"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job_number">Job Number</Label>
                  <Input
                    id="job_number"
                    placeholder="e.g., JOB-2024-001"
                    value={formData.job_number}
                    onChange={(e) => handleChange("job_number", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_supervisor_name">Site Supervisor Name *</Label>
                <Input
                  id="site_supervisor_name"
                  placeholder="e.g., John Smith"
                  value={formData.site_supervisor_name}
                  onChange={(e) => handleChange("site_supervisor_name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Site Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Main Street, Sydney NSW 2000"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use the map below to select the exact location
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the project..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                />
              </div>

              {/* Map Selector */}
              <div className="space-y-2">
                <Label>Location Pin</Label>
                <LocationMapSelector
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onLocationChange={handleLocationChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Project Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Type, status, stage and financial details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLookups ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="job_type_id">Job Type *</Label>
                    <Select
                      value={formData.job_type_id}
                      onValueChange={(value) => handleChange("job_type_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_status_id">Job Status *</Label>
                    <Select
                      value={formData.job_status_id}
                      onValueChange={(value) => handleChange("job_status_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_stage_id">Job Stage</Label>
                    <Select
                      value={formData.job_stage_id}
                      onValueChange={(value) => handleChange("job_stage_id", value)}
                      disabled={jobStages.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={jobStages.length === 0 ? "No stages available" : "Select stage"} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id.toString()}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {jobStages.length === 0 && formData.job_type_id && formData.job_status_id && (
                      <p className="text-xs text-muted-foreground">
                        No stages configured for this type and status combination
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract_value">Contract Value ($)</Label>
                    <Input
                      id="contract_value"
                      type="number"
                      placeholder="e.g., 500000"
                      value={formData.contract_value}
                      onChange={(e) => handleChange("contract_value", e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/jobs">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || loadingLookups}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Job"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
