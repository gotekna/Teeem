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
import { Plus, Save, X, Pencil, Trash2 } from "lucide-react";

interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface EditingState {
  id: number | "new";
  code: string;
  name: string;
  description: string;
  sort_order: string;
}

/**
 * UomTab - Manage Units of Measure
 *
 * SSoT: UnitOfMeasure model (database table)
 * Simple editable table for <20 rows. Not TeeemTableView (overkill).
 */
export function UomTab() {
  const { toast } = useToast();
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; units: UnitOfMeasure[] }>(
        "/api/v1/units_of_measure"
      );
      if (res.success) {
        setUnits(res.units);
      }
    } catch (err) {
      console.error("[UomTab] Failed to load units:", err);
      toast({ title: "Error", description: "Failed to load units of measure", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const startEdit = (unit: UnitOfMeasure) => {
    setEditing({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      description: unit.description || "",
      sort_order: String(unit.sort_order ?? 0),
    });
  };

  const startAdd = () => {
    setEditing({
      id: "new",
      code: "",
      name: "",
      description: "",
      sort_order: "0",
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);

    const payload = {
      unit_of_measure: {
        code: editing.code,
        name: editing.name,
        description: editing.description || null,
        sort_order: parseInt(editing.sort_order, 10) || 0,
      },
    };

    try {
      if (editing.id === "new") {
        await api.post("/api/v1/units_of_measure", payload);
        toast({ title: "Created", description: `Unit '${editing.code}' created` });
      } else {
        await api.put(`/api/v1/units_of_measure/${editing.id}`, payload);
        toast({ title: "Updated", description: `Unit '${editing.code}' updated` });
      }
      setEditing(null);
      fetchUnits();
    } catch (err) {
      console.error("[UomTab] Failed to save unit:", err);
      toast({ title: "Error", description: "Failed to save unit of measure", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (unit: UnitOfMeasure) => {
    try {
      await api.delete(`/api/v1/units_of_measure/${unit.id}`);
      toast({ title: "Deactivated", description: `Unit '${unit.code}' deactivated` });
      fetchUnits();
    } catch (err) {
      console.error("[UomTab] Failed to deactivate unit:", err);
      toast({ title: "Error", description: "Failed to deactivate unit", variant: "destructive" });
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
            <CardTitle>Units of Measure</CardTitle>
            <CardDescription>
              Units used in Pricebook items (e.g., Each, Lm, m2, m3).
              Changes affect new selections only.
            </CardDescription>
          </div>
          <Button size="sm" onClick={startAdd} disabled={!!editing}>
            <Plus className="h-4 w-4 mr-1" />
            Add Unit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-right p-3 font-medium">Sort Order</th>
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

              {units.map((unit) =>
                editing?.id === unit.id ? (
                  <EditRow
                    key={unit.id}
                    editing={editing}
                    setEditing={setEditing}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                ) : (
                  <tr
                    key={unit.id}
                    className={`border-b last:border-b-0 ${!unit.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="p-3 font-mono">{unit.code}</td>
                    <td className="p-3">{unit.name}</td>
                    <td className="p-3 text-muted-foreground">{unit.description || "-"}</td>
                    <td className="p-3 text-right font-mono">{unit.sort_order}</td>
                    <td className="p-3 text-center">
                      <Badge variant={unit.is_active ? "default" : "secondary"}>
                        {unit.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(unit)}
                          disabled={!!editing}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {unit.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deactivate(unit)}
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

              {units.length === 0 && !editing && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No units of measure configured. Click &quot;Add Unit&quot; to create one.
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
          placeholder="m2"
          className="h-8 text-sm font-mono"
        />
      </td>
      <td className="p-2">
        <Input
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          placeholder="Square Metres"
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <Input
          value={editing.description}
          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
          placeholder="Optional description"
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          value={editing.sort_order}
          onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })}
          className="h-8 text-sm text-right font-mono w-20 ml-auto"
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
