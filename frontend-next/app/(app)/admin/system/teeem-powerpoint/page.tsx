"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  Download,
  Upload,
  Presentation,
  ChevronLeft,
  MoreVertical,
  Plus,
  Trash2,
  Copy,
  Type,
  ImageIcon,
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  ArrowRight,
  Diamond,
  Table2,
  BarChart3,
  LineChart,
  PieChart,
  Briefcase,
  X,
  Search,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { useToast } from "@/components/ui/use-toast";
import {
  downloadPptx,
  importFromPptx,
  createEmptyPresentation,
  createSlideFromLayout,
  cloneSlide,
  reorderSlides,
  generateElementId,
} from "@/lib/teeem-powerpoint";
import type {
  PresentationData,
  Slide,
  SlideElement,
  SlideLayout,
  TextElement,
  ImageElement,
  ShapeElement,
  ShapeType,
  TableElement,
  TableRow,
  TableCell,
  ChartElement,
  ChartData,
  ChartType,
} from "@/lib/teeem-powerpoint";

// Types
interface TeeemPresentation {
  id: number;
  name: string;
  description?: string;
  data: PresentationData;
  jobId?: number;
  jobName?: string;
  updatedAt: string;
  createdAt: string;
}

interface Job {
  id: number;
  name: string;
}

// Slide canvas dimensions (16:9 aspect ratio in inches)
const CANVAS_WIDTH_INCHES = 10;
const CANVAS_HEIGHT_INCHES = 5.625;
const CANVAS_SCALE = 96; // pixels per inch for display

// Toolbar button component
function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-muted text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="h-6 w-px bg-border mx-1" />;
}

// Slide thumbnail component
function SlideThumbnail({
  slide,
  index,
  isSelected,
  onClick,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  slide: Slide;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-lg border-2 transition-all",
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-transparent hover:border-muted-foreground/30"
      )}
      onClick={onClick}
    >
      {/* Slide number */}
      <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {index + 1}
      </div>

      {/* Thumbnail preview */}
      <div
        className="bg-white dark:bg-gray-900 rounded overflow-hidden"
        style={{
          width: 160,
          height: 90,
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: CANVAS_WIDTH_INCHES * CANVAS_SCALE,
            height: CANVAS_HEIGHT_INCHES * CANVAS_SCALE,
            transform: `scale(${160 / (CANVAS_WIDTH_INCHES * CANVAS_SCALE)})`,
          }}
        >
          {/* Render elements at small scale */}
          {slide.elements.map((element) => (
            <ThumbnailElement key={element.id} element={element} />
          ))}
        </div>
      </div>

      {/* Actions overlay */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-background/80"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={!canMoveUp}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-background/80"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={!canMoveDown}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-background/80"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-background/80 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Thumbnail element renderer (simplified)
function ThumbnailElement({ element }: { element: SlideElement }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: element.x * CANVAS_SCALE,
    top: element.y * CANVAS_SCALE,
    width: element.w * CANVAS_SCALE,
    height: element.h * CANVAS_SCALE,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };

  if (element.type === "text") {
    const textEl = element as TextElement;
    return (
      <div
        style={{
          ...style,
          fontSize: (textEl.options?.fontSize || 18) * 0.5,
          fontWeight: textEl.options?.bold ? "bold" : "normal",
          fontStyle: textEl.options?.italic ? "italic" : "normal",
          color: textEl.options?.color ? `#${textEl.options.color}` : "#363636",
          overflow: "hidden",
        }}
      >
        {textEl.content}
      </div>
    );
  }

  if (element.type === "shape") {
    const shapeEl = element as ShapeElement;
    const fillColor = shapeEl.options?.fill?.color || "#CCCCCC";
    return (
      <div
        style={{
          ...style,
          backgroundColor: fillColor,
          borderRadius: shapeEl.shapeType === "ellipse" ? "50%" : shapeEl.shapeType === "roundRect" ? 8 : 0,
        }}
      />
    );
  }

  if (element.type === "image") {
    const imgEl = element as ImageElement;
    return (
      <img
        src={imgEl.src}
        alt=""
        style={{
          ...style,
          objectFit: "contain",
        }}
      />
    );
  }

  if (element.type === "table") {
    const tableEl = element as TableElement;
    return (
      <div
        style={{
          ...style,
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
        }}
      >
        <Table2 className="h-4 w-4 text-gray-500" />
      </div>
    );
  }

  if (element.type === "chart") {
    const chartEl = element as ChartElement;
    return (
      <div
        style={{
          ...style,
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
        }}
      >
        <BarChart3 className="h-4 w-4 text-gray-500" />
      </div>
    );
  }

  return null;
}

