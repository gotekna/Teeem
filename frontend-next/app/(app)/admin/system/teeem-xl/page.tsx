"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  ChevronLeft,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Grid configuration
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26; // A-Z
const CELL_WIDTH = 100;
const CELL_HEIGHT = 28;
const ROW_HEADER_WIDTH = 50;

// Types
interface CellData {
  value: string | number | boolean | null;
  type?: "string" | "number" | "boolean" | "formula";
  formula?: string;
}

interface SheetData {
  name: string;
  cells: Record<string, CellData>;
}

interface SpreadsheetData {
  sheets: SheetData[];
  activeSheet: number;
  columnWidths: Record<string, number>;
  frozenRows: number;
  frozenCols: number;
}

interface Spreadsheet {
  id: number;
  name: string;
  data: SpreadsheetData;
  updatedAt: string;
  createdAt: string;
}

// Column letter helper
function getColumnLetter(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

// Cell reference helper
function getCellRef(row: number, col: number): string {
  return `${getColumnLetter(col)}${row + 1}`;
}

export default function TeeemXLPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spreadsheetId = searchParams.get("id");

  // State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [spreadsheet, setSpreadsheet] = React.useState<Spreadsheet | null>(null);
  const [name, setName] = React.useState("Untitled Spreadsheet");
  const [sheets, setSheets] = React.useState<SheetData[]>([{ name: "Sheet1", cells: {} }]);
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [hasChanges, setHasChanges] = React.useState(false);

  const gridRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load spreadsheet or create new
  React.useEffect(() => {
    const loadOrCreate = async () => {
      setLoading(true);
      try {
        if (spreadsheetId) {
          // Load existing
          const response = await api.get<{ success: boolean; data: Spreadsheet }>(
            `/api/v1/teeem_spreadsheets/${spreadsheetId}`
          );
          if (response?.success && response.data) {
            setSpreadsheet(response.data);
            setName(response.data.name);
            setSheets(response.data.data.sheets || [{ name: "Sheet1", cells: {} }]);
            setActiveSheetIndex(response.data.data.activeSheet || 0);
          }
        } else {
          // Create new spreadsheet
          const response = await api.post<{ success: boolean; data: Spreadsheet }>(
            "/api/v1/teeem_spreadsheets",
            { teeem_spreadsheet: { name: "Untitled Spreadsheet" } }
          );
          if (response?.success && response.data) {
            setSpreadsheet(response.data);
            setName(response.data.name);
            setSheets(response.data.data.sheets || [{ name: "Sheet1", cells: {} }]);
            // Update URL with new ID
            router.replace(`/admin/system/teeem-xl?id=${response.data.id}`);
          }
        }
      } catch (error) {
        console.error("Failed to load/create spreadsheet:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrCreate();
  }, [spreadsheetId, router]);

  // Auto-save on changes (debounced)
  React.useEffect(() => {
    if (!hasChanges || !spreadsheet) return;

    const timeout = setTimeout(async () => {
      await saveSpreadsheet();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [hasChanges, sheets, name]);

  // Save spreadsheet
  const saveSpreadsheet = async () => {
    if (!spreadsheet) return;

    setSaving(true);
    try {
      const data: SpreadsheetData = {
        sheets,
        activeSheet: activeSheetIndex,
        columnWidths: {},
        frozenRows: 0,
        frozenCols: 0,
      };

      await api.patch(`/api/v1/teeem_spreadsheets/${spreadsheet.id}`, {
        teeem_spreadsheet: { name, data },
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Export to XLSX
  const handleExport = async () => {
    if (!spreadsheet) return;

    try {
      const TeeemXL = await import("@/lib/teeem-xl");
      const activeSheet = sheets[activeSheetIndex];

      // Convert cells to 2D array
      const rows: (string | number | boolean | null)[][] = [];
      let maxRow = 0;
      let maxCol = 0;

      Object.entries(activeSheet.cells).forEach(([ref, cell]) => {
        const match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          const col = TeeemXL.columnToIndex(match[1]);
          const row = parseInt(match[2], 10) - 1;
          maxRow = Math.max(maxRow, row);
          maxCol = Math.max(maxCol, col);
        }
      });

      // Build array
      for (let r = 0; r <= maxRow; r++) {
        const row: (string | number | boolean | null)[] = [];
        for (let c = 0; c <= maxCol; c++) {
          const ref = getCellRef(r, c);
          const cell = activeSheet.cells[ref];
          row.push(cell?.value ?? null);
        }
        rows.push(row);
      }

      const blob = await TeeemXL.write(rows, {
        sheetName: activeSheet.name,
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  // Cell handlers
  const handleCellClick = (ref: string) => {
    setSelectedCell(ref);
    setEditingCell(null);
  };

  const handleCellDoubleClick = (ref: string) => {
    setSelectedCell(ref);
    setEditingCell(ref);
    const cell = sheets[activeSheetIndex].cells[ref];
    setEditValue(cell?.value?.toString() || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCellChange = (value: string) => {
    setEditValue(value);
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const newSheets = [...sheets];
      const activeSheet = { ...newSheets[activeSheetIndex] };
      activeSheet.cells = { ...activeSheet.cells };

      if (editValue.trim() === "") {
        delete activeSheet.cells[editingCell];
      } else {
        // Detect type
        let cellValue: string | number | boolean = editValue;
        let cellType: "string" | "number" | "boolean" = "string";

        if (!isNaN(Number(editValue)) && editValue.trim() !== "") {
          cellValue = Number(editValue);
          cellType = "number";
        } else if (editValue.toLowerCase() === "true" || editValue.toLowerCase() === "false") {
          cellValue = editValue.toLowerCase() === "true";
          cellType = "boolean";
        }

        activeSheet.cells[editingCell] = { value: cellValue, type: cellType };
      }

      newSheets[activeSheetIndex] = activeSheet;
      setSheets(newSheets);
      setHasChanges(true);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const match = selectedCell.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return;

    const col = match[1].charCodeAt(0) - 65;
    const row = parseInt(match[2], 10) - 1;

    if (e.key === "Enter") {
      if (editingCell) {
        handleCellBlur();
        // Move down
        const newRef = getCellRef(row + 1, col);
        setSelectedCell(newRef);
      } else {
        handleCellDoubleClick(selectedCell);
      }
      e.preventDefault();
    } else if (e.key === "Tab") {
      if (editingCell) handleCellBlur();
      // Move right
      const newRef = getCellRef(row, col + 1);
      setSelectedCell(newRef);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (!editingCell) {
      if (e.key === "ArrowUp" && row > 0) {
        setSelectedCell(getCellRef(row - 1, col));
      } else if (e.key === "ArrowDown") {
        setSelectedCell(getCellRef(row + 1, col));
      } else if (e.key === "ArrowLeft" && col > 0) {
        setSelectedCell(getCellRef(row, col - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedCell(getCellRef(row, col + 1));
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Start typing
        handleCellDoubleClick(selectedCell);
        setEditValue(e.key);
      }
    }
  };

  // Add sheet
  const addSheet = () => {
    const newSheets = [...sheets, { name: `Sheet${sheets.length + 1}`, cells: {} }];
    setSheets(newSheets);
    setActiveSheetIndex(newSheets.length - 1);
    setHasChanges(true);
  };

  // Render cell
  const renderCell = (row: number, col: number) => {
    const ref = getCellRef(row, col);
    const cell = sheets[activeSheetIndex]?.cells[ref];
    const isSelected = selectedCell === ref;
    const isEditing = editingCell === ref;

    return (
      <div
        key={ref}
        className={cn(
          "border-r border-b border-gray-200 dark:border-gray-700 px-1 flex items-center overflow-hidden",
          isSelected && "ring-2 ring-blue-500 ring-inset z-10",
          !isEditing && "cursor-cell"
        )}
        style={{ width: CELL_WIDTH, height: CELL_HEIGHT, minWidth: CELL_WIDTH }}
        onClick={() => handleCellClick(ref)}
        onDoubleClick={() => handleCellDoubleClick(ref)}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => handleCellChange(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent outline-none text-sm"
            autoFocus
          />
        ) : (
          <span className="text-sm truncate">
            {cell?.value?.toString() ?? ""}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/system/teeem-xl/list")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="h-5 w-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <FileSpreadsheet className="h-3 w-3 text-green-600 dark:text-green-400" />
        </div>

        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          className="w-64 h-8 text-sm font-medium"
        />

        <div className="flex-1" />

        {saving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Spinner size={12} /> Saving...
          </span>
        )}

        {hasChanges && !saving && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}

        <Button variant="outline" size="sm" onClick={saveSpreadsheet} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push("/admin/system/teeem-xl/list")}>
              All Spreadsheets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-1 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-mono w-12 text-center">
          {selectedCell || ""}
        </span>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs flex-1">
          {selectedCell && sheets[activeSheetIndex]?.cells[selectedCell]?.value?.toString()}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex sticky top-0 z-20 bg-muted">
            <div
              className="border-r border-b border-gray-300 dark:border-gray-600 bg-muted"
              style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}
            />
            {Array.from({ length: DEFAULT_COLS }, (_, col) => (
              <div
                key={col}
                className="border-r border-b border-gray-300 dark:border-gray-600 bg-muted flex items-center justify-center text-xs font-medium"
                style={{ width: CELL_WIDTH, height: CELL_HEIGHT, minWidth: CELL_WIDTH }}
              >
                {getColumnLetter(col)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: DEFAULT_ROWS }, (_, row) => (
            <div key={row} className="flex">
              {/* Row header */}
              <div
                className="border-r border-b border-gray-300 dark:border-gray-600 bg-muted flex items-center justify-center text-xs font-medium sticky left-0 z-10"
                style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}
              >
                {row + 1}
              </div>
              {/* Cells */}
              {Array.from({ length: DEFAULT_COLS }, (_, col) => renderCell(row, col))}
            </div>
          ))}
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-t bg-muted/50 shrink-0">
        {sheets.map((sheet, idx) => (
          <button
            key={idx}
            onClick={() => setActiveSheetIndex(idx)}
            className={cn(
              "px-3 py-1 text-xs rounded-t border-t border-l border-r",
              idx === activeSheetIndex
                ? "bg-background border-gray-300 dark:border-gray-600"
                : "bg-muted/50 border-transparent hover:bg-muted"
            )}
          >
            {sheet.name}
          </button>
        ))}
        <button
          onClick={addSheet}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
