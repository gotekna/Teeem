"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboboxDropdown, ComboboxItem } from "@/components/ui/combobox-dropdown";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ListChecks,
  Building2,
  Link2,
  Home,
  Settings2,
} from "lucide-react";
import { CreatePropertyFromJobDialog } from "@/components/properties/CreatePropertyFromJobDialog";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  loading: boolean;
  icon: React.ElementType;
}

interface XeroOrg {
  id: number;
  tenant_id: string;
  tenant_name: string;
  connected: boolean;
  display_status: string;
}

interface PropertySettingsData {
  xero_credential_id: number | null;
  xero_tenant_name: string | null;
  trading_name: string | null;
  configured: boolean;
}

export default function PropertySetup() {
  const { toast } = useToast();

  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: "types",
      title: "Property Types & Statuses",
      description: "Configure property types and statuses for your portfolio",
      icon: ListChecks,
      complete: false,
      loading: true,
    },
    {
      id: "xero_trading",
      title: "Xero File & Trading Name",
      description: "Select the Xero file and trading name for property management",
      icon: Link2,
      complete: false,
      loading: true,
    },
    {
      id: "property",
      title: "First Property",
      description: "Create your first property from an existing job or add manually",
      icon: Home,
      complete: false,
      loading: true,
    },
  ]);

  const [showCreateFromJob, setShowCreateFromJob] = useState(false);
  const [showXeroConfig, setShowXeroConfig] = useState(false);

  // Xero config dialog state
  const [xeroOrgs, setXeroOrgs] = useState<XeroOrg[]>([]);
  const [selectedXeroId, setSelectedXeroId] = useState<number | null>(null);
  const [tradingName, setTradingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [xeroConfigLoading, setXeroConfigLoading] = useState(false);

  const updateItem = useCallback(
    (id: string, updates: Partial<ChecklistItem>) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    },
    []
  );

  useEffect(() => {
    const fetchAll = async () => {
      const results = await Promise.allSettled([
        api.get("/api/v1/properties/lookups"),
        api.get("/api/v1/property_settings"),
        api.get("/api/v1/properties/stats"),
      ]);

      // Types & Statuses
      {
        const res = results[0];
        let complete = false;
        let desc = "Configure property types and statuses for your portfolio";
        if (res.status === "fulfilled" && res.value) {
          const val = res.value as Record<string, unknown>;
          const lookups = (val?.lookups ?? (val?.data as Record<string, unknown>)?.lookups) as
            | { property_types?: unknown[]; property_statuses?: unknown[] }
            | undefined;
          const types = lookups?.property_types ?? [];
          const statuses = lookups?.property_statuses ?? [];
          complete = types.length > 0 || statuses.length > 0;
          if (complete) {
            desc = `${types.length} type${types.length !== 1 ? "s" : ""}, ${statuses.length} status${statuses.length !== 1 ? "es" : ""} configured`;
          }
        }
        updateItem("types", { complete, loading: false, description: desc });
      }

      // Xero & Trading Name
      {
        const res = results[1];
        let complete = false;
        let desc = "Select the Xero file and trading name for property management";
        if (res.status === "fulfilled" && res.value) {
          const val = res.value as { data?: PropertySettingsData } & PropertySettingsData;
          const settings = val?.data ?? val;
          complete = settings?.configured ?? false;
          if (complete) {
            const parts: string[] = [];
            if (settings?.xero_tenant_name) parts.push(settings.xero_tenant_name);
            if (settings?.trading_name) parts.push(`"${settings.trading_name}"`);
            desc = parts.length > 0 ? parts.join(" — ") : "Configured";
          }
        }
        updateItem("xero_trading", { complete, loading: false, description: desc });
      }

      // Properties
      {
        const res = results[2];
        let complete = false;
        let desc = "Create your first property from an existing job or add manually";
        if (res.status === "fulfilled" && res.value) {
          const val = res.value as { total?: number; data?: { total?: number } };
          const total = val?.total ?? val?.data?.total ?? 0;
          complete = total > 0;
          if (complete) {
            desc = `${total} propert${total !== 1 ? "ies" : "y"} created`;
          }
        }
        updateItem("property", { complete, loading: false, description: desc });
      }
    };

    fetchAll();
  }, [updateItem]);

  // Load available Xero orgs + current settings when config dialog opens
  useEffect(() => {
    if (!showXeroConfig) return;

    const loadConfig = async () => {
      setXeroConfigLoading(true);
      try {
        const [xeroRes, settingsRes] = await Promise.all([
          api.get("/api/v1/company_xero_connections"),
          api.get("/api/v1/property_settings"),
        ]);

        // Parse Xero orgs
        const xeroData = xeroRes as Record<string, unknown>;
        const orgs = ((xeroData?.organizations ?? xeroData?.data) as XeroOrg[]) ?? [];
        setXeroOrgs(
          orgs.map((o) => ({
            id: o.id,
            tenant_id: o.tenant_id,
            tenant_name: o.tenant_name,
            connected: o.connected,
            display_status: o.display_status,
          }))
        );

        // Parse current settings
        const settingsData = settingsRes as { data?: PropertySettingsData } & PropertySettingsData;
        const settings = settingsData?.data ?? settingsData;
        if (settings?.xero_credential_id) setSelectedXeroId(settings.xero_credential_id);
        if (settings?.trading_name) setTradingName(settings.trading_name);
      } catch {
        // Non-critical
      } finally {
        setXeroConfigLoading(false);
      }
    };

    loadConfig();
  }, [showXeroConfig]);

  const handleSaveXeroConfig = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/property_settings", {
        xero_credential_id: selectedXeroId,
        trading_name: tradingName || null,
      });

      toast({ title: "Settings saved" });
      setShowXeroConfig(false);

      // Refresh the checklist item
      const parts: string[] = [];
      const selectedOrg = xeroOrgs.find((o) => o.id === selectedXeroId);
      if (selectedOrg) parts.push(selectedOrg.tenant_name);
      if (tradingName) parts.push(`"${tradingName}"`);
      const configured = selectedXeroId != null || !!tradingName;

      updateItem("xero_trading", {
        complete: configured,
        description: configured
          ? parts.length > 0
            ? parts.join(" — ")
            : "Configured"
          : "Select the Xero file and trading name for property management",
      });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const completedCount = items.filter((i) => i.complete).length;
  const allLoading = items.every((i) => i.loading);

  const xeroComboItems: ComboboxItem[] = xeroOrgs.map((o) => ({
    id: String(o.id),
    label: o.connected ? o.tenant_name : `${o.tenant_name} (disconnected)`,
    disabled: !o.connected,
  }));

  const renderAction = (item: ChecklistItem) => {
    switch (item.id) {
      case "types":
        return (
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/operations/properties">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {item.complete ? "Manage" : "Configure"}
            </Link>
          </Button>
        );
      case "xero_trading":
        return (
          <Button variant="outline" size="sm" onClick={() => setShowXeroConfig(true)}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            {item.complete ? "Change" : "Configure"}
          </Button>
        );
      case "property":
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateFromJob(true)}>
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              From Job
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/properties/list">
                Add New
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 -mt-2">
      {/* Header */}
      <div>
        <BackButton fallbackHref="/properties" label="Properties" />
        <h1 className="text-2xl font-bold tracking-tight font-serif mt-3">
          Property Management Setup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your property management module
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        {allLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <>
            <Badge variant={completedCount === items.length ? "default" : "secondary"}>
              {completedCount} / {items.length} complete
            </Badge>
            {completedCount === items.length && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                All set! You&apos;re ready to go.
              </span>
            )}
          </>
        )}
      </div>

      {/* Checklist */}
      <Card>
        <CardContent className="divide-y p-0">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-6 py-4 first:pt-5 last:pb-5"
              >
                <div className="flex-shrink-0">
                  {item.loading ? (
                    <Skeleton className="h-5 w-5 rounded-full" />
                  ) : item.complete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.complete ? "text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.loading ? <Skeleton className="h-3 w-48 inline-block" /> : item.description}
                  </p>
                </div>
                <div className="flex-shrink-0">{!item.loading && renderAction(item)}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/properties">
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Xero & Trading Name Config Dialog */}
      <Dialog open={showXeroConfig} onOpenChange={setShowXeroConfig}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xero File & Trading Name</DialogTitle>
          </DialogHeader>

          {xeroConfigLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Xero Organisation</Label>
                {xeroComboItems.length > 0 ? (
                  <ComboboxDropdown
                    placeholder="Select Xero file..."
                    searchPlaceholder="Search organisations..."
                    items={xeroComboItems}
                    selectedItem={
                      selectedXeroId
                        ? xeroComboItems.find((i) => i.id === String(selectedXeroId))
                        : undefined
                    }
                    onSelect={(item) => setSelectedXeroId(Number(item.id))}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                    No connected Xero organisations found.{" "}
                    <Link href="/settings/connections/integrations" className="text-primary underline">
                      Connect one first
                    </Link>
                    .
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="trading-name">Trading Name</Label>
                <Input
                  id="trading-name"
                  placeholder="e.g. Pilgrim Property Management"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The name used on property invoices and correspondence
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowXeroConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveXeroConfig} disabled={saving || xeroConfigLoading}>
              {saving && <Spinner className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create from Job Dialog */}
      <CreatePropertyFromJobDialog
        open={showCreateFromJob}
        onOpenChange={setShowCreateFromJob}
        onSuccess={() => {
          setShowCreateFromJob(false);
          api.get("/api/v1/properties/stats").then((res) => {
            const val = res as { total?: number; data?: { total?: number } };
            const total = val?.total ?? val?.data?.total ?? 0;
            updateItem("property", {
              complete: total > 0,
              description: total > 0 ? `${total} propert${total !== 1 ? "ies" : "y"} created` : "Create your first property from an existing job or add manually",
            });
          });
        }}
      />
    </div>
  );
}
