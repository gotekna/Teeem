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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Switch } from "@/components/ui/switch";
import type { DateRange } from "react-day-picker";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { useConfirm } from "@/contexts/ConfirmationContext";

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
  const { confirm } = useConfirm();
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
    region: "National",
  });
  const [multiDayMode, setMultiDayMode] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);

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
      // SSoT: Database is the only source - no mock/fallback data
      toast({ title: "Error", description: "Failed to load holidays from database", variant: "destructive" });
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", date: "", region: "National" });
    setEditingHoliday(null);
    setMultiDayMode(false);
    setDateRange(undefined);
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

  // Helper to get all WEEKDAY dates in a range (skip Saturdays and Sundays)
  const getDatesInRange = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Helper to count weekdays in range (for display)
  const countWeekdaysInRange = (start: Date, end: Date): number => {
    return getDatesInRange(start, end).length;
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name) {
      toast({ title: "Error", description: "Please enter a holiday name", variant: "destructive" });
      return;
    }

    if (multiDayMode && !editingHoliday) {
      // Multi-day mode - need date range
      if (!dateRange?.from) {
        toast({ title: "Error", description: "Please select at least one date", variant: "destructive" });
        return;
      }
    } else {
      // Single day mode
      if (!formData.date) {
        toast({ title: "Error", description: "Please select a date", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        // Editing existing - always single day
        await api.patch(`/api/v1/public_holidays/${editingHoliday.id}`, {
          public_holiday: formData,
        });
        toast({ title: "Success", description: "Holiday updated successfully" });
      } else if (multiDayMode && dateRange?.from) {
        // Multi-day creation (weekdays only)
        const endDate = dateRange.to || dateRange.from;
        const dates = getDatesInRange(dateRange.from, endDate);

        if (dates.length === 0) {
          toast({ title: "No weekdays selected", description: "The selected range contains only weekends. Please select a range with at least one weekday.", variant: "destructive" });
          setSaving(false);
          return;
        }

        // Get existing holidays to check for duplicates
        const existingDates = new Set(holidays.map(h => h.date));

        // Create holidays for each date
        let successCount = 0;
        const skippedDates: string[] = [];
        const failedDates: string[] = [];

        for (const date of dates) {
          const dateStr = format(date, "yyyy-MM-dd");

          // Skip if holiday already exists for this date
          if (existingDates.has(dateStr)) {
            skippedDates.push(format(date, "MMM d"));
            continue;
          }

          try {
            await api.post("/api/v1/public_holidays", {
              public_holiday: {
                name: formData.name,
                date: dateStr,
                region: formData.region,
              },
            });
            successCount++;
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            // Check if it's a duplicate error from server
            if (errorMessage.includes("already been taken") || errorMessage.includes("duplicate")) {
              skippedDates.push(format(date, "MMM d"));
            } else {
              failedDates.push(format(date, "MMM d"));
              console.error(`Failed to create holiday for ${dateStr}:`, err);
            }
          }
        }

        // Build feedback message
        let description = `Created ${successCount} holiday${successCount !== 1 ? "s" : ""}`;
        if (skippedDates.length > 0) {
          description += `. Skipped ${skippedDates.length} (already exist: ${skippedDates.slice(0, 3).join(", ")}${skippedDates.length > 3 ? "..." : ""})`;
        }
        if (failedDates.length > 0) {
          description += `. Failed: ${failedDates.join(", ")}`;
        }

        if (successCount > 0) {
          toast({ title: "Holidays Created", description });
        } else if (skippedDates.length > 0) {
          toast({ title: "No New Holidays", description: "All selected dates already have holidays", variant: "destructive" });
        } else {
          throw new Error("Failed to create any holidays");
        }
      } else {
        // Single day creation
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
    if (!(await confirm("Are you sure you want to delete this holiday?"))) return;

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
            <Spinner size={32} className="text-muted-foreground" />
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
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
                              <Spinner size={16} />
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

            {/* Multi-day toggle - only when adding new */}
            {!editingHoliday && (
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="multi-day">Multiple Days</Label>
                  <p className="text-sm text-muted-foreground">Select a date range for consecutive days</p>
                </div>
                <Switch
                  id="multi-day"
                  checked={multiDayMode}
                  onCheckedChange={(checked) => {
                    setMultiDayMode(checked);
                    if (checked) {
                      // Reset date range when switching to multi-day
                      setDateRange(undefined);
                    } else {
                      // Reset single date when switching to single day
                      setFormData({ ...formData, date: "" });
                    }
                  }}
                />
              </div>
            )}

            {/* Date selection - single or range */}
            <div className="space-y-2">
              <Label>{multiDayMode && !editingHoliday ? "Date Range" : "Date"}</Label>
              {multiDayMode && !editingHoliday ? (
                <>
                  <DateRangePicker
                    range={dateRange || { from: undefined, to: undefined }}
                    onSelect={(range) => setDateRange(range)}
                    placeholder={
                      dateRange?.from
                        ? dateRange.to
                          ? `${format(dateRange.from, "d MMM yyyy")} - ${format(dateRange.to, "d MMM yyyy")}`
                          : format(dateRange.from, "d MMM yyyy")
                        : "Select date range"
                    }
                  />
                  {dateRange?.from && dateRange?.to && (
                    <p className="text-sm text-muted-foreground">
                      {getDatesInRange(dateRange.from, dateRange.to).length} weekdays selected (Sat/Sun excluded)
                    </p>
                  )}
                </>
              ) : (
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              )}
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
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingHoliday ? (
                "Update Holiday"
              ) : multiDayMode && dateRange?.from && dateRange?.to ? (
                `Add ${getDatesInRange(dateRange.from, dateRange.to).length} Holidays`
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
