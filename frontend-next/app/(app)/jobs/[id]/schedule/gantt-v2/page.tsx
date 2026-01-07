'use client';

/**
 * Gantt V2 Page - Job Schedule
 *
 * SSoT: Uses useGanttDataManager hook for all Gantt behavior.
 * Same handlers as Schedule Master (templates) - fix once, works everywhere.
 *
 * @see lib/gantt/hooks/useGanttDataManager.ts - THE ONE hook
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GanttUnified, GanttDependencyEditor } from '@/components/gantt-v2';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  ExternalLink,
  Camera,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Link2Off,
  PlayCircle,
  GitBranch,
} from 'lucide-react';
import type { GanttTask, SmScheduleMaster } from '@/lib/gantt/types';
import type { PhotoItem } from '@/components/ui/photo-gallery';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { useGanttDataManager } from '@/lib/gantt/hooks';

// =============================================================================
// Types
// =============================================================================

interface Job {
  id: number;
  name: string;
  title: string;
}

// =============================================================================
// Page Component
// =============================================================================

export default function GanttV2Page() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = Number(params.id);

  // SSoT: Use shared hook for all Gantt behavior
  const gantt = useGanttDataManager({ mode: 'job', jobId });

  // Job-specific state
  const [job, setJob] = React.useState<Job | null>(null);

  // Photo panel state (job-specific feature)
  const [showPhotoPanel, setShowPhotoPanel] = React.useState(false);
  const [jobPhotos, setJobPhotos] = React.useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // ==========================================================================
  // Load Job and Gantt Data
  // ==========================================================================

  React.useEffect(() => {
    async function loadJob() {
      try {
        const jobResponse = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        if (jobResponse) {
          setJob(jobResponse);
        }
      } catch (err) {
        console.error('[GanttV2] Failed to load job:', err);
      }
    }

    if (jobId) {
      loadJob();
      gantt.loadData();
    }
  }, [jobId, gantt.loadData]);

  // ==========================================================================
  // Photo Panel (Job-specific)
  // ==========================================================================

  const loadJobPhotos = React.useCallback(async () => {
    if (!showPhotoPanel || !jobId) return;

    try {
      setLoadingPhotos(true);

      const response = await api.get<{
        success: boolean;
        items: Array<{
          id: string;
          name: string;
          download_url?: string;
          thumbnail_url?: string;
          web_url?: string;
          modified?: string;
        }>;
      }>(`/api/v1/organization_onedrive/job_all_files?job_id=${jobId}`);

      if (response?.items) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
        const imageFiles = response.items.filter((item) => {
          const ext = item.name.toLowerCase().slice(item.name.lastIndexOf('.'));
          return imageExtensions.includes(ext);
        });

        const photos: PhotoItem[] = imageFiles.map((file) => ({
          id: file.id,
          name: file.name,
          url: file.thumbnail_url || file.download_url || '',
          thumbnailUrl: file.thumbnail_url || file.download_url || '',
          webUrl: file.web_url,
          modifiedAt: file.modified,
        }));

        photos.sort((a, b) => {
          const dateA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
          const dateB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
          return dateB - dateA;
        });

        setJobPhotos(photos);
      }
    } catch (err) {
      console.error('[GanttV2] Failed to load photos:', err);
      toast({
        title: 'Error',
        description: 'Failed to load job photos',
        variant: 'destructive',
      });
    } finally {
      setLoadingPhotos(false);
    }
  }, [showPhotoPanel, jobId, toast]);

  React.useEffect(() => {
    if (showPhotoPanel && jobPhotos.length === 0) {
      loadJobPhotos();
    }
  }, [showPhotoPanel, jobPhotos.length, loadJobPhotos]);

  const handleOpenOldGantt = () => {
    window.open(`/jobs/${jobId}/schedule`, '_blank');
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (gantt.loading) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} jobId={jobId} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-muted-foreground">Loading Gantt V2...</p>
          </div>
        </div>
      </div>
    );
  }

  if (gantt.error) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} jobId={jobId} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-destructive">{gantt.error}</p>
            <Button onClick={() => gantt.loadData()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header job={job} jobId={jobId} onOpenOldGantt={handleOpenOldGantt} />

      {/* Gantt Chart + Photo Panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Gantt Chart */}
        <div className="flex-1 min-h-0">
          <GanttUnified
            tasks={gantt.tasks}
            dependencies={gantt.dependencies}
            jobId={jobId}
            showToolbar={true}
            onTaskClick={gantt.handleTaskClick}
            onTaskDoubleClick={gantt.handleTaskDoubleClick}
            onCheckboxToggle={gantt.handleCheckboxToggle}
            onRollover={gantt.handleRollover}
            onEditDependencies={gantt.openDependencyEditor}
            onTaskDrag={gantt.handleTaskDrag}
            showPhotoPanel={showPhotoPanel}
            onTogglePhotoPanel={() => setShowPhotoPanel(!showPhotoPanel)}
          />
        </div>

        {/* Photo Panel - Right Side (Job-specific) */}
        {showPhotoPanel && (
          <div className="w-64 border-l bg-background flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Job Photos</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowPhotoPanel(false)}
                title="Close Panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-3 py-2 border-b text-xs text-muted-foreground">
              {loadingPhotos ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-3 w-3" />
                  Loading photos...
                </span>
              ) : (
                <span>{jobPhotos.length} photos</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loadingPhotos ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : jobPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Camera className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No photos found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {jobPhotos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }}
                      className="aspect-square rounded-md overflow-hidden bg-muted/50 hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary relative group"
                    >
                      {photo.thumbnailUrl ? (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Replace broken image with placeholder
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling;
                            if (placeholder) placeholder.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted/80 ${photo.thumbnailUrl ? 'hidden' : ''}`}>
                        <Camera className="h-6 w-6 text-muted-foreground/50 mb-1" />
                        <span className="text-[9px] text-muted-foreground text-center px-1 truncate w-full">
                          {photo.name.length > 20 ? photo.name.slice(0, 17) + '...' : photo.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={loadJobPhotos}
                disabled={loadingPhotos}
              >
                {loadingPhotos ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      <ImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={jobPhotos}
        initialIndex={lightboxIndex}
      />

      {/* Dependency Editor - SSoT: shared component */}
      {/* SSoT: Always pass ALL tasks (gantt.tasks), not just visible tasks
          The editor needs to look up inherited predecessors which might be in collapsed headers */}
      <GanttDependencyEditor
        isOpen={gantt.dependencyEditorState.isOpen}
        onClose={() => gantt.setDependencyEditorState({ isOpen: false, task: null, visibleTasks: [] })}
        task={gantt.dependencyEditorState.task}
        tasks={gantt.tasks}
        onSave={gantt.handleDependencyEditorSave}
      />

      {/* Edit Dialog - SSoT: uses hook's state */}
      <Dialog open={gantt.editSheetOpen} onOpenChange={gantt.setEditSheetOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Edit Task</DialogTitle>
              {/* Auto-save status indicator */}
              {gantt.autoSaveStatus === 'saving' && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <Spinner size={12} className="mr-1" />
                  Saving...
                </span>
              )}
              {gantt.autoSaveStatus === 'saved' && (
                <span className="flex items-center text-xs text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Saved
                </span>
              )}
              {gantt.autoSaveStatus === 'error' && (
                <span className="flex items-center text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Error
                </span>
              )}
            </div>
            <DialogDescription>
              {gantt.editingTask?.name} (Task #{gantt.editingRow?.task_number})
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={gantt.editRowForm.name || ''}
                onChange={(e) => gantt.setEditRowForm({ ...gantt.editRowForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={gantt.editRowForm.duration_days || 1}
                  onChange={(e) =>
                    gantt.setEditRowForm({
                      ...gantt.editRowForm,
                      duration_days: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sequence">Sequence</Label>
                <Input
                  id="sequence"
                  type="number"
                  step="0.1"
                  value={gantt.editRowForm.sequence_order || 0}
                  onChange={(e) =>
                    gantt.setEditRowForm({
                      ...gantt.editRowForm,
                      sequence_order: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={gantt.editRowForm.description || ''}
                onChange={(e) =>
                  gantt.setEditRowForm({ ...gantt.editRowForm, description: e.target.value })
                }
                placeholder="Optional description..."
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">PO Settings</h4>

              <div className="flex items-center gap-2">
                <Switch
                  id="po_required"
                  checked={gantt.editRowForm.po_required || false}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({ ...gantt.editRowForm, po_required: checked })
                  }
                />
                <Label htmlFor="po_required" className="text-sm">
                  PO Required
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="critical_po"
                  checked={gantt.editRowForm.critical_po || false}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({ ...gantt.editRowForm, critical_po: checked })
                  }
                />
                <Label htmlFor="critical_po" className="text-sm">
                  Critical PO
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="create_po_on_job_start"
                  checked={gantt.editRowForm.create_po_on_job_start || false}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({ ...gantt.editRowForm, create_po_on_job_start: checked })
                  }
                />
                <Label htmlFor="create_po_on_job_start" className="text-sm">
                  Auto-PO on Start
                </Label>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">Completion</h4>

              <div className="flex items-center gap-2">
                <Switch
                  id="require_photo"
                  checked={gantt.editRowForm.require_photo || false}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({ ...gantt.editRowForm, require_photo: checked })
                  }
                />
                <Label htmlFor="require_photo" className="text-sm">
                  Require Photo
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="pass_fail_enabled"
                  checked={gantt.editRowForm.pass_fail_enabled || false}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({ ...gantt.editRowForm, pass_fail_enabled: checked })
                  }
                />
                <div>
                  <Label htmlFor="pass_fail_enabled" className="text-sm">
                    Pass/Fail
                  </Label>
                  <p className="text-xs text-muted-foreground">Spawns re-inspect if failed</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">Header Settings</h4>

              <div className="flex items-center gap-2">
                <Switch
                  id="allow_header"
                  checked={gantt.editRowForm.allow_header || false}
                  disabled={gantt.editRowForm.po_required || gantt.editRowForm.create_po_on_job_start}
                  onCheckedChange={(checked) =>
                    gantt.setEditRowForm({
                      ...gantt.editRowForm,
                      allow_header: checked,
                      header_gantt: checked ? null : gantt.editRowForm.header_gantt,
                    })
                  }
                />
                <div>
                  <Label
                    htmlFor="allow_header"
                    className={`text-sm ${
                      gantt.editRowForm.po_required || gantt.editRowForm.create_po_on_job_start
                        ? 'text-muted-foreground'
                        : ''
                    }`}
                  >
                    Allow Header
                  </Label>
                  <p className="text-xs text-muted-foreground">Can be parent for other tasks</p>
                </div>
                {gantt.editRowForm.allow_header && (
                  <Badge className="text-xs bg-blue-500">Header</Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => gantt.setEditSheetOpen(false)}>
              Close
            </Button>
            <Button onClick={() => gantt.saveEditSheet()} disabled={gantt.saving}>
              {gantt.saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog - SSoT: for supplier_confirm/confirm toggles */}
      <Dialog
        open={gantt.confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {gantt.confirmDialog.type === 'supplierConfirm'
                ? 'Confirm Supplier Lock'
                : 'Confirm Task Lock'}
            </DialogTitle>
            <DialogDescription>
              {gantt.confirmDialog.isChecking ? (
                <>
                  Locking this task will fix its position. Successors will no longer push it forward.
                  {gantt.confirmDialog.affectedSuccessors.length > 0 && (
                    <span className="block mt-2">
                      <strong>{gantt.confirmDialog.affectedSuccessors.length} successor(s)</strong>{' '}
                      depend on this task.
                    </span>
                  )}
                </>
              ) : (
                'Unlocking this task will allow it to be pushed by predecessors again.'
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (gantt.confirmDialog.task) {
                  await gantt.executeCheckboxToggle(
                    gantt.confirmDialog.task.id,
                    gantt.confirmDialog.type === 'supplierConfirm' ? 'supplier_confirm' : 'confirm',
                    gantt.confirmDialog.isChecking
                  );
                }
                gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false });
              }}
            >
              {gantt.confirmDialog.isChecking ? 'Lock Task' : 'Unlock Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Task Dialog - SSoT: for starting tasks with break options */}
      <Dialog
        open={gantt.startTaskDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-green-600" />
              Start Task
            </DialogTitle>
            <DialogDescription>
              <strong>{gantt.startTaskDialog.task?.name}</strong>
              {gantt.startTaskDialog.headerName && (
                <span className="block mt-1">
                  Under header: <strong>{gantt.startTaskDialog.headerName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {!gantt.startTaskDialog.isTodayWorkingDay && gantt.startTaskDialog.lastWorkingDay && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Today is not a working day. Choose a start date:
                </p>
              </div>
            )}

            {gantt.startTaskDialog.headerName && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => {
                  if (gantt.startTaskDialog.task) {
                    gantt.executeStartTask(
                      gantt.startTaskDialog.task,
                      'break-header',
                      gantt.startTaskDialog.isTodayWorkingDay
                        ? new Date()
                        : gantt.startTaskDialog.lastWorkingDay || new Date()
                    );
                  }
                  gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
                }}
              >
                <Link2Off className="h-5 w-5 text-amber-600" />
                <div className="text-left">
                  <div className="font-medium">Break out of header</div>
                  <div className="text-xs text-muted-foreground">
                    Task becomes standalone, starts{' '}
                    {gantt.startTaskDialog.isTodayWorkingDay
                      ? 'today'
                      : gantt.startTaskDialog.lastWorkingDay?.toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                  </div>
                </div>
              </Button>
            )}

            {gantt.startTaskDialog.hasPredecessors && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => {
                  if (gantt.startTaskDialog.task) {
                    gantt.executeStartTask(
                      gantt.startTaskDialog.task,
                      'break-dependency',
                      gantt.startTaskDialog.isTodayWorkingDay
                        ? new Date()
                        : gantt.startTaskDialog.lastWorkingDay || new Date()
                    );
                  }
                  gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
                }}
              >
                <GitBranch className="h-5 w-5 text-orange-600" />
                <div className="text-left">
                  <div className="font-medium">Break dependencies</div>
                  <div className="text-xs text-muted-foreground">
                    Clear predecessors, stay under header
                  </div>
                </div>
              </Button>
            )}

            <Button
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => {
                if (gantt.startTaskDialog.task) {
                  gantt.executeStartTask(
                    gantt.startTaskDialog.task,
                    'start-only',
                    gantt.startTaskDialog.isTodayWorkingDay
                      ? new Date()
                      : gantt.startTaskDialog.lastWorkingDay || new Date()
                  );
                }
                gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
              }}
            >
              <PlayCircle className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Start only</div>
                <div className="text-xs text-muted-foreground">
                  Keep relationships, mark as started
                </div>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade Dialog - SSoT: for task moves with successors */}
      <Dialog
        open={gantt.cascadeDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setCascadeDialog({
              isOpen: false,
              task: null,
              newStartDate: null,
              successors: [],
              lockedSuccessors: [],
              unlockedSuccessors: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Move Task - Successor Impact</DialogTitle>
            <DialogDescription>
              <strong>{gantt.cascadeDialog.task?.name}</strong> has successors that depend on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {gantt.cascadeDialog.unlockedSuccessors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-600">
                  Will Move ({gantt.cascadeDialog.unlockedSuccessors.length})
                </h4>
                <div className="text-sm text-muted-foreground">
                  {gantt.cascadeDialog.unlockedSuccessors.map((s) => s.name).join(', ')}
                </div>
              </div>
            )}

            {gantt.cascadeDialog.lockedSuccessors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-amber-600">
                  Locked ({gantt.cascadeDialog.lockedSuccessors.length})
                </h4>
                <div className="text-sm text-muted-foreground">
                  These tasks are confirmed and cannot be moved automatically.
                </div>
                <div className="space-y-1">
                  {gantt.cascadeDialog.lockedSuccessors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <Badge variant="outline" className="text-xs">
                        Locked
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                gantt.setCascadeDialog({
                  isOpen: false,
                  task: null,
                  newStartDate: null,
                  successors: [],
                  lockedSuccessors: [],
                  unlockedSuccessors: [],
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (gantt.cascadeDialog.task && gantt.cascadeDialog.newStartDate) {
                  gantt.executeDragMove(gantt.cascadeDialog.task, gantt.cascadeDialog.newStartDate);
                }
                gantt.setCascadeDialog({
                  isOpen: false,
                  task: null,
                  newStartDate: null,
                  successors: [],
                  lockedSuccessors: [],
                  unlockedSuccessors: [],
                });
              }}
            >
              Move Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Info */}
      <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium">Gantt V2 (SSoT Hook)</span>
        {' | '}
        {gantt.tasks.length} tasks, {gantt.dependencies.length} dependencies
        {' | '}
        <a
          href={`/jobs/${jobId}/schedule`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Compare with old Gantt
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  job: Job | null;
  jobId: number;
  onOpenOldGantt: () => void;
}

function Header({ job, jobId, onOpenOldGantt }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-lg font-semibold">
            Gantt V2 {job ? `- ${job.name || job.title}` : ''}
          </h1>
          <p className="text-xs text-muted-foreground">SSoT Hook Architecture</p>
        </div>
        {/* Quick Links - Plans, PO, Site (SSoT: same as old Gantt page) */}
        <div className="flex items-center gap-1 ml-2">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/plans`, '_blank')}>
            Plans
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/purchase-orders`, '_blank')}>
            PO
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/site`, '_blank')}>
            Site
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenOldGantt}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Compare with Old Gantt
        </Button>
      </div>
    </div>
  );
}
