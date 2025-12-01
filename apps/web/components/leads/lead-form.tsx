"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lead,
  LeadStatus,
  LeadSource,
  ProjectType,
  DwellingType,
  LEAD_STATUS_CONFIG,
  LEAD_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
  DWELLING_TYPE_LABELS,
} from "@/types/leads";
import { Loader2, User, MapPin, Building, Calendar } from "lucide-react";

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSubmit: (data: Partial<Lead>) => Promise<void>;
}

export function LeadForm({ open, onOpenChange, lead, onSubmit }: LeadFormProps) {
  const isEditing = !!lead;
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({
    title: "",
    status: "new",
    source: undefined,
    client_name: "",
    client_email: "",
    client_phone: "",
    client_company: "",
    site_address: "",
    site_suburb: "",
    site_state: "QLD",
    site_postcode: "",
    lot_plan_number: "",
    project_type: "new_dwelling",
    dwelling_type: undefined,
    number_of_storeys: undefined,
    estimated_floor_area: undefined,
    estimated_value: 0,
    expected_start_date: "",
    decision_timeline: "",
    notes: "",
  });

  // Reset form when lead changes or modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: lead?.title || "",
        status: lead?.status || "new",
        source: lead?.source || undefined,
        client_name: lead?.client_name || "",
        client_email: lead?.client_email || "",
        client_phone: lead?.client_phone || "",
        client_company: lead?.client_company || "",
        site_address: lead?.site_address || "",
        site_suburb: lead?.site_suburb || "",
        site_state: lead?.site_state || "QLD",
        site_postcode: lead?.site_postcode || "",
        lot_plan_number: lead?.lot_plan_number || "",
        project_type: lead?.project_type || "new_dwelling",
        dwelling_type: lead?.dwelling_type || undefined,
        number_of_storeys: lead?.number_of_storeys || undefined,
        estimated_floor_area: lead?.estimated_floor_area || undefined,
        estimated_value: lead?.estimated_value || 0,
        expected_start_date: lead?.expected_start_date || "",
        decision_timeline: lead?.decision_timeline || "",
        notes: lead?.notes || "",
      });
      setActiveTab("basic");
    }
  }, [open, lead]);

  const updateField = <K extends keyof Lead>(field: K, value: Lead[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save lead:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Lead" : "New Lead"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the lead details below."
              : "Enter the prospect details to create a new lead."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="basic" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Client</span>
              </TabsTrigger>
              <TabsTrigger value="site" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Site</span>
              </TabsTrigger>
              <TabsTrigger value="building" className="gap-1.5">
                <Building className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Building</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="form-grid">
                <div className="form-full form-group">
                  <Label className="form-label">Project Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="e.g., Smith Residence - New Build"
                    required
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => updateField("status", v as LeadStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Lead Source</Label>
                  <Select
                    value={formData.source || ""}
                    onValueChange={(v) => updateField("source", v as LeadSource)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_SOURCE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-section">
                <p className="modal-section-title">Client Details</p>
                <div className="form-grid">
                  <div className="form-group">
                    <Label className="form-label">Client Name *</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => updateField("client_name", e.target.value)}
                      placeholder="John Smith"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <Label className="form-label">Company</Label>
                    <Input
                      value={formData.client_company}
                      onChange={(e) => updateField("client_company", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="form-group">
                    <Label className="form-label">Email *</Label>
                    <Input
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => updateField("client_email", e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <Label className="form-label">Phone</Label>
                    <Input
                      value={formData.client_phone}
                      onChange={(e) => updateField("client_phone", e.target.value)}
                      placeholder="+61 400 000 000"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Site Tab */}
            <TabsContent value="site" className="space-y-4 mt-0">
              <div className="form-grid">
                <div className="form-full form-group">
                  <Label className="form-label">Site Address *</Label>
                  <Input
                    value={formData.site_address}
                    onChange={(e) => updateField("site_address", e.target.value)}
                    placeholder="123 Main Street"
                    required
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Suburb *</Label>
                  <Input
                    value={formData.site_suburb}
                    onChange={(e) => updateField("site_suburb", e.target.value)}
                    placeholder="Brisbane"
                    required
                  />
                </div>

                <div className="form-grid" style={{ gridColumn: "span 1" }}>
                  <div className="form-group">
                    <Label className="form-label">State</Label>
                    <Select
                      value={formData.site_state}
                      onValueChange={(v) => updateField("site_state", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="form-group">
                    <Label className="form-label">Postcode</Label>
                    <Input
                      value={formData.site_postcode}
                      onChange={(e) => updateField("site_postcode", e.target.value)}
                      placeholder="4000"
                    />
                  </div>
                </div>

                <div className="form-full form-group">
                  <Label className="form-label">Lot/Plan Number</Label>
                  <Input
                    value={formData.lot_plan_number}
                    onChange={(e) => updateField("lot_plan_number", e.target.value)}
                    placeholder="Lot 1 SP123456"
                  />
                  <p className="form-helper">Required for QBCC contracts</p>
                </div>
              </div>
            </TabsContent>

            {/* Building Tab */}
            <TabsContent value="building" className="space-y-4 mt-0">
              <div className="form-grid">
                <div className="form-group">
                  <Label className="form-label">Project Type *</Label>
                  <Select
                    value={formData.project_type}
                    onValueChange={(v) => updateField("project_type", v as ProjectType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Dwelling Type</Label>
                  <Select
                    value={formData.dwelling_type || ""}
                    onValueChange={(v) => updateField("dwelling_type", v as DwellingType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DWELLING_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Number of Storeys</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.number_of_storeys || ""}
                    onChange={(e) =>
                      updateField(
                        "number_of_storeys",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="2"
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Floor Area (m²)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.estimated_floor_area || ""}
                    onChange={(e) =>
                      updateField(
                        "estimated_floor_area",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="250"
                  />
                </div>

                <div className="form-full form-group">
                  <Label className="form-label">Estimated Value (AUD) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={formData.estimated_value || ""}
                    onChange={(e) =>
                      updateField(
                        "estimated_value",
                        e.target.value ? parseInt(e.target.value) : 0
                      )
                    }
                    placeholder="500000"
                    required
                  />
                  <p className="form-helper">Total expected contract value including GST</p>
                </div>
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4 mt-0">
              <div className="form-grid">
                <div className="form-group">
                  <Label className="form-label">Expected Start Date</Label>
                  <Input
                    type="date"
                    value={formData.expected_start_date || ""}
                    onChange={(e) => updateField("expected_start_date", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Decision Timeline</Label>
                  <Select
                    value={formData.decision_timeline || ""}
                    onValueChange={(v) => updateField("decision_timeline", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When will they decide?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="1_week">Within 1 week</SelectItem>
                      <SelectItem value="2_weeks">Within 2 weeks</SelectItem>
                      <SelectItem value="1_month">Within 1 month</SelectItem>
                      <SelectItem value="3_months">Within 3 months</SelectItem>
                      <SelectItem value="6_months">Within 6 months</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-full form-group">
                  <Label className="form-label">Notes</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Any additional notes about this lead..."
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
