import { atom } from "jotai";

// ════════════════════════════════════════════════════
// Inspection Conduct State (Jotai Atoms)
// SSoT for all inspection conduct UI state
// ════════════════════════════════════════════════════

export interface InspectionPhoto {
  id: number;
  inspection_item_id: number;
  storage_blob: { id: number; storage_path: string; content_type: string; file_size: number };
  annotated_blob?: { id: number; storage_path: string; content_type: string; file_size: number } | null;
  caption: string | null;
  annotations_json: Record<string, unknown>;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
}

export interface InspectionItem {
  id: number;
  name: string;
  condition: string | null;
  entry_condition: string | null;
  notes: string | null;
  is_clean: boolean;
  is_working: boolean;
  action_required: boolean;
  sort_order: number;
  inspection_photos: InspectionPhoto[];
}

export interface InspectionRoom {
  id: number;
  name: string;
  room_type: string;
  sort_order: number;
  overall_condition: string | null;
  notes: string | null;
  inspection_items: InspectionItem[];
}

export interface InspectionData {
  id: number;
  inspection_type: string;
  inspection_number: string | null;
  scheduled_date: string;
  status: string;
  overall_condition: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_percentage: number;
  action_items_count: number;
  has_report: boolean;
  signed_by_inspector: boolean;
  signed_by_tenant: boolean;
  property: { id: number; name: string; property_code: string };
  inspector_contact?: { id: number; display_name: string } | null;
  inspection_rooms: InspectionRoom[];
}

/** Full inspection data loaded from API */
export const inspectionDataAtom = atom<InspectionData | null>(null);

/** Currently selected room ID */
export const activeRoomIdAtom = atom<number | null>(null);

/** Whether there are unsaved changes */
export const inspectionDirtyAtom = atom(false);

/** Auto-save queue of pending item updates */
export interface PendingUpdate {
  roomId: number;
  itemId: number;
  field: string;
  value: string | boolean | null;
  timestamp: number;
}

export const autoSaveQueueAtom = atom<PendingUpdate[]>([]);

/** Whether auto-save is currently in flight */
export const autoSavingAtom = atom(false);

/** Derived: active room data */
export const activeRoomAtom = atom((get) => {
  const data = get(inspectionDataAtom);
  const activeId = get(activeRoomIdAtom);
  if (!data || !activeId) return null;
  return data.inspection_rooms.find(r => r.id === activeId) || null;
});

/** Derived: overall completion percentage */
export const completionPercentageAtom = atom((get) => {
  const data = get(inspectionDataAtom);
  if (!data) return 0;

  const rooms = data.inspection_rooms;
  if (rooms.length === 0) return 0;

  const totalItems = rooms.reduce((sum, r) => sum + r.inspection_items.length, 0);
  if (totalItems === 0) return 0;

  const checkedItems = rooms.reduce(
    (sum, r) => sum + r.inspection_items.filter(i => i.condition !== null).length,
    0
  );

  return Math.round((checkedItems / totalItems) * 100);
});

/** Condition options with labels and colors */
export const CONDITIONS = [
  { value: "new", label: "New", color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400" },
  { value: "good", label: "Good", color: "bg-green-500", textColor: "text-green-700 dark:text-green-400" },
  { value: "fair", label: "Fair", color: "bg-yellow-500", textColor: "text-yellow-700 dark:text-yellow-400" },
  { value: "poor", label: "Poor", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-400" },
  { value: "damaged", label: "Damaged", color: "bg-red-500", textColor: "text-red-700 dark:text-red-400" },
] as const;
