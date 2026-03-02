"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Upload } from "lucide-react";
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
  qleaveThreshold: number;
  qbccMinimumThreshold: number;
}

interface QbccBracket {
  id?: number;
  category: string;
  minValue: number;
  maxValue: number | null;
  premium: number;
  ratePerThousand: number | null;
  sortOrder: number;
}

// ============================================
// Component
// ============================================

export function MarkupDefaultsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<PricingSettings | null>(null);
  const [brackets, setBrackets] = React.useState<QbccBracket[]>([]);
  const [bracketCategory, setBracketCategory] = React.useState("new_home");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savingBrackets, setSavingBrackets] = React.useState(false);

  // ============================================
  // Fetch
  // ============================================

  React.useEffect(() => {
    (async () => {
      try {
        const [settingsRes, bracketsRes] = await Promise.all([
          api.get<{ settings: PricingSettings }>("/api/v1/sm_settings"),
          api.get<{ brackets: QbccBracket[] }>("/api/v1/qbcc_premium_brackets"),
        ]);

        if (settingsRes?.settings) {
          setSettings({
            defaultBuilderMarginPercent: settingsRes.settings.defaultBuilderMarginPercent ?? 0,
            defaultEscalationPercent: settingsRes.settings.defaultEscalationPercent ?? 0,
            pcPsMarkupCapPercent: settingsRes.settings.pcPsMarkupCapPercent ?? 25,
            defaultConstructionInsurancePercent: settingsRes.settings.defaultConstructionInsurancePercent ?? 0,
            defaultOverheadsPercent: settingsRes.settings.defaultOverheadsPercent ?? 0,
            defaultQleaveRatePercent: settingsRes.settings.defaultQleaveRatePercent ?? 0.575,
            qleaveThreshold: settingsRes.settings.qleaveThreshold ?? 150000,
            qbccMinimumThreshold: settingsRes.settings.qbccMinimumThreshold ?? 3300,
          });
        }

        if (bracketsRes?.brackets) {
          setBrackets(bracketsRes.brackets);
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
  // QBCC Brackets
  // ============================================

  const filteredBrackets = brackets
    .filter(b => b.category === bracketCategory)
    .sort((a, b) => a.minValue - b.minValue);

  const addBracket = () => {
    const lastMax = filteredBrackets.length > 0
      ? filteredBrackets[filteredBrackets.length - 1].maxValue ?? filteredBrackets[filteredBrackets.length - 1].minValue + 1000
      : 0;

    setBrackets(prev => [...prev, {
      category: bracketCategory,
      minValue: lastMax,
      maxValue: lastMax + 50000,
      premium: 0,
      ratePerThousand: 0,
      sortOrder: filteredBrackets.length,
    }]);
  };

  const updateBracket = (index: number, field: keyof QbccBracket, value: number | null) => {
    const globalIndex = brackets.findIndex((b, i) => {
      if (b.category !== bracketCategory) return false;
      const catBrackets = brackets.filter(bb => bb.category === bracketCategory);
      return catBrackets.indexOf(b) === index;
    });
    if (globalIndex === -1) return;

    setBrackets(prev => prev.map((b, i) => i === globalIndex ? { ...b, [field]: value } : b));
  };

  const removeBracket = (index: number) => {
    const catBrackets = brackets.filter(b => b.category === bracketCategory);
    const target = catBrackets[index];
    if (!target) return;
    setBrackets(prev => prev.filter(b => b !== target));
  };

  const saveBrackets = async () => {
    setSavingBrackets(true);
    try {
      await api.post("/api/v1/qbcc_premium_brackets/bulk_import", {
        category: bracketCategory,
        brackets: filteredBrackets.map(b => ({
          minValue: b.minValue,
          maxValue: b.maxValue,
          premium: b.premium,
          ratePerThousand: b.ratePerThousand,
        })),
      });
      toast({ title: "QBCC brackets saved", description: `${filteredBrackets.length} brackets for ${bracketCategory}` });

      // Refresh brackets
      const res = await api.get<{ brackets: QbccBracket[] }>("/api/v1/qbcc_premium_brackets");
      if (res?.brackets) setBrackets(res.brackets);
    } catch {
      toast({ title: "Failed to save QBCC brackets", variant: "destructive" });
    } finally {
      setSavingBrackets(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    // Skip header row if it contains non-numeric first cell
    const startIdx = isNaN(parseFloat(lines[0]?.split(",")[0])) ? 1 : 0;

    const imported: QbccBracket[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      if (cols.length < 3) continue;
      imported.push({
        category: bracketCategory,
        minValue: parseFloat(cols[0]) || 0,
        maxValue: cols[1] ? parseFloat(cols[1]) || null : null,
        premium: parseFloat(cols[2]) || 0,
        ratePerThousand: cols[3] ? parseFloat(cols[3]) || null : null,
        sortOrder: i - startIdx,
      });
    }

    // Replace brackets for this category
    setBrackets(prev => [
      ...prev.filter(b => b.category !== bracketCategory),
      ...imported,
    ]);

    toast({ title: `Imported ${imported.length} brackets`, description: "Review and save to apply." });
    e.target.value = "";
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
      {/* ── Existing Markup Defaults ── */}
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

      {/* ── QBCC Premium Table ── */}
      <div>
        <h2 className="text-lg font-semibold">QBCC Premium Brackets</h2>
        <p className="text-sm text-muted-foreground">
          Lookup table for QBCC Home Warranty Insurance premiums by insurable value.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Select value={bracketCategory} onValueChange={setBracketCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_home">New Home</SelectItem>
                <SelectItem value="alterations">Alterations</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addBracket}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Row
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Import CSV
                  </span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
              </label>
              <Button size="sm" onClick={saveBrackets} disabled={savingBrackets}>
                {savingBrackets ? "Saving..." : "Save Brackets"}
              </Button>
            </div>
          </div>

          {filteredBrackets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No brackets configured for {bracketCategory === "new_home" ? "New Home" : "Alterations"}.
              Add rows or import a CSV.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Min Value ($)</TableHead>
                    <TableHead>Max Value ($)</TableHead>
                    <TableHead>Base Premium ($)</TableHead>
                    <TableHead>Rate / $1,000</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrackets.map((bracket, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          value={bracket.minValue}
                          onChange={e => updateBracket(idx, "minValue", parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          value={bracket.maxValue ?? ""}
                          placeholder="No limit"
                          onChange={e => updateBracket(idx, "maxValue", e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-7 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={bracket.premium}
                          onChange={e => updateBracket(idx, "premium", parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm w-28"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={bracket.ratePerThousand ?? ""}
                          placeholder="0"
                          onChange={e => updateBracket(idx, "ratePerThousand", e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-7 text-sm w-24"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeBracket(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            CSV format: min_value, max_value, premium, rate_per_thousand (header row optional).
            The rate per $1,000 is used to interpolate within a bracket.
          </p>
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
          className={prefix ? "pl-6" : ""}
        />
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
