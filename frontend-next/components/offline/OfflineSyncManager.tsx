"use client";

/**
 * Offline Sync Manager
 *
 * UI for supervisors to manage offline data:
 * - View assigned active jobs
 * - Sync/unsync documents for each job
 * - See sync progress and storage usage
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Cloud,
  CloudOff,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  FileText,
  Briefcase,
  Camera,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDocumentOfflineSync,
  getPhotoCacheStats,
  syncAllPendingPhotos,
  clearPhotoCache,
  type JobForSync,
  type PhotoCacheStats,
  type PhotoSyncProgress,
} from "@/lib/offline";

export function OfflineSyncManager() {
  const {
    isOnline,
    jobs,
    loadingJobs,
    syncProgress,
    syncJob,
    unsyncJob,
    syncAllJobs,
    cacheStats,
    refreshJobs,
    clearAllCache,
  } = useDocumentOfflineSync();

  // Photo sync state
  const [photoStats, setPhotoStats] = React.useState<PhotoCacheStats>({
    totalCount: 0,
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    errorCount: 0,
    totalSizeBytes: 0,
    totalSizeDisplay: "0 KB",
  });
  const [photoSyncProgress, setPhotoSyncProgress] = React.useState<PhotoSyncProgress | null>(null);

  // Load photo stats
  const loadPhotoStats = React.useCallback(async () => {
    const stats = await getPhotoCacheStats();
    setPhotoStats(stats);
  }, []);

  React.useEffect(() => {
    loadPhotoStats();
  }, [loadPhotoStats]);

  // Sync photos
  const handleSyncPhotos = async () => {
    await syncAllPendingPhotos((progress) => {
      setPhotoSyncProgress(progress);
    });
    await loadPhotoStats();
    setTimeout(() => setPhotoSyncProgress(null), 3000);
  };

  // Clear photo cache
  const handleClearPhotos = async () => {
    await clearPhotoCache();
    await loadPhotoStats();
  };

  const syncedJobs = jobs.filter(j => j.isSynced);
  const unsyncedJobs = jobs.filter(j => !j.isSynced);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Offline Data</h2>
          <p className="text-sm text-muted-foreground">
            Sync job documents for offline access
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 bg-green-50 dark:bg-green-950/50">
              <Cloud className="h-3 w-3 mr-1" />
              Online
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50 dark:bg-slate-800">
              <CloudOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={refreshJobs} disabled={loadingJobs}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingJobs && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Storage Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{cacheStats.jobCount}</div>
              <div className="text-xs text-muted-foreground">Jobs Synced</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{cacheStats.documentCount}</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{cacheStats.totalSizeDisplay}</div>
              <div className="text-xs text-muted-foreground">Storage Used</div>
            </div>
          </div>
          {cacheStats.documentCount > 0 && (
            <div className="mt-4 pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Offline Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Offline Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all cached documents ({cacheStats.documentCount} files, {cacheStats.totalSizeDisplay}).
                      You&apos;ll need to sync again to access documents offline.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllCache}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Sync Status */}
      {(photoStats.totalCount > 0 || photoSyncProgress) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div>
                <div className="text-xl font-bold">{photoStats.pendingCount}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{photoStats.syncedCount}</div>
                <div className="text-xs text-muted-foreground">Synced</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{photoStats.errorCount}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div>
                <div className="text-xl font-bold">{photoStats.totalSizeDisplay}</div>
                <div className="text-xs text-muted-foreground">Size</div>
              </div>
            </div>

            {/* Photo Sync Progress */}
            {photoSyncProgress && photoSyncProgress.total > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm">
                    Syncing {photoSyncProgress.completed}/{photoSyncProgress.total}...
                  </span>
                </div>
                <Progress value={(photoSyncProgress.completed / photoSyncProgress.total) * 100} className="h-1" />
              </div>
            )}

            {/* Photo Actions */}
            {photoStats.pendingCount > 0 && isOnline && !photoSyncProgress && (
              <div className="mt-3 pt-3 border-t">
                <Button variant="outline" size="sm" className="w-full" onClick={handleSyncPhotos}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync {photoStats.pendingCount} Photo{photoStats.pendingCount === 1 ? "" : "s"}
                </Button>
              </div>
            )}

            {photoStats.totalCount > 0 && !photoSyncProgress && (
              <div className="mt-3 pt-3 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Photo Cache
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Photo Cache?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {photoStats.pendingCount > 0
                          ? `Warning: ${photoStats.pendingCount} photos haven't been synced yet and will be lost.`
                          : "This will remove all cached photos from your device."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearPhotos}>
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Progress */}
      {syncProgress && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              <Spinner className="h-5 w-5" />
              <div className="flex-1">
                <div className="font-medium">{syncProgress.jobName}</div>
                <div className="text-sm text-muted-foreground">
                  {syncProgress.currentDocument}
                </div>
              </div>
            </div>
            {syncProgress.total > 0 && (
              <>
                <Progress value={(syncProgress.completed / syncProgress.total) * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{syncProgress.completed} of {syncProgress.total} documents</span>
                  {syncProgress.failed > 0 && (
                    <span className="text-amber-600">{syncProgress.failed} failed</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loadingJobs && (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 mr-2" />
          <span className="text-muted-foreground">Loading your jobs...</span>
        </div>
      )}

      {/* No Jobs */}
      {!loadingJobs && jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-medium mb-1">No Assigned Jobs</h3>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any active jobs assigned to sync.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Synced Jobs */}
      {syncedJobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            Available Offline ({syncedJobs.length})
          </h3>
          {syncedJobs.map(job => (
            <JobSyncCard
              key={job.id}
              job={job}
              onSync={syncJob}
              onUnsync={unsyncJob}
              isSyncing={syncProgress?.jobId === job.id}
              isOnline={isOnline}
            />
          ))}
        </div>
      )}

      {/* Unsynced Jobs */}
      {unsyncedJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CloudOff className="h-4 w-4" />
              Not Synced ({unsyncedJobs.length})
            </h3>
            {isOnline && unsyncedJobs.length > 1 && (
              <Button variant="outline" size="sm" onClick={syncAllJobs}>
                <Download className="h-4 w-4 mr-2" />
                Sync All
              </Button>
            )}
          </div>
          {unsyncedJobs.map(job => (
            <JobSyncCard
              key={job.id}
              job={job}
              onSync={syncJob}
              onUnsync={unsyncJob}
              isSyncing={syncProgress?.jobId === job.id}
              isOnline={isOnline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Job Card Component
// =============================================================================

interface JobSyncCardProps {
  job: JobForSync;
  onSync: (jobId: number) => Promise<void>;
  onUnsync: (jobId: number) => Promise<void>;
  isSyncing: boolean;
  isOnline: boolean;
}

function JobSyncCard({ job, onSync, onUnsync, isSyncing, isOnline }: JobSyncCardProps) {
  const handleSync = async () => {
    await onSync(job.id);
  };

  const handleUnsync = async () => {
    await onUnsync(job.id);
  };

  return (
    <Card className={cn(
      "transition-colors",
      job.isSynced && "border-green-200 bg-green-50/30 dark:bg-green-950/10"
    )}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            job.isSynced ? "bg-green-100 dark:bg-green-900/50" : "bg-muted"
          )}>
            {job.isSynced ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-medium">{job.name}</div>
            <div className="text-xs text-muted-foreground">
              {job.jobCode}
              {job.syncInfo && (
                <>
                  {" • "}
                  {job.syncInfo.documentCount} docs
                  {job.syncInfo.status === "partial" && (
                    <Badge variant="outline" className="ml-2 text-amber-600 border-amber-200 text-[10px] py-0">
                      Partial
                    </Badge>
                  )}
                  {job.syncInfo.status === "error" && (
                    <Badge variant="outline" className="ml-2 text-red-600 dark:text-red-400 border-red-200 text-[10px] py-0">
                      Error
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.isSynced ? (
            <>
              {isOnline && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  title="Re-sync"
                >
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Offline Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove cached documents for &quot;{job.name}&quot;.
                      You&apos;ll need to sync again to access these documents offline.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnsync}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
            >
              {isSyncing ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Sync
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Compact Indicator for Toolbar
// =============================================================================

export function OfflineSyncIndicator({ className }: { className?: string }) {
  const { cacheStats, isOnline } = useDocumentOfflineSync();

  if (cacheStats.jobCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isOnline ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400",
        className
      )}
      title={`${cacheStats.documentCount} documents (${cacheStats.totalSizeDisplay}) available offline`}
    >
      {isOnline ? (
        <Cloud className="h-3.5 w-3.5" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      <span>{cacheStats.jobCount} jobs offline</span>
    </div>
  );
}
