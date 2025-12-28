"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  Clock,
  Search,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";

// Foundation ID for WHS Incidents table

export default function WHSIncidentsPage() {
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);

  // Use foundation hook for TeeemTableView
  const { foundation, records, isLoading, refresh } = useFoundationBySlug("whs_incidents");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/whs_incidents/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update incident:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    open: records.filter((i) => ["reported", "investigating"].includes(String(i.status))).length,
    high: records.filter((i) => i.severity === "high").length,
    thisMonth: records.filter((i) => {
      const date = new Date(String(i.reported_at));
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  // Left actions - Report Incident button
  const leftActions = (
    <Dialog open={newIncidentOpen} onOpenChange={setNewIncidentOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report New Incident</DialogTitle>
          <DialogDescription>
            Document a workplace safety incident for investigation
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Incident Title</Label>
            <Input id="title" placeholder="Brief description of the incident" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="severity">Severity</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job">Job Site</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="42">Smith Residence - Foundation</SelectItem>
                  <SelectItem value="67">Commercial Fitout - Level 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Specific location within the site" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of what happened..."
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="injury">Injury Type (if any)</Label>
            <Input id="injury" placeholder="e.g., Minor bruising, No injury" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNewIncidentOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setNewIncidentOpen(false)}>Submit Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Add back button to leftActions
  const leftActionsWithBack = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/whs" />
      {leftActions}
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        foundationId="whs_incidents"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Incident Reports"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActionsWithBack}
        hideFooter={true}
      />
    </div>
  );
}
