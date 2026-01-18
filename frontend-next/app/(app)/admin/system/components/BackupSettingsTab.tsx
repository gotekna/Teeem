"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
  HardDrive,
  Database,
  FileArchive,
  RefreshCw,
  Play,
  Check,
  X,
  Clock,
  AlertCircle,
  CloudUpload,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatDistanceToNow, format } from "date-fns";

// Types
interface SchedulePreset {
  value: string;
  label: string;
  cron: string | null;
}

interface S3Credential {
  id: number;
  name: string;
  providerName: string;
  endpoint: string;
  bucket: string;
  isConnected: boolean;
}

interface BackupConfig {
  id: number;
  enabled: boolean;
  databaseSchedule: string;
  databaseScheduleLabel: string;
  documentSchedule: string;
  documentScheduleLabel: string;
  retentionDays: number;
  mirrorEnabled: boolean;
  primaryCredentialId: number | null;
  primaryCredential: S3Credential | null;
  secondaryCredentialId: number | null;
  secondaryCredential: S3Credential | null;
  lastDatabaseBackupAt: string | null;
  lastDocumentBackupAt: string | null;
  lastMirrorSyncAt: string | null;
  nextDatabaseBackup: string | null;
  nextDocumentBackup: string | null;
}

interface BackupLog {
  id: number;
  backupType: string;
  status: string;
  sizeBytes: number | null;
  sizeDisplay: string | null;
  durationSeconds: number | null;
  durationDisplay: string | null;
  filesCount: number | null;
  storageKey: string | null;
  providerName: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/**
 * BackupSettingsTab - Per-tenant backup configuration UI
 *
 * Allows admins to configure:
 * - Backup schedules (database & documents)
 * - Storage providers (primary & secondary/mirror)
 * - Retention policies
 * - View backup history
 * - Trigger manual backups
 */
export function BackupSettingsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [runningBackup, setRunningBackup] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<BackupConfig | null>(null);
  const [history, setHistory] = React.useState<BackupLog[]>([]);
  const [presets, setPresets] = React.useState<SchedulePreset[]>([]);
  const [credentials, setCredentials] = React.useState<S3Credential[]>([]);

  // Track dirty state for save button
  const [isDirty, setIsDirty] = React.useState(false);
  const [formState, setFormState] = React.useState<Partial<BackupConfig>>({});

  // Load initial data
  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load in parallel
      const [configRes, historyRes, presetsRes, credsRes] = await Promise.all([
        api.get<{ data: BackupConfig }>("/api/v1/backup_configuration"),
        api.get<{ data: BackupLog[] }>("/api/v1/backup_configuration/history"),
        api.get<{ data: SchedulePreset[] }>("/api/v1/backup_configuration/schedule_presets"),
        api.get<{ data: S3Credential[] }>("/api/v1/s3_compatible_credentials"),
      ]);

