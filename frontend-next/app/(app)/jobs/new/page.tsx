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

interface JobFormData {
  title: string;
  job_number: string;
  client_name: string;
  address: string;
  description: string;
  construction_stage: string;
  contract_value: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<JobFormData>({
    title: "",
    job_number: "",
    client_name: "",
    address: "",
    description: "",
    construction_stage: "planning",
    contract_value: "",
  });

  const handleChange = (field: keyof JobFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/api/v1/jobs", {
        job: {
          ...formData,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : 0,
        },
      });

      // Navigate to the new job
      router.push(`/jobs/${response.id || 1}`);
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
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  placeholder="e.g., John Smith"
                  value={formData.client_name}
                  onChange={(e) => handleChange("client_name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Site Address *</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Main Street, Sydney NSW 2000"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  required
                />
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
            </CardContent>
          </Card>

          {/* Project Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Stage and financial details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="construction_stage">Construction Stage</Label>
                <Select
                  value={formData.construction_stage}
                  onValueChange={(value) => handleChange("construction_stage", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="pre-construction">Pre-Construction</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="fitout">Fitout</SelectItem>
                    <SelectItem value="handover">Handover</SelectItem>
                  </SelectContent>
                </Select>
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
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/jobs">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
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
