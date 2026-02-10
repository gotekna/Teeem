"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmationContext";

interface MeetingType {
  id: number;
  name: string;
  description: string;
  color: string;
  duration_minutes: number;
  requires_attendees: boolean;
  position: number;
  active: boolean;
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export function MeetingTypesTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [meetingTypes, setMeetingTypes] = React.useState<MeetingType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingType, setEditingType] = React.useState<MeetingType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    color: PRESET_COLORS[0],
    duration_minutes: 60,
    requires_attendees: false,
  });

  React.useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
    try {
      const data = await api.get<MeetingType[] | { meeting_types: MeetingType[] }>("/api/v1/meeting_types");
      // Handle both direct array and { meeting_types: [...] } response formats
      const typesArray = Array.isArray(data) ? data : (data?.meeting_types || []);
      setMeetingTypes(typesArray);
    } catch (error) {
      console.error("Failed to load meeting types:", error);
      // Mock data
      setMeetingTypes([
        {
          id: 1,
          name: "Site Meeting",
          description: "On-site team coordination meeting",
          color: "#3B82F6",
          duration_minutes: 60,
          requires_attendees: true,
          position: 1,
          active: true,
        },
        {
          id: 2,
          name: "Client Meeting",
          description: "Meeting with client to discuss progress",
          color: "#10B981",
          duration_minutes: 90,
          requires_attendees: true,
          position: 2,
          active: true,
        },
        {
          id: 3,
          name: "Daily Standup",
          description: "Quick daily team check-in",
          color: "#F59E0B",
          duration_minutes: 15,
          requires_attendees: false,
          position: 3,
          active: true,
        },
        {
          id: 4,
          name: "Safety Briefing",
          description: "WHS safety briefing before work starts",
          color: "#EF4444",
          duration_minutes: 30,
          requires_attendees: true,
          position: 4,
          active: true,
        },
        {
          id: 5,
          name: "Supplier Call",
          description: "Phone call with suppliers",
          color: "#8B5CF6",
          duration_minutes: 30,
          requires_attendees: false,
          position: 5,
          active: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      description: "",
      color: PRESET_COLORS[0],
      duration_minutes: 60,
      requires_attendees: false,
    });
    setEditingType(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (type: MeetingType) => {
    setFormData({
      name: type.name,
      description: type.description || "",
      color: type.color || PRESET_COLORS[0],
      duration_minutes: type.duration_minutes || 60,
      requires_attendees: type.requires_attendees || false,
    });
    setEditingType(type);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Meeting type name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingType) {
        await api.patch(`/api/v1/meeting_types/${editingType.id}`, {
          meeting_type: formData,
        });
        toast({ title: "Success", description: "Meeting type updated successfully" });
      } else {
        await api.post("/api/v1/meeting_types", {
          meeting_type: {
            ...formData,
            position: meetingTypes.length + 1,
          },
        });
        toast({ title: "Success", description: "Meeting type created successfully" });
      }
      setShowDialog(false);
      loadMeetingTypes();
    } catch (error) {
      console.error("Failed to save meeting type:", error);
      toast({ title: "Error", description: "Failed to save meeting type", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this meeting type?"))) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/meeting_types/${id}`);
      toast({ title: "Success", description: "Meeting type deleted successfully" });
      loadMeetingTypes();
    } catch (error) {
      console.error("Failed to delete meeting type:", error);
      toast({ title: "Error", description: "Failed to delete meeting type", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTypes = [...meetingTypes];
    const [removed] = newTypes.splice(draggedIndex, 1);
    newTypes.splice(index, 0, removed);

    newTypes.forEach((type, i) => {
      type.position = i + 1;
    });

    setMeetingTypes(newTypes);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);

    try {
      await api.post("/api/v1/meeting_types/reorder", {
        order: meetingTypes.map((t) => t.id),
      });
    } catch (error) {
      console.error("Failed to save order:", error);
      loadMeetingTypes();
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Meeting Types</h2>
          <p className="text-sm text-muted-foreground">
            Define the types of meetings used in your organization. Drag to reorder.
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Meeting Type
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {meetingTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No meeting types yet</h3>
              <p className="text-center max-w-md mb-4">
                Create meeting types to categorize and organize your team meetings.
              </p>
              <Button onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Meeting Type
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {meetingTypes
                .sort((a, b) => a.position - b.position)
                .map((type, index) => (
                  <div
                    key={type.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-muted/50 cursor-move",
                      draggedIndex === index && "opacity-50 bg-muted"
                    )}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: type.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{type.name}</p>
                      </div>
                      {type.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {type.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(type.duration_minutes)}
                      </Badge>
                      {type.requires_attendees && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Attendees
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={deleting === type.id}
                        onClick={() => handleDelete(type.id)}
                      >
                        {deleting === type.id ? (
                          <Spinner size={16} />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Meeting Type" : "New Meeting Type"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update the meeting type details."
                : "Create a new meeting type for your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Meeting Type Name</Label>
              <Input
                id="name"
                placeholder="e.g., Site Meeting"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this meeting type"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform",
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Default Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.duration_minutes === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, duration_minutes: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_attendees"
                checked={formData.requires_attendees}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requires_attendees: checked === true })
                }
              />
              <Label htmlFor="requires_attendees" className="cursor-pointer">
                Requires attendees to be selected
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingType ? (
                "Update Meeting Type"
              ) : (
                "Create Meeting Type"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
