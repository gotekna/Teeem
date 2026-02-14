"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { SYSTEM_ROLES } from "@/lib/constants/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  Plus,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Rocket,
  Calendar,
  Inbox,
  CheckCircle2,
  XCircle,
  Bug,
  Sparkles,
  ArrowUpCircle,
  MessageSquare,
  Users,
} from "lucide-react";
import { ScopingSheet } from "@/components/feature-requests/ScopingSheet";

// Types
interface FeatureRequest {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priorityOrder: number | null;
  submittedByName: string | null;
  submittedByCompany: string | null;
  submittedByUserId: number;
  adminNotes?: string | null;
  statusUpdate: string | null;
  followerCount: number;
  isFollowing: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    feature_requests: FeatureRequest[];
    counts: {
      submitted: number;
      planned: number;
      in_progress: number;
      completed: number;
    };
  };
}

const CATEGORIES = [
  { value: "feature", label: "Feature Request", icon: Sparkles },
  { value: "improvement", label: "Improvement", icon: ArrowUpCircle },
  { value: "bug_report", label: "Bug Report", icon: Bug },
  { value: "suggestion", label: "Suggestion", icon: MessageSquare },
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  in_progress: {
    label: "In Progress",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
    icon: Rocket,
  },
  planned: {
    label: "Planned",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
    icon: Calendar,
  },
  submitted: {
    label: "Submitted",
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20",
    icon: Inbox,
  },
  completed: {
    label: "Completed",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20",
    icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
    icon: XCircle,
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  feature: { label: "Feature", icon: Sparkles },
  improvement: { label: "Improvement", icon: ArrowUpCircle },
  bug_report: { label: "Bug Report", icon: Bug },
  suggestion: { label: "Suggestion", icon: MessageSquare },
};

export default function FeatureRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [counts, setCounts] = useState({ submitted: 0, planned: 0, in_progress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showScopingSheet, setShowScopingSheet] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Admin edit state
  const isAdmin = Array.isArray(user?.role_names) &&
    user.role_names.some(
      (r: string) => r.toLowerCase() === SYSTEM_ROLES.ADMIN || r.toLowerCase() === SYSTEM_ROLES.SUPER_ADMIN
    );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editStatusUpdate, setEditStatusUpdate] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse>("/api/v1/feature_requests");
      if (res.success) {
        setRequests(res.data.feature_requests);
        setCounts(res.data.counts);
        setFollowingIds(new Set(
          res.data.feature_requests.filter((r) => r.isFollowing).map((r) => r.id)
        ));
      }
    } catch {
      // Silently handle - page will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFollow = async (id: number, isCurrentlyFollowing: boolean) => {
    // Optimistic update
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFollowing) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, followerCount: r.followerCount + (isCurrentlyFollowing ? -1 : 1), isFollowing: !isCurrentlyFollowing }
          : r
      )
    );

    try {
      if (isCurrentlyFollowing) {
        await api.delete(`/api/v1/feature_requests/${id}/follow`);
      } else {
        await api.post(`/api/v1/feature_requests/${id}/follow`);
      }
    } catch {
      // Revert on error
      fetchRequests();
    }
  };

  const handleAdminUpdate = async (id: number) => {
    try {
      await api.patch(`/api/v1/feature_requests/${id}`, {
        feature_request: {
          status: editStatus || undefined,
          priority_order: editPriority ? parseInt(editPriority) : undefined,
          status_update: editStatusUpdate || undefined,
          admin_notes: editAdminNotes || undefined,
        },
      });
      setEditingId(null);
      fetchRequests();
    } catch {
      // Error handling
    }
  };

  const startEditing = (fr: FeatureRequest) => {
    setEditingId(fr.id);
    setEditStatus(fr.status);
    setEditPriority(fr.priorityOrder?.toString() || "");
    setEditStatusUpdate(fr.statusUpdate || "");
    setEditAdminNotes(fr.adminNotes || "");
  };

  // Group requests by status
  const grouped = {
    in_progress: requests.filter((r) => r.status === "in_progress"),
    planned: requests.filter((r) => r.status === "planned"),
    submitted: requests.filter((r) => r.status === "submitted"),
    completed: requests.filter((r) => r.status === "completed"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/10 rounded-lg">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Feature Requests & Suggestions</h1>
                <p className="text-sm text-muted-foreground">
                  Help shape the future of TEEEM. Submit ideas, vote on features, and track progress.
                </p>
              </div>
            </div>
            <Button onClick={() => setShowScopingSheet(true)} size="sm">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Submit Request
            </Button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-4">
            <StatBadge label="Submitted" count={counts.submitted} color="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
            <StatBadge label="Planned" count={counts.planned} color="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" />
            <StatBadge label="In Progress" count={counts.in_progress} color="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" />
            <StatBadge label="Completed" count={counts.completed} color="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 space-y-6">
        {requests.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No feature requests yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to submit a feature request or suggestion!
            </p>
            <Button onClick={() => setShowScopingSheet(true)} size="sm">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Submit Request
            </Button>
          </div>
        ) : (
          <>
            {/* In Progress */}
            <StatusGroup
              status="in_progress"
              items={grouped.in_progress}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              followingIds={followingIds}
              onFollow={handleFollow}
              isAdmin={isAdmin}
              editingId={editingId}
              onStartEditing={startEditing}
              onCancelEditing={() => setEditingId(null)}
              editStatus={editStatus}
              setEditStatus={setEditStatus}
              editPriority={editPriority}
              setEditPriority={setEditPriority}
              editStatusUpdate={editStatusUpdate}
              setEditStatusUpdate={setEditStatusUpdate}
              editAdminNotes={editAdminNotes}
              setEditAdminNotes={setEditAdminNotes}
              onSaveEdit={handleAdminUpdate}
            />

            {/* Planned */}
            <StatusGroup
              status="planned"
              items={grouped.planned}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              followingIds={followingIds}
              onFollow={handleFollow}
              isAdmin={isAdmin}
              editingId={editingId}
              onStartEditing={startEditing}
              onCancelEditing={() => setEditingId(null)}
              editStatus={editStatus}
              setEditStatus={setEditStatus}
              editPriority={editPriority}
              setEditPriority={setEditPriority}
              editStatusUpdate={editStatusUpdate}
              setEditStatusUpdate={setEditStatusUpdate}
              editAdminNotes={editAdminNotes}
              setEditAdminNotes={setEditAdminNotes}
              onSaveEdit={handleAdminUpdate}
            />

            {/* Submitted */}
            <StatusGroup
              status="submitted"
              items={grouped.submitted}
              expandedId={expandedId}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              followingIds={followingIds}
              onFollow={handleFollow}
              isAdmin={isAdmin}
              editingId={editingId}
              onStartEditing={startEditing}
              onCancelEditing={() => setEditingId(null)}
              editStatus={editStatus}
              setEditStatus={setEditStatus}
              editPriority={editPriority}
              setEditPriority={setEditPriority}
              editStatusUpdate={editStatusUpdate}
              setEditStatusUpdate={setEditStatusUpdate}
              editAdminNotes={editAdminNotes}
              setEditAdminNotes={setEditAdminNotes}
              onSaveEdit={handleAdminUpdate}
            />

            {/* Completed (collapsible) */}
            {grouped.completed.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Completed ({grouped.completed.length})
                </button>
                {showCompleted && (
                  <StatusGroup
                    status="completed"
                    items={grouped.completed}
                    expandedId={expandedId}
                    onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                    followingIds={followingIds}
                    onFollow={handleFollow}
                    isAdmin={isAdmin}
                    editingId={editingId}
                    onStartEditing={startEditing}
                    onCancelEditing={() => setEditingId(null)}
                    editStatus={editStatus}
                    setEditStatus={setEditStatus}
                    editPriority={editPriority}
                    setEditPriority={setEditPriority}
                    editStatusUpdate={editStatusUpdate}
                    setEditStatusUpdate={setEditStatusUpdate}
                    editAdminNotes={editAdminNotes}
                    setEditAdminNotes={setEditAdminNotes}
                    onSaveEdit={handleAdminUpdate}
                    hideHeader
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Scoping Sheet */}
      <ScopingSheet
        open={showScopingSheet}
        onOpenChange={setShowScopingSheet}
        onSuccess={fetchRequests}
        onOpenQuickSubmit={() => setShowSubmitDialog(true)}
      />

      {/* Quick Submit Dialog (fallback) */}
      <SubmitDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onSuccess={fetchRequests}
      />
    </div>
  );
}

// ── Stat Badge ──────────────────────────────────────────────────────────
function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
      {count} {label}
    </div>
  );
}

// ── Status Group ────────────────────────────────────────────────────────
interface StatusGroupProps {
  status: string;
  items: FeatureRequest[];
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  followingIds: Set<number>;
  onFollow: (id: number, isFollowing: boolean) => void;
  isAdmin: boolean;
  editingId: number | null;
  onStartEditing: (fr: FeatureRequest) => void;
  onCancelEditing: () => void;
  editStatus: string;
  setEditStatus: (s: string) => void;
  editPriority: string;
  setEditPriority: (s: string) => void;
  editStatusUpdate: string;
  setEditStatusUpdate: (s: string) => void;
  editAdminNotes: string;
  setEditAdminNotes: (s: string) => void;
  onSaveEdit: (id: number) => void;
  hideHeader?: boolean;
}

function StatusGroup({ status, items, expandedId, onToggleExpand, followingIds, onFollow, isAdmin, editingId, onStartEditing, onCancelEditing, editStatus, setEditStatus, editPriority, setEditPriority, editStatusUpdate, setEditStatusUpdate, editAdminNotes, setEditAdminNotes, onSaveEdit, hideHeader }: StatusGroupProps) {
  const config = STATUS_CONFIG[status];
  if (!items.length) return null;

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-3">
          <config.icon className={`h-4 w-4 ${config.color}`} />
          <h2 className={`text-sm font-semibold ${config.color}`}>
            {config.label}
          </h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
      )}
      <div className="space-y-2">
        {items.map((fr) => (
          <RequestCard
            key={fr.id}
            request={fr}
            isExpanded={expandedId === fr.id}
            onToggleExpand={() => onToggleExpand(fr.id)}
            isFollowing={followingIds.has(fr.id)}
            onFollow={() => onFollow(fr.id, followingIds.has(fr.id))}
            isAdmin={isAdmin}
            isEditing={editingId === fr.id}
            onStartEditing={() => onStartEditing(fr)}
            onCancelEditing={onCancelEditing}
            editStatus={editStatus}
            setEditStatus={setEditStatus}
            editPriority={editPriority}
            setEditPriority={setEditPriority}
            editStatusUpdate={editStatusUpdate}
            setEditStatusUpdate={setEditStatusUpdate}
            editAdminNotes={editAdminNotes}
            setEditAdminNotes={setEditAdminNotes}
            onSaveEdit={() => onSaveEdit(fr.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Request Card ────────────────────────────────────────────────────────
interface RequestCardProps {
  request: FeatureRequest;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isFollowing: boolean;
  onFollow: () => void;
  isAdmin: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  editStatus: string;
  setEditStatus: (s: string) => void;
  editPriority: string;
  setEditPriority: (s: string) => void;
  editStatusUpdate: string;
  setEditStatusUpdate: (s: string) => void;
  editAdminNotes: string;
  setEditAdminNotes: (s: string) => void;
  onSaveEdit: () => void;
}

function RequestCard({
  request,
  isExpanded,
  onToggleExpand,
  isFollowing,
  onFollow,
  isAdmin,
  isEditing,
  onStartEditing,
  onCancelEditing,
  editStatus,
  setEditStatus,
  editPriority,
  setEditPriority,
  editStatusUpdate,
  setEditStatusUpdate,
  editAdminNotes,
  setEditAdminNotes,
  onSaveEdit,
}: RequestCardProps) {
  const statusConfig = STATUS_CONFIG[request.status];
  const categoryConfig = CATEGORY_CONFIG[request.category];
  const CategoryIcon = categoryConfig?.icon || Sparkles;

  return (
    <div className={`border rounded-lg transition-colors ${statusConfig.bgColor}`}>
      {/* Card Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm text-foreground truncate">{request.title}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-1">
              <CategoryIcon className="h-3 w-3" />
              {categoryConfig?.label || request.category}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{request.submittedByName || "Anonymous"}</span>
            {request.submittedByCompany && (
              <>
                <span className="text-muted-foreground/50">from</span>
                <span>{request.submittedByCompany}</span>
              </>
            )}
            <span>{new Date(request.createdAt).toLocaleDateString("en-AU")}</span>
          </div>
        </div>

        {/* Follow button */}
        <button
          onClick={(e) => { e.stopPropagation(); onFollow(); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            isFollowing
              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
          title={isFollowing ? "Unfollow" : "Follow to get updates"}
        >
          {isFollowing ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          <Users className="h-3 w-3" />
          <span>{request.followerCount}</span>
        </button>

        {/* Expand chevron */}
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-border/50">
          {request.description && (
            <p className="text-sm text-foreground/80 mt-3 whitespace-pre-wrap">{request.description}</p>
          )}

          {request.statusUpdate && (
            <div className="mt-3 p-2 bg-background/50 rounded-md border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">Status Update</p>
              <p className="text-sm text-foreground">{request.statusUpdate}</p>
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && !isEditing && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onStartEditing}>
                Edit
              </Button>
            </div>
          )}

          {isAdmin && isEditing && (
            <div className="mt-3 space-y-3 p-3 bg-background/50 rounded-md border border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Controls</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority Order</Label>
                  <Input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    placeholder="1, 2, 3..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Status Update (public)</Label>
                <Textarea
                  value={editStatusUpdate}
                  onChange={(e) => setEditStatusUpdate(e.target.value)}
                  placeholder="e.g. Released in v2.3"
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div>
                <Label className="text-xs">Admin Notes (private)</Label>
                <Textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveEdit}>Save</Button>
                <Button size="sm" variant="outline" onClick={onCancelEditing}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Submit Dialog ───────────────────────────────────────────────────────
function SubmitDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("feature");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await api.post<{ success: boolean; error?: string }>("/api/v1/feature_requests", {
        feature_request: {
          title: title.trim(),
          description: description.trim() || null,
          category,
        },
      });

      if (res?.success) {
        setTitle("");
        setDescription("");
        setCategory("feature");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res?.error || "Failed to submit request");
      }
    } catch {
      setError("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Submit a Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of your idea..."
              autoFocus
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <cat.icon className="h-4 w-4" />
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us more about what you'd like and why it would be helpful..."
              className="min-h-[100px]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
