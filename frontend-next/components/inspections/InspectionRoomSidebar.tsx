"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { inspectionDataAtom, activeRoomIdAtom, type InspectionRoom } from "@/lib/inspection-atoms";
import { Button } from "@/components/ui/button";
import { Plus, Copy, CheckCircle2, Circle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useCallback } from "react";
import { ConditionBadge } from "./ConditionBadge";

interface InspectionRoomSidebarProps {
  inspectionId: number;
  onRoomAdded: () => void;
}

function roomCompletionPercentage(room: InspectionRoom): number {
  if (room.inspection_items.length === 0) return 0;
  const checked = room.inspection_items.filter(i => i.condition !== null).length;
  return Math.round((checked / room.inspection_items.length) * 100);
}

export function InspectionRoomSidebar({ inspectionId, onRoomAdded }: InspectionRoomSidebarProps) {
  const data = useAtomValue(inspectionDataAtom);
  const activeRoomId = useAtomValue(activeRoomIdAtom);
  const setActiveRoomId = useSetAtom(activeRoomIdAtom);
  const { toast } = useToast();

  const handleAddRoom = useCallback(async () => {
    try {
      await api.post(`/api/v1/property_inspections/${inspectionId}/inspection_rooms`, {
        inspection_room: {
          name: `Room ${(data?.inspection_rooms.length || 0) + 1}`,
          room_type: "other",
        },
      });
      onRoomAdded();
    } catch {
      toast({ title: "Error", description: "Failed to add room", variant: "destructive" });
    }
  }, [inspectionId, data, onRoomAdded, toast]);

  const handleDuplicate = useCallback(async (roomId: number) => {
    try {
      await api.post(`/api/v1/property_inspections/${inspectionId}/inspection_rooms/${roomId}/duplicate`);
      onRoomAdded();
    } catch {
      toast({ title: "Error", description: "Failed to duplicate room", variant: "destructive" });
    }
  }, [inspectionId, onRoomAdded, toast]);

  if (!data) return null;

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold">Rooms</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {data.inspection_rooms.map(room => {
          const pct = roomCompletionPercentage(room);
          const isActive = room.id === activeRoomId;
          const isComplete = pct === 100;

          return (
            <button
              key={room.id}
              className={`w-full text-left p-3 border-b transition-colors hover:bg-accent/50 ${
                isActive ? "bg-accent border-l-2 border-l-primary" : ""
              }`}
              onClick={() => setActiveRoomId(room.id)}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{room.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-primary/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                  {room.overall_condition && (
                    <div className="mt-1">
                      <ConditionBadge condition={room.overall_condition} size="sm" />
                    </div>
                  )}
                </div>
                {isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(room.id);
                    }}
                    title="Duplicate room"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t">
        <Button size="sm" variant="outline" className="w-full" onClick={handleAddRoom}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Room
        </Button>
      </div>
    </div>
  );
}
