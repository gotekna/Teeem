"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface RoomItem {
  name: string;
}

interface TemplateRoom {
  name: string;
  room_type: string;
  items: RoomItem[];
}

interface InspectionTemplate {
  id: number;
  name: string;
  property_type_name: string;
  rooms: TemplateRoom[];
  is_default: boolean;
  active: boolean;
}

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "commercial", label: "Commercial" },
  { value: "unit", label: "Unit" },
  { value: "villa", label: "Villa" },
  { value: "other", label: "Other" },
];

const ROOM_TYPES = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "living", label: "Living" },
  { value: "dining", label: "Dining" },
  { value: "laundry", label: "Laundry" },
  { value: "garage", label: "Garage" },
  { value: "outdoor", label: "Outdoor" },
  { value: "hallway", label: "Hallway" },
  { value: "ensuite", label: "Ensuite" },
  { value: "storage", label: "Storage" },
  { value: "car_space", label: "Car Space" },
  { value: "balcony", label: "Balcony" },
  { value: "study", label: "Study" },
  { value: "office", label: "Office" },
  { value: "patio", label: "Patio" },
  { value: "other", label: "Other" },
];

export function InspectionTemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editorName, setEditorName] = useState("");
  const [editorPropertyType, setEditorPropertyType] = useState("house");
  const [editorRooms, setEditorRooms] = useState<TemplateRoom[]>([]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: InspectionTemplate[] }>("/api/v1/inspection_room_templates");
      if (res.success) setTemplates(res.data);
    } catch {
      toast({ title: "Error", description: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSeedDefaults = useCallback(async () => {
    try {
      await api.post("/api/v1/inspection_room_templates/seed_defaults");
      toast({ title: "Default templates created" });
      fetchTemplates();
    } catch {
      toast({ title: "Error", description: "Failed to create defaults", variant: "destructive" });
    }
  }, [toast, fetchTemplates]);

  const handleEdit = useCallback((template: InspectionTemplate) => {
    setEditingTemplate(template);
    setEditorName(template.name);
    setEditorPropertyType(template.property_type_name);
    setEditorRooms(JSON.parse(JSON.stringify(template.rooms)));
    setShowEditor(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    setEditorName("");
    setEditorPropertyType("house");
    setEditorRooms([{ name: "", room_type: "other", items: [{ name: "" }] }]);
    setShowEditor(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await api.delete(`/api/v1/inspection_room_templates/${id}`);
      toast({ title: "Template deleted" });
      fetchTemplates();
    } catch {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  }, [toast, fetchTemplates]);

  const handleSave = useCallback(async () => {
    if (!editorName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    // Filter out empty rooms and items
    const cleanedRooms = editorRooms
      .filter(r => r.name.trim())
      .map(r => ({
        ...r,
        items: r.items.filter(i => i.name.trim()),
      }));

    if (cleanedRooms.length === 0) {
      toast({ title: "At least one room is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inspection_room_template: {
          name: editorName,
          property_type_name: editorPropertyType,
          rooms: cleanedRooms,
        },
      };

      if (editingTemplate) {
        await api.patch(`/api/v1/inspection_room_templates/${editingTemplate.id}`, payload);
      } else {
        await api.post("/api/v1/inspection_room_templates", payload);
      }

      toast({ title: editingTemplate ? "Template updated" : "Template created" });
      setShowEditor(false);
      fetchTemplates();
    } catch {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editorName, editorPropertyType, editorRooms, editingTemplate, toast, fetchTemplates]);

  const addRoom = useCallback(() => {
    setEditorRooms(prev => [...prev, { name: "", room_type: "other", items: [{ name: "" }] }]);
  }, []);

  const removeRoom = useCallback((index: number) => {
    setEditorRooms(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateRoom = useCallback((index: number, field: keyof TemplateRoom, value: string) => {
    setEditorRooms(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }, []);

  const addItem = useCallback((roomIndex: number) => {
    setEditorRooms(prev => prev.map((r, i) =>
      i === roomIndex ? { ...r, items: [...r.items, { name: "" }] } : r
    ));
  }, []);

  const removeItem = useCallback((roomIndex: number, itemIndex: number) => {
    setEditorRooms(prev => prev.map((r, i) =>
      i === roomIndex ? { ...r, items: r.items.filter((_, j) => j !== itemIndex) } : r
    ));
  }, []);

  const updateItem = useCallback((roomIndex: number, itemIndex: number, value: string) => {
    setEditorRooms(prev => prev.map((r, i) =>
      i === roomIndex
        ? { ...r, items: r.items.map((item, j) => j === itemIndex ? { name: value } : item) }
        : r
    ));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Group by property type
  const grouped = templates.reduce((acc, t) => {
    const key = t.property_type_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, InspectionTemplate[]>);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspection Room Templates</h2>
          <p className="text-sm text-muted-foreground">
            Configure room checklists for property inspections
          </p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <Wand2 className="h-4 w-4 mr-1.5" />
              Create Defaults
            </Button>
          )}
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Template
          </Button>
        </div>
      </div>

      {Object.entries(grouped).map(([propertyType, templateList]) => (
        <div key={propertyType} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground capitalize">{propertyType}</h3>
          {templateList.map(template => (
            <Card key={template.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-left"
                    onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                  >
                    {expandedTemplate === template.id
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                    <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                    <Badge variant="outline" className="text-xs ml-2">
                      {template.rooms.length} rooms
                    </Badge>
                    {template.is_default && (
                      <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Default
                      </Badge>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(template)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedTemplate === template.id && (
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="space-y-2">
                    {template.rooms.map((room, ri) => (
                      <div key={ri} className="pl-6 border-l-2 border-muted">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{room.name}</span>
                          <Badge variant="outline" className="text-xs">{room.room_type}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {room.items.map((item, ii) => (
                            <Badge key={ii} variant="secondary" className="text-xs font-normal">
                              {item.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ))}

      {templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No inspection templates yet. Create default templates to get started.
            </p>
            <Button onClick={handleSeedDefaults}>
              <Wand2 className="h-4 w-4 mr-1.5" />
              Create Default Templates
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="e.g. Standard House" />
              </div>
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select value={editorPropertyType} onValueChange={setEditorPropertyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rooms</Label>
                <Button size="sm" variant="outline" onClick={addRoom}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Room
                </Button>
              </div>

              {editorRooms.map((room, ri) => (
                <Card key={ri} className="p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Room name"
                          value={room.name}
                          onChange={e => updateRoom(ri, "name", e.target.value)}
                          className="flex-1"
                        />
                        <Select value={room.room_type} onValueChange={v => updateRoom(ri, "room_type", v)}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROOM_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => removeRoom(ri)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="pl-4 space-y-1">
                        {room.items.map((item, ii) => (
                          <div key={ii} className="flex items-center gap-2">
                            <Input
                              placeholder="Item name"
                              value={item.name}
                              onChange={e => updateItem(ri, ii, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeItem(ri, ii)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addItem(ri)}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner className="mr-2 h-4 w-4" />}
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
