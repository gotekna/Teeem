"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  RefreshCw,
  FileText,
  Play,
  Download,
  Copy,
  Star,
  StarOff,
  LayoutDashboard,
  Plus,
  Table2,
  BarChart3,
  Clock,
  Grid3X3,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/utils/formatters";

interface CustomReport {
  id: number;
  name: string;
  description: string | null;
  report_type: string;
  base_entity: string;
  category: string | null;
  is_public: boolean;
  is_template: boolean;
  created_by: { id: number; name: string } | null;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  base_entity: string;
  popularity: number;
}

interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  is_default: boolean;
  widget_count: number;
  created_by: { id: number; name: string } | null;
  created_at: string;
}

export default function ReportsBuilderTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [favorites, setFavorites] = useState<CustomReport[]>([]);
  const [activeTab, setActiveTab] = useState("reports");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const categoryParam = categoryFilter !== "all" ? `?category=${categoryFilter}` : "";
      const [reportsRes, templatesRes, dashboardsRes, favoritesRes] = await Promise.all([
        api.get<{ success: boolean; data: CustomReport[] }>(`/api/v1/gl/reports_builder${categoryParam}`),
        api.get<{ success: boolean; data: ReportTemplate[] }>("/api/v1/gl/reports_builder/templates"),
        api.get<{ success: boolean; data: Dashboard[] }>("/api/v1/gl/reports_builder/dashboards"),
        api.get<{ success: boolean; data: CustomReport[] }>("/api/v1/gl/reports_builder/favorites"),
      ]);

      if (reportsRes?.success) setReports(reportsRes.data || []);
      if (templatesRes?.success) setTemplates(templatesRes.data || []);
      if (dashboardsRes?.success) setDashboards(dashboardsRes.data || []);
      if (favoritesRes?.success) setFavorites(favoritesRes.data || []);
    } catch (error) {
      console.error("Failed to fetch reports builder data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRun = async (report: CustomReport) => {
    try {
      const res = await api.post<{ success: boolean; data: unknown }>(`/api/v1/gl/reports_builder/${report.id}/run`);
      if (res?.success) {
        // In a real implementation, this would display the results
        console.log("Report results:", res.data);
      }
      fetchData(); // Refresh to update run count
    } catch (error) {
      console.error("Failed to run report:", error);
    }
  };

  const handleDuplicate = async (report: CustomReport) => {
    try {
      await api.post(`/api/v1/gl/reports_builder/${report.id}/duplicate`);
      fetchData();
    } catch (error) {
      console.error("Failed to duplicate report:", error);
    }
  };

  const handleToggleFavorite = async (report: CustomReport) => {
    try {
      const isFavorite = favorites.some(f => f.id === report.id);
      if (isFavorite) {
        await api.delete(`/api/v1/gl/reports_builder/${report.id}/favorite`);
      } else {
        await api.post(`/api/v1/gl/reports_builder/${report.id}/favorite`);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const handleCreateFromTemplate = async (template: ReportTemplate) => {
    try {
      await api.post(`/api/v1/gl/reports_builder/from_template/${template.id}`);
      fetchData();
    } catch (error) {
      console.error("Failed to create from template:", error);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "table":
        return <Table2 className="h-4 w-4" />;
      case "chart":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  const isFavorite = (report: CustomReport) => favorites.some(f => f.id === report.id);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custom Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Favorites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{favorites.length}</div>
            <p className="text-xs text-muted-foreground mt-1">saved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dashboards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dashboards.length}</div>
            <p className="text-xs text-muted-foreground mt-1">configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{templates.length}</div>
            <p className="text-xs text-muted-foreground mt-1">available</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports">My Reports</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Custom Reports
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No custom reports</p>
                  <p className="text-sm mt-1">Create a report or use a template to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{report.name}</span>
                            {report.is_public && (
                              <Badge variant="outline" className="text-xs">Public</Badge>
                            )}
                          </div>
                          {report.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {report.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getReportTypeIcon(report.report_type)}
                            <span className="capitalize">{report.report_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.base_entity}</Badge>
                        </TableCell>
                        <TableCell>{report.category || "-"}</TableCell>
                        <TableCell>{report.created_by?.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(report.last_run_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{report.run_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRun(report)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Run
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleFavorite(report)}
                            >
                              {isFavorite(report) ? (
                                <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400 fill-yellow-500" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicate(report)}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Export"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                Favorite Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No favorites yet</p>
                  <p className="text-sm mt-1">Star reports to add them to your favorites</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map((report) => (
                    <Card key={report.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-medium">{report.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{report.base_entity}</p>
                          </div>
                          <Star className="h-5 w-5 text-yellow-500 dark:text-yellow-400 fill-yellow-500" />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" onClick={() => handleRun(report)}>
                            <Play className="h-4 w-4 mr-1" />
                            Run
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboards Tab */}
        <TabsContent value="dashboards" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Report Dashboards
              </CardTitle>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Dashboard
              </Button>
            </CardHeader>
            <CardContent>
              {dashboards.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No dashboards</p>
                  <p className="text-sm mt-1">Create a dashboard to combine multiple reports</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboards.map((dashboard) => (
                    <Card key={dashboard.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              {dashboard.name}
                              {dashboard.is_default && (
                                <Badge variant="outline" className="text-xs">Default</Badge>
                              )}
                            </h3>
                            {dashboard.description && (
                              <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
                            )}
                          </div>
                          <Grid3X3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                          <span>{dashboard.widget_count} widgets</span>
                          <span>By {dashboard.created_by?.name || "Unknown"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No templates available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-6">
                        <div>
                          <h3 className="text-sm font-medium">{template.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline">{template.base_entity}</Badge>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                        <Button
                          className="w-full mt-4"
                          variant="outline"
                          onClick={() => handleCreateFromTemplate(template)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
