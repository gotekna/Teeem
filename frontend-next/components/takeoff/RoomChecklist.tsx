"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Trash2,
  ShoppingCart,
  Pin,
  X,
  CheckCircle2,
  Circle,
  Package,
  ArrowRight,
} from "lucide-react";
import type { TakeoffRoomInstance, TakeoffRoomSlot, TakeoffTool } from "./types";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

// =============================================================================
// Props
// =============================================================================

interface RoomChecklistProps {
  room: TakeoffRoomInstance;
  activeSlotId: number | null;
  onSlotSelect: (slot: TakeoffRoomSlot | null) => void;
  onSlotClear: (slotId: number) => void;
  onSlotAssignPricebook: (slotId: number) => void;
  onGeneratePO: () => void;
  onMarkComplete: () => void;
  isLoading?: boolean;
  onClose?: () => void;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  hasJob?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  count: "Count",
  area: "Area",
  linear: "Linear",
  perimeter: "Perimeter",
};

const UNIT_LABELS: Record<string, string> = {
  count: "ea",
  area: "m\u00B2",
  linear: "m",
  perimeter: "m",
};

function formatSlotQuantity(slot: TakeoffRoomSlot): string {
  if (!slot.is_filled) return "\u2014 unfilled";
  const unit = slot.unit_display || UNIT_LABELS[slot.measurement_type] || "";
  if (slot.measurement_type === "count") {
    return `${Math.round(slot.quantity)} ${unit}`;
  }
  return `${slot.quantity.toFixed(2)} ${unit}`;
}

// =============================================================================
// Component
// =============================================================================

export function RoomChecklist({
  room,
  activeSlotId,
  onSlotSelect,
  onSlotClear,
  onSlotAssignPricebook,
  onGeneratePO,
  onMarkComplete,
  isLoading,
  onClose,
  pinned,
  onPinChange,
  hasJob = true,
}: RoomChecklistProps) {
  const progressPercent = room.total > 0 ? (room.filled / room.total) * 100 : 0;
  const isComplete = room.status === "complete";

  // Calculate total from filled slots with pricing
  const totalCost = room.slots.reduce((sum, slot) => {
    if (slot.is_filled && slot.line_total != null) {
      return sum + slot.line_total;
    }
    return sum;
  }, 0);

  const filledWithPrice = room.slots.filter(
    (s) => s.is_filled && s.pricebook_item_id != null
  );

  return (
    <div className="w-80 bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{room.name}</h2>
            <p className="text-xs text-muted-foreground">
              {room.template_name} &middot; {room.filled}/{room.total} filled
            </p>
          </div>
          {onClose && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPinChange?.(!pinned)}
                title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              >
                <Pin className={cn("h-3.5 w-3.5 transition-colors", pinned && "text-primary fill-primary")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
                title="Close sidebar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Slot Checklist */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {room.slots.map((slot) => (
            <SlotItem
              key={slot.id}
              slot={slot}
              isActive={activeSlotId === slot.id}
              onSelect={() => onSlotSelect(slot)}
              onClear={() => onSlotClear(slot.id)}
              onAssignPricebook={() => onSlotAssignPricebook(slot.id)}
            />
          ))}

          {room.slots.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No slots in this room.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer — total + actions */}
      <Separator />
      <div className="p-4 space-y-3">
        {totalCost > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-lg font-semibold">
              {formatCurrency(totalCost)}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          {hasJob && (
            <Button
              className="flex-1"
              onClick={onGeneratePO}
              disabled={isLoading || filledWithPrice.length === 0}
              title={filledWithPrice.length === 0 ? "No priced slots to generate PO from" : "Generate PO from filled slots"}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Generate PO
            </Button>
          )}

          <Button
            variant={isComplete ? "secondary" : "outline"}
            onClick={onMarkComplete}
            disabled={isLoading}
            title={isComplete ? "Mark as in progress" : "Mark room as complete"}
          >
            {isComplete ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!hasJob && (
          <p className="text-xs text-muted-foreground text-center">
            Link to a job to generate purchase orders
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Slot Item Component
// =============================================================================

interface SlotItemProps {
  slot: TakeoffRoomSlot;
  isActive: boolean;
  onSelect: () => void;
  onClear: () => void;
  onAssignPricebook: () => void;
}

function SlotItem({
  slot,
  isActive,
  onSelect,
  onClear,
  onAssignPricebook,
}: SlotItemProps) {
  const typeLabel = MEASUREMENT_TYPE_LABELS[slot.measurement_type] || slot.measurement_type;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-1 p-2 rounded cursor-pointer text-sm transition-colors",
        isActive
          ? "bg-primary/10 border border-primary/30"
          : slot.is_filled
          ? "hover:bg-muted"
          : "hover:bg-muted/50 border border-dashed border-muted-foreground/20"
      )}
    >
      {/* Top row: color dot + label + type */}
      <div className="flex items-center gap-2">
        {/* Color dot */}
        {slot.color && (
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: slot.color }}
          />
        )}

        {/* Status icon */}
        {slot.is_filled ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}

        {/* Label */}
        <span className="font-medium flex-1 truncate">{slot.label}</span>

        {/* Type badge */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          ({typeLabel})
        </span>

        {/* Active indicator */}
        {isActive && (
          <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        )}
      </div>

      {/* Bottom row: value + pricebook + actions */}
      <div className="flex items-center gap-2 ml-5">
        {/* Quantity or unfilled */}
        <span className={cn(
          "text-xs flex-1",
          slot.is_filled ? "text-foreground" : "text-muted-foreground italic"
        )}>
          {formatSlotQuantity(slot)}
        </span>

        {/* Pricebook info */}
        {slot.pricebook_item_id ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignPricebook();
            }}
            className="flex items-center gap-1 hover:bg-muted rounded px-1"
          >
            <Badge variant="outline" className="text-xs truncate max-w-[60px]">
              {slot.pricebook_item_code}
            </Badge>
            {slot.line_total != null && slot.line_total > 0 && (
              <span className="text-xs text-muted-foreground">
                ${Number(slot.line_total).toFixed(0)}
              </span>
            )}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onAssignPricebook();
            }}
            title="Assign pricebook item"
          >
            <Package className="h-3 w-3" />
          </Button>
        )}

        {/* Clear button — only when filled */}
        {slot.is_filled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Clear measurement"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Prompt hint */}
      {slot.prompt && !slot.is_filled && isActive && (
        <p className="text-xs text-muted-foreground ml-5 italic">
          {slot.prompt}
        </p>
      )}
    </div>
  );
}
