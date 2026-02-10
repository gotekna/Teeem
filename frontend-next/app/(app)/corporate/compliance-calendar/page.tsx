"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface ComplianceItem {
  id: number;
  title: string;
  due_date: string;
  completed: boolean;
  is_overdue: boolean;
  days_until_due: number;
  company_id: number;
  company_name: string;
  company_code?: string;
  company_group?: string;
  item_type?: string;
  asic_related?: boolean;
  ato_related?: boolean;
}

interface CalendarData {
  items: ComplianceItem[];
  items_by_date: Record<string, ComplianceItem[]>;
  summary: {
    overdue: number;
    due_this_week: number;
    due_this_month: number;
    pending: number;
    completed: number;
  };
}

interface CompanyGroup {
  id: number;
  name: string;
}

export default function ComplianceCalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [calendarData, setCalendarData] = React.useState<CalendarData | null>(null);
  const [viewMode, setViewMode] = React.useState<"calendar" | "list" | "by_company">("calendar");
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [filters, setFilters] = React.useState({ company_group_id: "", include_completed: false });
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    loadCompanyGroups();
  }, []);

  React.useEffect(() => {
    loadCalendarData();
     
  }, [filters, currentMonth]);

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get<{ company_groups: CompanyGroup[] }>("/api/v1/company_groups");
      setCompanyGroups(response.company_groups || []);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 0);

      const params: Record<string, string> = {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        include_completed: filters.include_completed.toString(),
      };
      if (filters.company_group_id) {
        params.company_group_id = filters.company_group_id;
      }

      const response = await api.get<CalendarData>(`/api/v1/compliance_calendar`, { params });
      setCalendarData(response);
    } catch (error) {
      console.error("Failed to load calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateComplianceItems = async () => {
    try {
      setGenerating(true);
      const response = await api.post<{ generated: number }>("/api/v1/compliance_calendar/generate");
      toast({ title: "Success", description: `Generated ${response?.generated || 0} compliance items` });
      loadCalendarData();
    } catch (error) {
      console.error("Failed to generate compliance items:", error);
    } finally {
      setGenerating(false);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + direction);
      return newMonth;
    });
  };

  // Generate calendar days
  const calendarDays = React.useMemo(() => {
    if (!calendarData?.items_by_date) return [];

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days: { day: number | null; date?: Date; items: ComplianceItem[]; isToday: boolean }[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, items: [], isToday: false });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const items = calendarData.items_by_date[dateKey] || [];
      days.push({
        day,
        date: new Date(year, month, day),
        items,
        isToday: new Date().toDateString() === new Date(year, month, day).toDateString(),
      });
    }

    return days;
  }, [calendarData, currentMonth]);

  const summary = calendarData?.summary || { overdue: 0, due_this_week: 0, due_this_month: 0, pending: 0, completed: 0 };

  if (loading && !calendarData) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/corporate" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Compliance Calendar</h1>
            <p className="text-sm text-muted-foreground mt-1">Track compliance deadlines across all companies</p>
          </div>
        </div>
        <Button onClick={generateComplianceItems} disabled={generating}>
          <RefreshCw className={cn("h-4 w-4 mr-2", generating && "animate-spin")} />
          Generate Items
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{summary.overdue}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">This Week</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">{summary.due_this_week}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Calendar className="h-5 w-5" />
              <span className="text-sm font-medium">This Month</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">{summary.due_this_month}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{summary.completed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={filters.company_group_id || "__all__"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, company_group_id: v === "__all__" ? "" : v }))}
              >
                <SelectTrigger className="w-[160px] text-sm h-8">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Groups</SelectItem>
                  {companyGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.include_completed}
                onChange={(e) => setFilters((prev) => ({ ...prev, include_completed: e.target.checked }))}
                className="rounded"
              />
              Show Completed
            </label>
          </div>
          <div className="flex items-center gap-2">
            {(["calendar", "list", "by_company"] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
              >
                {mode === "by_company" ? "By Company" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold">
                {currentMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="bg-muted/50 px-2 py-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={cn("bg-background min-h-[100px] p-2", day.isToday && "ring-2 ring-primary ring-inset")}
                >
                  {day.day && (
                    <>
                      <span className={cn("text-sm", day.isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                        {day.day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {day.items.slice(0, 3).map((item, i) => (
                          <div
                            key={i}
                            onClick={() => router.push(`/corporate/companies/${item.company_id}/compliance`)}
                            className={cn(
                              "text-xs p-1 rounded cursor-pointer truncate",
                              item.is_overdue
                                ? "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-300"
                                : item.completed
                                ? "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300"
                            )}
                            title={`${item.company_name}: ${item.title}`}
                          >
                            {item.company_code || item.company_name?.slice(0, 10)}
                          </div>
                        ))}
                        {day.items.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{day.items.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {calendarData?.items?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-8">
                      <EmptyState title="No compliance items found" size="sm" />
                    </TableCell>
                  </TableRow>
                ) : (
                  calendarData?.items?.map((item) => (
                    <TableRow
                      key={item.id}
                      onClick={() => router.push(`/corporate/companies/${item.company_id}/compliance`)}
                      className="hover:bg-muted/50 cursor-pointer"
                    >
                      <TableCell className="px-4 py-3 whitespace-nowrap">
                        <span className={item.is_overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                          {new Date(item.due_date).toLocaleDateString("en-AU")}
                        </span>
                        {item.is_overdue && (
                          <span className="ml-2 text-xs text-red-500 dark:text-red-400">({Math.abs(item.days_until_due)} days overdue)</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.company_name}</span>
                          {item.company_code && <span className="text-xs text-muted-foreground">({item.company_code})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">{item.title}</TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-sm text-muted-foreground capitalize">{item.item_type?.replace(/_/g, " ")}</span>
                        {item.asic_related && <Badge className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">ASIC</Badge>}
                        {item.ato_related && <Badge className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">ATO</Badge>}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {item.completed ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            Completed
                          </span>
                        ) : item.is_overdue ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            Overdue
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* By Company View */}
      {viewMode === "by_company" && (
        <div className="space-y-4">
          {Object.entries(
            (calendarData?.items || []).reduce((acc, item) => {
              if (!acc[item.company_id]) {
                acc[item.company_id] = {
                  company_name: item.company_name,
                  company_code: item.company_code,
                  company_group: item.company_group,
                  items: [],
                };
              }
              acc[item.company_id].items.push(item);
              return acc;
            }, {} as Record<number, { company_name: string; company_code?: string; company_group?: string; items: ComplianceItem[] }>)
          ).map(([companyId, data]) => (
            <Card key={companyId}>
              <CardContent className="p-4">
                <div
                  onClick={() => router.push(`/corporate/companies/${companyId}/compliance`)}
                  className="flex items-center justify-between mb-3 cursor-pointer hover:text-primary"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-sm font-medium">{data.company_name}</h3>
                    {data.company_code && <span className="text-sm text-muted-foreground">({data.company_code})</span>}
                    {data.company_group && <Badge variant="outline">{data.company_group}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {data.items.some((i) => i.is_overdue) && (
                      <span className="text-red-600 dark:text-red-400">{data.items.filter((i) => i.is_overdue).length} overdue</span>
                    )}
                    <span className="text-muted-foreground">{data.items.length} items</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.items.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-t">
                      <div className="flex items-center gap-3">
                        <span className={cn("text-sm", item.is_overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                          {new Date(item.due_date).toLocaleDateString("en-AU")}
                        </span>
                        <span className="text-sm">{item.title}</span>
                      </div>
                      {item.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                      ) : item.is_overdue ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  {data.items.length > 5 && (
                    <div className="text-sm text-muted-foreground pt-2 border-t">+{data.items.length - 5} more items</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
