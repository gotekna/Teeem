"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import axios from "axios";
import { TASK_STATUS } from "@/lib/constants/task-status";
import {
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftIcon,
  CameraIcon,
  ArrowPathIcon,
  FunnelIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface Construction {
  id: number;
  name: string;
}

interface Task {
  id: number;
  name: string;
  trade: string;
  status: string;
  start_date: string;
  end_date: string;
  duration_days?: number;
  photos_count?: number;
  comments_count?: number;
  supplier_confirmed_at?: string;
  construction?: Construction;
  description?: string;
  predecessors?: Task[];
  comments?: Comment[];
  photos?: Photo[];
}

interface Comment {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
}

interface Photo {
  id: number;
  url: string;
  thumbnail_url?: string;
  caption?: string;
}

interface Summary {
  total: number;
  not_started: number;
  started: number;
  completed: number;
}

interface TasksData {
  all_tasks: Task[];
  upcoming: Task[];
  in_progress: Task[];
  completed: Task[];
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    not_started: "bg-muted dark:bg-muted text-foreground dark:text-muted-foreground",
    started: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    completed: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  };
  const labels = {
    not_started: "Not Started",
    started: "In Progress",
    completed: "Completed",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.not_started
      }`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
};

// Task card component
const TaskCard = ({
  task,
  onClick,
}: {
  task: Task;
  onClick: (task: Task) => void;
}) => {
  const isOverdue =
    task.status !== TASK_STATUS.COMPLETED && new Date(task.end_date) < new Date();

  return (
    <div
      onClick={() => onClick(task)}
      className="bg-card rounded-lg border border-border dark:border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground dark:text-white truncate">{task.name}</h3>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{task.trade}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground dark:text-muted-foreground">
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-4 h-4" />
          {new Date(task.start_date).toLocaleDateString()}
        </div>
        {task.duration_days && (
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {task.duration_days} days
          </div>
        )}
      </div>

      {/* Construction info */}
      <div className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
        {task.construction?.name}
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        {task.photos_count !== undefined && task.photos_count > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground dark:text-muted-foreground">
            <CameraIcon className="w-3 h-3" />
            {task.photos_count}
          </div>
        )}
        {task.comments_count !== undefined && task.comments_count > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground dark:text-muted-foreground">
            <ChatBubbleLeftIcon className="w-3 h-3" />
            {task.comments_count}
          </div>
        )}
        {isOverdue && (
          <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Overdue
          </div>
        )}
        {task.supplier_confirmed_at && (
          <div className="flex items-center gap-1 text-green-500 dark:text-green-400">
            <CheckCircleIcon className="w-3 h-3" />
            Confirmed
          </div>
        )}
      </div>
    </div>
  );
};

// Task detail modal
const TaskDetailModal = ({
  task,
  onClose,
  onUpdate,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        const res = await axios.get(`/api/v1/portal/sm_tasks/${task.id}`);
        setDetail(res.data.data);
      } catch (err) {
        console.error("Failed to fetch task detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [task.id]);

  const handleConfirm = async () => {
    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      await axios.patch(`/api/v1/portal/sm_tasks/${task.id}`, {
        confirm_schedule: true,
      });
      setDetail((prev) =>
        prev ? { ...prev, supplier_confirmed_at: new Date().toISOString() } : null
      );
      onUpdate?.();
    } catch (err) {
      console.error("Failed to confirm:", err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      await axios.post(`/api/v1/portal/sm_tasks/${task.id}/add_comment`, {
        body: newComment,
      });
      setNewComment("");
      // Refresh comments
      const res = await axios.get(`/api/v1/portal/sm_tasks/${task.id}`);
      setDetail(res.data.data);
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          className="fixed inset-0 bg-muted0 bg-opacity-75 dark:bg-background dark:bg-opacity-80 transition-opacity"
          onClick={onClose}
        />

        <div className="relative transform overflow-hidden rounded-lg bg-card text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          {/* Header */}
          <div className="bg-card px-4 pb-4 pt-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground dark:text-white">{task.name}</h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">{task.trade}</p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground">
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 border-b border-border dark:border-border">
              <nav className="-mb-px flex space-x-8">
                {["details", "comments", "photos"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? "border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                        : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 sm:px-6 sm:pb-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <ArrowPathIcon className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {activeTab === "details" && detail && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">Start Date</label>
                        <p className="font-medium dark:text-white">
                          {new Date(detail.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">End Date</label>
                        <p className="font-medium dark:text-white">
                          {new Date(detail.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">Status</label>
                        <p>
                          <StatusBadge status={detail.status} />
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">Duration</label>
                        <p className="font-medium dark:text-white">{detail.duration_days} days</p>
                      </div>
                    </div>

                    {detail.description && (
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">Description</label>
                        <p className="text-sm text-foreground dark:text-muted-foreground">{detail.description}</p>
                      </div>
                    )}

                    {/* Confirm button */}
                    {!detail.supplier_confirmed_at && (
                      <button
                        onClick={handleConfirm}
                        className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="w-5 h-5" />
                        Confirm Schedule
                      </button>
                    )}
                    {detail.supplier_confirmed_at && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircleIcon className="w-5 h-5" />
                        Confirmed on{" "}
                        {new Date(detail.supplier_confirmed_at).toLocaleDateString()}
                      </div>
                    )}

                    {/* Dependencies */}
                    {detail.predecessors && detail.predecessors.length > 0 && (
                      <div>
                        <label className="text-xs text-muted-foreground dark:text-muted-foreground">Waiting on</label>
                        <div className="mt-1 space-y-1">
                          {detail.predecessors.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-sm dark:text-white">
                              <StatusBadge status={p.status} />
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "comments" && detail && (
                  <div className="space-y-4">
                    {/* Comment list */}
                    <div className="space-y-3">
                      {!detail.comments || detail.comments.length === 0 ? (
                        <p className="text-muted-foreground dark:text-muted-foreground text-sm text-center py-4">
                          No comments yet
                        </p>
                      ) : (
                        detail.comments.map((comment) => (
                          <div key={comment.id} className="bg-muted dark:bg-muted rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-foreground dark:text-white">
                                {comment.author_name}
                              </span>
                              <span className="text-muted-foreground dark:text-muted-foreground">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-foreground dark:text-muted-foreground">{comment.body}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 text-sm border-border dark:border-border dark:bg-muted dark:text-white rounded-md"
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={submitting || !newComment.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50"
                      >
                        {submitting ? "..." : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "photos" && detail && (
                  <div>
                    {!detail.photos || detail.photos.length === 0 ? (
                      <p className="text-muted-foreground dark:text-muted-foreground text-sm text-center py-4">
                        No photos yet
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {detail.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="aspect-square rounded-lg overflow-hidden"
                          >
                            <img
                              src={photo.thumbnail_url || photo.url}
                              alt={photo.caption || "Task photo"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PortalSchedule() {
  const router = useRouter();
  // SSoT: URL state for filter (enables shareable filtered views)
  const [urlState, setUrlState] = useUrlState({
    filter: null as string | null,  // null = "all"
  });
  const filter = urlState.filter || "all";
  const setFilter = (newFilter: string) => {
    setUrlState({ filter: newFilter === "all" ? null : newFilter });
  };
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TasksData>({
    all_tasks: [],
    upcoming: [],
    in_progress: [],
    completed: [],
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const token = getStorageItem(STORAGE_KEYS.PORTAL_TOKEN, "");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const params: any = {};
      if (filter !== "all") params.status = filter;

      const res = await axios.get("/api/v1/portal/sm_tasks", { params });
      setTasks(res.data.data);
      setSummary(res.data.summary);
    } catch (err: any) {
      console.error("Failed to fetch tasks:", err);
      if (err.response?.status === 401) {
        router.push("/portal/login");
      }
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const displayTasks =
    filter === "all"
      ? tasks.all_tasks
      : filter === TASK_STATUS.NOT_STARTED
      ? tasks.upcoming
      : filter === TASK_STATUS.STARTED
      ? tasks.in_progress
      : tasks.completed;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Schedule</h1>
        <p className="text-muted-foreground dark:text-muted-foreground">Your assigned tasks and schedule</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border border-border dark:border-border p-4">
            <div className="text-2xl font-bold text-foreground dark:text-white">{summary.total}</div>
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">Total Tasks</div>
          </div>
          <div className="bg-card rounded-lg border border-border dark:border-border p-4">
            <div className="text-2xl font-bold text-foreground dark:text-white">
              {summary.not_started}
            </div>
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">Upcoming</div>
          </div>
          <div className="bg-card rounded-lg border border-border dark:border-border p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.started}</div>
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">In Progress</div>
          </div>
          <div className="bg-card rounded-lg border border-border dark:border-border p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summary.completed}
            </div>
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">Completed</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <FunnelIcon className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px] text-sm">
            <SelectValue placeholder="All Tasks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value={TASK_STATUS.NOT_STARTED}>Upcoming</SelectItem>
            <SelectItem value={TASK_STATUS.STARTED}>In Progress</SelectItem>
            <SelectItem value={TASK_STATUS.COMPLETED}>Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {displayTasks.length === 0 ? (
        <div className="bg-card rounded-lg border border-border dark:border-border p-8 text-center text-muted-foreground dark:text-muted-foreground">
          <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2" />
          No tasks found
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayTasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={setSelectedTask} />
          ))}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
}
