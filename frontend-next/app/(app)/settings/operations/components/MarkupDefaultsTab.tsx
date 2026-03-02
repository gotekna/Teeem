"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

interface PricingSettings {
  defaultBuilderMarginPercent: number;
  defaultEscalationPercent: number;
  pcPsMarkupCapPercent: number;
}

export function MarkupDefaultsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<PricingSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const response = await api.get<{ settings: PricingSettings }>("/api/v1/sm_settings");
        setSettings({
          defaultBuilderMarginPercent: response.settings.defaultBuilderMarginPercent ?? 0,
          defaultEscalationPercent: response.settings.defaultEscalationPercent ?? 0,
          pcPsMarkupCapPercent: response.settings.pcPsMarkupCapPercent ?? 25,
        });
      } catch {
        toast({ title: "Failed to load markup settings", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch("/api/v1/sm_settings", {
        settings: {
          default_builder_margin_percent: settings.defaultBuilderMarginPercent,
          default_escalation_percent: settings.defaultEscalationPercent,
          pc_ps_markup_cap_percent: settings.pcPsMarkupCapPercent,
        },
      });
      toast({ title: "Markup defaults saved" });
    } catch {
      toast({ title: "Failed to save markup defaults", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={32} className="text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl px-4 pt-4">
      <div>
        <h2 className="text-lg font-semibold">Markup Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default markup values applied when a Schedule Master template is copied to a new job.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>Default Builder Margin (%)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={settings?.defaultBuilderMarginPercent ?? 0}
              onChange={(e) =>
                setSettings((prev) =>
                  prev ? { ...prev, defaultBuilderMarginPercent: parseFloat(e.target.value) || 0 } : null
                )
              }
              className="w-36"
            />
            <p className="text-xs text-muted-foreground">
              Applied to new jobs when a template is copied. Editable per-job in the Markup tab.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Default Escalation (%)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={settings?.defaultEscalationPercent ?? 0}
              onChange={(e) =>
                setSettings((prev) =>
                  prev ? { ...prev, defaultEscalationPercent: parseFloat(e.target.value) || 0 } : null
                )
              }
              className="w-36"
            />
            <p className="text-xs text-muted-foreground">
              CPI/inflation adjustment applied to PO costs. Editable per-task in the Markup tab.
            </p>
          </div>

          <div className="space-y-2">
            <Label>PC/PS Markup Cap (%)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={settings?.pcPsMarkupCapPercent ?? 25}
              onChange={(e) =>
                setSettings((prev) =>
                  prev ? { ...prev, pcPsMarkupCapPercent: parseFloat(e.target.value) || 0 } : null
                )
              }
              className="w-36"
            />
            <p className="text-xs text-muted-foreground">
              Maximum markup allowed on Provisional Cost / Provisional Sum items (default 25%).
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Markup Defaults"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
