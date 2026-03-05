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

interface CreateInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number | string;
  onSuccess: () => void;
}

interface InspectionFormData {
  inspection_type: string;
  scheduled_date: string;
  notes: string;
}

const INITIAL_FORM: InspectionFormData = {
  inspection_type: "routine",
  scheduled_date: "",
  notes: "",
};

export function CreateInspectionDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: CreateInspectionDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<InspectionFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof InspectionFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.scheduled_date) {
      toast({ title: "Required", description: "Scheduled date is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.post<{ success: boolean }>("/api/v1/property_inspections", {
        property_inspection: {
          property_id: propertyId,
          inspection_type: form.inspection_type,
          scheduled_date: form.scheduled_date,
          status: "scheduled",
          notes: form.notes || null,
        },
      });

      toast({ title: "Success", description: "Inspection scheduled" });
      setForm(INITIAL_FORM);
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to schedule inspection", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, propertyId, toast, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Schedule Inspection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Inspection Type</Label>
            <Select value={form.inspection_type} onValueChange={(v) => handleChange("inspection_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="exit">Exit</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="sda_compliance">SDA Compliance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scheduled Date *</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => handleChange("scheduled_date", e.target.value)}
            />
          </div>

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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
