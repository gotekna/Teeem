"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  MousePointer2,
  Pencil,
  Type,
  Highlighter,
  Square,
  Circle,
  ArrowRight,
  Stamp,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Save,
  FilePlus2,
  PenLine,
  AtSign,
  Calendar,
  TextCursor,
} from "lucide-react";
import type { AnnotationTool, ToolbarProps, Signer } from "./types";
import { cn } from "@/lib/utils";

const TOOLS: { tool: AnnotationTool; icon: React.ReactNode; label: string }[] = [
  { tool: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select" },
  { tool: "draw", icon: <Pencil className="h-4 w-4" />, label: "Draw" },
  { tool: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
  { tool: "highlight", icon: <Highlighter className="h-4 w-4" />, label: "Highlight" },
  { tool: "rectangle", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
  { tool: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
  { tool: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
  { tool: "stamp", icon: <Stamp className="h-4 w-4" />, label: "Stamp" },
  { tool: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser" },
];

// E-signature field tools (shown when esignMode is true)
const SIGNATURE_FIELD_TOOLS: { tool: AnnotationTool; icon: React.ReactNode; label: string }[] = [
  { tool: "signature_field", icon: <PenLine className="h-4 w-4" />, label: "Signature" },
  { tool: "initials_field", icon: <AtSign className="h-4 w-4" />, label: "Initials" },
  { tool: "date_field", icon: <Calendar className="h-4 w-4" />, label: "Date" },
  { tool: "text_field", icon: <TextCursor className="h-4 w-4" />, label: "Text Input" },
];

const COLORS = [
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FF6600", // Orange
  "#9900FF", // Purple
  "#FFFFFF", // White
];

const ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200];

export function EditorToolbar({
  currentTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onSave,
  onMerge,
  isSaving,
  esignMode = false,
  selectedSigner,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-background flex-wrap">
      {/* E-signature field tools (when in esign mode) */}
      {esignMode && (
        <>
          <div className="flex items-center gap-0.5">
            {SIGNATURE_FIELD_TOOLS.map(({ tool, icon, label }) => (
              <Button
                key={tool}
                variant={currentTool === tool ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onToolChange(tool)}
                title={`Add ${label} field`}
                disabled={!selectedSigner}
                style={
                  currentTool === tool && selectedSigner
                    ? { backgroundColor: selectedSigner.color, borderColor: selectedSigner.color }
                    : undefined
                }
              >
                {icon}
              </Button>
            ))}
          </div>
          {selectedSigner && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
              style={{ backgroundColor: selectedSigner.color }}
            >
              <span className="font-medium">{selectedSigner.name || selectedSigner.email}</span>
            </div>
          )}
          {!selectedSigner && (
            <span className="text-xs text-muted-foreground">Select a signer to add fields</span>
          )}
          <Separator orientation="vertical" className="h-6 mx-1" />
        </>
      )}

      {/* Regular annotation tools */}
      <div className="flex items-center gap-0.5">
        {TOOLS.map(({ tool, icon, label }) => (
          <Button
            key={tool}
            variant={currentTool === tool ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onToolChange(tool)}
            title={label}
          >
            {icon}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Color">
            <div
              className="h-4 w-4 rounded border"
              style={{ backgroundColor: strokeColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "h-6 w-6 rounded border-2 transition-all",
                  strokeColor === color
                    ? "border-primary scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
                onClick={() => onStrokeColorChange(color)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Stroke width */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Stroke Width">
            {strokeWidth}px
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Stroke Width: {strokeWidth}px</p>
            <Slider
              value={[strokeWidth]}
              onValueChange={([value]) => onStrokeWidthChange(value)}
              min={1}
              max={20}
              step={1}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Zoom controls */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onZoomChange(Math.max(25, zoom - 25))}
        disabled={zoom <= 25}
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Select
        value={String(zoom)}
        onValueChange={(value) => onZoomChange(Number(value))}
      >
        <SelectTrigger className="h-8 w-20 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ZOOM_OPTIONS.map((z) => (
            <SelectItem key={z} value={String(z)}>
              {z}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onZoomChange(Math.min(200, zoom + 25))}
        disabled={zoom >= 200}
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      {/* Actions */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onMerge}
        title="Merge another PDF"
      >
        <FilePlus2 className="h-4 w-4 mr-1" />
        Merge
      </Button>
      <Button
        variant="default"
        size="sm"
        className="h-8 text-xs"
        onClick={onSave}
        disabled={isSaving}
        title="Save PDF"
      >
        {isSaving ? (
          <>Saving...</>
        ) : (
          <>
            <Save className="h-4 w-4 mr-1" />
            Save
          </>
        )}
      </Button>
    </div>
  );
}
