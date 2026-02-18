"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Pencil, Trash2, RefreshCw } from "lucide-react";

interface GstCode {
  id: number;
  code: string;
  name: string;
  rate: number;
  xero_tax_types: string | null;
  active: boolean;
  position: number;
}

interface EditingState {
  id: number | "new";
  code: string;
  name: string;
  rate: string;
  xero_tax_types: string;
}

/**
 * GstCodesTab - Manage tenant GST codes
 *
 * SSoT: GstCode model (database table, tenant-scoped)
 * Simple editable table for 3-5 rows. Not TeeemTableView (overkill).
 */
export function GstCodesTab() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<GstCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; gst_codes: GstCode[] }>(
        "/api/v1/gst_codes"
      );
      if (res.success) {
        setCodes(res.gst_codes);
      }
    } catch (err) {
      console.error("[GstCodesTab] Failed to load GST codes:", err);
      toast({ title: "Error", description: "Failed to load GST codes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const startEdit = (code: GstCode) => {
    setEditing({
      id: code.id,
      code: code.code,
      name: code.name,
      rate: (code.rate * 100).toFixed(2),
      xero_tax_types: code.xero_tax_types || "",
    });
  };

  const startAdd = () => {
    setEditing({
      id: "new",
      code: "",
      name: "",
      rate: "0.00",
      xero_tax_types: "",
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);

    const payload = {
      gst_code: {
        code: editing.code,
        name: editing.name,
        rate: parseFloat(editing.rate) / 100,
        xero_tax_types: editing.xero_tax_types || null,
      },
    };

    try {
      if (editing.id === "new") {
        await api.post("/api/v1/gst_codes", payload);
        toast({ title: "Created", description: `GST code '${editing.code}' created` });
      } else {
        await api.put(`/api/v1/gst_codes/${editing.id}`, payload);
        toast({ title: "Updated", description: `GST code '${editing.code}' updated` });
      }
      setEditing(null);
      fetchCodes();
    } catch (err) {
      console.error("[GstCodesTab] Failed to save GST code:", err);
      toast({ title: "Error", description: "Failed to save GST code", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (code: GstCode) => {
    try {
      await api.delete(`/api/v1/gst_codes/${code.id}`);
      toast({ title: "Deactivated", description: `GST code '${code.code}' deactivated` });
      fetchCodes();
    } catch (err) {
      console.error("[GstCodesTab] Failed to deactivate GST code:", err);
      toast({ title: "Error", description: "Failed to deactivate GST code", variant: "destructive" });
    }
  };

  const syncFromXero = async () => {
    setSyncing(true);
    try {
      const res = await api.post<{
        success: boolean;
        xero_rates_fetched: number;
        created: Array<{ code: string; tax_type: string; rate: number }>;
        updated: Array<{ code: string; tax_type: string; rate: number }>;
        message: string;
      }>("/api/v1/gst_codes/sync_from_xero", {});

      if (res?.success) {
        toast({
          title: "Xero Sync Complete",
          description: res.message,
        });
        fetchCodes();
      } else {
        toast({
          title: "Xero Sync Failed",
          description: "Unexpected response from server",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Xero Sync Failed",
        description: err instanceof Error ? err.message : "Failed to sync from Xero",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>GST Codes</CardTitle>
            <CardDescription>
              Tax codes used in Purchase Orders, Pricebook, and Xero sync.
              Changes affect future calculations only.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={syncFromXero}
              disabled={!!editing || syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Xero"}
            </Button>
            <Button size="sm" onClick={startAdd} disabled={!!editing}>
              <Plus className="h-4 w-4 mr-1" />
              Add Code
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-right p-3 font-medium">Rate (%)</th>
                <th className="text-left p-3 font-medium">Xero Tax Types</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* New row form */}
              {editing?.id === "new" && (
                <EditRow
                  editing={editing}
                  setEditing={setEditing}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  saving={saving}
                />
              )}

              {codes.map((code) =>
                editing?.id === code.id ? (
                  <EditRow
                    key={code.id}
                    editing={editing}
                    setEditing={setEditing}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                ) : (
                  <tr
                    key={code.id}
                    className={`border-b last:border-b-0 ${!code.active ? "opacity-50" : ""}`}
                  >
                    <td className="p-3 font-mono">{code.code}</td>
                    <td className="p-3">{code.name}</td>
                    <td className="p-3 text-right font-mono">
                      {(code.rate * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-muted-foreground text-xs font-mono">
                      {code.xero_tax_types || "-"}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={code.active ? "default" : "secondary"}>
                        {code.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(code)}
                          disabled={!!editing}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {code.active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deactivate(code)}
                            disabled={!!editing}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}

              {codes.length === 0 && !editing && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No GST codes configured. Click &quot;Add Code&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditRow({
  editing,
  setEditing,
  onSave,
  onCancel,
  saving,
}: {
  editing: EditingState;
  setEditing: (state: EditingState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td className="p-2">
        <Input
          value={editing.code}
          onChange={(e) => setEditing({ ...editing, code: e.target.value })}
          placeholder="GST"
          className="h-8 text-sm font-mono"
          disabled={editing.id !== "new"}
        />
      </td>
      <td className="p-2">
        <Input
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          placeholder="GST 10%"
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={editing.rate}
          onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
          className="h-8 text-sm text-right font-mono w-24 ml-auto"
        />
      </td>
      <td className="p-2">
        <Input
          value={editing.xero_tax_types}
          onChange={(e) => setEditing({ ...editing, xero_tax_types: e.target.value })}
          placeholder="INPUT,OUTPUT"
          className="h-8 text-sm font-mono text-xs"
        />
      </td>
      <td className="p-2" />
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary"
            onClick={onSave}
            disabled={saving || !editing.code || !editing.name}
          >
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
