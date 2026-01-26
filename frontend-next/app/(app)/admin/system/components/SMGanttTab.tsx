"use client";

import * as React from "react";
import { useUrlTabs } from "@/hooks/useUrlTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  RotateCcw,
  Calendar,
  Palette,
  Layers,
  Settings,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface GanttConfig {
  defaultView: "day" | "week" | "month";
  showWeekends: boolean;
  showDependencies: boolean;
  showProgress: boolean;
  showMilestones: boolean;
  barHeight: number;
  rowHeight: number;
  headerHeight: number;
  gridLineColor: string;
  todayLineColor: string;
  taskColors: {
    default: string;
    completed: string;
    delayed: string;
    milestone: string;
  };
  autoSchedule: boolean;
  snapToGrid: boolean;
  zoomLevel: number;
}

const DEFAULT_CONFIG: GanttConfig = {
  defaultView: "week",
  showWeekends: true,
  showDependencies: true,
  showProgress: true,
  showMilestones: true,
  barHeight: 24,
  rowHeight: 40,
  headerHeight: 60,
  gridLineColor: "#E5E7EB",
  todayLineColor: "#EF4444",
  taskColors: {
    default: "#3B82F6",
    completed: "#10B981",
    delayed: "#EF4444",
    milestone: "#8B5CF6",
  },
  autoSchedule: true,
  snapToGrid: true,
  zoomLevel: 100,
};

const COLOR_PRESETS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#84CC16",
];

