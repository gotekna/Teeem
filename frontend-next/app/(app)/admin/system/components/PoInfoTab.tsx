"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Save, RotateCcw, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface CompanySettings {
  company_name: string;
  abn: string;
  qbcc_license: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  po_conditions: string[];
}

const DEFAULT_PO_CONDITIONS = [
  "If the purchase order is incorrect, please contact our office immediately.",
  "If additional work/items are required, then a NEW order number must be received.",
  "The correct purchase order number and job address MUST be included on your tax invoice. Tax invoices without these details will be returned to the supplier for correction.",
  "Processing of order will acknowledge acceptance of these conditions.",
  "In the instance the work is not completed by the original supplier in the specified timeframe, '{company_name}' reserves the right to engage another supplier to complete the work. The new supplier will be paid from the original purchase order amount and any balance of funds will then be paid to the original supplier.",
  "Please ensure invoice is made out to {company_name}.",
  "This purchase order is issued pursuant to the terms of the subcontract agreement. By accepting this purchase order you confirm that you agree to these subcontract terms.",
];

export function PoInfoTab() {
  const [settings, setSettings] = React.useState<CompanySettings | null>(null);
  const [conditions, setConditions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  // Track original values to detect changes
  const [originalSettings, setOriginalSettings] = React.useState<CompanySettings | null>(null);
  const [originalConditions, setOriginalConditions] = React.useState<string[]>([]);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: CompanySettings }>("/api/v1/company_settings");
      if (response?.success && response.data) {
        setSettings(response.data);
        setOriginalSettings(response.data);
        const conds = response.data.po_conditions?.length > 0
          ? response.data.po_conditions
          : DEFAULT_PO_CONDITIONS;
        setConditions(conds);
        setOriginalConditions(conds);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load company settings");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof CompanySettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setDirty(true);
  };

  const handleConditionChange = (index: number, value: string) => {
    const updated = [...conditions];
    updated[index] = value;
    setConditions(updated);
    setDirty(true);
  };

  const addCondition = () => {
    setConditions([...conditions, ""]);
    setDirty(true);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
    setDirty(true);
  };

  const resetConditions = () => {
    setConditions([...DEFAULT_PO_CONDITIONS]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);

      // Build the update payload — only send changed fields
      const payload: Record<string, unknown> = {};

      if (settings.qbcc_license !== originalSettings?.qbcc_license) payload.qbcc_license = settings.qbcc_license;
      if (settings.abn !== originalSettings?.abn) payload.abn = settings.abn;
      if (settings.email !== originalSettings?.email) payload.email = settings.email;
      if (settings.phone !== originalSettings?.phone) payload.phone = settings.phone;
      if (settings.address !== originalSettings?.address) payload.address = settings.address;
      if (settings.website !== originalSettings?.website) payload.website = settings.website;

      // Always send conditions if they changed
      if (JSON.stringify(conditions) !== JSON.stringify(originalConditions)) {
        // Store with {company_name} placeholder for portability
        payload.po_conditions = conditions;
      }

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save");
        return;
      }

      const response = await api.patch<{ success: boolean; data: CompanySettings }>(
        "/api/v1/company_settings",
        { company_setting: payload }
      );

      if (response?.success) {
        toast.success("PO settings saved");
        setOriginalSettings(response.data);
        setSettings(response.data);
        const conds = response.data.po_conditions?.length > 0
          ? response.data.po_conditions
          : conditions;
        setOriginalConditions(conds);
        setConditions(conds);
        setDirty(false);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...conditions];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, removed);
    setConditions(updated);
    setDragIndex(index);
    setDirty(true);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return <div className="text-center text-muted-foreground py-8">Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details (PO-relevant)</CardTitle>
          <CardDescription>
            These fields appear on Purchase Order documents. Changes here update your company settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Edit in Company Info tab</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qbcc_license">QBCC License</Label>
              <Input
                id="qbcc_license"
                value={settings.qbcc_license || ""}
                onChange={(e) => handleFieldChange("qbcc_license", e.target.value)}
                placeholder="e.g. 1234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                value={settings.abn || ""}
                onChange={(e) => handleFieldChange("abn", e.target.value)}
                placeholder="e.g. 12 345 678 901"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="e.g. info@company.com.au"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={settings.phone || ""}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="e.g. 07 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={settings.website || ""}
                onChange={(e) => handleFieldChange("website", e.target.value)}
                placeholder="e.g. www.company.com.au"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={settings.address || ""}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                placeholder="e.g. 123 Main St, Brisbane QLD 4000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditions of Acceptance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Conditions of Acceptance</CardTitle>
              <CardDescription>
                These conditions appear at the bottom of every Purchase Order. Drag to reorder, edit inline, or add/remove conditions.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={resetConditions}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-2 group ${dragIndex === index ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1 pt-2.5 shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                  <span className="text-xs text-muted-foreground w-5 text-right">{index + 1}.</span>
                </div>
                <Textarea
                  value={condition}
                  onChange={(e) => handleConditionChange(index, e.target.value)}
                  rows={2}
                  className="flex-1 text-sm resize-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index)}
                  className="shrink-0 mt-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addCondition} className="mt-3">
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{company_name}"}</code> as a placeholder — it will be replaced with your company name when the PO is generated.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Spinner size={16} className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save PO Settings
        </Button>
      </div>
    </div>
  );
}
