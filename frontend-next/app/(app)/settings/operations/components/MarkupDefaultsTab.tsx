"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface PricingSettings {
  defaultBuilderMarginPercent: number;
  defaultEscalationPercent: number;
  pcPsMarkupCapPercent: number;
  defaultConstructionInsurancePercent: number;
  defaultOverheadsPercent: number;
  defaultQleaveRatePercent: number;
  defaultBuildsContingencyPercent: number;
  defaultProjectPrelimsPercent: number;
  defaultProjectManagementPercent: number;
  defaultMaintenanceFeePercent: number;
  defaultTenderMarkupPercent: number;
  qleaveThreshold: number;
  qbccMinimumThreshold: number;
}

// ============================================
// Component
// ============================================

export function MarkupDefaultsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<PricingSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // ============================================
  // Fetch
  // ============================================

  React.useEffect(() => {
    (async () => {
      try {
        const settingsRes = await api.get<{ settings: PricingSettings }>("/api/v1/sm_settings");

        if (settingsRes?.settings) {
          setSettings({
            defaultBuilderMarginPercent: settingsRes.settings.defaultBuilderMarginPercent ?? 0,
            defaultEscalationPercent: settingsRes.settings.defaultEscalationPercent ?? 0,
            pcPsMarkupCapPercent: settingsRes.settings.pcPsMarkupCapPercent ?? 25,
            defaultConstructionInsurancePercent: settingsRes.settings.defaultConstructionInsurancePercent ?? 0,
            defaultOverheadsPercent: settingsRes.settings.defaultOverheadsPercent ?? 0,
            defaultQleaveRatePercent: settingsRes.settings.defaultQleaveRatePercent ?? 0.575,
            defaultBuildsContingencyPercent: settingsRes.settings.defaultBuildsContingencyPercent ?? 0,
            defaultProjectPrelimsPercent: settingsRes.settings.defaultProjectPrelimsPercent ?? 0,
            defaultProjectManagementPercent: settingsRes.settings.defaultProjectManagementPercent ?? 0,
            defaultMaintenanceFeePercent: settingsRes.settings.defaultMaintenanceFeePercent ?? 0,
            defaultTenderMarkupPercent: settingsRes.settings.defaultTenderMarkupPercent ?? 0,
            qleaveThreshold: settingsRes.settings.qleaveThreshold ?? 150000,
            qbccMinimumThreshold: settingsRes.settings.qbccMinimumThreshold ?? 3300,
          });
        }
      } catch {
        toast({ title: "Failed to load markup settings", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // ============================================
  // Save settings
  // ============================================

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch("/api/v1/sm_settings", {
        settings: {
          default_builder_margin_percent: settings.defaultBuilderMarginPercent,
          default_escalation_percent: settings.defaultEscalationPercent,
          pc_ps_markup_cap_percent: settings.pcPsMarkupCapPercent,
          default_construction_insurance_percent: settings.defaultConstructionInsurancePercent,
          default_overheads_percent: settings.defaultOverheadsPercent,
          default_qleave_rate_percent: settings.defaultQleaveRatePercent,
          default_builds_contingency_percent: settings.defaultBuildsContingencyPercent,
          default_project_prelims_percent: settings.defaultProjectPrelimsPercent,
          default_project_management_percent: settings.defaultProjectManagementPercent,
          default_maintenance_fee_percent: settings.defaultMaintenanceFeePercent,
          default_tender_markup_percent: settings.defaultTenderMarkupPercent,
          qleave_threshold: settings.qleaveThreshold,
          qbcc_minimum_threshold: settings.qbccMinimumThreshold,
        },
      });
      toast({ title: "Markup defaults saved" });
    } catch {
      toast({ title: "Failed to save markup defaults", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={32} className="text-muted-foreground" /></div>;
  }

  const updateSetting = (field: keyof PricingSettings, value: number) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="space-y-6 max-w-3xl px-4 pt-4">
      {/* ── Markup Defaults ── */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-1">Markup Defaults</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Applied when a Schedule Master template is copied to a new job. Editable per-job.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <CompactField
              label="Builder Margin"
              suffix="%"
              value={settings?.defaultBuilderMarginPercent ?? 0}
              onChange={v => updateSetting("defaultBuilderMarginPercent", v)}
            />
            <CompactField
              label="Escalation"
              suffix="%"
              value={settings?.defaultEscalationPercent ?? 0}
              onChange={v => updateSetting("defaultEscalationPercent", v)}
            />
            <CompactField
              label="PC/PS Markup Cap"
              suffix="%"
              value={settings?.pcPsMarkupCapPercent ?? 25}
              onChange={v => updateSetting("pcPsMarkupCapPercent", v)}
            />
            <CompactField
              label="Tender Markup"
              suffix="%"
              value={settings?.defaultTenderMarkupPercent ?? 0}
              onChange={v => updateSetting("defaultTenderMarkupPercent", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Job Charge Defaults ── */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-1">Job Charge Defaults</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Default rates for insurance, levies, and overheads added to job pricing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <CompactField
              label="Constr. Insurance"
              suffix="%"
              value={settings?.defaultConstructionInsurancePercent ?? 0}
              onChange={v => updateSetting("defaultConstructionInsurancePercent", v)}
              step={0.1}
            />
            <CompactField
              label="Overheads"
              suffix="%"
              value={settings?.defaultOverheadsPercent ?? 0}
              onChange={v => updateSetting("defaultOverheadsPercent", v)}
              step={0.1}
            />
            <CompactField
              label="Build Contingency"
              suffix="%"
              value={settings?.defaultBuildsContingencyPercent ?? 0}
              onChange={v => updateSetting("defaultBuildsContingencyPercent", v)}
              step={0.1}
            />
            <CompactField
              label="Project Prelims"
              suffix="%"
              value={settings?.defaultProjectPrelimsPercent ?? 0}
              onChange={v => updateSetting("defaultProjectPrelimsPercent", v)}
              step={0.1}
            />
            <CompactField
              label="Project Management"
              suffix="%"
              value={settings?.defaultProjectManagementPercent ?? 0}
              onChange={v => updateSetting("defaultProjectManagementPercent", v)}
              step={0.1}
            />
            <CompactField
              label="Maintenance Fee"
              suffix="%"
              value={settings?.defaultMaintenanceFeePercent ?? 0}
              onChange={v => updateSetting("defaultMaintenanceFeePercent", v)}
              step={0.1}
            />
            <CompactField
              label="QLeave Rate"
              suffix="%"
              value={settings?.defaultQleaveRatePercent ?? 0.575}
              onChange={v => updateSetting("defaultQleaveRatePercent", v)}
              step={0.001}
            />
            <CompactField
              label="QLeave Threshold"
              prefix="$"
              value={settings?.qleaveThreshold ?? 150000}
              onChange={v => updateSetting("qleaveThreshold", v)}
              step={1000}
              inputWidth="w-28"
            />
            <CompactField
              label="QBCC Min Threshold"
              prefix="$"
              value={settings?.qbccMinimumThreshold ?? 3300}
              onChange={v => updateSetting("qbccMinimumThreshold", v)}
              step={100}
              inputWidth="w-28"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save All Defaults"}
      </Button>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function CompactField({
  label,
  value,
  onChange,
  step = 0.5,
  prefix,
  suffix,
  inputWidth = "w-20",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  inputWidth?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-b-0">
      <Label className="text-sm font-normal text-foreground shrink-0">{label}</Label>
      <div className="flex items-center gap-1.5 shrink-0">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          className={`${inputWidth} h-8 text-right text-sm`}
        />
        {suffix && <span className="text-sm text-muted-foreground w-3">{suffix}</span>}
      </div>
    </div>
  );
}
