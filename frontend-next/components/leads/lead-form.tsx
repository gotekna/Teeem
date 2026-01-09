"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Spinner } from "@/components/ui/spinner";
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Lead" : "New Lead"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="site">Site</TabsTrigger>
              <TabsTrigger value="building">Building</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="e.g., Smith Residence - New Build"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
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

                <div>
                  <Label htmlFor="source">Lead Source</Label>
                  <Select
                    value={formData.source || ""}
                    onValueChange={(v) =>
                      updateField("source", v as LeadSource)
                    }
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

                <div className="col-span-2 border-t pt-4 mt-2">
                  <p className="text-sm font-medium mb-3">Client Details</p>
                </div>

                <div>
                  <Label htmlFor="client_name">Client Name *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => updateField("client_name", e.target.value)}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="client_company">Company</Label>
                  <Input
                    id="client_company"
                    value={formData.client_company}
                    onChange={(e) =>
                      updateField("client_company", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <Label htmlFor="client_email">Email *</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => updateField("client_email", e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="client_phone">Phone</Label>
                  <Input
                    id="client_phone"
                    value={formData.client_phone}
                    onChange={(e) => updateField("client_phone", e.target.value)}
                    placeholder="+61 400 000 000"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Site Tab */}
            <TabsContent value="site" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="site_address">Site Address *</Label>
                  <Input
                    id="site_address"
                    value={formData.site_address}
                    onChange={(e) => updateField("site_address", e.target.value)}
                    placeholder="123 Main Street"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="site_suburb">Suburb *</Label>
                  <Input
                    id="site_suburb"
                    value={formData.site_suburb}
                    onChange={(e) => updateField("site_suburb", e.target.value)}
                    placeholder="Brisbane"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="site_state">State</Label>
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
                  <div>
                    <Label htmlFor="site_postcode">Postcode</Label>
                    <Input
                      id="site_postcode"
                      value={formData.site_postcode}
                      onChange={(e) =>
                        updateField("site_postcode", e.target.value)
                      }
                      placeholder="4000"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="lot_plan_number">Lot/Plan Number</Label>
                  <Input
                    id="lot_plan_number"
                    value={formData.lot_plan_number}
                    onChange={(e) =>
                      updateField("lot_plan_number", e.target.value)
                    }
                    placeholder="Lot 1 SP123456"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Building Tab */}
            <TabsContent value="building" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project_type">Project Type *</Label>
                  <Select
                    value={formData.project_type}
                    onValueChange={(v) =>
                      updateField("project_type", v as ProjectType)
                    }
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

                <div>
                  <Label htmlFor="dwelling_type">Dwelling Type</Label>
                  <Select
                    value={formData.dwelling_type || ""}
                    onValueChange={(v) =>
                      updateField("dwelling_type", v as DwellingType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DWELLING_TYPE_LABELS).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="number_of_storeys">Number of Storeys</Label>
                  <Input
                    id="number_of_storeys"
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

                <div>
                  <Label htmlFor="estimated_floor_area">
                    Estimated Floor Area (m²)
                  </Label>
                  <Input
                    id="estimated_floor_area"
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

                <div className="col-span-2">
                  <Label htmlFor="estimated_value">Estimated Value (AUD) *</Label>
                  <Input
                    id="estimated_value"
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
                </div>
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expected_start_date">
                    Expected Start Date
                  </Label>
                  <Input
                    id="expected_start_date"
                    type="date"
                    value={formData.expected_start_date || ""}
                    onChange={(e) =>
                      updateField("expected_start_date", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="decision_timeline">Decision Timeline</Label>
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

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ""}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Any additional notes about this lead..."
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner size={16} className="mr-2" />}
              {isEditing ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
