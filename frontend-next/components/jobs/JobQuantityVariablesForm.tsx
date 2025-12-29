"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  RefreshCw,
  Calculator,
  Ruler,
  Home,
  Settings,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface QuantityVariable {
  id: number;
  variable_name: string;
  display_name: string;
  category: string;
  data_type: string;
  unit_label: string | null;
  value: number | string;
  is_default: boolean;
  select_options: string[] | null;
  min_value: number | null;
  max_value: number | null;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface GroupedVariables {
  dimensions: QuantityVariable[];
  counts: QuantityVariable[];
  specifications: QuantityVariable[];
  computed: QuantityVariable[];
}

interface JobQuantityVariablesFormProps {
  jobId: string | number;
  onSave?: () => void;
}

const CATEGORY_CONFIG = {
  dimensions: {
    icon: Ruler,
    title: "Dimensions",
    description: "Physical measurements of the building",
  },
  counts: {
    icon: Home,
    title: "Room & Feature Counts",
    description: "Number of rooms and features",
  },
  specifications: {
    icon: Settings,
    title: "Specifications",
    description: "Building specifications and options",
  },
  computed: {
    icon: Calculator,
    title: "Computed Values",
    description: "Automatically calculated from other values",
  },
};

export function JobQuantityVariablesForm({ jobId, onSave }: JobQuantityVariablesFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<GroupedVariables | null>(null);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadVariables();
  }, [jobId]);

  const loadVariables = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ success: boolean; variables: GroupedVariables }>(
        `/api/v1/jobs/${jobId}/quantity_variables?grouped=true`
      );
      if (response?.success) {
        setVariables(response.variables);
        // Initialize values from current variable values
        const initialValues: Record<string, string | number> = {};
        Object.values(response.variables).flat().forEach((v: QuantityVariable) => {
          initialValues[v.variable_name] = v.value;
        });
        setValues(initialValues);
        setHasChanges(false);
      } else {
        setError("Failed to load quantity variables");
      }
    } catch (err) {
      console.error("Failed to load quantity variables:", err);
      setError("Failed to load quantity variables");
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (variableName: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [variableName]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Only send changed values
      const changedValues: Record<string, string | number> = {};
      Object.entries(values).forEach(([key, value]) => {
        const original = Object.values(variables || {})
          .flat()
          .find((v: QuantityVariable) => v.variable_name === key);
        if (original && original.value !== value) {
          changedValues[key] = value;
        }
      });

      if (Object.keys(changedValues).length === 0) {
        setHasChanges(false);
        return;
      }

      const response = await api.patch<{ success: boolean }>(
        `/api/v1/jobs/${jobId}/quantity_variables`,
        { variables: changedValues }
      );

      if (response?.success) {
        setHasChanges(false);
        onSave?.();
        await loadVariables(); // Reload to get computed values
      } else {
        setError("Failed to save changes");
      }
    } catch (err) {
      console.error("Failed to save:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !variables) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground">{error || "No variables available"}</p>
            <Button variant="outline" onClick={loadVariables} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderVariable = (variable: QuantityVariable) => {
    const isComputed = variable.category === "computed";
    const value = values[variable.variable_name] ?? variable.value;

    return (
      <div key={variable.variable_name} className="space-y-2">
        <Label htmlFor={variable.variable_name} className="flex items-center gap-2">
          {variable.display_name}
          {variable.unit_label && (
            <span className="text-xs text-muted-foreground">({variable.unit_label})</span>
          )}
        </Label>

        {variable.data_type === "select" && variable.select_options ? (
          <Select
            value={String(value)}
            onValueChange={(v) => handleValueChange(variable.variable_name, v)}
            disabled={isComputed}
          >
            <SelectTrigger id={variable.variable_name}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {variable.select_options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={variable.variable_name}
            type="number"
            value={value}
            onChange={(e) => handleValueChange(variable.variable_name, parseFloat(e.target.value) || 0)}
            disabled={isComputed}
            min={variable.min_value ?? undefined}
            max={variable.max_value ?? undefined}
            className={cn(
              "font-mono",
              isComputed && "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          />
        )}

        {variable.description && (
          <p className="text-xs text-muted-foreground">{variable.description}</p>
        )}

        {!variable.is_default && variable.updated_by && (
          <p className="text-xs text-muted-foreground">
            Updated by {variable.updated_by}
          </p>
        )}
      </div>
    );
  };

  const renderCategory = (categoryKey: keyof typeof CATEGORY_CONFIG) => {
    const categoryVars = variables[categoryKey];
    if (!categoryVars || categoryVars.length === 0) return null;

    const config = CATEGORY_CONFIG[categoryKey];
    const Icon = config.icon;

    return (
      <Card key={categoryKey}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{config.title}</CardTitle>
          </div>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryVars.map(renderVariable)}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">House Specifications</h3>
          <p className="text-sm text-muted-foreground">
            Enter the building specifications used for recipe calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadVariables}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Variable Categories */}
      {renderCategory("dimensions")}
      {renderCategory("counts")}
      {renderCategory("specifications")}
      {renderCategory("computed")}
    </div>
  );
}

export default JobQuantityVariablesForm;
