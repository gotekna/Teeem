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
    <div className="space-y-8 max-w-3xl px-4 pt-4">
      {/* ── Markup Defaults ── */}
      <div>
        <h2 className="text-lg font-semibold">Markup Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default markup values applied when a Schedule Master template is copied to a new job.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <SettingField
            label="Default Builder Margin (%)"
            value={settings?.defaultBuilderMarginPercent ?? 0}
            onChange={v => updateSetting("defaultBuilderMarginPercent", v)}
            help="Applied to new jobs when a template is copied. Editable per-job in the Markup tab."
          />
          <SettingField
            label="Default Escalation (%)"
            value={settings?.defaultEscalationPercent ?? 0}
            onChange={v => updateSetting("defaultEscalationPercent", v)}
            help="CPI/inflation adjustment applied to PO costs. Editable per-task in the Markup tab."
          />
          <SettingField
            label="PC/PS Markup Cap (%)"
            value={settings?.pcPsMarkupCapPercent ?? 25}
            onChange={v => updateSetting("pcPsMarkupCapPercent", v)}
            help="Maximum markup allowed on Provisional Cost / Provisional Sum items (default 25%)."
          />
          <SettingField
            label="Default Tender Markup (%)"
            value={settings?.defaultTenderMarkupPercent ?? 0}
            onChange={v => updateSetting("defaultTenderMarkupPercent", v)}
            help="Applied to non-PC/PS PO costs with smart roundup. E.g. PO $3,454.34 × 10% → $3,800."
          />
        </CardContent>
      </Card>

      {/* ── Job Charge Defaults ── */}
      <div>
        <h2 className="text-lg font-semibold">Job Charge Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default rates for insurance, levies, and overheads added to job pricing.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <SettingField
            label="Default Construction Insurance (%)"
            value={settings?.defaultConstructionInsurancePercent ?? 0}
            onChange={v => updateSetting("defaultConstructionInsurancePercent", v)}
            help="Builder's construction insurance as % of sell subtotal."
            step={0.1}
          />
          <SettingField
            label="Default Overheads (%)"
            value={settings?.defaultOverheadsPercent ?? 0}
            onChange={v => updateSetting("defaultOverheadsPercent", v)}
            help="General overheads as % of sell subtotal."
            step={0.1}
          />
          <SettingField
            label="Default Builds Contingency (%)"
            value={settings?.defaultBuildsContingencyPercent ?? 0}
            onChange={v => updateSetting("defaultBuildsContingencyPercent", v)}
            help="Contingency allowance as % of sell subtotal."
            step={0.1}
          />
          <SettingField
            label="Default Project Prelims (%)"
            value={settings?.defaultProjectPrelimsPercent ?? 0}
            onChange={v => updateSetting("defaultProjectPrelimsPercent", v)}
            help="Preliminary costs as % of sell subtotal."
            step={0.1}
          />
          <SettingField
            label="Default Project Management (%)"
            value={settings?.defaultProjectManagementPercent ?? 0}
            onChange={v => updateSetting("defaultProjectManagementPercent", v)}
            help="Project management fee as % of sell subtotal."
            step={0.1}
          />
          <SettingField
            label="Default Maintenance Fee (%)"
            value={settings?.defaultMaintenanceFeePercent ?? 0}
            onChange={v => updateSetting("defaultMaintenanceFeePercent", v)}
            help="Maintenance fee as % of sell subtotal."
            step={0.1}
          />

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">QLeave</h3>
            <div className="grid grid-cols-2 gap-4">
              <SettingField
                label="QLeave Rate (%)"
                value={settings?.defaultQleaveRatePercent ?? 0.575}
                onChange={v => updateSetting("defaultQleaveRatePercent", v)}
                help="QLD building levy rate (currently 0.575%)."
                step={0.001}
              />
              <SettingField
                label="QLeave Threshold ($)"
                value={settings?.qleaveThreshold ?? 150000}
                onChange={v => updateSetting("qleaveThreshold", v)}
                help="Cost threshold above which QLeave applies (currently $150,000 ex GST)."
                step={1000}
                prefix="$"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">QBCC Home Warranty Insurance</h3>
            <SettingField
              label="QBCC Minimum Threshold ($)"
              value={settings?.qbccMinimumThreshold ?? 3300}
              onChange={v => updateSetting("qbccMinimumThreshold", v)}
              help="Contract value below which QBCC premium doesn't apply (currently $3,300)."
              step={100}
              prefix="$"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save All Defaults"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function SettingField({
  label,
  value,
  onChange,
  help,
  step = 0.5,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
  step?: number;
  prefix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative w-36">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          className={prefix ? "pl-6" : ""}
        />
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