      setConfig(configRes.data);
      setFormState(configRes.data);
      setHistory(historyRes.data);
      setPresets(presetsRes.data);
      setCredentials(credsRes.data);
    } catch (error) {
      console.error("Failed to load backup configuration:", error);
      toast({
        title: "Error",
        description: "Failed to load backup configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = <K extends keyof BackupConfig>(key: K, value: BackupConfig[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ data: BackupConfig }>("/api/v1/backup_configuration", {
        backup_configuration: {
          enabled: formState.enabled,
          database_schedule: formState.databaseSchedule,
          document_schedule: formState.documentSchedule,
          retention_days: formState.retentionDays,
          mirror_enabled: formState.mirrorEnabled,
          primary_credential_id: formState.primaryCredentialId,
          secondary_credential_id: formState.secondaryCredentialId,
        },
      });
      setConfig(res.data);
      setFormState(res.data);
      setIsDirty(false);
      toast({
        title: "Success",
        description: "Backup settings saved successfully",
      });
    } catch (error) {
      console.error("Failed to save backup configuration:", error);
      toast({
        title: "Error",
        description: "Failed to save backup configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async (type: "database" | "documents" | "mirror") => {
    setRunningBackup(type);
    try {
      await api.post("/api/v1/backup_configuration/run_now", { type });
      toast({
        title: "Success",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} backup started`,
      });
      // Refresh history after a delay
      setTimeout(loadData, 2000);
    } catch (error: unknown) {
      console.error("Failed to run backup:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start backup";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRunningBackup(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const primaryCred = credentials.find((c) => c.id === formState.primaryCredentialId);
  const secondaryCred = credentials.find((c) => c.id === formState.secondaryCredentialId);

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CloudUpload className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">Backup Settings</CardTitle>
                <CardDescription>Configure backup schedules and storage providers</CardDescription>
              </div>
            </div>
            <Badge variant={formState.enabled ? "default" : "secondary"}>
              {formState.enabled ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Disabled
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="text-base">
                Backups Enabled
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable automatic backups for this organization
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formState.enabled ?? false}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
            />
          </div>

          {/* Schedule Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Database Backups</Label>
                <Select
                  value={formState.databaseSchedule ?? "disabled"}
                  onValueChange={(value) => handleChange("databaseSchedule", value)}
                  disabled={!formState.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {config?.lastDatabaseBackupAt && (
                  <p className="text-xs text-muted-foreground">
                    Last: {formatDistanceToNow(new Date(config.lastDatabaseBackupAt))} ago
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Document Backups</Label>
                <Select
                  value={formState.documentSchedule ?? "disabled"}
                  onValueChange={(value) => handleChange("documentSchedule", value)}
                  disabled={!formState.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {config?.lastDocumentBackupAt && (
                  <p className="text-xs text-muted-foreground">
                    Last: {formatDistanceToNow(new Date(config.lastDocumentBackupAt))} ago
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Retention Period: {formState.retentionDays ?? 90} days</Label>
              <Slider
                value={[formState.retentionDays ?? 90]}
                onValueChange={([value]) => handleChange("retentionDays", value)}
                min={7}
                max={365}
                step={7}
                disabled={!formState.enabled}
                className="w-full max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Backups older than {formState.retentionDays ?? 90} days will be automatically deleted
              </p>
            </div>
          </div>

          {/* Storage Providers Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Providers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Storage</Label>
                <Select
                  value={formState.primaryCredentialId?.toString() ?? ""}
                  onValueChange={(value) =>
                    handleChange("primaryCredentialId", value ? parseInt(value) : null)
                  }
                  disabled={!formState.enabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select storage provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id.toString()}>
                        {cred.name} ({cred.providerName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {primaryCred && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {primaryCred.isConnected ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-red-500" />
                    )}
                    {primaryCred.bucket} @ {primaryCred.endpoint}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mirror Storage</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="mirror" className="text-sm text-muted-foreground">
                      Enable Mirror
                    </Label>
                    <Switch
                      id="mirror"
                      checked={formState.mirrorEnabled ?? false}
                      onCheckedChange={(checked) => handleChange("mirrorEnabled", checked)}
                      disabled={!formState.enabled}
                    />
                  </div>
                </div>
                <Select
                  value={formState.secondaryCredentialId?.toString() ?? ""}
                  onValueChange={(value) =>
                    handleChange("secondaryCredentialId", value ? parseInt(value) : null)
                  }
                  disabled={!formState.enabled || !formState.mirrorEnabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mirror storage" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials
                      .filter((c) => c.id !== formState.primaryCredentialId)
                      .map((cred) => (
                        <SelectItem key={cred.id} value={cred.id.toString()}>
                          {cred.name} ({cred.providerName})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {secondaryCred && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {secondaryCred.isConnected ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-red-500" />
                    )}
                    {secondaryCred.bucket} @ {secondaryCred.endpoint}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium flex items-center gap-2">
              <Play className="h-4 w-4" />
              Manual Backup
            </h3>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handleRunNow("database")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
              >
                {runningBackup === "database" ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Run Database Backup Now
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRunNow("documents")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
              >
                {runningBackup === "documents" ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <FileArchive className="h-4 w-4 mr-2" />
                )}
                Run Document Backup Now
              </Button>
              {formState.mirrorEnabled && formState.secondaryCredentialId && (
                <Button
                  variant="outline"
                  onClick={() => handleRunNow("mirror")}
                  disabled={!formState.enabled || runningBackup !== null}
                >
                  {runningBackup === "mirror" ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Run Mirror Sync Now
                </Button>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={!isDirty || saving}>
              {saving ? <Spinner size={16} className="mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Recent Backups</CardTitle>
                <CardDescription>View backup history and status</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileArchive className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No backups yet</p>
              <p className="text-sm">Backups will appear here once they run</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium capitalize">
                      <div className="flex items-center gap-2">
                        {log.backupType === "database" && <Database className="h-4 w-4" />}
                        {log.backupType === "documents" && <FileArchive className="h-4 w-4" />}
                        {log.backupType === "mirror" && <RefreshCw className="h-4 w-4" />}
                        {log.backupType}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "completed"
                            ? "default"
                            : log.status === "started"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {log.status === "completed" && <Check className="h-3 w-3 mr-1" />}
                        {log.status === "started" && <Clock className="h-3 w-3 mr-1" />}
                        {log.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.sizeDisplay || "-"}</TableCell>
                    <TableCell>{log.durationDisplay || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{log.providerName || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
