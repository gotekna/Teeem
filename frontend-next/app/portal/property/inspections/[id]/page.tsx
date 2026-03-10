"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  AlertTriangle,
  Camera,
  MessageSquare,
  PenTool,
  Eraser,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface InspectionPhoto {
  id: number;
  caption: string | null;
  url: string | null;
  taken_at: string | null;
}

interface InspectionItem {
  id: number;
  name: string;
  condition: string | null;
  entry_condition: string | null;
  is_clean: boolean;
  is_working: boolean;
  action_required: boolean;
  notes: string | null;
  photos: InspectionPhoto[];
}

interface InspectionRoom {
  id: number;
  name: string;
  room_type: string;
  overall_condition: string | null;
  notes: string | null;
  items: InspectionItem[];
}

interface InspectionDetail {
  id: number;
  inspection_type: string;
  inspection_number: string | null;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  overall_condition: string | null;
  notes: string | null;
  inspector: string | null;
  property: { id: number; name: string; address: string };
  has_report: boolean;
  signed_by_tenant: boolean;
  signed_by_inspector: boolean;
  rooms: InspectionRoom[];
}

function portalFetch(path: string, options?: RequestInit) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  }).then((r) => r.json());
}

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentItemId, setCommentItemId] = useState<number | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const loadInspection = useCallback(() => {
    portalFetch(`/api/v1/portal/property/inspections/${params.id}`)
      .then((res) => {
        if (res.success) {
          setInspection(res.data);
          // Expand all rooms by default
          const roomIds = new Set<number>(
            (res.data.rooms || []).map((r: InspectionRoom) => r.id)
          );
          setExpandedRooms(roomIds);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    loadInspection();
  }, [loadInspection]);

  const toggleRoom = (roomId: number) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const handleDownloadReport = async () => {
    const res = await portalFetch(
      `/api/v1/portal/property/inspections/${params.id}/download_report`
    );
    if (res.success && res.data?.download_url) {
      window.open(res.data.download_url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Inspection not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/portal/property/inspections")}
        >
          Back to Inspections
        </Button>
      </div>
    );
  }

  const isExit = inspection.inspection_type === "exit";
  const needsSignature =
    inspection.status === "completed" && !inspection.signed_by_tenant;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/portal/property/inspections")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {inspection.inspection_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
            Inspection
          </h1>
          <p className="text-sm text-muted-foreground">
            {inspection.property.address}
            {inspection.inspection_number &&
              ` | ${inspection.inspection_number}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inspection.has_report && (
            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" /> PDF Report
            </Button>
          )}
          {needsSignature && (
            <Button size="sm" onClick={() => setShowSignDialog(true)}>
              <PenTool className="h-4 w-4 mr-2" /> Sign
            </Button>
          )}
        </div>
      </div>

      {/* Signature Required Banner */}
      {needsSignature && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <PenTool className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  Your signature is required
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Please review the inspection report and sign to acknowledge.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowSignDialog(true)}>
                Sign Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge
              className={statusColors[inspection.status] || ""}
              variant="outline"
            >
              {inspection.status.replace("_", " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">
              {formatDate(
                inspection.completed_date || inspection.scheduled_date
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Condition</p>
            {inspection.overall_condition ? (
              <Badge
                className={
                  conditionColors[inspection.overall_condition] || ""
                }
                variant="outline"
              >
                {inspection.overall_condition}
              </Badge>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Inspector</p>
            <p className="font-medium">{inspection.inspector || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Signatures Status */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm">
          {inspection.signed_by_inspector ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>Inspector signed</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {inspection.signed_by_tenant ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>Tenant signed</span>
        </div>
      </div>

      {/* Notes */}
      {inspection.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Notes
            </p>
            <p className="text-sm whitespace-pre-wrap">{inspection.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rooms */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Rooms ({inspection.rooms?.length || 0})
        </h2>

        {(inspection.rooms || []).map((room) => (
          <Card key={room.id}>
            <button
              className="w-full text-left"
              onClick={() => toggleRoom(room.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{room.name}</CardTitle>
                    {room.overall_condition && (
                      <Badge
                        className={
                          conditionColors[room.overall_condition] || ""
                        }
                        variant="outline"
                      >
                        {room.overall_condition}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {room.items.length} items
                    </span>
                  </div>
                  {expandedRooms.has(room.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </button>

            {expandedRooms.has(room.id) && (
              <CardContent className="pt-0">
                {room.notes && (
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    {room.notes}
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">Item</th>
                        {isExit && (
                          <th className="text-center py-2 px-2">Entry</th>
                        )}
                        <th className="text-center py-2 px-2">Condition</th>
                        <th className="text-center py-2 px-2">Clean</th>
                        <th className="text-center py-2 px-2">Working</th>
                        <th className="text-left py-2 px-2">Notes</th>
                        <th className="text-center py-2 px-2">Photos</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2 px-2 font-medium">
                            <div className="flex items-center gap-1">
                              {item.action_required && (
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                              {item.name}
                            </div>
                          </td>
                          {isExit && (
                            <td className="text-center py-2 px-2">
                              {item.entry_condition ? (
                                <Badge
                                  className={
                                    conditionColors[item.entry_condition] || ""
                                  }
                                  variant="outline"
                                >
                                  {item.entry_condition}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          <td className="text-center py-2 px-2">
                            {item.condition ? (
                              <Badge
                                className={
                                  conditionColors[item.condition] || ""
                                }
                                variant="outline"
                              >
                                {item.condition}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.is_clean ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.is_working ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="py-2 px-2 max-w-[200px]">
                            <p className="text-xs text-muted-foreground truncate">
                              {item.notes || "—"}
                            </p>
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.photos.length > 0 ? (
                              <div className="flex gap-1 justify-center">
                                {item.photos.slice(0, 3).map((photo) => (
                                  <button
                                    key={photo.id}
                                    onClick={() =>
                                      photo.url && setPhotoModal(photo.url)
                                    }
                                    className="h-8 w-8 rounded overflow-hidden bg-muted"
                                  >
                                    {photo.url ? (
                                      <img
                                        src={photo.url}
                                        alt={photo.caption || ""}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Camera className="h-4 w-4 m-auto text-muted-foreground" />
                                    )}
                                  </button>
                                ))}
                                {item.photos.length > 3 && (
                                  <span className="text-xs text-muted-foreground self-center">
                                    +{item.photos.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setCommentItemId(item.id);
                                setShowCommentDialog(true);
                              }}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Add general comment button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => {
            setCommentItemId(null);
            setShowCommentDialog(true);
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" /> Add General Comment
        </Button>
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <Dialog open={true} onOpenChange={() => setPhotoModal(null)}>
          <DialogContent className="sm:max-w-2xl p-0">
            <img
              src={photoModal}
              alt="Inspection photo"
              className="w-full h-auto rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Signature Dialog */}
      <PortalSignatureDialog
        open={showSignDialog}
        onClose={() => setShowSignDialog(false)}
        inspectionId={inspection.id}
        onSigned={() => {
          setShowSignDialog(false);
          loadInspection();
        }}
      />

      {/* Comment Dialog */}
      <CommentDialog
        open={showCommentDialog}
        onClose={() => setShowCommentDialog(false)}
        inspectionId={inspection.id}
        itemId={commentItemId}
        onSubmitted={() => {
          setShowCommentDialog(false);
          loadInspection();
        }}
      />
    </div>
  );
}

function PortalSignatureDialog({
  open,
  onClose,
  inspectionId,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: number;
  onSigned: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricCanvasRef = useRef<any>(null);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function initCanvas() {
      const fabricModule = await import("fabric");
      const { Canvas } = fabricModule;

      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: 500,
        height: 200,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
      });

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = "#1a1a1a";
        canvas.freeDrawingBrush.width = 2;
      }

      canvas.on("path:created", () => setHasDrawn(true));
      fabricCanvasRef.current = canvas;
    }

    initCanvas();

    return () => {
      cancelled = true;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setHasDrawn(false);
      setSignerName("");
    };
  }, [open]);

  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    setHasDrawn(false);
  };

  const handleSign = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !hasDrawn) return;

    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL({ format: "png" });

      await portalFetch(
        `/api/v1/portal/property/inspections/${inspectionId}/sign`,
        {
          method: "POST",
          body: JSON.stringify({
            signature_data: dataUrl,
            signer_name: signerName,
          }),
        }
      );

      onSigned();
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Sign Inspection Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter your name..."
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Signature</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClear}
                className="h-7 text-xs"
              >
                <Eraser className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="touch-none cursor-crosshair"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Draw your signature above using mouse or touch
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            By signing, you acknowledge that you have reviewed this inspection
            report. If you disagree with any findings, please add a comment
            before signing.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSign} disabled={saving || !hasDrawn}>
            {saving ? (
              <Spinner className="h-4 w-4 mr-1.5" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            Sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentDialog({
  open,
  onClose,
  inspectionId,
  itemId,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: number;
  itemId: number | null;
  onSubmitted: () => void;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await portalFetch(
        `/api/v1/portal/property/inspections/${inspectionId}/comment`,
        {
          method: "POST",
          body: JSON.stringify({
            comment,
            inspection_item_id: itemId,
          }),
        }
      );
      setComment("");
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {itemId ? "Comment on Item" : "General Comment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={
              itemId
                ? "Describe your concern about this item..."
                : "Add a general comment about this inspection..."
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your comment will be visible to the property manager.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!comment.trim() || submitting}
          >
            {submitting ? "Submitting..." : "Submit Comment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
