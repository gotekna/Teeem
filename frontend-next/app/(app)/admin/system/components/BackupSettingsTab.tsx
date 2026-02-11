"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  Check,
  X,
  Clock,
  AlertCircle,
  CloudUpload,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { formatDistanceToNow } from "date-fns";

// Types
interface SchedulePreset {
  value: string;
  label: string;
  cron: string | null;
}

interface S3Credential {
  id: number;
  name: string;
  providerType: string;
  providerName: string;
  endpoint: string;
  bucket: string | null;
  isConnected: boolean;
}

interface BackupConfig {
  id: number;
  enabled: boolean;
  databaseSchedule: string;
  documentSchedule: string;
  retentionDays: number;
  retentionCount: number;
  mirrorEnabled: boolean;
  primaryCredentialId: number | null;
  primaryCredential: S3Credential | null;
  secondaryCredentialId: number | null;
  secondaryCredential: S3Credential | null;
  lastDatabaseBackupAt: string | null;
  lastDocumentBackupAt: string | null;
  lastMirrorSyncAt: string | null;
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
 * BackupSettingsTab - Simplified per-tenant backup configuration
 *
 * Single schedule, "Keep last N backups" retention, clear history display.
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
  const [isDirty, setIsDirty] = React.useState(false);
  const [formState, setFormState] = React.useState<Partial<BackupConfig>>({});
  const [warehouseBucket, setWarehouseBucket] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, historyRes, presetsRes, credsRes, wpRes] = await Promise.all([
        api.get<{ data: BackupConfig }>("/api/v1/backup_configuration"),
        api.get<{ data: BackupLog[] }>("/api/v1/backup_configuration/history"),
        api.get<{ data: SchedulePreset[] }>("/api/v1/backup_configuration/schedule_presets"),
        api.get<{ data: S3Credential[] }>("/api/v1/s3_compatible_credentials"),
        api.get<{ data: { bucket: string } }>("/api/v1/warehouse_provider"),
      ]);

      setConfig(configRes.data);
      setFormState(configRes.data);
      setHistory(historyRes.data);
      setPresets(presetsRes.data);
      setCredentials(credsRes.data);
      setWarehouseBucket(wpRes.data?.bucket ?? null);

      // Auto-set primary credential to the WarehouseProvider's storage credential
      const bucket = wpRes.data?.bucket;
      if (bucket && credsRes.data?.length) {
        const storageCred = credsRes.data.find(
          (c: S3Credential) => c.providerType !== "backblaze_b2"
        );
        if (storageCred && configRes.data.primaryCredentialId !== storageCred.id) {
          setFormState((prev) => ({ ...prev, primaryCredentialId: storageCred.id }));
          setIsDirty(true);
        }
      }
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

  // Single schedule sets both DB and doc schedules
  const handleScheduleChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      databaseSchedule: value,
      documentSchedule: value,
    }));
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
          retention_count: formState.retentionCount,
          retention_days: (formState.retentionCount ?? 5) * 30, // Keep retention_days in sync
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
        description: "Backup settings saved",
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
        title: "Backup started",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} backup queued`,
      });
      setTimeout(loadData, 3000);
    } catch (error: unknown) {
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
    return <LoadingOverlay />;
  }

  const primaryCred = credentials.find((c) => c.id === formState.primaryCredentialId);
  const secondaryCred = credentials.find((c) => c.id === formState.secondaryCredentialId);
  const currentSchedule = formState.databaseSchedule ?? "disabled";

  // Compute total backup size from history
  const completedBackups = history.filter((h) => h.status === "completed");
  const totalSizeBytes = completedBackups.reduce((sum, h) => sum + (h.sizeBytes ?? 0), 0);
  const totalSizeDisplay = formatBytes(totalSizeBytes);

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CloudUpload className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">Backup Settings</CardTitle>
                <CardDescription>
                  Database backups are full dumps. Document backups are incremental (changes only).
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={formState.enabled ?? false}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schedule + Retention Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Backup Schedule</Label>
              <Select
                value={currentSchedule}
                onValueChange={handleScheduleChange}
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
            </div>

            <div className="space-y-2">
              <Label>Keep Last</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formState.retentionCount ?? 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 100) {
                      handleChange("retentionCount", val);
                    }
                  }}
                  disabled={!formState.enabled}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">successful backups</span>
              </div>
            </div>
          </div>

          {/* Storage Providers */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary - read-only */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Primary</Label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-sm">
                  {primaryCred ? (
                    <>
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{primaryCred.name}</span>
                      {primaryCred.isConnected ? (
                        <Check className="h-3 w-3 text-green-500 dark:text-green-400 ml-auto shrink-0" />
                      ) : (
                        <X className="h-3 w-3 text-red-500 dark:text-red-400 ml-auto shrink-0" />
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not configured</span>
                  )}
                </div>
                {warehouseBucket && (
                  <p className="text-xs text-muted-foreground">Bucket: {warehouseBucket}</p>
                )}
              </div>

              {/* Mirror */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Mirror</Label>
                  <Switch
                    checked={formState.mirrorEnabled ?? false}
                    onCheckedChange={(checked) => handleChange("mirrorEnabled", checked)}
                    disabled={!formState.enabled}
                  />
                </div>
                <Select
                  value={formState.secondaryCredentialId?.toString() ?? ""}
                  onValueChange={(value) =>
                    handleChange("secondaryCredentialId", value ? parseInt(value) : null)
                  }
                  disabled={!formState.enabled || !formState.mirrorEnabled}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select mirror storage" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials
                      .filter((c) => c.id !== formState.primaryCredentialId)
                      .map((cred) => (
                        <SelectItem key={cred.id} value={cred.id.toString()}>
                          {cred.name} → {cred.bucket || "no bucket"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {secondaryCred && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {secondaryCred.isConnected ? (
                      <Check className="h-3 w-3 text-green-500 dark:text-green-400" />
                    ) : (
                      <X className="h-3 w-3 text-red-500 dark:text-red-400" />
                    )}
                    Bucket: {secondaryCred.bucket || "not set"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Manual Backup + Save */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunNow("database")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
              >
                {runningBackup === "database" ? (
                  <Spinner size={14} className="mr-1.5" />
                ) : (
                  <Database className="h-3.5 w-3.5 mr-1.5" />
                )}
                Database
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunNow("documents")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
              >
                {runningBackup === "documents" ? (
                  <Spinner size={14} className="mr-1.5" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5 mr-1.5" />
                )}
                Documents
              </Button>
              {formState.mirrorEnabled && formState.secondaryCredentialId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunNow("mirror")}
                  disabled={!formState.enabled || runningBackup !== null}
                >
                  {runningBackup === "mirror" ? (
                    <Spinner size={14} className="mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Mirror
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={!isDirty || saving} size="sm">
              {saving ? <Spinner size={14} className="mr-1.5" /> : null}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Backup History</CardTitle>
                <CardDescription>
                  {completedBackups.length} successful backup{completedBackups.length !== 1 ? "s" : ""}
                  {totalSizeBytes > 0 && ` · ${totalSizeDisplay} total`}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileArchive className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No backups yet</p>
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
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {log.backupType === "database" && <Database className="h-3.5 w-3.5 text-muted-foreground" />}
                        {log.backupType === "documents" && <FileArchive className="h-3.5 w-3.5 text-muted-foreground" />}
                        {log.backupType === "mirror" && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="capitalize">{log.backupType}</span>
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
                        className="text-xs"
                      >
                        {log.status === "completed" && <Check className="h-3 w-3 mr-0.5" />}
                        {log.status === "started" && <Clock className="h-3 w-3 mr-0.5" />}
                        {log.status === "failed" && <AlertCircle className="h-3 w-3 mr-0.5" />}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.sizeDisplay || "-"}</TableCell>
                    <TableCell className="text-sm">{log.durationDisplay || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.providerName || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground text-right">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