export function SMGanttTab() {
  const [activeTab, setActiveTab] = useUrlTabs("display", "gantt-tab");
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [config, setConfig] = React.useState<GanttConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Try localStorage first as primary storage (API endpoint may not exist yet)
      const saved = getStorageItem<GanttConfig | null>(STORAGE_KEYS.GANTT_CONFIG, null);
      if (saved) {
        setConfig(saved);
      }
      // Optionally try API if it exists in the future
      // const data = await api.get<GanttConfig>("/api/v1/gantt_config");
      // setConfig(data);
    } catch {
      console.debug("Using default gantt config");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = <K extends keyof GanttConfig>(key: K, value: GanttConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleTaskColorChange = (key: keyof GanttConfig["taskColors"], value: string) => {
    setConfig((prev) => ({
      ...prev,
      taskColors: { ...prev.taskColors, [key]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/gantt_config", { gantt_config: config });
      setStorageItem(STORAGE_KEYS.GANTT_CONFIG, config);
      toast({ title: "Success", description: "Gantt configuration saved successfully" });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      // Save to localStorage as fallback
      setStorageItem(STORAGE_KEYS.GANTT_CONFIG, config);
      toast({ title: "Success", description: "Configuration saved locally" });
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!(await confirm("Reset all settings to default values?"))) return;
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
    toast({ title: "Reset", description: "Settings reset to defaults. Click Save to apply." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Schedule Master Gantt Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure the appearance and behavior of the Gantt chart.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Spinner size={16} className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="py-3 flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <Info className="h-4 w-4" />
            <span className="text-sm">You have unsaved changes</span>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="dimensions" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Dimensions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Settings</CardTitle>
              <CardDescription>
                Configure what elements are visible on the Gantt chart.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default View</Label>
                <Select
                  value={config.defaultView}
                  onValueChange={(value: "day" | "week" | "month") =>
                    handleChange("defaultView", value)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day View</SelectItem>
                    <SelectItem value="week">Week View</SelectItem>
                    <SelectItem value="month">Month View</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The default time scale when opening the Gantt chart.
                </p>
              </div>

              <div className="space-y-4">
                <Label>Visibility Options</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show Weekends</p>
                      <p className="text-xs text-muted-foreground">
                        Display Saturday and Sunday on the timeline.
                      </p>
                    </div>
                    <Switch
                      checked={config.showWeekends}
                      onCheckedChange={(checked) => handleChange("showWeekends", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show Dependencies</p>
                      <p className="text-xs text-muted-foreground">
                        Display arrows connecting dependent tasks.
                      </p>
                    </div>
                    <Switch
                      checked={config.showDependencies}
                      onCheckedChange={(checked) => handleChange("showDependencies", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show Progress</p>
                      <p className="text-xs text-muted-foreground">
                        Display progress percentage on task bars.
                      </p>
                    </div>
                    <Switch
                      checked={config.showProgress}
                      onCheckedChange={(checked) => handleChange("showProgress", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show Milestones</p>
                      <p className="text-xs text-muted-foreground">
                        Display milestone markers on the chart.
                      </p>
                    </div>
                    <Switch
                      checked={config.showMilestones}
                      onCheckedChange={(checked) => handleChange("showMilestones", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Color Settings</CardTitle>
              <CardDescription>
                Customize the colors used in the Gantt chart.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Grid Line Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.gridLineColor}
                      onChange={(e) => handleChange("gridLineColor", e.target.value)}
                      className="w-12 h-8 p-0 border-0"
                    />
                    <Input
                      value={config.gridLineColor}
                      onChange={(e) => handleChange("gridLineColor", e.target.value)}
                      className="w-24 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Today Line Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.todayLineColor}
                      onChange={(e) => handleChange("todayLineColor", e.target.value)}
                      className="w-12 h-8 p-0 border-0"
                    />
                    <Input
                      value={config.todayLineColor}
                      onChange={(e) => handleChange("todayLineColor", e.target.value)}
                      className="w-24 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Task Colors</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["default", "completed", "delayed", "milestone"] as const).map((key) => (
                    <div key={key} className="space-y-2">
                      <Label className="capitalize">{key} Tasks</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={config.taskColors[key]}
                          onChange={(e) => handleTaskColorChange(key, e.target.value)}
                          className="w-12 h-8 p-0 border-0"
                        />
                        <Input
                          value={config.taskColors[key]}
                          onChange={(e) => handleTaskColorChange(key, e.target.value)}
                          className="w-24 font-mono text-sm"
                        />
                        <div className="flex gap-1">
                          {COLOR_PRESETS.slice(0, 5).map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleTaskColorChange(key, color)}
                              className={cn(
                                "w-5 h-5 rounded-full border transition-transform",
                                config.taskColors[key] === color
                                  ? "border-foreground scale-110"
                                  : "border-transparent hover:scale-105"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Behavior Settings</CardTitle>
              <CardDescription>
                Configure how the Gantt chart behaves when editing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto Schedule</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically adjust dependent task dates when a task is moved.
                    </p>
                  </div>
                  <Switch
                    checked={config.autoSchedule}
                    onCheckedChange={(checked) => handleChange("autoSchedule", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Snap to Grid</p>
                    <p className="text-xs text-muted-foreground">
                      Snap task bars to day boundaries when dragging.
                    </p>
                  </div>
                  <Switch
                    checked={config.snapToGrid}
                    onCheckedChange={(checked) => handleChange("snapToGrid", checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Zoom Level</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={config.zoomLevel}
                    onChange={(e) => handleChange("zoomLevel", parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Badge variant="secondary" className="w-16 justify-center">
                    {config.zoomLevel}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Default zoom level when opening the Gantt chart.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dimensions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension Settings</CardTitle>
              <CardDescription>
                Configure the sizes of various Gantt chart elements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Bar Height (px)</Label>
                  <Input
                    type="number"
                    min="16"
                    max="40"
                    value={config.barHeight}
                    onChange={(e) => handleChange("barHeight", parseInt(e.target.value) || 24)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Height of task bars (16-40)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Row Height (px)</Label>
                  <Input
                    type="number"
                    min="30"
                    max="60"
                    value={config.rowHeight}
                    onChange={(e) => handleChange("rowHeight", parseInt(e.target.value) || 40)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Height of each row (30-60)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Header Height (px)</Label>
                  <Input
                    type="number"
                    min="40"
                    max="80"
                    value={config.headerHeight}
                    onChange={(e) => handleChange("headerHeight", parseInt(e.target.value) || 60)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Height of the timeline header (40-80)
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div
                    className="bg-background border rounded"
                    style={{ height: config.headerHeight }}
                  >
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      Header ({config.headerHeight}px)
                    </div>
                  </div>
                  <div
                    className="flex items-center border-x"
                    style={{ height: config.rowHeight }}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <div
                        className="rounded text-white text-xs flex items-center justify-center"
                        style={{
                          height: config.barHeight,
                          width: "80%",
                          backgroundColor: config.taskColors.default,
                        }}
                      >
                        Task ({config.barHeight}px)
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center border-x border-b rounded-b"
                    style={{ height: config.rowHeight }}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <div
                        className="rounded text-white text-xs flex items-center justify-center"
                        style={{
                          height: config.barHeight,
                          width: "60%",
                          backgroundColor: config.taskColors.completed,
                        }}
                      >
                        Completed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
