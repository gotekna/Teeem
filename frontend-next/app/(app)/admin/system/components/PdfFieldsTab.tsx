"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  Save,
  Eye,
  RefreshCw,
  GripVertical,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

interface PdfFieldPosition {
  id: number;
  pdf_template_key: string;
  field_key: string;
  display_name: string;
  page: number;
  x: number;
  y: number;
  font_size: number;
  test_value: string | null;
  active: boolean;
  updated_at: string;
}

interface Job {
  id: number;
  name: string;
  display_name?: string;
}

const TEMPLATE_OPTIONS = [
  { value: "qbcc_contract", label: "QBCC Contract" },
  { value: "qbcc_consumer_guide", label: "QBCC Consumer Guide" },
  { value: "qbcc_general_conditions", label: "QBCC General Conditions" },
];

export function PdfFieldsTab() {
  const { toast } = useToast();
  const [positions, setPositions] = React.useState<PdfFieldPosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState("qbcc_contract");
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editValues, setEditValues] = React.useState<Partial<PdfFieldPosition>>({});
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Load positions
  const loadPositions = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: { positions: PdfFieldPosition[]; templates: string[] };
      }>(`/api/v1/pdf_field_positions?template=${selectedTemplate}`);

      if (response.success && response.data) {
        setPositions(response.data.positions);
      }
    } catch (err) {
      console.error("Failed to load positions:", err);
      toast({
        title: "Error",
        description: "Failed to load field positions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, toast]);

  // Load jobs for picker
  const loadJobs = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Job[] }>(
        "/api/v1/jobs?fields=id,name&limit=100"
      );
      if (response.success && response.data) {
        setJobs(response.data);
        // Auto-select first job
        if (response.data.length > 0 && !selectedJob) {
          setSelectedJob(response.data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  }, [selectedJob]);

  React.useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Start editing a position
  const startEditing = (position: PdfFieldPosition) => {
    setEditingId(position.id);
    setEditValues({
      x: position.x,
      y: position.y,
      font_size: position.font_size,
      page: position.page,
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  // Save position
  const savePosition = async (id: number) => {
    try {
      setSaving(true);
      const response = await api.patch<{ success: boolean; data: PdfFieldPosition }>(
        `/api/v1/pdf_field_positions/${id}`,
        { pdf_field_position: editValues }
      );

      if (response.success && response.data) {
        setPositions((prev) =>
          prev.map((p) => (p.id === id ? response.data : p))
        );
        setEditingId(null);
        setEditValues({});
        toast({
          title: "Saved",
          description: "Position updated successfully",
        });
      }
    } catch (err) {
      console.error("Failed to save position:", err);
      toast({
        title: "Error",
        description: "Failed to save position",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate preview PDF
  const generatePreview = async () => {
    try {
      setGenerating(true);
      // Use blob response for PDF
      const response = await fetch(
        `/api/v1/pdf_field_positions/preview?template=${selectedTemplate}&job_id=${selectedJob?.id || ""}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        // Open in new tab
        window.open(url, "_blank");
      } else {
        throw new Error("Failed to generate preview");
      }
    } catch (err) {
      console.error("Failed to generate preview:", err);
      toast({
        title: "Error",
        description: "Failed to generate preview PDF",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">PDF Field Positions</h2>
          <p className="text-sm text-muted-foreground">
            Configure text overlay positions for PDF templates (SSoT)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPositions}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Template and Job selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preview Job (for real data)</Label>
              <ComboboxDropdown
                selectedItem={selectedJob ? { id: String(selectedJob.id), label: selectedJob.name || `Job ${selectedJob.id}` } : undefined}
                onSelect={(item) => {
                  if (item) {
                    const job = jobs.find((j) => String(j.id) === item.id);
                    setSelectedJob(job || null);
                  } else {
                    setSelectedJob(null);
                  }
                }}
                items={jobs.map((j) => ({
                  id: String(j.id),
                  label: j.name || `Job ${j.id}`,
                }))}
                placeholder="Select a job..."
                searchPlaceholder="Search jobs..."
                emptyResults="No jobs found"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={generatePreview}
              disabled={generating || !selectedJob}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Generate Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Field positions table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Field Positions
            <Badge variant="secondary" className="ml-2">
              {positions.length} fields
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No field positions configured for this template
            </p>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted rounded-md text-sm font-medium">
                <div className="col-span-3">Field</div>
                <div className="col-span-1 text-center">Page</div>
                <div className="col-span-2 text-center">X</div>
                <div className="col-span-2 text-center">Y</div>
                <div className="col-span-1 text-center">Size</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>

              {/* Rows */}
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 px-3 py-2 rounded-md border items-center",
                    editingId === pos.id && "bg-primary/5 border-primary"
                  )}
                >
                  <div className="col-span-3 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">
                        {pos.display_name || pos.field_key}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pos.field_key}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 text-center">
                    {editingId === pos.id ? (
                      <Input
                        type="number"
                        value={editValues.page || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, page: parseInt(e.target.value) })
                        }
                        className="h-8 text-center"
                      />
                    ) : (
                      <Badge variant="outline">{pos.page}</Badge>
                    )}
                  </div>

                  <div className="col-span-2 text-center">
                    {editingId === pos.id ? (
                      <Input
                        type="number"
                        value={editValues.x || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, x: parseFloat(e.target.value) })
                        }
                        className="h-8 text-center"
                        step="0.1"
                      />
                    ) : (
                      <code className="text-sm">{pos.x}</code>
                    )}
                  </div>

                  <div className="col-span-2 text-center">
                    {editingId === pos.id ? (
                      <Input
                        type="number"
                        value={editValues.y || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, y: parseFloat(e.target.value) })
                        }
                        className="h-8 text-center"
                        step="0.1"
                      />
                    ) : (
                      <code className="text-sm">{pos.y}</code>
                    )}
                  </div>

                  <div className="col-span-1 text-center">
                    {editingId === pos.id ? (
                      <Input
                        type="number"
                        value={editValues.font_size || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            font_size: parseInt(e.target.value),
                          })
                        }
                        className="h-8 text-center"
                      />
                    ) : (
                      <code className="text-sm">{pos.font_size}</code>
                    )}
                  </div>

                  <div className="col-span-3 flex justify-end gap-1">
                    {editingId === pos.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => savePosition(pos.id)}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(pos)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. Select the PDF template you want to configure
          </p>
          <p>
            2. Select a job to use real data in the preview
          </p>
          <p>
            3. Edit the X, Y coordinates to move fields on the PDF
          </p>
          <p>
            4. Click Generate Preview to see the result
          </p>
          <p>
            5. Repeat until positions are correct
          </p>
          <p className="text-xs mt-4">
            <strong>Note:</strong> X increases to the right, Y increases upward (PDF coordinate system).
            Typical page dimensions: 595 x 842 points (A4).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
