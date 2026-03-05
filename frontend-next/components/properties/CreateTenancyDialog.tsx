"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreateTenancyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number | string;
  onSuccess: () => void;
}

interface TenancyFormData {
  tenancy_type: string;
  start_date: string;
  end_date: string;
  lease_term_months: string;
  weekly_rent: string;
  rent_frequency: string;
  bond_amount: string;
  // SDA fields
  sda_plan_number: string;
  sda_weekly_rate: string;
  notes: string;
}

const INITIAL_FORM: TenancyFormData = {
  tenancy_type: "fixed_term",
  start_date: "",
  end_date: "",
  lease_term_months: "12",
  weekly_rent: "",
  rent_frequency: "weekly",
  bond_amount: "",
  sda_plan_number: "",
  sda_weekly_rate: "",
  notes: "",
};

export function CreateTenancyDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: CreateTenancyDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<TenancyFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const isSda = form.tenancy_type === "sda";

  const handleChange = useCallback((field: keyof TenancyFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.start_date || !form.weekly_rent) {
      toast({ title: "Required", description: "Start date and weekly rent are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.post<{ success: boolean }>("/api/v1/tenancies", {
        tenancy: {
          property_id: propertyId,
          tenancy_type: form.tenancy_type,
          status: "draft",
          start_date: form.start_date,
          end_date: form.end_date || null,
          lease_term_months: form.lease_term_months ? parseInt(form.lease_term_months) : null,
          weekly_rent: parseFloat(form.weekly_rent),
          rent_frequency: form.rent_frequency,
          bond_amount: form.bond_amount ? parseFloat(form.bond_amount) : null,
          sda_plan_number: isSda ? form.sda_plan_number : null,
          sda_weekly_rate: isSda && form.sda_weekly_rate ? parseFloat(form.sda_weekly_rate) : null,
          notes: form.notes || null,
        },
      });

      toast({ title: "Success", description: "Tenancy created" });
      setForm(INITIAL_FORM);
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to create tenancy", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, propertyId, isSda, toast, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Tenancy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tenancy Type */}
          <div className="space-y-2">
            <Label>Tenancy Type</Label>
            <Select value={form.tenancy_type} onValueChange={(v) => handleChange("tenancy_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_term">Fixed Term</SelectItem>
                <SelectItem value="periodic">Periodic</SelectItem>
                <SelectItem value="sda">SDA (Specialist Disability Accommodation)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => handleChange("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => handleChange("end_date", e.target.value)}
              />
            </div>
          </div>

          {form.tenancy_type === "fixed_term" && (
            <div className="space-y-2">
              <Label>Lease Term (months)</Label>
              <Input
                type="number"
                value={form.lease_term_months}
                onChange={(e) => handleChange("lease_term_months", e.target.value)}
              />
            </div>
          )}

          {/* Rent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weekly Rent *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.weekly_rent}
                onChange={(e) => handleChange("weekly_rent", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={form.rent_frequency} onValueChange={(v) => handleChange("rent_frequency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bond */}
          <div className="space-y-2">
            <Label>Bond Amount</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.bond_amount}
              onChange={(e) => handleChange("bond_amount", e.target.value)}
            />
          </div>

          {/* SDA Fields */}
          {isSda && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300">SDA Details</h4>
              <div className="space-y-2">
                <Label>NDIS Plan Number</Label>
                <Input
                  placeholder="e.g. NDIS-123456"
                  value={form.sda_plan_number}
                  onChange={(e) => handleChange("sda_plan_number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>SDA Weekly Rate (from NDIS Price Guide)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.sda_weekly_rate}
                  onChange={(e) => handleChange("sda_weekly_rate", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Create Tenancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
