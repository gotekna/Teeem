"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TeeemTableView from "@/components/table/TeeemTableView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackButton } from "@/components/ui/back-button";

export default function WHSIncidentsPage() {
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="whs_incidents"
        autoFetchRecords={true}
        tableName="Incident Reports"
        enableExport={true}
        onAddRow={() => setNewIncidentOpen(true)}  // SSoT: Override built-in Add to use custom dialog
        leftActions={<BackButton fallbackHref="/whs" />}
        hideFooter={true}
      />

      {/* Report Incident Dialog */}
      <Dialog open={newIncidentOpen} onOpenChange={setNewIncidentOpen}>
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
    </div>
  );
}
