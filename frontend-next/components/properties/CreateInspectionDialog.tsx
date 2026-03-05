"use client";

import { useState, useCallback, useEffect } from "react";
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

interface RoomTemplate {
  id: number;
  name: string;
  property_type_name: string;
  room_count?: number;
  item_count?: number;
  rooms: Array<{ name: string; room_type: string; items: Array<{ name: string }> }>;
}

interface ContactOption {
  id: number;
  display_name: string;
}

interface EntryInspection {
  id: number;
  inspection_number: string | null;
  scheduled_date: string;
  completed_date: string | null;
}

interface InspectionFormData {
  inspection_type: string;
  scheduled_date: string;
  notes: string;
  inspector_contact_id: string;
  template_id: string;
  entry_inspection_id: string;
}

const INITIAL_FORM: InspectionFormData = {
  inspection_type: "routine",
  scheduled_date: "",
  notes: "",
  inspector_contact_id: "",
  template_id: "",
  entry_inspection_id: "",
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
  const [templates, setTemplates] = useState<RoomTemplate[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [entryInspections, setEntryInspections] = useState<EntryInspection[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load templates and contacts when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);

    Promise.all([
      api.get<{ success: boolean; data: RoomTemplate[] }>("/api/v1/inspection_room_templates"),
      api.get<{ success: boolean; data: ContactOption[] }>("/api/v1/contacts?for_select=true&limit=100"),
    ]).then(([templatesRes, contactsRes]) => {
      if (templatesRes.success) setTemplates(templatesRes.data);
      if (contactsRes.success) setContacts(contactsRes.data);
    }).finally(() => setLoadingOptions(false));
  }, [open]);

  // Load entry inspections when type is "exit"
  useEffect(() => {
    if (form.inspection_type !== "exit" || !open) {
      setEntryInspections([]);
      return;
    }

    api.get<{ success: boolean; data: EntryInspection[] }>(
      `/api/v1/property_inspections?property_id=${propertyId}&type=entry&status=completed`
    ).then(res => {
      if (res.success) setEntryInspections(res.data);
    });
  }, [form.inspection_type, propertyId, open]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        property_inspection: {
          property_id: propertyId,
          inspection_type: form.inspection_type,
          scheduled_date: form.scheduled_date,
          status: "scheduled",
          notes: form.notes || null,
          inspector_contact_id: form.inspector_contact_id || null,
        },
      };

      if (form.template_id) {
        payload.template_id = form.template_id;
      }
      if (form.entry_inspection_id) {
        payload.entry_inspection_id = form.entry_inspection_id;
      }

      await api.post<{ success: boolean }>("/api/v1/property_inspections", payload);

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

  const selectedTemplate = templates.find(t => String(t.id) === form.template_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
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
            <Label>Inspector</Label>
            <Select value={form.inspector_contact_id} onValueChange={(v) => handleChange("inspector_contact_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select inspector..." />
              </SelectTrigger>
              <SelectContent>
                {contacts.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Room Template</Label>
            <Select value={form.template_id} onValueChange={(v) => handleChange("template_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select template (optional)..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} ({t.rooms.length} rooms)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.rooms.length} rooms, {selectedTemplate.rooms.reduce((sum, r) => sum + (r.items?.length || 0), 0)} items
              </p>
            )}
          </div>

          {/* Show entry inspection picker for exit inspections */}
          {form.inspection_type === "exit" && entryInspections.length > 0 && (
            <div className="space-y-2">
              <Label>Copy Rooms From Entry Inspection</Label>
              <Select value={form.entry_inspection_id} onValueChange={(v) => handleChange("entry_inspection_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entry inspection..." />
                </SelectTrigger>
                <SelectContent>
                  {entryInspections.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.inspection_number || `Entry #${e.id}`} - {new Date(e.scheduled_date).toLocaleDateString("en-AU")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Entry conditions will be pre-filled for comparison
              </p>
            </div>
          )}

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
          <Button onClick={handleSubmit} disabled={saving || loadingOptions}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
