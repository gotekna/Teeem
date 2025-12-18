"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Pencil, X, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Job {
  id: number;
  name: string;
  plan_number?: string;
  contract_price?: number;
  prime_cost?: number;
  provisional_sums?: number;
  contract_date?: string;
  build_period?: string;
  stage_slab?: string;
  stage_frame?: string;
  stage_enclosed?: string;
  stage_fixing?: string;
  stage_practical?: string;
  stage_weather?: string;
  weekend_work?: string;
  plan_date?: string;
  spec_date?: string;
  practical_completion_date?: string;
  warranty_end_date?: string;
}

interface JobContractTabProps {
  job: Job;
  onUpdate: () => void;
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function JobContractTab({ job, onUpdate }: JobContractTabProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_number: job.plan_number || "",
    contract_price: job.contract_price?.toString() || "",
    prime_cost: job.prime_cost?.toString() || "",
    provisional_sums: job.provisional_sums?.toString() || "",
    contract_date: job.contract_date || "",
    build_period: job.build_period || "",
    stage_slab: job.stage_slab || "",
    stage_frame: job.stage_frame || "",
    stage_enclosed: job.stage_enclosed || "",
    stage_fixing: job.stage_fixing || "",
    stage_practical: job.stage_practical || "",
    stage_weather: job.stage_weather || "",
    weekend_work: job.weekend_work || "",
    plan_date: job.plan_date || "",
    spec_date: job.spec_date || "",
    practical_completion_date: job.practical_completion_date || "",
    warranty_end_date: job.warranty_end_date || "",
  });

  // Sync form when job prop changes
  useEffect(() => {
    if (!isEditing) {
      setForm({
        plan_number: job.plan_number || "",
        contract_price: job.contract_price?.toString() || "",
        prime_cost: job.prime_cost?.toString() || "",
        provisional_sums: job.provisional_sums?.toString() || "",
        contract_date: job.contract_date || "",
        build_period: job.build_period || "",
        stage_slab: job.stage_slab || "",
        stage_frame: job.stage_frame || "",
        stage_enclosed: job.stage_enclosed || "",
        stage_fixing: job.stage_fixing || "",
        stage_practical: job.stage_practical || "",
        stage_weather: job.stage_weather || "",
        weekend_work: job.weekend_work || "",
        plan_date: job.plan_date || "",
        spec_date: job.spec_date || "",
        practical_completion_date: job.practical_completion_date || "",
        warranty_end_date: job.warranty_end_date || "",
      });
    }
  }, [job, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/jobs/${job.id}`, {
        job: {
          plan_number: form.plan_number || null,
          contract_price: form.contract_price ? parseFloat(form.contract_price) : null,
          prime_cost: form.prime_cost ? parseFloat(form.prime_cost) : null,
          provisional_sums: form.provisional_sums ? parseFloat(form.provisional_sums) : null,
          contract_date: form.contract_date || null,
          build_period: form.build_period || null,
          stage_slab: form.stage_slab || null,
          stage_frame: form.stage_frame || null,
          stage_enclosed: form.stage_enclosed || null,
          stage_fixing: form.stage_fixing || null,
          stage_practical: form.stage_practical || null,
          stage_weather: form.stage_weather || null,
          weekend_work: form.weekend_work || null,
          plan_date: form.plan_date || null,
          spec_date: form.spec_date || null,
          practical_completion_date: form.practical_completion_date || null,
          warranty_end_date: form.warranty_end_date || null,
        },
      });
      toast({ title: "Contract details saved" });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to save contract details:", error);
      toast({ title: "Failed to save contract details", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      plan_number: job.plan_number || "",
      contract_price: job.contract_price?.toString() || "",
      prime_cost: job.prime_cost?.toString() || "",
      provisional_sums: job.provisional_sums?.toString() || "",
      contract_date: job.contract_date || "",
      build_period: job.build_period || "",
      stage_slab: job.stage_slab || "",
      stage_frame: job.stage_frame || "",
      stage_enclosed: job.stage_enclosed || "",
      stage_fixing: job.stage_fixing || "",
      stage_practical: job.stage_practical || "",
      stage_weather: job.stage_weather || "",
      weekend_work: job.weekend_work || "",
      plan_date: job.plan_date || "",
      spec_date: job.spec_date || "",
      practical_completion_date: job.practical_completion_date || "",
      warranty_end_date: job.warranty_end_date || "",
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contract Details</h2>
          <p className="text-sm text-muted-foreground">
            Contract information and build schedule for document generation
          </p>
        </div>
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contract Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Number</Label>
                {isEditing ? (
                  <Input
                    value={form.plan_number}
                    onChange={(e) => setForm({ ...form, plan_number: e.target.value })}
                    placeholder="Enter plan number"
                  />
                ) : (
                  <p className="text-sm py-2">{job.plan_number || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Contract Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.contract_date}
                    onChange={(e) => setForm({ ...form, contract_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.contract_date) || "-"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contract Price Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Price Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fixed Component - Calculated */}
            <div className="space-y-2">
              <Label>Fixed Component</Label>
              <p className="text-sm py-2 font-medium">
                {(() => {
                  const contractPrice = isEditing
                    ? parseFloat(form.contract_price) || 0
                    : job.contract_price || 0;
                  const primeCost = isEditing
                    ? parseFloat(form.prime_cost) || 0
                    : job.prime_cost || 0;
                  const provisionalSums = isEditing
                    ? parseFloat(form.provisional_sums) || 0
                    : job.provisional_sums || 0;
                  const fixedComponent = contractPrice - primeCost - provisionalSums;
                  return fixedComponent > 0 ? formatCurrency(fixedComponent) : "-";
                })()}
              </p>
              <p className="text-xs text-muted-foreground">
                Calculated: Contract Price − Prime Cost − Provisional Sums
              </p>
            </div>

            {/* Prime Cost */}
            <div className="space-y-2">
              <Label>Prime Cost Allowance</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={form.prime_cost}
                    onChange={(e) => setForm({ ...form, prime_cost: e.target.value })}
                    className="pl-7"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              ) : (
                <p className="text-sm py-2">{job.prime_cost ? formatCurrency(job.prime_cost) : "-"}</p>
              )}
            </div>

            {/* Provisional Sums */}
            <div className="space-y-2">
              <Label>Provisional Sum Allowance</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={form.provisional_sums}
                    onChange={(e) => setForm({ ...form, provisional_sums: e.target.value })}
                    className="pl-7"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              ) : (
                <p className="text-sm py-2">{job.provisional_sums ? formatCurrency(job.provisional_sums) : "-"}</p>
              )}
            </div>

            {/* Total - Contract Price */}
            <div className="pt-3 border-t space-y-2">
              <Label className="font-semibold">Total Contract Price</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={form.contract_price}
                    onChange={(e) => setForm({ ...form, contract_price: e.target.value })}
                    className="pl-7 font-semibold"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              ) : (
                <p className="text-lg py-2 font-semibold">
                  {job.contract_price ? formatCurrency(job.contract_price) : "-"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Build Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Build Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Build Period</Label>
                {isEditing ? (
                  <Input
                    value={form.build_period}
                    onChange={(e) => setForm({ ...form, build_period: e.target.value })}
                    placeholder="e.g., 26 weeks"
                  />
                ) : (
                  <p className="text-sm py-2">{job.build_period || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Weekend Work</Label>
                {isEditing ? (
                  <Input
                    value={form.weekend_work}
                    onChange={(e) => setForm({ ...form, weekend_work: e.target.value })}
                    placeholder="e.g., Yes / No"
                  />
                ) : (
                  <p className="text-sm py-2">{job.weekend_work || "-"}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Stage Durations</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slab</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_slab}
                      onChange={(e) => setForm({ ...form, stage_slab: e.target.value })}
                      placeholder="e.g., 4 weeks"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_slab || "-"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Frame</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_frame}
                      onChange={(e) => setForm({ ...form, stage_frame: e.target.value })}
                      placeholder="e.g., 3 weeks"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_frame || "-"}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Enclosed</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_enclosed}
                      onChange={(e) => setForm({ ...form, stage_enclosed: e.target.value })}
                      placeholder="e.g., 5 weeks"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_enclosed || "-"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fixing</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_fixing}
                      onChange={(e) => setForm({ ...form, stage_fixing: e.target.value })}
                      placeholder="e.g., 8 weeks"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_fixing || "-"}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Practical</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_practical}
                      onChange={(e) => setForm({ ...form, stage_practical: e.target.value })}
                      placeholder="e.g., 4 weeks"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_practical || "-"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Weather Days</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_weather}
                      onChange={(e) => setForm({ ...form, stage_weather: e.target.value })}
                      placeholder="e.g., 10 days"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_weather || "-"}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Dates */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Plan Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.plan_date}
                    onChange={(e) => setForm({ ...form, plan_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.plan_date) || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Spec Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.spec_date}
                    onChange={(e) => setForm({ ...form, spec_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.spec_date) || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Practical Completion</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.practical_completion_date}
                    onChange={(e) => setForm({ ...form, practical_completion_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.practical_completion_date) || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Warranty End</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.warranty_end_date}
                    onChange={(e) => setForm({ ...form, warranty_end_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.warranty_end_date) || "-"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
