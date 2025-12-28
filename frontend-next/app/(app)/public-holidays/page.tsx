"use client";

import { useState, useEffect } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";

// SSoT: Columns fetched from Foundation API (ID: 405)

// Types
interface PublicHoliday extends TableRow {
  id: number;
  name: string;
  date: string;
  region: string;
  created_at: string;
  updated_at: string;
}

const REGIONS = ["ALL", "QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

export default function PublicHolidaysPage() {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for new holiday
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    region: "QLD",
  });

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 2);

  useEffect(() => {
    loadHolidays();
     
  }, [selectedYear, selectedRegion]);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { year: selectedYear };
      if (selectedRegion !== "ALL") {
        params.region = selectedRegion;
      }
      const response = await api.get<{ holidays: PublicHoliday[] }>("/api/v1/public_holidays", {
        params,
      });
      setHolidays(response?.holidays || []);
    } catch (err) {
      console.error("Failed to load holidays:", err);
      toast({
        title: "Error",
        description: "Failed to load public holidays",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<{ holiday: PublicHoliday }>("/api/v1/public_holidays", {
        public_holiday: {
          name: newHoliday.name,
          date: newHoliday.date,
          region: newHoliday.region,
        },
      });

      toast({ title: "Public holiday added successfully" });
      setShowAddModal(false);
      setNewHoliday({ name: "", date: "", region: "QLD" });

      // Add to list if it matches current filters
      if (response?.holiday) {
        if (selectedRegion === "ALL" || response.holiday.region === selectedRegion) {
          setHolidays([...holidays, response.holiday]);
        }
      }
    } catch (err) {
      console.error("Failed to add holiday:", err);
      toast({
        title: "Error",
        description: "Failed to add public holiday",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holiday: PublicHoliday) => {
    if (!confirm(`Delete "${holiday.name}"?`)) return;

    try {
      await api.delete(`/api/v1/public_holidays/${holiday.id}`);
      setHolidays(holidays.filter((h) => h.id !== holiday.id));
      toast({ title: "Public holiday deleted successfully" });
    } catch (err) {
      console.error("Failed to delete holiday:", err);
      toast({
        title: "Error",
        description: "Failed to delete public holiday",
        variant: "destructive",
      });
    }
  };

  // Filter controls for TeeemTableView leftActions
  const filterControls = (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="year" className="text-sm whitespace-nowrap">
          Year
        </Label>
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="region" className="text-sm whitespace-nowrap">
          Region
        </Label>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((region) => (
              <SelectItem key={region} value={region}>
                {region === "ALL" ? "All Regions" : region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={() => setShowAddModal(true)} size="sm">
        <PlusIcon className="mr-2 h-4 w-4" />
        Add Holiday
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={holidays}
        foundationId="public_holidays"
        tableName="Public Holidays"
        onRefresh={loadHolidays}
        leftActions={filterControls}
        enableExport={true}
        onDelete={(row) => handleDelete(row as PublicHoliday)}
      />

      {/* Add Holiday Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Public Holiday</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday Name</Label>
              <Input
                id="holiday-name"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-region">Region</Label>
              <Select
                value={newHoliday.region}
                onValueChange={(value) => setNewHoliday({ ...newHoliday, region: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.filter((r) => r !== "ALL").map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewHoliday({ name: "", date: "", region: "QLD" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Holiday"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
