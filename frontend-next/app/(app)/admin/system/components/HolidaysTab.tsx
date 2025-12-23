"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const REGIONS = [
  { value: "all", label: "All Regions" },
  { value: "QLD", label: "Queensland" },
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "National", label: "National" },
];

interface Holiday {
  id: number;
  name: string;
  date: string;
  region: string;
}

export function HolidaysTab() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedYear, setSelectedYear] = React.useState(currentYear.toString());
  const [selectedRegion, setSelectedRegion] = React.useState("all");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingHoliday, setEditingHoliday] = React.useState<Holiday | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    date: "",
    region: "QLD",
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 1);

  React.useEffect(() => {
    loadHolidays();
     
  }, [selectedYear, selectedRegion]);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: selectedYear });
      if (selectedRegion !== "all") {
        params.append("region", selectedRegion);
      }
      const data = await api.get<Holiday[] | { holidays: Holiday[] }>(`/api/v1/public_holidays?${params}`);
      // Handle both direct array and { holidays: [...] } response formats
      const holidaysArray = Array.isArray(data) ? data : (data?.holidays || []);
      setHolidays(holidaysArray);
    } catch (error) {
      console.error("Failed to load holidays:", error);
      // Mock data for development
      setHolidays([
        { id: 1, name: "New Year's Day", date: `${selectedYear}-01-01`, region: "National" },
        { id: 2, name: "Australia Day", date: `${selectedYear}-01-26`, region: "National" },
        { id: 3, name: "Good Friday", date: `${selectedYear}-04-07`, region: "National" },
        { id: 4, name: "Easter Monday", date: `${selectedYear}-04-10`, region: "National" },
        { id: 5, name: "Anzac Day", date: `${selectedYear}-04-25`, region: "National" },
        { id: 6, name: "Queen's Birthday", date: `${selectedYear}-06-12`, region: "QLD" },
        { id: 7, name: "Royal Queensland Show", date: `${selectedYear}-08-16`, region: "QLD" },
        { id: 8, name: "Christmas Day", date: `${selectedYear}-12-25`, region: "National" },
        { id: 9, name: "Boxing Day", date: `${selectedYear}-12-26`, region: "National" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", date: "", region: "QLD" });
    setEditingHoliday(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (holiday: Holiday) => {
    setFormData({
      name: holiday.name,
      date: holiday.date,
      region: holiday.region,
    });
    setEditingHoliday(holiday);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.date) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        await api.patch(`/api/v1/public_holidays/${editingHoliday.id}`, {
          public_holiday: formData,
        });
        toast({ title: "Success", description: "Holiday updated successfully" });
      } else {
        await api.post("/api/v1/public_holidays", {
          public_holiday: formData,
        });
        toast({ title: "Success", description: "Holiday created successfully" });
      }
      setShowAddDialog(false);
      loadHolidays();
    } catch (error) {
      console.error("Failed to save holiday:", error);
      toast({ title: "Error", description: "Failed to save holiday", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/public_holidays/${id}`);
      toast({ title: "Success", description: "Holiday deleted successfully" });
      loadHolidays();
    } catch (error) {
      console.error("Failed to delete holiday:", error);
      toast({ title: "Error", description: "Failed to delete holiday", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    if (selectedRegion === "all") return true;
    return h.region === selectedRegion || h.region === "National";
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Year:</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
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
            <Label>Region:</Label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHolidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No holidays found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredHolidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(holiday.date), "EEEE, MMMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={holiday.region === "National" ? "default" : "secondary"}>
                        {holiday.region}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deleting === holiday.id}>
                            {deleting === holiday.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(holiday)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>
              {editingHoliday
                ? "Update the details of this public holiday."
                : "Add a new public holiday to the calendar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name</Label>
              <Input
                id="name"
                placeholder="e.g., Australia Day"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={formData.region}
                onValueChange={(value) => setFormData({ ...formData, region: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.filter((r) => r.value !== "all").map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingHoliday ? (
                "Update Holiday"
              ) : (
                "Add Holiday"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
