"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Pencil, X, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Job {
  id: number;
  name: string;
  plan_number?: string;
  contract_price?: number;
  prime_cost?: number;
  provisional_sums?: number;
  prime_cost_details?: string;
  provisional_sums_details?: string;
  has_special_conditions?: boolean;
  special_conditions?: string;
  contract_date?: string;
  start_date?: string;
  build_period?: string;
  construction_days?: number;
  stage_weather?: string;
  weekend_work?: string;
  liquidated_damages?: number;
  certification_by_owner?: boolean;
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
    prime_cost_details: job.prime_cost_details || "",
    provisional_sums_details: job.provisional_sums_details || "",
    has_special_conditions: job.has_special_conditions ?? false,
    special_conditions: job.special_conditions || "",
    contract_date: job.contract_date || "",
    start_date: job.start_date || "",
    build_period: job.build_period || "",
    construction_days: job.construction_days?.toString() || "300",
    stage_weather: job.stage_weather || "10",
    weekend_work: job.weekend_work || "",
    liquidated_damages: job.liquidated_damages?.toString() || "50.00",
    certification_by_owner: job.certification_by_owner ?? false,
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
        prime_cost_details: job.prime_cost_details || "",
        provisional_sums_details: job.provisional_sums_details || "",
        has_special_conditions: job.has_special_conditions ?? false,
        special_conditions: job.special_conditions || "",
        contract_date: job.contract_date || "",
        start_date: job.start_date || "",
        build_period: job.build_period || "",
        construction_days: job.construction_days?.toString() || "300",
        stage_weather: job.stage_weather || "10",
        weekend_work: job.weekend_work || "",
        liquidated_damages: job.liquidated_damages?.toString() || "50.00",
        certification_by_owner: job.certification_by_owner ?? false,
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
          prime_cost_details: form.prime_cost_details || null,
          provisional_sums_details: form.provisional_sums_details || null,
          has_special_conditions: form.has_special_conditions,
          special_conditions: form.special_conditions || null,
          contract_date: form.contract_date || null,
          start_date: form.start_date || null,
          build_period: form.build_period || null,
          construction_days: form.construction_days ? parseInt(form.construction_days) : 300,
          stage_weather: form.stage_weather || "10",
          weekend_work: form.weekend_work || null,
          liquidated_damages: form.liquidated_damages ? parseFloat(form.liquidated_damages) : 50.00,
          certification_by_owner: form.certification_by_owner,
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
      prime_cost_details: job.prime_cost_details || "",
      provisional_sums_details: job.provisional_sums_details || "",
      has_special_conditions: job.has_special_conditions ?? false,
      special_conditions: job.special_conditions || "",
      contract_date: job.contract_date || "",
      start_date: job.start_date || "",
      build_period: job.build_period || "",
      construction_days: job.construction_days?.toString() || "300",
      stage_weather: job.stage_weather || "10",
      weekend_work: job.weekend_work || "",
      liquidated_damages: job.liquidated_damages?.toString() || "50.00",
      certification_by_owner: job.certification_by_owner ?? false,
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

            {/* Item 13 & 14: Liquidated Damages and Certification */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Contract Terms</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item 13: Liquidated Damages</Label>
                  {isEditing ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={form.liquidated_damages}
                        onChange={(e) => setForm({ ...form, liquidated_damages: e.target.value })}
                        className="pl-7"
                        placeholder="50.00"
                        step="0.01"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/day</span>
                    </div>
                  ) : (
                    <p className="text-sm py-2">
                      {job.liquidated_damages ? `${formatCurrency(job.liquidated_damages)} per day` : "$50.00 per day"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Item 14: Certification Responsibility</Label>
                  {isEditing ? (
                    <div className="flex items-center gap-3 py-2">
                      <span className={`text-sm ${!form.certification_by_owner ? 'font-medium' : 'text-muted-foreground'}`}>Contractor</span>
                      <Switch
                        checked={form.certification_by_owner}
                        onCheckedChange={(checked) => setForm({ ...form, certification_by_owner: checked })}
                      />
                      <span className={`text-sm ${form.certification_by_owner ? 'font-medium' : 'text-muted-foreground'}`}>Owner</span>
                    </div>
                  ) : (
                    <p className="text-sm py-2">
                      {job.certification_by_owner ? "Owner" : "Contractor"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Item 15: Special Conditions */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Checkbox
                    id="has_special_conditions"
                    checked={form.has_special_conditions}
                    onCheckedChange={(checked) => setForm({ ...form, has_special_conditions: checked === true })}
                  />
                ) : (
                  <Checkbox
                    id="has_special_conditions"
                    checked={job.has_special_conditions ?? false}
                    disabled
                  />
                )}
                <Label htmlFor="has_special_conditions" className="text-sm font-medium">
                  Item 15: Special Conditions Apply
                </Label>
              </div>
              {(isEditing ? form.has_special_conditions : job.has_special_conditions) && (
                <div className="space-y-2 pl-6">
                  {isEditing ? (
                    <Textarea
                      value={form.special_conditions}
                      onChange={(e) => setForm({ ...form, special_conditions: e.target.value })}
                      placeholder="Enter special conditions (e.g., NDIS build - cannot obtain QBCC insurance)"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {job.special_conditions || "-"}
                    </p>
                  )}
                </div>
              )}
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
                <>
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
                  {(form.prime_cost && parseFloat(form.prime_cost) > 0) && (
                    <Textarea
                      value={form.prime_cost_details}
                      onChange={(e) => setForm({ ...form, prime_cost_details: e.target.value })}
                      placeholder="List prime cost items (e.g., Kitchen appliances, Floor coverings)"
                      rows={2}
                      className="mt-2"
                    />
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm py-2">{job.prime_cost ? formatCurrency(job.prime_cost) : "-"}</p>
                  {job.prime_cost_details && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{job.prime_cost_details}</p>
                  )}
                </>
              )}
            </div>

            {/* Provisional Sums */}
            <div className="space-y-2">
              <Label>Provisional Sum Allowance</Label>
              {isEditing ? (
                <>
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
                  {(form.provisional_sums && parseFloat(form.provisional_sums) > 0) && (
                    <Textarea
                      value={form.provisional_sums_details}
                      onChange={(e) => setForm({ ...form, provisional_sums_details: e.target.value })}
                      placeholder="List provisional sum items (e.g., Site works, Landscaping)"
                      rows={2}
                      className="mt-2"
                    />
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm py-2">{job.provisional_sums ? formatCurrency(job.provisional_sums) : "-"}</p>
                  {job.provisional_sums_details && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{job.provisional_sums_details}</p>
                  )}
                </>
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
                <Label>Proposed Start Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{formatDate(job.start_date) || "-"}</p>
                )}
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Construction Days</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={form.construction_days}
                    onChange={(e) => setForm({ ...form, construction_days: e.target.value })}
                    placeholder="300"
                  />
                ) : (
                  <p className="text-sm py-2">{job.construction_days || "300"} days</p>
                )}
              </div>
            </div>

            {/* Item C: Working Days */}
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Item C: Working Days</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weather Days Allowance</Label>
                  {isEditing ? (
                    <Input
                      value={form.stage_weather}
                      onChange={(e) => setForm({ ...form, stage_weather: e.target.value })}
                      placeholder="10"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.stage_weather || "10"} days</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Weekends & Holidays</Label>
                  {isEditing ? (
                    <Input
                      value={form.weekend_work}
                      onChange={(e) => setForm({ ...form, weekend_work: e.target.value })}
                      placeholder="e.g., No weekend work"
                    />
                  ) : (
                    <p className="text-sm py-2">{job.weekend_work || "-"}</p>
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
