"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Trash2,
  Package,
  Calculator,
  ShoppingCart,
  Pin,
  X,
} from "lucide-react";
import type {
  TakeoffMeasurement,
  TakeoffLayer,
  MeasurementSummary,
} from "./types";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

// =============================================================================
// Props
// =============================================================================

interface TakeoffSidebarProps {
  measurements: TakeoffMeasurement[];
  layers: TakeoffLayer[];
  activeLayer?: TakeoffLayer | null;  // null = "All" view
  summary: MeasurementSummary | null;
  selectedMeasurement: TakeoffMeasurement | null;
  onMeasurementSelect: (measurement: TakeoffMeasurement | null) => void;
  onMeasurementDelete: (id: number) => void;
  onAssignPricebook: (measurementId: number) => void;
  onRenameMeasurement: (id: number, name: string) => void;
  onGeneratePO: () => void;
  isLoading?: boolean;
  onClose?: () => void;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function TakeoffSidebar({
  measurements,
  layers,
  activeLayer,
  summary,
  selectedMeasurement,
  onMeasurementSelect,
  onMeasurementDelete,
  onAssignPricebook,
  onRenameMeasurement,
  onGeneratePO,
  isLoading,
  onClose,
  pinned,
  onPinChange,
}: TakeoffSidebarProps) {
  // Filter measurements by active layer (null = show all)
  const filteredMeasurements = React.useMemo(() => {
    if (!activeLayer) return measurements; // "All" view
    return measurements.filter((m) => {
      const layerId = m.layer?.id || -1;
      return layerId === activeLayer.id;
    });
  }, [measurements, activeLayer]);

  // Group measurements by layer
  const measurementsByLayer = React.useMemo(() => {
    const groups: Record<number, TakeoffMeasurement[]> = {};

    layers.forEach((layer) => {
      groups[layer.id] = [];
    });

    // Add "Unassigned" group
    groups[-1] = [];

    filteredMeasurements.forEach((m) => {
      const layerId = m.layer?.id || -1;
      if (!groups[layerId]) groups[layerId] = [];
      groups[layerId].push(m);
    });

    return groups;
  }, [filteredMeasurements, layers]);

  // Expanded layers — auto-expand new layers as they appear
  const [expandedLayers, setExpandedLayers] = React.useState<Set<number>>(
    new Set(layers.map((l) => l.id))
  );

  React.useEffect(() => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      layers.forEach((l) => {
        if (!prev.has(l.id)) next.add(l.id);
      });
      return next.size !== prev.size ? next : prev;
    });
  }, [layers]);

  const toggleLayer = (layerId: number) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  return (
    <div className="w-80 bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold">
            {activeLayer ? activeLayer.name : "All Layers"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filteredMeasurements.length} items{activeLayer && measurements.length !== filteredMeasurements.length ? ` (${measurements.length} total)` : ""}
          </p>
        </div>
        {onClose && (
          <div className="flex items-center gap-1">
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

      {/* Measurements List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {layers.map((layer) => {
            const layerMeasurements = measurementsByLayer[layer.id] || [];
            if (layerMeasurements.length === 0) return null;

            return (
              <LayerGroup
                key={layer.id}
                layer={layer}
                measurements={layerMeasurements}
                isExpanded={expandedLayers.has(layer.id)}
                onToggle={() => toggleLayer(layer.id)}
                selectedId={selectedMeasurement?.id}
                onSelect={onMeasurementSelect}
                onDelete={onMeasurementDelete}
                onAssignPricebook={onAssignPricebook}
                onRename={onRenameMeasurement}
              />
            );
          })}

          {/* Unassigned measurements — only show if no layer with id -1 already exists */}
          {measurementsByLayer[-1]?.length > 0 && !layers.some(l => l.id === -1) && (
            <LayerGroup
              key={-1}
              layer={{ id: -1, name: "Unassigned", color: "#6B7280", display_order: 999, visible: true, locked: false, measurement_count: measurementsByLayer[-1].length }}
              measurements={measurementsByLayer[-1]}
              isExpanded={expandedLayers.has(-1)}
              onToggle={() => toggleLayer(-1)}
              selectedId={selectedMeasurement?.id}
              onSelect={onMeasurementSelect}
              onDelete={onMeasurementDelete}
              onAssignPricebook={onAssignPricebook}
              onRename={onRenameMeasurement}
            />
          )}

          {filteredMeasurements.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {activeLayer && measurements.length > 0
                ? `No measurements on "${activeLayer.name}" layer.`
                : <>No measurements yet.<br />Use the tools to start measuring.</>
              }
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      {summary && filteredMeasurements.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {summary.by_type.area > 0 && (
                <div>
                  <span className="text-muted-foreground">Area:</span>
                  <span className="ml-2 font-medium">{summary.by_type.area} m²</span>
                </div>
              )}
              {summary.by_type.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Linear:</span>
                  <span className="ml-2 font-medium">{summary.by_type.length} m</span>
                </div>
              )}
              {summary.by_type.perimeter > 0 && (
                <div>
                  <span className="text-muted-foreground">Perimeter:</span>
                  <span className="ml-2 font-medium">{summary.by_type.perimeter} m</span>
                </div>
              )}
              {summary.by_type.count > 0 && (
                <div>
                  <span className="text-muted-foreground">Count:</span>
                  <span className="ml-2 font-medium">{summary.by_type.count} ea</span>
                </div>
              )}
            </div>

            {summary.total_cost > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(summary.total_cost)}
                  </span>
                </div>
              </div>
            )}

            {/* Generate PO Button */}
            <Button
              className="w-full"
              onClick={onGeneratePO}
              disabled={isLoading || measurements.length === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Generate Purchase Order
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Layer Group Component
// =============================================================================

interface LayerGroupProps {
  layer: TakeoffLayer;
  measurements: TakeoffMeasurement[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedId: number | undefined;
  onSelect: (m: TakeoffMeasurement | null) => void;
  onDelete: (id: number) => void;
  onAssignPricebook: (id: number) => void;
  onRename: (id: number, name: string) => void;
}

function LayerGroup({
  layer,
  measurements,
  isExpanded,
  onToggle,
  selectedId,
  onSelect,
  onDelete,
  onAssignPricebook,
  onRename,
}: LayerGroupProps) {
  // Calculate layer totals
  const totals = React.useMemo(() => {
    const result = { area: 0, length: 0, perimeter: 0, count: 0 };
    measurements.forEach((m) => {
      const key = m.measurement_type as keyof typeof result;
      if (key in result) {
        result[key] += m.net_value;
      }
    });
    return result;
  }, [measurements]);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-md text-left">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: layer.color }}
          />
          <span className="font-medium flex-1 truncate">{layer.name}</span>
          <Badge variant="secondary" className="text-xs">
            {measurements.length}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-5 pl-2 border-l space-y-1">
          {measurements.map((m) => (
            <MeasurementItem
              key={m.id}
              measurement={m}
              isSelected={m.id === selectedId}
              onSelect={() => onSelect(m)}
              onDelete={() => onDelete(m.id)}
              onAssignPricebook={() => onAssignPricebook(m.id)}
              onRename={onRename}
            />
          ))}

          {/* Layer totals */}
          <div className="text-xs text-muted-foreground pt-1 flex gap-3">
            {Number(totals.area) > 0 && <span>{Number(totals.area).toFixed(2)} m²</span>}
            {Number(totals.length) > 0 && <span>{Number(totals.length).toFixed(2)} m</span>}
            {Number(totals.count) > 0 && <span>{Number(totals.count)} ea</span>}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// Measurement Item Component
// =============================================================================

interface MeasurementItemProps {
  measurement: TakeoffMeasurement;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAssignPricebook: () => void;
  onRename: (id: number, name: string) => void;
}

function MeasurementItem({
  measurement,
  isSelected,
  onSelect,
  onDelete,
  onAssignPricebook,
  onRename,
}: MeasurementItemProps) {
  const { measurement_type, formatted_net_value, display_label, pricebook_item, is_deduction, category } = measurement;
  const [isEditing, setIsEditing] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(category || "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const typeLabel = measurement_type === "count" ? "Count"
    : measurement_type === "area" ? "Area"
    : measurement_type === "length" ? "Lin"
    : measurement_type === "perimeter" ? "Per"
    : measurement_type;

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(category || "");
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleCommit = () => {
    setIsEditing(false);
    const trimmed = nameValue.trim();
    if (trimmed !== (category || "")) {
      onRename(measurement.id, trimmed);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center gap-2 p-2 rounded cursor-pointer text-sm
        ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}
        ${is_deduction ? "opacity-60" : ""}
      `}
    >
      {/* Type indicator + name */}
      <span className="text-xs text-muted-foreground shrink-0">
        {typeLabel}
      </span>

      {/* Editable name */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") setIsEditing(false);
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-xs bg-muted border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
          placeholder="Name..."
          autoFocus
        />
      ) : category ? (
        <span
          onDoubleClick={handleStartEdit}
          className="text-xs text-muted-foreground truncate max-w-[60px] cursor-text"
          title={`${category} (double-click to edit)`}
        >
          {category}
        </span>
      ) : (
        <span
          onDoubleClick={handleStartEdit}
          className="text-xs text-muted-foreground/40 cursor-text opacity-0 group-hover:opacity-100"
          title="Double-click to name"
        >
          name
        </span>
      )}

      {/* Value */}
      <span className="flex-1 font-medium text-right">
        {is_deduction && "−"}{formatted_net_value}
      </span>

      {/* Pricebook info or assign button */}
      <div className="flex items-center gap-1">
        {pricebook_item ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignPricebook();
            }}
            className="flex items-center gap-1 hover:bg-muted rounded px-1"
          >
            <Badge variant="outline" className="text-xs truncate max-w-[60px]">
              {pricebook_item.code}
            </Badge>
            {measurement.net_line_total != null && measurement.net_line_total > 0 && (
              <span className="text-xs text-muted-foreground">
                ${Number(measurement.net_line_total).toFixed(0)}
              </span>
            )}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onAssignPricebook();
            }}
            title="Assign pricebook item"
          >
            <Package className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Delete button — always visible when selected, hover-only otherwise */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 text-destructive hover:text-destructive",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete (or press Delete key)"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
