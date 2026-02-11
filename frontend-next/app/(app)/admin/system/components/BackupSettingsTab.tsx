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
  Clock,
  AlertCircle,
  Shield,
  ArrowRight,
  FolderArchive,
  CheckCircle2,
  XCircle,
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
 * BackupSettingsTab - Two-tier backup configuration
 *
 * Tier 1: Wasabi Backup (teeem-backups bucket) — incremental, quick restores
 * Tier 2: Backblaze B2 (off-site) — full sync from live storage, disaster recovery
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

  const handleScheduleChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      databaseSchedule: value,
      documentSchedule: value,
    }));
    setIsDirty(true);
  };

  const handlePrimaryChange = (value: string) => {
    if (value === "none") {
      setFormState((prev) => ({ ...prev, primaryCredentialId: null }));
    } else {
      setFormState((prev) => ({ ...prev, primaryCredentialId: parseInt(value) }));
    }
    setIsDirty(true);
  };

  const handleSecondaryChange = (value: string) => {
    if (value === "none") {
      setFormState((prev) => ({
        ...prev,
        secondaryCredentialId: null,
        mirrorEnabled: false,
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        secondaryCredentialId: parseInt(value),
        mirrorEnabled: true,
      }));
    }
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
          retention_days: (formState.retentionCount ?? 5) * 30,
          mirror_enabled: !!formState.secondaryCredentialId,
          primary_credential_id: formState.primaryCredentialId,
          secondary_credential_id: formState.secondaryCredentialId,
        },
      });
      setConfig(res.data);
      setFormState(res.data);
      setIsDirty(false);
      toast({ title: "Success", description: "Backup settings saved" });
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

  const handleRunNow = async (type: "database" | "documents" | "mirror", fullSync = false) => {
    setRunningBackup(type);
    try {
      await api.post("/api/v1/backup_configuration/run_now", { type, full_sync: fullSync });
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
  const hasTier2 = !!formState.secondaryCredentialId;

  // Compute stats from history
  const completedBackups = history.filter((h) => h.status === "completed");
  const totalSizeBytes = completedBackups.reduce((sum, h) => sum + (h.sizeBytes ?? 0), 0);
  const totalSizeDisplay = formatBytes(totalSizeBytes);

  const lastDbLog = history.find((h) => h.backupType === "database" && h.status === "completed");
  const lastDocLog = history.find((h) => h.backupType === "documents" && h.status === "completed");
  const lastMirrorLog = history.find((h) => h.backupType === "mirror" && h.status === "completed");
  const lastDbFailed = history.find((h) => h.backupType === "database" && h.status === "failed");
  const lastDocFailed = history.find((h) => h.backupType === "documents" && h.status === "failed");
  const lastMirrorFailed = history.find((h) => h.backupType === "mirror" && h.status === "failed");

  const tier1SizeBytes = completedBackups
    .filter((h) => h.backupType === "database" || h.backupType === "documents")
    .reduce((sum, h) => sum + (h.sizeBytes ?? 0), 0);
  const tier2SizeBytes = completedBackups
    .filter((h) => h.backupType === "mirror")
    .reduce((sum, h) => sum + (h.sizeBytes ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Master enable bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderArchive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Two-Tier Backup System</p>
                <p className="text-xs text-muted-foreground">
                  Wasabi for quick restores, Backblaze B2 for disaster recovery
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isDirty && (
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Spinner size={14} className="mr-1.5" /> : null}
                  Save Changes
                </Button>
              )}
              <Switch
                checked={formState.enabled ?? false}
                onCheckedChange={(checked) => handleChange("enabled", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier 1: Wasabi Backup */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/40">
                <HardDrive className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-base">Tier 1 — Wasabi Backup</CardTitle>
              <Badge variant="outline" className="text-xs">Quick Restore</Badge>
            </div>
          </div>
          <CardDescription>
            Copies documents and database dumps from the live bucket to a separate Wasabi backup bucket.
            If the live bucket is lost or corrupted, restore quickly from this copy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* What it does */}
          <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How it works</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Document Backup</strong> — Incrementally copies only documents changed since last backup from the live bucket to the backup bucket.</li>
              <li><strong>Database Dump</strong> — Downloads the latest Heroku database backup and stores it in the backup bucket.</li>
            </ul>
            <div className="flex items-center gap-2 text-sm pt-1">
              <Badge variant="outline" className="font-mono text-xs">
                {warehouseBucket || "live-bucket"}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge variant="outline" className="font-mono text-xs bg-orange-50 dark:bg-orange-950/30">
                {primaryCred?.bucket || "not configured"}
              </Badge>
            </div>
            {primaryCred?.bucket && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="text-xs text-muted-foreground">
                  <Database className="h-3 w-3 inline mr-1" />
                  DB path: <span className="font-mono">{primaryCred.bucket}/&lt;tenant&gt;/database/</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <FileArchive className="h-3 w-3 inline mr-1" />
                  Docs path: <span className="font-mono">{primaryCred.bucket}/&lt;tenant&gt;/documents/</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Last DB Backup"
              value={config?.lastDatabaseBackupAt
                ? formatDistanceToNow(new Date(config.lastDatabaseBackupAt), { addSuffix: true })
                : "Never"}
              detail={lastDbLog?.sizeDisplay}
              icon={<Database className="h-3.5 w-3.5" />}
              status={lastDbFailed && (!lastDbLog || new Date(lastDbFailed.createdAt) > new Date(lastDbLog.createdAt)) ? "error" : lastDbLog ? "ok" : "none"}
            />
            <StatCard
              label="Last Doc Backup"
              value={config?.lastDocumentBackupAt
                ? formatDistanceToNow(new Date(config.lastDocumentBackupAt), { addSuffix: true })
                : "Never"}
              detail={lastDocLog ? `${lastDocLog.filesCount ?? 0} files · ${lastDocLog.sizeDisplay || ""}` : undefined}
              icon={<FileArchive className="h-3.5 w-3.5" />}
              status={lastDocFailed && (!lastDocLog || new Date(lastDocFailed.createdAt) > new Date(lastDocLog.createdAt)) ? "error" : lastDocLog ? "ok" : "none"}
            />
            <StatCard
              label="Backup Storage"
              value={primaryCred?.name || "Not set"}
              detail={primaryCred?.bucket}
              icon={<HardDrive className="h-3.5 w-3.5" />}
              status={primaryCred?.isConnected ? "ok" : "none"}
            />
            <StatCard
              label="Total Backup Size"
              value={tier1SizeBytes > 0 ? formatBytes(tier1SizeBytes) : "—"}
              detail={`${completedBackups.filter((h) => h.backupType !== "mirror").length} backups`}
              icon={<FolderArchive className="h-3.5 w-3.5" />}
              status="none"
            />
          </div>

          {/* Settings + Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs">Backup Storage Credential</Label>
              <Select
                value={formState.primaryCredentialId?.toString() ?? "none"}
                onValueChange={handlePrimaryChange}
                disabled={!formState.enabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not configured</SelectItem>
                  {credentials
                    .filter((c) => c.id !== formState.secondaryCredentialId)
                    .map((cred) => (
                      <SelectItem key={cred.id} value={cred.id.toString()}>
                        {cred.name} {cred.bucket ? `(${cred.bucket})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunNow("database")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
                className="w-full"
              >
                {runningBackup === "database" ? (
                  <Spinner size={14} className="mr-1.5" />
                ) : (
                  <Database className="h-3.5 w-3.5 mr-1.5" />
                )}
                Run Database Dump Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunNow("documents")}
                disabled={!formState.enabled || !formState.primaryCredentialId || runningBackup !== null}
                className="w-full"
              >
                {runningBackup === "documents" ? (
                  <Spinner size={14} className="mr-1.5" />
                ) : (
                  <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                )}
                Run Document Backup Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier 2: Backblaze B2 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base">Tier 2 — Backblaze B2</CardTitle>
              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                Disaster Recovery
              </Badge>
            </div>
          </div>
          <CardDescription>
            Completely separate copy of all documents on a different provider.
            If Wasabi goes down entirely, everything is safe in B2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* What it does */}
          {hasTier2 && (
            <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How it works</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Document Sync</strong> — Downloads documents directly from the live Wasabi bucket and uploads them to B2. Does NOT depend on Tier 1.</li>
                <li><strong>Database Sync</strong> — Copies database dumps from the Wasabi backup bucket to B2.</li>
                <li><strong>Incremental</strong> — Only documents changed since the last sync are copied. &quot;Full Re-sync&quot; copies everything.</li>
                <li><strong>Scheduled</strong> — Runs on the schedule below, or manually from the buttons.</li>
              </ul>
              <div className="flex items-center gap-2 text-sm pt-1">
                <Badge variant="outline" className="font-mono text-xs">
                  {warehouseBucket || "live-bucket"}
                </Badge>
                <span className="text-xs text-muted-foreground">(live)</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="font-mono text-xs bg-blue-50 dark:bg-blue-950/30">
                  {secondaryCred?.bucket || "not set"}
                </Badge>
                <span className="text-xs text-muted-foreground">(B2)</span>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {hasTier2 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Last B2 Sync"
                value={config?.lastMirrorSyncAt
                  ? formatDistanceToNow(new Date(config.lastMirrorSyncAt), { addSuffix: true })
                  : "Never"}
                detail={lastMirrorLog?.durationDisplay ? `took ${lastMirrorLog.durationDisplay}` : undefined}
                icon={<Shield className="h-3.5 w-3.5" />}
                status={lastMirrorFailed && (!lastMirrorLog || new Date(lastMirrorFailed.createdAt) > new Date(lastMirrorLog.createdAt)) ? "error" : lastMirrorLog ? "ok" : "none"}
              />
              <StatCard
                label="Files Synced"
                value={lastMirrorLog?.filesCount != null ? lastMirrorLog.filesCount.toLocaleString() : "—"}
                detail={lastMirrorLog?.sizeDisplay}
                icon={<FileArchive className="h-3.5 w-3.5" />}
                status="none"
              />
              <StatCard
                label="B2 Bucket"
                value={secondaryCred?.bucket || "Not set"}
                detail={secondaryCred?.name}
                icon={<Shield className="h-3.5 w-3.5" />}
                status={secondaryCred?.isConnected ? "ok" : "none"}
              />
              <StatCard
                label="Total Synced"
                value={tier2SizeBytes > 0 ? formatBytes(tier2SizeBytes) : "—"}
                detail={`${completedBackups.filter((h) => h.backupType === "mirror").length} syncs`}
                icon={<FolderArchive className="h-3.5 w-3.5" />}
                status="none"
              />
            </div>
          )}

          {/* Settings + Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">B2 Storage Credential</Label>
                <Select
                  value={formState.secondaryCredentialId?.toString() ?? "none"}
                  onValueChange={handleSecondaryChange}
                  disabled={!formState.enabled}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — no off-site mirror</SelectItem>
                    {credentials
                      .filter((c) => c.id !== formState.primaryCredentialId)
                      .map((cred) => (
                        <SelectItem key={cred.id} value={cred.id.toString()}>
                          {cred.name} {cred.bucket ? `(${cred.bucket})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!hasTier2 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                    Without B2, there is no off-site disaster recovery copy.
                  </p>
                )}
              </div>
              {hasTier2 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Schedule</Label>
                    <Select
                      value={currentSchedule}
                      onValueChange={handleScheduleChange}
                      disabled={!formState.enabled}
                    >
                      <SelectTrigger className="h-9">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">Keep Last</Label>
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
                        className="h-9 w-20"
                      />
                      <span className="text-xs text-muted-foreground">backups</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {hasTier2 && (
              <div className="flex flex-col justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunNow("mirror")}
                  disabled={!formState.enabled || runningBackup !== null}
                  className="w-full"
                >
                  {runningBackup === "mirror" ? (
                    <Spinner size={14} className="mr-1.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sync to B2 (Incremental)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunNow("mirror", true)}
                  disabled={!formState.enabled || runningBackup !== null}
                  className="w-full"
                >
                  {runningBackup === "mirror" ? (
                    <Spinner size={14} className="mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Full Re-sync to B2
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-center py-6 text-muted-foreground">
              <FileArchive className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No backups yet. Enable backups and run one to see history.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {log.backupType === "database" && <Database className="h-3.5 w-3.5 text-muted-foreground" />}
                        {log.backupType === "documents" && <HardDrive className="h-3.5 w-3.5 text-orange-500" />}
                        {log.backupType === "mirror" && <Shield className="h-3.5 w-3.5 text-blue-500" />}
                        <span className="capitalize">
                          {log.backupType === "documents" ? "Tier 1 Docs" : log.backupType === "mirror" ? "Tier 2 B2" : "DB Dump"}
                        </span>
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
                    <TableCell className="text-sm">{log.sizeDisplay || "—"}</TableCell>
                    <TableCell className="text-sm">{log.filesCount != null ? log.filesCount.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-sm">{log.durationDisplay || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">
                      {log.storageKey || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-right whitespace-nowrap">
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

function StatCard({
  label,
  value,
  detail,
  icon,
  status,
}: {
  label: string;
  value: string;
  detail?: string | null;
  icon: React.ReactNode;
  status: "ok" | "error" | "none";
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        {status === "error" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium truncate">{value}</span>
      </div>
      {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
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
