"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Cloud,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/utils/formatters";

interface RainLog {
  id: number;
  date: string;
  rainfall_mm: number | null;
  severity: "light" | "moderate" | "heavy" | null;
  hours_affected: number | null;
  notes: string | null;
  source: "manual" | "automatic";
  created_by_user?: {
    name: string;
  };
}

interface WeatherStatus {
  api_configured: boolean;
  job_has_location: boolean;
  message: string;
  job_location?: string;
}

interface WeatherResult {
  error?: string;
  rain_log_created?: boolean;
  rain_log?: {
    rainfall_mm: number;
  };
  rainfall_mm?: number;
  message?: string;
}

interface RainLogTabProps {
  jobId: string | number;
}

function getTodayAsString(): string {
  return new Date().toISOString().split("T")[0];
}

export function RainLogTab({ jobId }: RainLogTabProps) {
  const { toast } = useToast();
  const [rainLogs, setRainLogs] = useState<RainLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<RainLog | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus | null>(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherResult, setWeatherResult] = useState<WeatherResult | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    rainfall_mm: "",
    hours_affected: "",
    notes: "",
  });

  useEffect(() => {
    loadRainLogs();
    loadWeatherStatus();
     
  }, [jobId]);

  const loadRainLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ rain_logs: RainLog[] }>(
        `/api/v1/jobs/${jobId}/rain_logs`
      );
      setRainLogs(response?.rain_logs || []);
    } catch (err) {
      console.error("Failed to load rain logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadWeatherStatus = async () => {
    try {
      const response = await api.get<WeatherStatus>(
        `/api/v1/jobs/${jobId}/rain_logs/weather_status`
      );
      if (response) {
        setWeatherStatus(response);
      }
    } catch (err) {
      console.error("Failed to load weather status:", err);
    }
  };

  const fetchYesterdayWeather = async () => {
    setFetchingWeather(true);
    setWeatherResult(null);
    try {
      const response = await api.post<WeatherResult>(
        `/api/v1/jobs/${jobId}/rain_logs/auto_log`
      );
      if (response) {
        setWeatherResult(response);
        if (response?.rain_log_created) {
          await loadRainLogs();
        }
      }
    } catch (err) {
      setWeatherResult({ error: "Failed to fetch weather" });
    } finally {
      setFetchingWeather(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLog) {
        await api.put(`/api/v1/jobs/${jobId}/rain_logs/${editingLog.id}`, {
          rain_log: formData,
        });
      } else {
        await api.post(`/api/v1/jobs/${jobId}/rain_logs`, {
          rain_log: formData,
        });
      }

      setFormData({ date: "", rainfall_mm: "", hours_affected: "", notes: "" });
      setShowAddForm(false);
      setEditingLog(null);
      await loadRainLogs();
    } catch (err) {
      console.error("Failed to save rain log:", err);
      toast({ title: "Error", description: "Failed to save rain log", variant: "destructive" });
    }
  };

  const handleDelete = async (logId: number) => {
    if (!confirm("Are you sure you want to delete this rain log?")) return;

    try {
      await api.delete(`/api/v1/jobs/${jobId}/rain_logs/${logId}`);
      await loadRainLogs();
    } catch (err) {
      console.error("Failed to delete rain log:", err);
      toast({ title: "Error", description: "Failed to delete rain log", variant: "destructive" });
    }
  };

  const handleEdit = (log: RainLog) => {
    setEditingLog(log);
    setFormData({
      date: log.date,
      rainfall_mm: log.rainfall_mm?.toString() || "",
      hours_affected: log.hours_affected?.toString() || "",
      notes: log.notes || "",
    });
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setFormData({ date: "", rainfall_mm: "", hours_affected: "", notes: "" });
  };

  const getSeverityBadge = (severity: string | null) => {
    switch (severity) {
      case "light":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Light</Badge>;
      case "moderate":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Moderate</Badge>;
      case "heavy":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Heavy</Badge>;
      default:
        return <span className="text-muted-foreground">-</span>;
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === "automatic") {
      return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">Auto</Badge>;
    }
    return <Badge variant="secondary">Manual</Badge>;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weather Status Card */}
      {weatherStatus && (
        <Card className={
          weatherStatus.api_configured && weatherStatus.job_has_location
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
            : "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950"
        }>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {weatherStatus.api_configured && weatherStatus.job_has_location ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                )}
                <div>
                  <h4 className={`text-sm font-medium ${
                    weatherStatus.api_configured && weatherStatus.job_has_location
                      ? "text-green-800 dark:text-green-200"
                      : "text-yellow-800 dark:text-yellow-200"
                  }`}>
                    Weather Station Status
                  </h4>
                  <p className={`text-sm mt-1 ${
                    weatherStatus.api_configured && weatherStatus.job_has_location
                      ? "text-green-700 dark:text-green-300"
                      : "text-yellow-700 dark:text-yellow-300"
                  }`}>
                    {weatherStatus.message}
                  </p>
                  {weatherStatus.job_location && (
                    <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location: {weatherStatus.job_location}
                    </p>
                  )}
                </div>
              </div>
              {weatherStatus.api_configured && weatherStatus.job_has_location && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchYesterdayWeather}
                  disabled={fetchingWeather}
                  className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${fetchingWeather ? "animate-spin" : ""}`} />
                  {fetchingWeather ? "Checking..." : "Check Yesterday"}
                </Button>
              )}
            </div>
            {weatherResult && (
              <div className={`mt-3 p-3 rounded-lg ${
                weatherResult.error
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "bg-background text-foreground"
              }`}>
                {weatherResult.error ? (
                  <p className="text-sm">{weatherResult.error}</p>
                ) : weatherResult.rain_log_created ? (
                  <p className="text-sm flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Rain log created: {weatherResult.rain_log?.rainfall_mm}mm recorded
                  </p>
                ) : (
                  <p className="text-sm flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    {weatherResult.message || `No rainfall detected (${weatherResult.rainfall_mm || 0}mm)`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="h-6 w-6 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Rain Log</h3>
            <p className="text-sm text-muted-foreground">
              Track rainy days that affect construction
            </p>
          </div>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Rain Day
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingLog ? "Edit Rain Log" : "Log Rain Day"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={getTodayAsString()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rainfall">Rainfall (mm)</Label>
                  <Input
                    id="rainfall"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.rainfall_mm}
                    onChange={(e) => setFormData({ ...formData, rainfall_mm: e.target.value })}
                    placeholder="e.g., 5.2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours Affected</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={formData.hours_affected}
                    onChange={(e) => setFormData({ ...formData, hours_affected: e.target.value })}
                    placeholder="e.g., 3.5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes *</Label>
                <Textarea
                  id="notes"
                  required
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Describe the impact (e.g., 'Heavy rain in the morning, work stopped for 3 hours')"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit">
                  <Check className="h-4 w-4 mr-2" />
                  {editingLog ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rain Logs Table */}
      {rainLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No rain logs recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a manual entry or wait for automatic daily checks
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rainfall</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rainLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{formatDate(log.date)}</TableCell>
                    <TableCell>{log.rainfall_mm ? `${log.rainfall_mm} mm` : "-"}</TableCell>
                    <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    <TableCell>{log.hours_affected ? `${log.hours_affected}h` : "-"}</TableCell>
                    <TableCell>{getSourceBadge(log.source)}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.notes || "-"}</TableCell>
                    <TableCell>{log.created_by_user?.name || "System"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(log)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(log.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RainLogTab;