// Canvas element renderer
function CanvasElement({
  element,
  isSelected,
  onClick,
  onUpdate,
  onDoubleClick,
}: {
  element: SlideElement;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<SlideElement>) => void;
  onDoubleClick?: () => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = React.useState({ x: 0, y: 0, w: 0, h: 0 });

  const style: React.CSSProperties = {
    position: "absolute",
    left: element.x * CANVAS_SCALE,
    top: element.y * CANVAS_SCALE,
    width: element.w * CANVAS_SCALE,
    height: element.h * CANVAS_SCALE,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onClick(e);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, w: element.w, h: element.h });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, w: element.w, h: element.h });
  };

  React.useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.x) / CANVAS_SCALE;
      const dy = (e.clientY - dragStart.y) / CANVAS_SCALE;

      if (isDragging) {
        onUpdate({
          x: Math.max(0, Math.min(CANVAS_WIDTH_INCHES - element.w, elementStart.x + dx)),
          y: Math.max(0, Math.min(CANVAS_HEIGHT_INCHES - element.h, elementStart.y + dy)),
        });
      } else if (isResizing) {
        onUpdate({
          w: Math.max(0.5, elementStart.w + dx),
          h: Math.max(0.5, elementStart.h + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, elementStart, element.w, element.h, onUpdate]);

  const renderContent = () => {
    if (element.type === "text") {
      const textEl = element as TextElement;
      return (
        <div
          className="w-full h-full p-2 overflow-hidden"
          style={{
            fontSize: textEl.options?.fontSize || 18,
            fontWeight: textEl.options?.bold ? "bold" : "normal",
            fontStyle: textEl.options?.italic ? "italic" : "normal",
            textDecoration: textEl.options?.underline ? "underline" : textEl.options?.strike ? "line-through" : "none",
            color: textEl.options?.color ? `#${textEl.options.color}` : "#363636",
            textAlign: textEl.options?.align || "left",
            display: "flex",
            alignItems: textEl.options?.valign === "middle" ? "center" : textEl.options?.valign === "bottom" ? "flex-end" : "flex-start",
          }}
        >
          {textEl.content || "Double-click to edit"}
        </div>
      );
    }

    if (element.type === "shape") {
      const shapeEl = element as ShapeElement;
      const fillColor = shapeEl.options?.fill?.color || "#CCCCCC";
      const borderRadius = shapeEl.shapeType === "ellipse" ? "50%" : shapeEl.shapeType === "roundRect" ? 8 : 0;
      return (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: fillColor,
            borderRadius,
            border: shapeEl.options?.line ? `${shapeEl.options.line.width || 1}px solid ${shapeEl.options.line.color}` : undefined,
          }}
        />
      );
    }

    if (element.type === "image") {
      const imgEl = element as ImageElement;
      return (
        <img
          src={imgEl.src}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
        />
      );
    }

    if (element.type === "table") {
      const tableEl = element as TableElement;
      const rows = tableEl.rows || [];
      return (
        <div className="w-full h-full overflow-hidden p-1">
          <table className="w-full h-full border-collapse text-xs">
            <tbody>
              {rows.slice(0, 6).map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.cells.slice(0, 6).map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border border-gray-300 dark:border-gray-600 p-1 truncate"
                      style={{
                        backgroundColor: cell.options?.fill?.color || (rowIdx === 0 ? "#e5e7eb" : "transparent"),
                        color: cell.options?.color || "#363636",
                        fontWeight: cell.options?.bold || rowIdx === 0 ? "bold" : "normal",
                        textAlign: cell.options?.align || "left",
                      }}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (element.type === "chart") {
      const chartEl = element as ChartElement;
      const chartIcon = chartEl.chartType === "pie" || chartEl.chartType === "doughnut"
        ? <PieChart className="h-8 w-8" />
        : chartEl.chartType === "line" || chartEl.chartType === "area"
        ? <LineChart className="h-8 w-8" />
        : <BarChart3 className="h-8 w-8" />;

      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex flex-col items-center justify-center text-sm rounded">
          <div className="text-blue-600 dark:text-blue-400 mb-2">
            {chartIcon}
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {chartEl.options?.title || `${chartEl.chartType.charAt(0).toUpperCase() + chartEl.chartType.slice(1)} Chart`}
          </div>
          {chartEl.data.length > 0 && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              {chartEl.data.length} series · {chartEl.data[0]?.values?.length || 0} points
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={style}
      className={cn(
        "border-2 transition-colors",
        isSelected ? "border-blue-500" : "border-transparent hover:border-blue-300"
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {renderContent()}

      {/* Resize handle */}
      {isSelected && (
        <div
          className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize rounded-sm"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}

// Text editor dialog
function TextEditorDialog({
  element,
  onSave,
  onClose,
}: {
  element: TextElement;
  onSave: (content: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = React.useState(element.content);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl p-4 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4">Edit Text</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(content)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// Table editor dialog
function TableEditorDialog({
  element,
  onSave,
  onClose,
}: {
  element: TableElement | null;
  onSave: (rows: TableRow[]) => void;
  onClose: () => void;
}) {
  const [numRows, setNumRows] = React.useState(element?.rows?.length || 3);
  const [numCols, setNumCols] = React.useState(element?.rows?.[0]?.cells?.length || 3);
  const [tableData, setTableData] = React.useState<string[][]>(() => {
    if (element?.rows) {
      return element.rows.map(row => row.cells.map(cell => cell.text));
    }
    return Array(3).fill(null).map(() => Array(3).fill(""));
  });

  // Update grid size
  const handleSizeChange = (newRows: number, newCols: number) => {
    const newData = Array(newRows).fill(null).map((_, rowIdx) =>
      Array(newCols).fill(null).map((_, colIdx) =>
        tableData[rowIdx]?.[colIdx] || ""
      )
    );
    setNumRows(newRows);
    setNumCols(newCols);
    setTableData(newData);
  };

  // Update cell value
  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const newData = [...tableData];
    newData[rowIdx] = [...newData[rowIdx]];
    newData[rowIdx][colIdx] = value;
    setTableData(newData);
  };

  // Convert to TableRow format and save
  const handleSave = () => {
    const rows: TableRow[] = tableData.map((row, rowIdx) => ({
      cells: row.map((text, colIdx) => ({
        text,
        options: rowIdx === 0 ? { bold: true, fill: { color: "#E5E7EB" } } : undefined,
      })),
    }));
    onSave(rows);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl p-4 w-[600px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4">
          {element ? "Edit Table" : "Insert Table"}
        </h3>

        {/* Size controls */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Rows:</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={numRows}
              onChange={(e) => handleSizeChange(parseInt(e.target.value) || 1, numCols)}
              className="w-20 h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Columns:</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={numCols}
              onChange={(e) => handleSizeChange(numRows, parseInt(e.target.value) || 1)}
              className="w-20 h-8"
            />
          </div>
        </div>

        {/* Table grid */}
        <div className="border rounded overflow-auto max-h-[400px]">
          <table className="w-full border-collapse">
            <tbody>
              {tableData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, colIdx) => (
                    <td key={colIdx} className="border border-gray-300 p-0">
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                        placeholder={rowIdx === 0 ? `Header ${colIdx + 1}` : ""}
                        className={cn(
                          "w-full h-8 px-2 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
                          rowIdx === 0 && "bg-gray-100 font-medium"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {element ? "Update Table" : "Insert Table"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Chart editor dialog
function ChartEditorDialog({
  element,
  onSave,
  onClose,
}: {
  element: ChartElement | null;
  onSave: (chartType: ChartType, data: ChartData[], title: string) => void;
  onClose: () => void;
}) {
  const [chartType, setChartType] = React.useState<ChartType>(element?.chartType || "bar");
  const [title, setTitle] = React.useState(element?.options?.title || "");
  const [seriesData, setSeriesData] = React.useState<{ name: string; labels: string; values: string }[]>(() => {
    if (element?.data?.length) {
      return element.data.map(d => ({
        name: d.name,
        labels: d.labels.join(", "),
        values: d.values.join(", "),
      }));
    }
    return [
      { name: "Series 1", labels: "Jan, Feb, Mar, Apr", values: "10, 20, 15, 25" },
    ];
  });

  const chartTypes: { value: ChartType; label: string; icon: React.ReactNode }[] = [
    { value: "bar", label: "Bar Chart", icon: <BarChart3 className="h-4 w-4" /> },
    { value: "line", label: "Line Chart", icon: <LineChart className="h-4 w-4" /> },
    { value: "pie", label: "Pie Chart", icon: <PieChart className="h-4 w-4" /> },
    { value: "doughnut", label: "Doughnut", icon: <PieChart className="h-4 w-4" /> },
    { value: "area", label: "Area Chart", icon: <LineChart className="h-4 w-4" /> },
  ];

  const addSeries = () => {
    setSeriesData([
      ...seriesData,
      { name: `Series ${seriesData.length + 1}`, labels: "Jan, Feb, Mar, Apr", values: "10, 20, 15, 25" },
    ]);
  };

  const removeSeries = (index: number) => {
    if (seriesData.length > 1) {
      setSeriesData(seriesData.filter((_, i) => i !== index));
    }
  };

  const updateSeries = (index: number, field: keyof typeof seriesData[0], value: string) => {
    const newData = [...seriesData];
    newData[index] = { ...newData[index], [field]: value };
    setSeriesData(newData);
  };

  const handleSave = () => {
    const data: ChartData[] = seriesData.map(s => ({
      name: s.name,
      labels: s.labels.split(",").map(l => l.trim()).filter(Boolean),
      values: s.values.split(",").map(v => parseFloat(v.trim()) || 0),
    }));
    onSave(chartType, data, title);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl p-4 w-[600px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4">
          {element ? "Edit Chart" : "Insert Chart"}
        </h3>

        {/* Chart type selector */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Chart Type</label>
          <div className="flex gap-2 flex-wrap">
            {chartTypes.map((ct) => (
              <Button
                key={ct.value}
                variant={chartType === ct.value ? "default" : "outline"}
                size="sm"
                onClick={() => setChartType(ct.value)}
                className="gap-2"
              >
                {ct.icon}
                {ct.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Chart title */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Chart Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter chart title..."
            className="h-9"
          />
        </div>

        {/* Data series */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Data Series</label>
            <Button variant="outline" size="sm" onClick={addSeries}>
              <Plus className="h-3 w-3 mr-1" />
              Add Series
            </Button>
          </div>

          <div className="space-y-3">
            {seriesData.map((series, idx) => (
              <div key={idx} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={series.name}
                    onChange={(e) => updateSeries(idx, "name", e.target.value)}
                    placeholder="Series name"
                    className="h-8 w-40"
                  />
                  {seriesData.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSeries(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Labels (comma-separated)</label>
                  <Input
                    value={series.labels}
                    onChange={(e) => updateSeries(idx, "labels", e.target.value)}
                    placeholder="Jan, Feb, Mar, Apr"
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Values (comma-separated numbers)</label>
                  <Input
                    value={series.values}
                    onChange={(e) => updateSeries(idx, "values", e.target.value)}
                    placeholder="10, 20, 15, 25"
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {element ? "Update Chart" : "Insert Chart"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TeeemPowerPointPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("id");
  const { setMode } = useLayoutMode();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Enable fullscreen mode (hide sidebar/breadcrumbs)
  React.useEffect(() => {
    setMode("fullscreen");
    return () => setMode("padded");
  }, [setMode]);

  // State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [presentation, setPresentation] = React.useState<TeeemPresentation | null>(null);
  const [name, setName] = React.useState("Untitled Presentation");
  const [hasChanges, setHasChanges] = React.useState(false);
  const [data, setData] = React.useState<PresentationData>(() => createEmptyPresentation());
  const [selectedSlideIndex, setSelectedSlideIndex] = React.useState(0);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [editingTextElement, setEditingTextElement] = React.useState<TextElement | null>(null);
  const [editingTableElement, setEditingTableElement] = React.useState<TableElement | null>(null);
  const [showTableDialog, setShowTableDialog] = React.useState(false);
  const [editingChartElement, setEditingChartElement] = React.useState<ChartElement | null>(null);
  const [showChartDialog, setShowChartDialog] = React.useState(false);

  // Job association state
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [selectedJobName, setSelectedJobName] = React.useState<string | null>(null);
  const [jobSearchOpen, setJobSearchOpen] = React.useState(false);
  const [jobSearchTerm, setJobSearchTerm] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  // Current slide
  const currentSlide = data.slides[selectedSlideIndex];

  // Search jobs for the job picker
  const searchJobs = React.useCallback(async (term: string) => {
    setLoadingJobs(true);
    try {
      const url = term.trim()
        ? `/api/v1/jobs/for_select?q=${encodeURIComponent(term)}`
        : `/api/v1/jobs/for_select`;
      const response = await api.get<{ success: boolean; jobs: Job[] }>(url);
      if (response?.success && response.jobs) {
        setJobs(response.jobs.slice(0, 20));
      }
    } catch (error) {
      console.error("Failed to search jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load jobs when popover opens
  React.useEffect(() => {
    if (!jobSearchOpen) return;
    if (jobSearchTerm === "") {
      searchJobs("");
      return;
    }
    const timeout = setTimeout(() => {
      searchJobs(jobSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearchTerm, jobSearchOpen, searchJobs]);

  // Load presentation or create new
  React.useEffect(() => {
    const loadOrCreate = async () => {
      setLoading(true);
      try {
        if (presentationId) {
          const response = await api.get<{ success: boolean; data: TeeemPresentation }>(
            `/api/v1/teeem_presentations/${presentationId}`
          );
          if (response?.success && response.data) {
            setPresentation(response.data);
            setName(response.data.name);
            setSelectedJobId(response.data.jobId || null);
            setSelectedJobName(response.data.jobName || null);
            if (response.data.data) {
              setData(response.data.data);
            }
          }
        } else {
          const response = await api.post<{ success: boolean; data: TeeemPresentation }>(
            "/api/v1/teeem_presentations",
            { teeem_presentation: { name: "Untitled Presentation" } }
          );
          if (response?.success && response.data) {
            setPresentation(response.data);
            setName(response.data.name);
            if (response.data.data) {
              setData(response.data.data);
            }
            router.replace(`/admin/system/teeem-powerpoint?id=${response.data.id}`);
          }
        }
      } catch (error) {
        console.error("Failed to load/create presentation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrCreate();
  }, [presentationId, router]);

  // Auto-save on changes (debounced)
  React.useEffect(() => {
    if (!hasChanges || !presentation) return;

    const timeout = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch(`/api/v1/teeem_presentations/${presentation.id}`, {
          teeem_presentation: {
            name,
            job_id: selectedJobId,
            data,
          },
        });
        setHasChanges(false);
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [hasChanges, presentation, name, selectedJobId, data]);

  // Save immediately
  const handleSave = async () => {
    if (!presentation) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/teeem_presentations/${presentation.id}`, {
        teeem_presentation: {
          name,
          job_id: selectedJobId,
          data,
        },
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Update data helper
  const updateData = (updates: Partial<PresentationData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Update current slide
  const updateCurrentSlide = (updates: Partial<Slide>) => {
    setData((prev) => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === selectedSlideIndex ? { ...s, ...updates } : s
      ),
    }));
    setHasChanges(true);
  };

  // Update element in current slide
  const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
    setData((prev) => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === selectedSlideIndex
          ? {
              ...s,
              elements: s.elements.map((el) =>
                el.id === elementId ? ({ ...el, ...updates } as SlideElement) : el
              ),
            }
          : s
      ),
    }));
    setHasChanges(true);
  };

  // Add slide
  const addSlide = (layout: SlideLayout = "titleAndContent") => {
    const newSlide = createSlideFromLayout(layout, data.slides.length + 1);
    updateData({ slides: [...data.slides, newSlide] });
    setSelectedSlideIndex(data.slides.length);
    setSelectedElementId(null);
  };

  // Delete slide
  const deleteSlide = (index: number) => {
    if (data.slides.length <= 1) {
      toast({
        title: "Cannot delete",
        description: "Presentation must have at least one slide",
        variant: "destructive",
      });
      return;
    }
    const newSlides = data.slides.filter((_, i) => i !== index);
    updateData({ slides: newSlides });
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }
    setSelectedElementId(null);
  };

  // Duplicate slide
  const duplicateSlide = (index: number) => {
    const newSlide = cloneSlide(data.slides[index], `slide-${Date.now()}`);
    const newSlides = [...data.slides];
    newSlides.splice(index + 1, 0, newSlide);
    updateData({ slides: newSlides });
    setSelectedSlideIndex(index + 1);
  };

  // Move slide
  const moveSlide = (fromIndex: number, toIndex: number) => {
    const newSlides = reorderSlides(data.slides, fromIndex, toIndex);
    updateData({ slides: newSlides });
    setSelectedSlideIndex(toIndex);
  };

  // Add text element
  const addTextElement = () => {
    const newElement: TextElement = {
      id: generateElementId("text", currentSlide.id),
      type: "text",
      content: "Double-click to edit",
      x: 1,
      y: 1,
      w: 4,
      h: 1,
      options: {
        fontSize: 24,
        fontFace: "Arial",
        color: "363636",
      },
    };
    updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
    setSelectedElementId(newElement.id);
  };

  // Add shape element
  const addShapeElement = (shapeType: ShapeType) => {
    const newElement: ShapeElement = {
      id: generateElementId("shape", currentSlide.id),
      type: "shape",
      shapeType,
      x: 2,
      y: 2,
      w: 2,
      h: 2,
      options: {
        fill: { color: "#4A90D9" },
      },
    };
    updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
    setSelectedElementId(newElement.id);
  };

  // Add image element
  const addImageElement = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const newElement: ImageElement = {
          id: generateElementId("image", currentSlide.id),
          type: "image",
          src: reader.result as string,
          x: 2,
          y: 1.5,
          w: 4,
          h: 3,
        };
        updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
        setSelectedElementId(newElement.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Add table element
  const addTableElement = (rows: TableRow[]) => {
    const newElement: TableElement = {
      id: generateElementId("table", currentSlide.id),
      type: "table",
      rows,
      x: 1,
      y: 1.5,
      w: 6,
      h: 2,
    };
    updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
    setSelectedElementId(newElement.id);
    setShowTableDialog(false);
    setEditingTableElement(null);
  };

  // Add chart element
  const addChartElement = (chartType: ChartType, chartData: ChartData[], title: string) => {
    const newElement: ChartElement = {
      id: generateElementId("chart", currentSlide.id),
      type: "chart",
      chartType,
      data: chartData,
      x: 1,
      y: 1.5,
      w: 6,
      h: 3.5,
      options: {
        showLegend: true,
        showTitle: !!title,
        title,
      },
    };
    updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
    setSelectedElementId(newElement.id);
    setShowChartDialog(false);
    setEditingChartElement(null);
  };

  // Handle table save (update existing or create new)
  const handleTableSave = (rows: TableRow[]) => {
    if (editingTableElement) {
      // Update existing table
      updateElement(editingTableElement.id, { rows });
      setEditingTableElement(null);
      setShowTableDialog(false);
    } else {
      // Create new table
      addTableElement(rows);
    }
  };

  // Handle chart save (update existing or create new)
  const handleChartSave = (chartType: ChartType, chartData: ChartData[], title: string) => {
    if (editingChartElement) {
      // Update existing chart
      updateElement(editingChartElement.id, {
        chartType,
        data: chartData,
        options: {
          ...editingChartElement.options,
          showTitle: !!title,
          title,
        },
      });
      setEditingChartElement(null);
      setShowChartDialog(false);
    } else {
      // Create new chart
      addChartElement(chartType, chartData, title);
    }
  };

  // Delete selected element
  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    updateCurrentSlide({
      elements: currentSlide.elements.filter((el) => el.id !== selectedElementId),
    });
    setSelectedElementId(null);
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault();
          deleteSelectedElement();
        }
      }
      if (e.key === "Escape") {
        setSelectedElementId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (selectedElementId) {
          // Duplicate element
          const element = currentSlide.elements.find((el) => el.id === selectedElementId);
          if (element) {
            const newElement = {
              ...JSON.parse(JSON.stringify(element)),
              id: generateElementId(element.type, currentSlide.id),
              x: element.x + 0.2,
              y: element.y + 0.2,
            };
            updateCurrentSlide({ elements: [...currentSlide.elements, newElement] });
            setSelectedElementId(newElement.id);
          }
        } else {
          duplicateSlide(selectedSlideIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, currentSlide, editingTextElement]);

  // Import PPTX file
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pptx")) {
      toast({
        title: "Invalid file type",
        description: "Please select a .pptx file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const importedData = await importFromPptx(file);
      setData(importedData);
      setSelectedSlideIndex(0);
      setSelectedElementId(null);
      setHasChanges(true);

      const fileName = file.name.replace(/\.pptx$/i, "");
      setName(fileName);

      toast({
        title: "Presentation imported",
        description: `Imported ${importedData.slides.length} slides`,
      });
    } catch (error) {
      console.error("Failed to import:", error);
      toast({
        title: "Import failed",
        description: "Failed to import the presentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Export to PPTX
  const handleExport = async () => {
    setExporting(true);
    try {
      const filename = name.replace(/[^a-z0-9]/gi, "_") + ".pptx";
      await downloadPptx(data, filename);

      toast({
        title: "Presentation exported",
        description: "Your presentation has been downloaded",
      });
    } catch (error) {
      console.error("Failed to export:", error);
      toast({
        title: "Export failed",
        description: "Failed to export the presentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Handle text save
  const handleTextSave = (content: string) => {
    if (editingTextElement) {
      updateElement(editingTextElement.id, { content });
      setEditingTextElement(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/system/teeem-powerpoint/list")}
            title="Back to presentations"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="h-8 w-8 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Presentation className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>

          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            className="w-64 h-8 text-sm font-medium bg-transparent border-0 hover:bg-muted/50 focus:bg-background"
            placeholder="Presentation name"
          />

          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Spinner size={12} />
              Saving...
            </span>
          )}
          {!saving && hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          {!saving && !hasChanges && presentation && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Job association */}
          <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                {selectedJobName || "Attach to Job"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={jobSearchTerm}
                    onChange={(e) => setJobSearchTerm(e.target.value)}
                    placeholder="Search jobs..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingJobs ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size={16} />
                    </div>
                  ) : jobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No jobs found
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {selectedJobId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 text-xs text-destructive"
                          onClick={() => {
                            setSelectedJobId(null);
                            setSelectedJobName(null);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-2" />
                          Remove job
                        </Button>
                      )}
                      {jobs.map((job) => (
                        <Button
                          key={job.id}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start h-8 text-xs",
                            selectedJobId === job.id && "bg-muted"
                          )}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setSelectedJobName(job.name);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          {job.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="h-8" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-2" />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Spinner size={14} className="mr-2" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-2" />
            )}
            Import
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pptx"
            onChange={handleImport}
            className="hidden"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <Spinner size={14} className="mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export as PowerPoint (.pptx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card/50">
        {/* Add slide */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              <span className="text-xs">New Slide</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => addSlide("title")}>
              Title Slide
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addSlide("titleAndContent")}>
              Title and Content
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addSlide("twoColumn")}>
              Two Column
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addSlide("sectionHeader")}>
              Section Header
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addSlide("blank")}>
              Blank
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarSeparator />

        {/* Insert text */}
        <ToolbarButton onClick={addTextElement} title="Add text box">
          <Type className="h-4 w-4" />
        </ToolbarButton>

        {/* Insert image */}
        <ToolbarButton onClick={addImageElement} title="Add image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Insert shapes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <Square className="h-4 w-4" />
              <span className="text-xs">Shape</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => addShapeElement("rect")}>
              <Square className="h-4 w-4 mr-2" />
              Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("roundRect")}>
              <Square className="h-4 w-4 mr-2 rounded" />
              Rounded Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("ellipse")}>
              <Circle className="h-4 w-4 mr-2" />
              Ellipse
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("triangle")}>
              <Triangle className="h-4 w-4 mr-2" />
              Triangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("diamond")}>
              <Diamond className="h-4 w-4 mr-2" />
              Diamond
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("star5")}>
              <Star className="h-4 w-4 mr-2" />
              Star
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addShapeElement("line")}>
              <Minus className="h-4 w-4 mr-2" />
              Line
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addShapeElement("arrow")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Arrow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Insert table */}
        <ToolbarButton
          onClick={() => setShowTableDialog(true)}
          title="Add table"
        >
          <Table2 className="h-4 w-4" />
        </ToolbarButton>

        {/* Insert chart */}
        <ToolbarButton
          onClick={() => setShowChartDialog(true)}
          title="Add chart"
        >
          <BarChart3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Delete selected */}
        {selectedElementId && (
          <ToolbarButton onClick={deleteSelectedElement} title="Delete selected (Del)">
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide sidebar */}
        <div className="w-52 border-r bg-muted/30 overflow-y-auto p-4 pl-8 space-y-3">
          {data.slides.map((slide, index) => (
            <SlideThumbnail
              key={slide.id}
              slide={slide}
              index={index}
              isSelected={index === selectedSlideIndex}
              onClick={() => {
                setSelectedSlideIndex(index);
                setSelectedElementId(null);
              }}
              onDelete={() => deleteSlide(index)}
              onDuplicate={() => duplicateSlide(index)}
              onMoveUp={() => moveSlide(index, index - 1)}
              onMoveDown={() => moveSlide(index, index + 1)}
              canMoveUp={index > 0}
              canMoveDown={index < data.slides.length - 1}
            />
          ))}

          {/* Add slide button */}
          <Button
            variant="outline"
            className="w-full h-[90px] border-dashed"
            onClick={() => addSlide("titleAndContent")}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900/50 flex items-center justify-center p-8">
          <div
            className="bg-white dark:bg-gray-950 shadow-xl rounded relative"
            style={{
              width: CANVAS_WIDTH_INCHES * CANVAS_SCALE,
              height: CANVAS_HEIGHT_INCHES * CANVAS_SCALE,
              backgroundColor: currentSlide.background?.color || "#FFFFFF",
            }}
            onClick={() => setSelectedElementId(null)}
          >
            {/* Render elements */}
            {currentSlide.elements.map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={element.id === selectedElementId}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElementId(element.id);
                }}
                onUpdate={(updates) => updateElement(element.id, updates)}
                onDoubleClick={() => {
                  if (element.type === "text") {
                    setEditingTextElement(element as TextElement);
                  } else if (element.type === "table") {
                    setEditingTableElement(element as TableElement);
                    setShowTableDialog(true);
                  } else if (element.type === "chart") {
                    setEditingChartElement(element as ChartElement);
                    setShowChartDialog(true);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Text editor dialog */}
      {editingTextElement && (
        <TextEditorDialog
          element={editingTextElement}
          onSave={handleTextSave}
          onClose={() => setEditingTextElement(null)}
        />
      )}

      {/* Table editor dialog */}
      {showTableDialog && (
        <TableEditorDialog
          element={editingTableElement}
          onSave={handleTableSave}
          onClose={() => {
            setShowTableDialog(false);
            setEditingTableElement(null);
          }}
        />
      )}

      {/* Chart editor dialog */}
      {showChartDialog && (
        <ChartEditorDialog
          element={editingChartElement}
          onSave={handleChartSave}
          onClose={() => {
            setShowChartDialog(false);
            setEditingChartElement(null);
          }}
        />
      )}
    </div>
  );
}
