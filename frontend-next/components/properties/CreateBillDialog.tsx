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
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreateBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number | string;
  onSuccess: () => void;
}

interface BillFormData {
  bill_type: string;
  description: string;
  amount: string;
  tax_amount: string;
  bill_date: string;
  due_date: string;
  charge_to: string;
  notes: string;
}

const INITIAL_FORM: BillFormData = {
  bill_type: "maintenance",
  description: "",
  amount: "",
  tax_amount: "0",
  bill_date: new Date().toISOString().split("T")[0],
  due_date: "",
  charge_to: "owner",
  notes: "",
};

export function CreateBillDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: CreateBillDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<BillFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof BillFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.bill_date) {
      toast({ title: "Required", description: "Amount and bill date are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.post<{ success: boolean }>("/api/v1/property_bills", {
        property_bill: {
          property_id: propertyId,
          bill_type: form.bill_type,
          description: form.description || null,
          amount: parseFloat(form.amount),
          tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : 0,
          bill_date: form.bill_date,
          due_date: form.due_date || null,
          charge_to: form.charge_to,
          status: "draft",
          notes: form.notes || null,
        },
      });

      toast({ title: "Success", description: "Bill created" });
      setForm(INITIAL_FORM);
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to create bill", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, propertyId, toast, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add Bill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Bill Type</Label>
            <Select value={form.bill_type} onValueChange={(v) => handleChange("bill_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="rates">Rates</SelectItem>
                <SelectItem value="body_corporate">Body Corporate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Brief description..."
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tax (GST)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.tax_amount}
                onChange={(e) => handleChange("tax_amount", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bill Date *</Label>
              <Input type="date" value={form.bill_date} onChange={(e) => handleChange("bill_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => handleChange("due_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Charge To</Label>
            <Select value={form.charge_to} onValueChange={(v) => handleChange("charge_to", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="government_ndis">Government (NDIS)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Add Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
