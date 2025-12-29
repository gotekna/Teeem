"use client";

import { useState, useEffect, useCallback, ElementType } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  CameraIcon,
  MapPinIcon,
  MicrophoneIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface SmTask {
  id: number;
  name: string;
  status: string;
  trade?: string;
  start_date: string;
  completed_at?: string;
  photos_count?: number;
  supplier?: {
    name: string;
  };
}

interface Construction {
  id: number;
  name: string;
  site_latitude?: number;
  site_longitude?: number;
}

interface Photo {
  id: number;
  url: string;
  photo_type: string;
  created_at: string;
}

interface VoiceNote {
  id: number;
  url: string;
  duration: number;
  created_at: string;
}

interface ConstructionResponse {
  construction?: Construction;
}

interface TasksResponse {
  tasks: SmTask[];
}

interface PhotosResponse {
  photos: Photo[];
}

interface VoiceNotesResponse {
  voice_notes: VoiceNote[];
}

interface OfflineData {
  photos: unknown[];
  checkins: unknown[];
  voice_notes: unknown[];
}

// ============================================
// Offline storage helper
// ============================================

const offlineStorage = {
  save: (key: keyof OfflineData, data: unknown) => {
    try {
      const existing = JSON.parse(localStorage.getItem("sm_offline_data") || "{}") as OfflineData;
      if (!existing[key]) existing[key] = [];
      existing[key].push(data);
      localStorage.setItem("sm_offline_data", JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to save offline data:", e);
    }
  },
  get: (key: keyof OfflineData): unknown[] => {
    try {
      const data = JSON.parse(localStorage.getItem("sm_offline_data") || "{}") as OfflineData;
      return data[key] || [];
    } catch {
      return [];
    }
  },
  clear: (key: keyof OfflineData) => {
    try {
      const existing = JSON.parse(localStorage.getItem("sm_offline_data") || "{}") as OfflineData;
      delete existing[key];
      localStorage.setItem("sm_offline_data", JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to clear offline data:", e);
    }
  },
  getPendingCount: (): number => {
    try {
      const data = JSON.parse(localStorage.getItem("sm_offline_data") || "{}") as OfflineData;
      return Object.values(data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    } catch {
      return 0;
    }
  },
};

// ============================================
// Sub Components
// ============================================

interface TaskCardProps {
  task: SmTask;
  onClick: (task: SmTask) => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "started":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/50"
      onClick={() => onClick(task)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{task.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {task.trade && <span className="mr-2">{task.trade}</span>}
              <span>{new Date(task.start_date).toLocaleDateString()}</span>
            </div>
          </div>
          <Badge variant="secondary" className={getStatusVariant(task.status)}>
            {task.status}
          </Badge>
        </div>
        {task.photos_count && task.photos_count > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <CameraIcon className="h-3 w-3" />
            {task.photos_count} photos
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TabButtonProps {
  active: boolean;
  icon: ElementType;
  label: string;
  badge?: number;
  onClick: () => void;
}

function TabButton({ active, icon: Icon, label, badge, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-1 py-3 ${
        active ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs">{label}</span>
      {badge && badge > 0 && (
        <span className="absolute right-1/4 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function SmFieldPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const constructionId = params.id as string;
  const resourceId = searchParams.get("resource");

  // URL-synced tab state
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl || "tasks";

  const handleTabChange = useCallback((tabId: string) => {
    const url = tabId === "tasks"
      ? `/jobs/${constructionId}/field`
      : `/jobs/${constructionId}/field?tab=${tabId}`;
    router.push(url, { scroll: false });
  }, [constructionId, router]);

  // State
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [construction, setConstruction] = useState<Construction | null>(null);
  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SmTask | null>(null);
  const [taskPhotos, setTaskPhotos] = useState<Photo[]>([]);
  const [taskVoiceNotes, setTaskVoiceNotes] = useState<VoiceNote[]>([]);
  const [pendingSync, setPendingSync] = useState(0);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending count
  useEffect(() => {
    setPendingSync(offlineStorage.getPendingCount());
  }, []);

  // Fetch construction and tasks
  const fetchData = useCallback(async () => {
    if (!constructionId) return;

    setLoading(true);
    try {
      // Fetch construction details
      const constructionRes = await api.get<ConstructionResponse>(`/api/v1/jobs/${constructionId}`);
      setConstruction(constructionRes.construction || (constructionRes as unknown as Construction));

      // Fetch tasks
      const tasksRes = await api.get<TasksResponse>(`/api/v1/jobs/${constructionId}/sm_tasks`);
      const todaysTasks = (tasksRes.tasks || []).filter(
        (t) =>
          t.status !== "completed" ||
          (t.completed_at && new Date(t.completed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      );
      setTasks(todaysTasks);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [constructionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch task photos and voice notes
  const fetchTaskMedia = useCallback(async (taskId: number) => {
    if (!taskId) return;

    try {
      const [photosRes, notesRes] = await Promise.all([
        api.get<PhotosResponse>(`/api/v1/sm_tasks/${taskId}/photos`),
        api.get<VoiceNotesResponse>(`/api/v1/sm_tasks/${taskId}/voice_notes`),
      ]);
      setTaskPhotos(photosRes.photos || []);
      setTaskVoiceNotes(notesRes.voice_notes || []);
    } catch (err) {
      console.error("Failed to fetch task media:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedTask) {
      fetchTaskMedia(selectedTask.id);
    }
  }, [selectedTask, fetchTaskMedia]);

  // Sync offline data
  const syncOfflineData = async () => {
    if (!isOnline) return;

    const photos = offlineStorage.get("photos");
    const checkins = offlineStorage.get("checkins");
    const voiceNotes = offlineStorage.get("voice_notes");

    if (photos.length === 0 && checkins.length === 0 && voiceNotes.length === 0) return;

    try {
      const res = await api.post<{
        success: boolean;
        results: {
          photos: { synced: number };
          checkins: { synced: number };
          voice_notes: { synced: number };
        };
      }>("/api/v1/sm_field/sync", {
        photos,
        checkins,
        voice_notes: voiceNotes,
      });

      if (res?.success && res.results) {
        offlineStorage.clear("photos");
        offlineStorage.clear("checkins");
        offlineStorage.clear("voice_notes");
        setPendingSync(0);
        toast({
          title: "Sync complete",
          description: `Synced: ${res.results.photos.synced} photos, ${res.results.checkins.synced} check-ins, ${res.results.voice_notes.synced} voice notes`,
        });
      }
    } catch (err) {
      console.error("Sync failed:", err);
      toast({
        title: "Sync failed",
        description: "Will retry when connection is stable.",
        variant: "destructive",
      });
    }
  };

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSync > 0) {
      syncOfflineData();
    }
     
  }, [isOnline, pendingSync]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedTask && (
              <Button variant="ghost" size="icon" className="-ml-1" onClick={() => setSelectedTask(null)}>
                <ChevronLeftIcon className="h-6 w-6" />
              </Button>
            )}
            <div>
              <h1 className="font-semibold">
                {selectedTask ? selectedTask.name : construction?.name || "Field Work"}
              </h1>
              <div className="text-xs text-muted-foreground">
                {selectedTask ? selectedTask.trade : "Select a task"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online status */}
            <Badge
              variant="secondary"
              className={
                isOnline
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }
            >
              {isOnline ? <WifiIcon className="mr-1 h-4 w-4" /> : <ExclamationTriangleIcon className="mr-1 h-4 w-4" />}
              {isOnline ? "Online" : "Offline"}
            </Badge>

            {/* Pending sync */}
            {pendingSync > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={syncOfflineData}
                disabled={!isOnline}
                className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              >
                <ArrowPathIcon className="mr-1 h-4 w-4" />
                {pendingSync} pending
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedTask ? (
          /* Task list */
          <div className="space-y-3">
            <div className="mb-2 text-sm text-muted-foreground">Today's Tasks ({tasks.length})</div>
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No tasks scheduled for today</div>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} onClick={setSelectedTask} />)
            )}
          </div>
        ) : (
          /* Task detail with media capture */
          <div className="space-y-4">
            {activeTab === "tasks" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedTask.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Trade:</span> {selectedTask.trade || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> {selectedTask.status}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start:</span>{" "}
                    {new Date(selectedTask.start_date).toLocaleDateString()}
                  </div>
                  {selectedTask.supplier && (
                    <div>
                      <span className="text-muted-foreground">Supplier:</span> {selectedTask.supplier.name}
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="mt-4 grid grid-cols-2 gap-2 pt-4">
                    <Button onClick={() => handleTabChange("photos")}>
                      <CameraIcon className="mr-2 h-5 w-5" />
                      Add Photo
                    </Button>
                    <Button variant="outline" onClick={() => handleTabChange("voice")}>
                      <MicrophoneIcon className="mr-2 h-5 w-5" />
                      Voice Note
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "photos" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photo Capture</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <CameraIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Photo capture component</p>
                    <p className="mt-2 text-sm">Coming soon</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "checkin" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">GPS Check-in</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <MapPinIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>GPS check-in component</p>
                    <p className="mt-2 text-sm">Coming soon</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "voice" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Voice Notes</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <MicrophoneIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Voice notes component</p>
                    <p className="mt-2 text-sm">Coming soon</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom tabs (when task selected) */}
      {selectedTask && (
        <div className="sticky bottom-0 flex border-t bg-background">
          <TabButton
            active={activeTab === "tasks"}
            icon={ClipboardDocumentListIcon}
            label="Details"
            onClick={() => handleTabChange("tasks")}
          />
          <TabButton
            active={activeTab === "photos"}
            icon={CameraIcon}
            label="Photos"
            badge={taskPhotos.length}
            onClick={() => handleTabChange("photos")}
          />
          <TabButton
            active={activeTab === "checkin"}
            icon={MapPinIcon}
            label="Check-in"
            onClick={() => handleTabChange("checkin")}
          />
          <TabButton
            active={activeTab === "voice"}
            icon={MicrophoneIcon}
            label="Voice"
            badge={taskVoiceNotes.length}
            onClick={() => handleTabChange("voice")}
          />
        </div>
      )}
    </div>
  );
}
