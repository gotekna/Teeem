"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  Download,
  Plus,
  FileSpreadsheet,
  ChevronLeft,
  MoreVertical,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  Percent,
  DollarSign,
  Hash,
  Briefcase,
  X,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import {
  evaluateFormula as evalFormula,
  adjustFormula as adjustFormulaRefs,
  extractReferences,
  extractReferencesWithColors,
  isError,
  type CellData as FormulaCellData,
  type CellFormat,
  type ErrorValue,
} from "@/lib/teeem-xl/formula-engine";

// Grid configuration
const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26; // A-Z
const DEFAULT_CELL_WIDTH = 100;
const MIN_CELL_WIDTH = 30;
const MAX_CELL_WIDTH = 500;
const CELL_HEIGHT = 28;
const ROW_HEADER_WIDTH = 50;
const VIRTUALIZATION_BUFFER = 5; // Extra rows to render above/below viewport

// Color palette for formula references (moved outside component to avoid recreation)
const FORMULA_REF_COLORS = [
  "bg-sky-100 dark:bg-sky-900/40 ring-2 ring-sky-400 ring-inset",      // light blue
  "bg-pink-100 dark:bg-pink-900/40 ring-2 ring-pink-400 ring-inset",   // pink
  "bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-400 ring-inset", // orange
  "bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-400 ring-inset", // green
  "bg-violet-100 dark:bg-violet-900/40 ring-2 ring-violet-400 ring-inset", // purple
  "bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400 ring-inset",   // amber
];

// Types
type CellValue = string | number | boolean | null;

interface CellData {
  value: CellValue | ErrorValue;
  type?: "string" | "number" | "boolean" | "formula" | "error";
  formula?: string;
  format?: CellFormat;
}

interface SheetData {
  name: string;
  cells: Record<string, CellData>;
  columnWidths?: Record<number, number>;
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
  description?: string;
  data: SpreadsheetData;
  jobId?: number;
  jobName?: string;
  updatedAt: string;
  createdAt: string;
}

interface Job {
  id: number;
  name: string;
}

interface Selection {
  start: { row: number; col: number };
  end: { row: number; col: number };
}

interface ClipboardData {
  cells: Record<string, CellData>;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  isCut: boolean;
}

interface HistoryEntry {
  sheets: SheetData[];
  name: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Column letter helper (0 -> A, 1 -> B, 26 -> AA)
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

// Column letter to index (A -> 0, B -> 1, AA -> 26)
function colLetterToIndex(col: string): number {
  let result = 0;
  const upper = col.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

// Cell reference helper
function getCellRef(row: number, col: number): string {
  return `${getColumnLetter(col)}${row + 1}`;
}

// Parse cell reference (A1 -> {row: 0, col: 0})
function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!match) return null;
  return {
    col: colLetterToIndex(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

// Format cell value for display
function formatCellValue(value: CellValue | ErrorValue, format?: CellFormat): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && isError(value)) return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (typeof value === "number" && format) {
    const decimals = format.decimals ?? 2;

    switch (format.type) {
      case "currency":
        return `${format.currency ?? "$"}${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
      case "percentage":
        return `${(value * 100).toFixed(decimals)}%`;
      case "number":
        return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      case "date":
        // If it's an Excel serial date number, convert it
        if (value > 1000) {
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.toLocaleDateString();
        }
        return String(value);
      default:
        return String(value);
    }
  }

  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TeeemXLPage() {
  // Column widths state (per column index)
  const [columnWidths, setColumnWidths] = React.useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = React.useState<number | null>(null);
  const resizeStartX = React.useRef<number>(0);
  const resizeStartWidth = React.useRef<number>(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const spreadsheetId = searchParams.get("id");
  const { setMode } = useLayoutMode();

  // Enable fullscreen mode (hide sidebar/breadcrumbs)
  React.useEffect(() => {
    setMode("fullscreen");
    return () => setMode("padded");
  }, [setMode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [spreadsheet, setSpreadsheet] = React.useState<Spreadsheet | null>(
    null
  );
  const [name, setName] = React.useState("Untitled Spreadsheet");
  const [description, setDescription] = React.useState("");
  const [sheets, setSheets] = React.useState<SheetData[]>([
    { name: "Sheet1", cells: {} },
  ]);
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [hasChanges, setHasChanges] = React.useState(false);

  // Job association state
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [selectedJobName, setSelectedJobName] = React.useState<string | null>(null);
  const [jobSearchOpen, setJobSearchOpen] = React.useState(false);
  const [jobSearchTerm, setJobSearchTerm] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  // Phase 1: Selection state
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Fill handle state (drag to fill)
  const [isFillDragging, setIsFillDragging] = React.useState(false);
  const [fillEnd, setFillEnd] = React.useState<{ row: number; col: number } | null>(null);

  // Formula range selection state (for clicking cells while editing a formula)
  const [isFormulaRangeSelecting, setIsFormulaRangeSelecting] = React.useState(false);
  const [formulaRangeStart, setFormulaRangeStart] = React.useState<{ row: number; col: number } | null>(null);
  const [formulaRangeEnd, setFormulaRangeEnd] = React.useState<{ row: number; col: number } | null>(null);

  // Phase 1: Clipboard state
  const [clipboard, setClipboard] = React.useState<ClipboardData | null>(null);

  // Phase 1: History state (undo/redo)
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const formulaBarRef = React.useRef<HTMLInputElement>(null);

  // Virtualization state - track visible row range
  const [visibleRows, setVisibleRows] = React.useState({ start: 0, end: 30 });

  // Search jobs for the job picker
  const searchJobs = React.useCallback(async (term: string) => {
    setLoadingJobs(true);
    try {
      const url = term.trim()
        ? `/api/v1/jobs/for_select?q=${encodeURIComponent(term)}`
        : `/api/v1/jobs/for_select`;
      const response = await api.get<{ success: boolean; jobs: Job[] }>(url);
      if (response?.success && response.jobs) {
        setJobs(response.jobs.slice(0, 20)); // Limit to 20 results in dropdown
      }
    } catch (error) {
      console.error("Failed to search jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load jobs when popover opens, debounce search term changes
  React.useEffect(() => {
    if (!jobSearchOpen) return;

    // Load immediately when opening (no debounce for initial load)
    if (jobSearchTerm === "") {
      searchJobs("");
      return;
    }

    // Debounce search term changes
    const timeout = setTimeout(() => {
      searchJobs(jobSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearchTerm, jobSearchOpen, searchJobs]);

  // Memoize formula reference colors to avoid recalculating for every cell
  const formulaRefColors = React.useMemo(() => {
    // When editing a formula, get refs from editValue
    if (editingCell && editValue.startsWith("=")) {
      return extractReferencesWithColors(editValue);
    }
    // When viewing a formula cell (not editing), get refs from its formula
    if (selectedCell && !editingCell) {
      const selectedCellData = sheets[activeSheetIndex]?.cells[selectedCell];
      if (selectedCellData?.formula) {
        return extractReferencesWithColors(selectedCellData.formula);
      }
    }
    return new Map<string, number>();
  }, [editingCell, editValue, selectedCell, sheets, activeSheetIndex]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD / SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  // Load spreadsheet or create new
  React.useEffect(() => {
    const loadOrCreate = async () => {
      setLoading(true);
      try {
        if (spreadsheetId) {
          const response = await api.get<{ success: boolean; data: Spreadsheet }>(
            `/api/v1/teeem_spreadsheets/${spreadsheetId}`
          );
          if (response?.success && response.data) {
            setSpreadsheet(response.data);
            setName(response.data.name);
            setDescription(response.data.description || "");
            setSelectedJobId(response.data.jobId || null);
            setSelectedJobName(response.data.jobName || null);
            setSheets(
              response.data.data.sheets || [{ name: "Sheet1", cells: {} }]
            );
            setActiveSheetIndex(response.data.data.activeSheet || 0);
            // Initialize history
            setHistory([
              {
                sheets: JSON.parse(
                  JSON.stringify(
                    response.data.data.sheets || [{ name: "Sheet1", cells: {} }]
                  )
                ),
                name: response.data.name,
              },
            ]);
            setHistoryIndex(0);
          }
        } else {
          const response = await api.post<{ success: boolean; data: Spreadsheet }>(
            "/api/v1/teeem_spreadsheets",
            { teeem_spreadsheet: { name: "Untitled Spreadsheet" } }
          );
          if (response?.success && response.data) {
            setSpreadsheet(response.data);
            setName(response.data.name);
            setSheets(
              response.data.data.sheets || [{ name: "Sheet1", cells: {} }]
            );
            setHistory([
              {
                sheets: [{ name: "Sheet1", cells: {} }],
                name: "Untitled Spreadsheet",
              },
            ]);
            setHistoryIndex(0);
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

  // Virtualization: update visible rows on scroll
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleScroll = () => {
      const scrollTop = grid.scrollTop;
      const viewportHeight = grid.clientHeight;
      const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - VIRTUALIZATION_BUFFER);
      const endRow = Math.min(
        DEFAULT_ROWS,
        Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + VIRTUALIZATION_BUFFER
      );
      setVisibleRows({ start: startRow, end: endRow });
    };

    // Initial calculation
    handleScroll();

    grid.addEventListener("scroll", handleScroll, { passive: true });
    return () => grid.removeEventListener("scroll", handleScroll);
  }, []);

  // Save spreadsheet (to database AND to File Warehouse)
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

      // 1. Save to database
      await api.patch(`/api/v1/teeem_spreadsheets/${spreadsheet.id}`, {
        teeem_spreadsheet: {
          name,
          description,
          job_id: selectedJobId,
          data,
        },
      });

      // 2. Save to File Warehouse (S3)
      try {
        await api.post(`/api/v1/teeem_spreadsheets/${spreadsheet.id}/save_to_warehouse`);
      } catch (warehouseError) {
        console.warn("Failed to save to warehouse:", warehouseError);
        // Don't fail the whole save - database save succeeded
      }

      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY (UNDO/REDO)
  // ═══════════════════════════════════════════════════════════════════════════

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      sheets: JSON.parse(JSON.stringify(sheets)),
      name,
    });
    // Limit history to 50 items
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSheets(JSON.parse(JSON.stringify(prev.sheets)));
      setName(prev.name);
      setHistoryIndex(historyIndex - 1);
      setHasChanges(true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSheets(JSON.parse(JSON.stringify(next.sheets)));
      setName(next.name);
      setHistoryIndex(historyIndex + 1);
      setHasChanges(true);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULA EVALUATOR - Using new formula-engine.ts
  // ═══════════════════════════════════════════════════════════════════════════

  // Create a cell getter function for the formula engine
  const createCellGetter = React.useCallback((cells: Record<string, CellData>) => {
    return (ref: string): FormulaCellData | undefined => {
      const cell = cells[ref.toUpperCase()];
      if (!cell) return undefined;
      return {
        value: cell.value,
        formula: cell.formula,
        type: cell.type,
        format: cell.format,
      };
    };
  }, []);

  // Evaluate formula using the new formula engine
  const evaluateFormula = React.useCallback((
    formula: string,
    cells: Record<string, CellData>
  ): CellValue | ErrorValue => {
    const getCell = createCellGetter(cells);
    return evalFormula(formula, getCell);
  }, [createCellGetter]);

  // Recalculate all formulas that depend on changed cells
  const recalculateDependentFormulas = React.useCallback((
    cells: Record<string, CellData>,
    changedRefs: string[]
  ): Record<string, CellData> => {
    const newCells = { ...cells };

    // Find all cells with formulas that reference the changed cells
    const formulaCells = Object.entries(newCells).filter(([, cell]) => cell.formula);

    for (const [ref, cell] of formulaCells) {
      if (cell.formula) {
        const deps = extractReferences(cell.formula);
        const needsRecalc = deps.some(dep => changedRefs.includes(dep));

        if (needsRecalc) {
          const newValue = evaluateFormula(cell.formula, newCells);
          newCells[ref] = { ...cell, value: newValue };
        }
      }
    }

    return newCells;
  }, [evaluateFormula]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Memoize selection bounds to avoid recalculating for every cell
  const selectionBounds = React.useMemo(() => {
    if (!selection)
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, hasSelection: false };
    return {
      minRow: Math.min(selection.start.row, selection.end.row),
      maxRow: Math.max(selection.start.row, selection.end.row),
      minCol: Math.min(selection.start.col, selection.end.col),
      maxCol: Math.max(selection.start.col, selection.end.col),
      hasSelection: true,
    };
  }, [selection]);

  const getSelectionBounds = () => selectionBounds;

  const isInSelection = (row: number, col: number) => {
    if (!selectionBounds.hasSelection) return false;
    const { minRow, maxRow, minCol, maxCol } = selectionBounds;
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  const forEachSelectedCell = (
    callback: (row: number, col: number, ref: string) => void
  ) => {
    const { minRow, maxRow, minCol, maxCol, hasSelection } =
      getSelectionBounds();
    if (!hasSelection) {
      // Single cell selection
      if (selectedCell) {
        const parsed = parseRef(selectedCell);
        if (parsed) {
          callback(parsed.row, parsed.col, selectedCell);
        }
      }
      return;
    }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        callback(r, c, getCellRef(r, c));
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY / PASTE
  // ═══════════════════════════════════════════════════════════════════════════

  const copySelection = (isCut: boolean = false) => {
    const { minRow, maxRow, minCol, maxCol, hasSelection } =
      getSelectionBounds();
    const activeSheet = sheets[activeSheetIndex];
    const copiedCells: Record<string, CellData> = {};

    if (!hasSelection && selectedCell) {
      const cell = activeSheet.cells[selectedCell];
      if (cell) {
        copiedCells[selectedCell] = { ...cell };
      }
      const parsed = parseRef(selectedCell);
      if (parsed) {
        setClipboard({
          cells: copiedCells,
          startRow: parsed.row,
          startCol: parsed.col,
          endRow: parsed.row,
          endCol: parsed.col,
          isCut,
        });
      }
    } else {
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const ref = getCellRef(r, c);
          const cell = activeSheet.cells[ref];
          if (cell) {
            copiedCells[ref] = { ...cell };
          }
        }
      }
      setClipboard({
        cells: copiedCells,
        startRow: minRow,
        startCol: minCol,
        endRow: maxRow,
        endCol: maxCol,
        isCut,
      });
    }

    // Also copy to system clipboard as text
    const text = getSelectionAsText();
    if (text) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  const getSelectionAsText = (): string => {
    const { minRow, maxRow, minCol, maxCol, hasSelection } =
      getSelectionBounds();
    const activeSheet = sheets[activeSheetIndex];
    const rows: string[] = [];

    if (!hasSelection && selectedCell) {
      const cell = activeSheet.cells[selectedCell];
      return cell?.value?.toString() ?? "";
    }

    for (let r = minRow; r <= maxRow; r++) {
      const cols: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const ref = getCellRef(r, c);
        const cell = activeSheet.cells[ref];
        cols.push(cell?.value?.toString() ?? "");
      }
      rows.push(cols.join("\t"));
    }
    return rows.join("\n");
  };

  // Adjust formula references when pasting (uses formula-engine.ts)
  const adjustFormula = React.useCallback((
    formula: string,
    rowOffset: number,
    colOffset: number
  ): string => {
    // Use the formula engine's adjustFormula which handles $A$1, $A1, A$1 references
    return adjustFormulaRefs(formula, rowOffset, colOffset);
  }, []);

  // Paste from system clipboard (handles tab-separated values from Excel, etc.)
  const pasteFromSystemClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !selectedCell) {
        // Fall back to internal clipboard
        pasteClipboard();
        return;
      }

      // Parse tab-separated values
      const rows = text.split(/\r?\n/).filter(row => row.length > 0);
      if (rows.length === 0) {
        pasteClipboard();
        return;
      }

      saveToHistory();
      const newSheets = [...sheets];
      const activeSheet = { ...newSheets[activeSheetIndex] };
      activeSheet.cells = { ...activeSheet.cells };

      const parsed = parseRef(selectedCell);
      if (!parsed) return;

      const changedRefs: string[] = [];

      rows.forEach((row, rowOffset) => {
        const cols = row.split("\t");
        cols.forEach((cellValue, colOffset) => {
          const newRow = parsed.row + rowOffset;
          const newCol = parsed.col + colOffset;
          const newRef = getCellRef(newRow, newCol);

          let value: CellValue = cellValue;
          let cellType: "string" | "number" | "boolean" | "formula" = "string";
          let formula: string | undefined;

          // Detect cell type
          if (cellValue.startsWith("=")) {
            cellType = "formula";
            formula = cellValue;
            value = evaluateFormula(cellValue, activeSheet.cells);
          } else if (!isNaN(Number(cellValue)) && cellValue.trim() !== "") {
            value = Number(cellValue);
            cellType = "number";
          } else if (cellValue.toLowerCase() === "true" || cellValue.toLowerCase() === "false") {
            value = cellValue.toLowerCase() === "true";
            cellType = "boolean";
          }

          activeSheet.cells[newRef] = { value, type: cellType, formula };
          changedRefs.push(newRef);
        });
      });

      // Recalculate dependent formulas
      activeSheet.cells = recalculateDependentFormulas(activeSheet.cells, changedRefs);

      newSheets[activeSheetIndex] = activeSheet;
      setSheets(newSheets);
      setHasChanges(true);
    } catch {
      // Clipboard API failed, fall back to internal clipboard
      pasteClipboard();
    }
  };

  const pasteClipboard = () => {
    if (!clipboard) return;

    saveToHistory();
    const newSheets = [...sheets];
    const activeSheet = { ...newSheets[activeSheetIndex] };
    activeSheet.cells = { ...activeSheet.cells };

    // Determine paste location
    let pasteRow = 0;
    let pasteCol = 0;
    if (selectedCell) {
      const parsed = parseRef(selectedCell);
      if (parsed) {
        pasteRow = parsed.row;
        pasteCol = parsed.col;
      }
    }

    const rowOffset = pasteRow - clipboard.startRow;
    const colOffset = pasteCol - clipboard.startCol;

    // Paste cells
    Object.entries(clipboard.cells).forEach(([ref, cell]) => {
      const parsed = parseRef(ref);
      if (!parsed) return;

      const newRow = parsed.row + rowOffset;
      const newCol = parsed.col + colOffset;
      if (newRow < 0 || newCol < 0) return;

      const newRef = getCellRef(newRow, newCol);
      const newCell = { ...cell };

      // Adjust formula references
      if (cell.formula) {
        newCell.formula = adjustFormula(cell.formula, rowOffset, colOffset);
        newCell.value = evaluateFormula(newCell.formula, activeSheet.cells);
      }

      activeSheet.cells[newRef] = newCell;
    });

    // If cut, clear original cells
    if (clipboard.isCut) {
      Object.keys(clipboard.cells).forEach((ref) => {
        // Only delete if not in paste area
        const parsed = parseRef(ref);
        if (parsed) {
          const pastedRef = getCellRef(
            parsed.row + rowOffset,
            parsed.col + colOffset
          );
          if (ref !== pastedRef) {
            delete activeSheet.cells[ref];
          }
        }
      });
      setClipboard(null);
    }

    newSheets[activeSheetIndex] = activeSheet;
    setSheets(newSheets);
    setHasChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════════

  const deleteSelection = () => {
    saveToHistory();
    const newSheets = [...sheets];
    const activeSheet = { ...newSheets[activeSheetIndex] };
    activeSheet.cells = { ...activeSheet.cells };

    // Collect refs of deleted cells
    const deletedRefs: string[] = [];
    forEachSelectedCell((row, col, ref) => {
      delete activeSheet.cells[ref];
      deletedRefs.push(ref);
    });

    // Recalculate formulas that depended on the deleted cells
    activeSheet.cells = recalculateDependentFormulas(activeSheet.cells, deletedRefs);

    newSheets[activeSheetIndex] = activeSheet;
    setSheets(newSheets);
    setHasChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FILL (DRAG TO FILL)
  // ═══════════════════════════════════════════════════════════════════════════

  // Month names for pattern detection
  const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Detect if a value is a month and return its index and format
  const detectMonth = (value: CellValue): { index: number; format: "full" | "short" } | null => {
    if (typeof value !== "string") return null;
    const lower = value.toLowerCase();

    // Check full month names
    const fullIndex = MONTHS_FULL.findIndex(m => m.toLowerCase() === lower);
    if (fullIndex >= 0) return { index: fullIndex, format: "full" };

    // Check short month names
    const shortIndex = MONTHS_SHORT.findIndex(m => m.toLowerCase() === lower);
    if (shortIndex >= 0) return { index: shortIndex, format: "short" };

    return null;
  };

  // Detect if a value is a day and return its index and format
  const detectDay = (value: CellValue): { index: number; format: "full" | "short" } | null => {
    if (typeof value !== "string") return null;
    const lower = value.toLowerCase();

    // Check full day names
    const fullIndex = DAYS_FULL.findIndex(d => d.toLowerCase() === lower);
    if (fullIndex >= 0) return { index: fullIndex, format: "full" };

    // Check short day names
    const shortIndex = DAYS_SHORT.findIndex(d => d.toLowerCase() === lower);
    if (shortIndex >= 0) return { index: shortIndex, format: "short" };

    return null;
  };

  // Detect month/day series pattern
  const detectTextSeriesPattern = (values: CellValue[]): { type: "month" | "day" | null; format: "full" | "short"; startIndex: number } => {
    if (values.length === 0) return { type: null, format: "full", startIndex: 0 };

    // Check if first value is a month
    const monthResult = detectMonth(values[0]);
    if (monthResult) {
      // Verify all values are months in sequence (or just use the first one for single cell)
      if (values.length === 1) {
        return { type: "month", format: monthResult.format, startIndex: monthResult.index };
      }
      // Check if subsequent values follow the month pattern
      for (let i = 1; i < values.length; i++) {
        const expected = (monthResult.index + i) % 12;
        const actual = detectMonth(values[i]);
        if (!actual || actual.index !== expected) {
          return { type: null, format: "full", startIndex: 0 };
        }
      }
      return { type: "month", format: monthResult.format, startIndex: monthResult.index };
    }

    // Check if first value is a day
    const dayResult = detectDay(values[0]);
    if (dayResult) {
      if (values.length === 1) {
        return { type: "day", format: dayResult.format, startIndex: dayResult.index };
      }
      // Check if subsequent values follow the day pattern
      for (let i = 1; i < values.length; i++) {
        const expected = (dayResult.index + i) % 7;
        const actual = detectDay(values[i]);
        if (!actual || actual.index !== expected) {
          return { type: null, format: "full", startIndex: 0 };
        }
      }
      return { type: "day", format: dayResult.format, startIndex: dayResult.index };
    }

    return { type: null, format: "full", startIndex: 0 };
  };

  // Get the next value in a text series
  const getNextTextSeriesValue = (type: "month" | "day", format: "full" | "short", currentIndex: number, offset: number): string => {
    if (type === "month") {
      const index = (currentIndex + offset) % 12;
      return format === "full" ? MONTHS_FULL[index] : MONTHS_SHORT[index];
    } else {
      const index = (currentIndex + offset) % 7;
      return format === "full" ? DAYS_FULL[index] : DAYS_SHORT[index];
    }
  };

  // Detect numeric series pattern (1,2,3 or 10,20,30)
  const detectSeriesPattern = (values: CellValue[]): { isPattern: boolean; step: number } => {
    if (values.length < 2) return { isPattern: false, step: 0 };

    const nums = values.map(v => typeof v === "number" ? v : parseFloat(String(v)));
    if (nums.some(n => isNaN(n))) return { isPattern: false, step: 0 };

    const step = nums[1] - nums[0];
    for (let i = 2; i < nums.length; i++) {
      if (Math.abs((nums[i] - nums[i - 1]) - step) > 0.0001) {
        return { isPattern: false, step: 0 };
      }
    }
    return { isPattern: true, step };
  };

  // Memoize fill handle position (bottom-right of selection)
  const fillHandlePosition = React.useMemo((): { row: number; col: number } | null => {
    if (!selection) {
      if (selectedCell) {
        return parseRef(selectedCell);
      }
      return null;
    }
    return {
      row: Math.max(selection.start.row, selection.end.row),
      col: Math.max(selection.start.col, selection.end.col),
    };
  }, [selection, selectedCell]);

  // Memoize formula range bounds for cell highlighting
  const formulaRangeBounds = React.useMemo(() => {
    if (!isFormulaRangeSelecting || !formulaRangeStart || !formulaRangeEnd) {
      return null;
    }
    return {
      minRow: Math.min(formulaRangeStart.row, formulaRangeEnd.row),
      maxRow: Math.max(formulaRangeStart.row, formulaRangeEnd.row),
      minCol: Math.min(formulaRangeStart.col, formulaRangeEnd.col),
      maxCol: Math.max(formulaRangeStart.col, formulaRangeEnd.col),
    };
  }, [isFormulaRangeSelecting, formulaRangeStart, formulaRangeEnd]);

  // Execute fill operation
  const executeFill = () => {
    if (!selection || !fillEnd) return;

    const { minRow, maxRow, minCol, maxCol } = getSelectionBounds();
    const activeSheet = sheets[activeSheetIndex];

    // Determine fill direction
    const fillToRow = fillEnd.row;
    const fillToCol = fillEnd.col;

    // Only fill down or right from selection
    if (fillToRow < maxRow && fillToCol < maxCol) return;
    if (fillToRow < minRow || fillToCol < minCol) return;

    saveToHistory();
    const newSheets = [...sheets];
    const newSheet = { ...newSheets[activeSheetIndex] };
    newSheet.cells = { ...newSheet.cells };

    // Get source values for pattern detection
    const sourceValues: CellValue[] = [];
    const sourceCells: { ref: string; cell: CellData | undefined; row: number; col: number }[] = [];

    // Fill down
    if (fillToRow > maxRow && fillToCol <= maxCol) {
      // Get source column values
      for (let c = minCol; c <= maxCol; c++) {
        const colValues: CellValue[] = [];
        const colCells: typeof sourceCells = [];

        for (let r = minRow; r <= maxRow; r++) {
          const ref = getCellRef(r, c);
          const cell = activeSheet.cells[ref];
          colValues.push(cell?.value ?? null);
          colCells.push({ ref, cell, row: r, col: c });
        }

        const { isPattern, step } = detectSeriesPattern(colValues);
        const textPattern = detectTextSeriesPattern(colValues);
        const sourceHeight = maxRow - minRow + 1;

        // Fill each row
        for (let r = maxRow + 1; r <= fillToRow; r++) {
          const sourceIndex = (r - maxRow - 1) % sourceHeight;
          const sourceCell = colCells[sourceIndex];
          const newRef = getCellRef(r, c);

          if (sourceCell.cell) {
            const newCell = { ...sourceCell.cell };

            if (textPattern.type) {
              // Extend the text series (months or days)
              const offset = sourceHeight + (r - maxRow - 1);
              newCell.value = getNextTextSeriesValue(textPattern.type, textPattern.format, textPattern.startIndex, offset);
              newCell.type = "string";
              newCell.formula = undefined;
            } else if (isPattern && typeof sourceCell.cell.value === "number") {
              // Extend the numeric series
              const lastValue = colValues[colValues.length - 1] as number;
              newCell.value = lastValue + step * (r - maxRow);
              newCell.type = "number";
              newCell.formula = undefined;
            } else if (sourceCell.cell.formula) {
              // Adjust formula references
              const rowOffset = r - sourceCell.row;
              newCell.formula = adjustFormula(sourceCell.cell.formula, rowOffset, 0);
              newCell.value = evaluateFormula(newCell.formula, newSheet.cells);
            }
            // else: just copy the value as-is

            newSheet.cells[newRef] = newCell;
          }
        }
      }
    }

    // Fill right
    if (fillToCol > maxCol && fillToRow <= maxRow) {
      // Get source row values
      for (let r = minRow; r <= maxRow; r++) {
        const rowValues: CellValue[] = [];
        const rowCells: typeof sourceCells = [];

        for (let c = minCol; c <= maxCol; c++) {
          const ref = getCellRef(r, c);
          const cell = activeSheet.cells[ref];
          rowValues.push(cell?.value ?? null);
          rowCells.push({ ref, cell, row: r, col: c });
        }

        const { isPattern, step } = detectSeriesPattern(rowValues);
        const textPattern = detectTextSeriesPattern(rowValues);
        const sourceWidth = maxCol - minCol + 1;

        // Fill each column
        for (let c = maxCol + 1; c <= fillToCol; c++) {
          const sourceIndex = (c - maxCol - 1) % sourceWidth;
          const sourceCell = rowCells[sourceIndex];
          const newRef = getCellRef(r, c);

          if (sourceCell.cell) {
            const newCell = { ...sourceCell.cell };

            if (textPattern.type) {
              // Extend the text series (months or days)
              const offset = sourceWidth + (c - maxCol - 1);
              newCell.value = getNextTextSeriesValue(textPattern.type, textPattern.format, textPattern.startIndex, offset);
              newCell.type = "string";
              newCell.formula = undefined;
            } else if (isPattern && typeof sourceCell.cell.value === "number") {
              // Extend the numeric series
              const lastValue = rowValues[rowValues.length - 1] as number;
              newCell.value = lastValue + step * (c - maxCol);
              newCell.type = "number";
              newCell.formula = undefined;
            } else if (sourceCell.cell.formula) {
              // Adjust formula references
              const colOffset = c - sourceCell.col;
              newCell.formula = adjustFormula(sourceCell.cell.formula, 0, colOffset);
              newCell.value = evaluateFormula(newCell.formula, newSheet.cells);
            }

            newSheet.cells[newRef] = newCell;
          }
        }
      }
    }

    newSheets[activeSheetIndex] = newSheet;
    setSheets(newSheets);
    setHasChanges(true);

    // Extend selection to include filled area
    if (fillToRow > maxRow) {
      setSelection({
        start: { row: minRow, col: minCol },
        end: { row: fillToRow, col: maxCol },
      });
    } else if (fillToCol > maxCol) {
      setSelection({
        start: { row: minRow, col: minCol },
        end: { row: maxRow, col: fillToCol },
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  const handleExport = async () => {
    if (!spreadsheet) return;

    try {
      const TeeemXL = await import("@/lib/teeem-xl");
      const activeSheet = sheets[activeSheetIndex];

      // Convert cells to 2D array
      const rows: (string | number | boolean | null)[][] = [];
      let maxRow = 0;
      let maxCol = 0;

      Object.entries(activeSheet.cells).forEach(([ref]) => {
        const match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          const col = TeeemXL.columnToIndex(match[1]);
          const row = parseInt(match[2], 10) - 1;
          maxRow = Math.max(maxRow, row);
          maxCol = Math.max(maxCol, col);
        }
      });

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

  // ═══════════════════════════════════════════════════════════════════════════
  // CELL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCellMouseDown = (
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    const ref = getCellRef(row, col);

    // If we're editing a formula, clicking a cell inserts the reference
    if (editingCell && editValue.startsWith("=")) {
      e.preventDefault();
      e.stopPropagation();

      // Start formula range selection
      setIsFormulaRangeSelecting(true);
      setFormulaRangeStart({ row, col });
      setFormulaRangeEnd({ row, col });

      // Insert the cell reference at cursor position or end of formula
      const cellRef = getCellRef(row, col);

      // Find where to insert - look for operators or opening paren before cursor
      // For now, append to the formula or replace any existing range being built
      // Check both cell input and formula bar for active input
      const activeInput = inputRef.current ?? formulaBarRef.current;
      if (activeInput) {
        const cursorPos = activeInput.selectionStart ?? editValue.length;
        const beforeCursor = editValue.slice(0, cursorPos);
        const afterCursor = editValue.slice(cursorPos);

        // Check if we're right after an operator or opening paren
        const lastChar = beforeCursor.slice(-1);
        if (/[+\-*/^%&=<>,(]/.test(lastChar) || beforeCursor === "=") {
          setEditValue(beforeCursor + cellRef + afterCursor);
        } else {
          // Replace last token with the new reference
          const match = beforeCursor.match(/([A-Z]+\d+(?::[A-Z]+\d+)?)$/i);
          if (match) {
            setEditValue(beforeCursor.slice(0, -match[1].length) + cellRef + afterCursor);
          } else {
            setEditValue(beforeCursor + cellRef + afterCursor);
          }
        }
      }
      return;
    }

    if (e.shiftKey && selectedCell) {
      // Extend selection
      const startParsed = parseRef(selectedCell);
      if (startParsed) {
        setSelection({
          start: startParsed,
          end: { row, col },
        });
      }
    } else {
      // New selection
      setSelectedCell(ref);
      setSelection({
        start: { row, col },
        end: { row, col },
      });
      setIsDragging(true);
    }
    // Don't set editingCell to null here - let the blur handler save the value first
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging && selection) {
      setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
    }
    if (isFillDragging) {
      setFillEnd({ row, col });
    }
    // Handle formula range selection dragging
    if (isFormulaRangeSelecting && formulaRangeStart) {
      setFormulaRangeEnd({ row, col });

      // Update the formula with the range
      const startRef = getCellRef(formulaRangeStart.row, formulaRangeStart.col);
      const endRef = getCellRef(row, col);
      const rangeRef = startRef === endRef ? startRef : `${startRef}:${endRef}`;

      // Replace the last cell reference or range in the formula
      setEditValue((prev) => {
        // Find and replace the last cell reference or range
        const match = prev.match(/([A-Z]+\d+(?::[A-Z]+\d+)?)$/i);
        if (match) {
          return prev.slice(0, -match[1].length) + rangeRef;
        }
        return prev;
      });
    }
  };

  const handleMouseUp = React.useCallback(() => {
    if (isFillDragging && fillEnd) {
      executeFill();
    }
    setIsDragging(false);
    setIsFillDragging(false);
    setFillEnd(null);

    // Always clear formula range selection state on mouseup
    // This prevents the highlight from following the mouse after release
    setIsFormulaRangeSelecting(false);
    setFormulaRangeStart(null);
    setFormulaRangeEnd(null);
  }, [isFillDragging, fillEnd, executeFill]);

  React.useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Fill handle mouse down
  const handleFillHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFillDragging(true);
    // Initialize fillEnd to current selection end (uses memoized position)
    if (fillHandlePosition) {
      setFillEnd(fillHandlePosition);
    }
  };

  const handleCellDoubleClick = (ref: string) => {
    setSelectedCell(ref);
    setEditingCell(ref);
    const cell = sheets[activeSheetIndex].cells[ref];
    setEditValue(cell?.formula || cell?.value?.toString() || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Handle formula bar mouse down - start editing before focus to avoid value switching
  const handleFormulaBarMouseDown = () => {
    if (selectedCell && !editingCell) {
      setEditingCell(selectedCell);
      const cell = sheets[activeSheetIndex].cells[selectedCell];
      setEditValue(cell?.formula || cell?.value?.toString() || "");
    }
  };

  // Handle formula bar blur - commit the edit
  const handleFormulaBarBlur = (e: React.FocusEvent) => {
    // Don't commit if switching to cell input (they share the same edit state)
    if (e.relatedTarget === inputRef.current) {
      return;
    }
    handleCellBlur();
  };

  const handleCellBlur = () => {
    if (editingCell) {
      saveToHistory();
      const newSheets = [...sheets];
      const activeSheet = { ...newSheets[activeSheetIndex] };
      activeSheet.cells = { ...activeSheet.cells };

      if (editValue.trim() === "") {
        delete activeSheet.cells[editingCell];
      } else {
        let cellValue: CellValue | ErrorValue = editValue;
        let cellType: "string" | "number" | "boolean" | "formula" | "error" = "string";
        let formula: string | undefined;

        if (editValue.startsWith("=")) {
          cellType = "formula";
          formula = editValue;
          cellValue = evaluateFormula(editValue, activeSheet.cells);
          // Check if result is an error
          if (typeof cellValue === "string" && isError(cellValue)) {
            cellType = "error";
          }
        } else if (!isNaN(Number(editValue)) && editValue.trim() !== "") {
          cellValue = Number(editValue);
          cellType = "number";
        } else if (
          editValue.toLowerCase() === "true" ||
          editValue.toLowerCase() === "false"
        ) {
          cellValue = editValue.toLowerCase() === "true";
          cellType = "boolean";
        }

        activeSheet.cells[editingCell] = { value: cellValue, type: cellType, formula };
      }

      // Recalculate any formulas that depend on the changed cell
      activeSheet.cells = recalculateDependentFormulas(activeSheet.cells, [editingCell]);

      newSheets[activeSheetIndex] = activeSheet;
      setSheets(newSheets);
      setHasChanges(true);
    }
    setEditingCell(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const parsed = parseRef(selectedCell);
    if (!parsed) return;

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleCellBlur();
      const newRef = getCellRef(parsed.row + 1, parsed.col);
      setSelectedCell(newRef);
      setSelection({ start: { row: parsed.row + 1, col: parsed.col }, end: { row: parsed.row + 1, col: parsed.col } });
      // Focus container so next keystroke starts editing immediately
      setTimeout(() => containerRef.current?.focus(), 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      handleCellBlur();
      const newCol = e.shiftKey ? Math.max(0, parsed.col - 1) : parsed.col + 1;
      const newRef = getCellRef(parsed.row, newCol);
      setSelectedCell(newRef);
      setSelection({ start: { row: parsed.row, col: newCol }, end: { row: parsed.row, col: newCol } });
      // Focus container so next keystroke starts editing immediately
      setTimeout(() => containerRef.current?.focus(), 0);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setEditingCell(null);
      // Focus container
      setTimeout(() => containerRef.current?.focus(), 0);
    } else if (e.key.startsWith("Arrow")) {
      // Arrow key handling when editing a cell
      // Allow text navigation/selection shortcuts to work natively in the input:
      // - Cmd+Arrow: jump to start/end of text
      // - Shift+Arrow: select text character by character
      // - Cmd+Shift+Arrow: select to start/end of text
      // - Alt+Arrow: jump word by word
      // - Alt+Shift+Arrow: select word by word
      const hasModifier = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;

      if (hasModifier) {
        // Let browser handle native text navigation/selection
        // Don't call preventDefault - let the default behavior happen
        // Don't call stopPropagation - the container's handleKeyDown will also check for modifiers
        // The key is to do NOTHING here and let the event flow naturally
        return;
      }

      // Plain arrow keys (no modifiers) navigate to adjacent cells
      e.preventDefault();
      e.stopPropagation();
      handleCellBlur();

      let newRow = parsed.row;
      let newCol = parsed.col;

      if (e.key === "ArrowUp") {
        newRow = Math.max(0, parsed.row - 1);
      } else if (e.key === "ArrowDown") {
        newRow = parsed.row + 1;
      } else if (e.key === "ArrowLeft") {
        newCol = Math.max(0, parsed.col - 1);
      } else if (e.key === "ArrowRight") {
        newCol = parsed.col + 1;
      }

      const newRef = getCellRef(newRow, newCol);
      setSelectedCell(newRef);
      setSelection({ start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } });
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't intercept keyboard events when typing in input fields (like spreadsheet name)
    const target = e.target as HTMLElement;
    const isInNonCellInput = target.tagName === "INPUT" && !target.hasAttribute("data-cell-input");
    const isInCellInput = target.tagName === "INPUT" && target.hasAttribute("data-cell-input");

    if (isInNonCellInput) {
      // Let the input handle its own keyboard events
      return;
    }

    // When editing a cell, allow text navigation/selection shortcuts to work natively:
    // Cmd+Arrow, Shift+Arrow, Alt+Arrow (word jump), and combinations thereof
    if (isInCellInput && (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) && e.key.startsWith("Arrow")) {
      // Don't intercept - let the input handle text navigation/selection
      return;
    }

    // Handle undo/redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo();
      return;
    }

    // Handle copy/paste
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      copySelection(false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "x") {
      e.preventDefault();
      copySelection(true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      // Try to paste from system clipboard first (tab-separated values)
      pasteFromSystemClipboard();
      return;
    }

    // Select all
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      setSelection({
        start: { row: 0, col: 0 },
        end: { row: DEFAULT_ROWS - 1, col: DEFAULT_COLS - 1 },
      });
      return;
    }

    if (!selectedCell || editingCell) return;

    const parsed = parseRef(selectedCell);
    if (!parsed) return;

    // Delete
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelection();
      return;
    }

    // Navigation
    if (e.key === "Enter") {
      handleCellDoubleClick(selectedCell);
      e.preventDefault();
    } else if (e.key === "Tab") {
      const newCol = e.shiftKey ? Math.max(0, parsed.col - 1) : parsed.col + 1;
      const newRef = getCellRef(parsed.row, newCol);
      setSelectedCell(newRef);
      setSelection({ start: { row: parsed.row, col: newCol }, end: { row: parsed.row, col: newCol } });
      e.preventDefault();
    } else if (e.key === "ArrowUp" && parsed.row > 0) {
      const newRef = getCellRef(parsed.row - 1, parsed.col);
      setSelectedCell(newRef);
      if (!e.shiftKey) {
        setSelection({ start: { row: parsed.row - 1, col: parsed.col }, end: { row: parsed.row - 1, col: parsed.col } });
      } else if (selection) {
        setSelection({ ...selection, end: { row: parsed.row - 1, col: parsed.col } });
      }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      const newRef = getCellRef(parsed.row + 1, parsed.col);
      setSelectedCell(newRef);
      if (!e.shiftKey) {
        setSelection({ start: { row: parsed.row + 1, col: parsed.col }, end: { row: parsed.row + 1, col: parsed.col } });
      } else if (selection) {
        setSelection({ ...selection, end: { row: parsed.row + 1, col: parsed.col } });
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && parsed.col > 0) {
      const newRef = getCellRef(parsed.row, parsed.col - 1);
      setSelectedCell(newRef);
      if (!e.shiftKey) {
        setSelection({ start: { row: parsed.row, col: parsed.col - 1 }, end: { row: parsed.row, col: parsed.col - 1 } });
      } else if (selection) {
        setSelection({ ...selection, end: { row: parsed.row, col: parsed.col - 1 } });
      }
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      const newRef = getCellRef(parsed.row, parsed.col + 1);
      setSelectedCell(newRef);
      if (!e.shiftKey) {
        setSelection({ start: { row: parsed.row, col: parsed.col + 1 }, end: { row: parsed.row, col: parsed.col + 1 } });
      } else if (selection) {
        setSelection({ ...selection, end: { row: parsed.row, col: parsed.col + 1 } });
      }
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Start typing
      handleCellDoubleClick(selectedCell);
      setEditValue(e.key);
      e.preventDefault();
    }
  };

  // Get column width (from state or default)
  const getColumnWidth = (col: number): number => {
    return columnWidths[col] ?? DEFAULT_CELL_WIDTH;
  };

  // Column resize handlers
  const handleColumnResizeStart = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(col);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = getColumnWidth(col);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_CELL_WIDTH, Math.min(MAX_CELL_WIDTH, resizeStartWidth.current + delta));
      setColumnWidths(prev => ({ ...prev, [col]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setResizingCol(null);
      setHasChanges(true);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Apply format to selected cells
  const applyFormat = (format: CellFormat) => {
    saveToHistory();
    const newSheets = [...sheets];
    const activeSheet = { ...newSheets[activeSheetIndex] };
    activeSheet.cells = { ...activeSheet.cells };

    forEachSelectedCell((row, col, ref) => {
      const cell = activeSheet.cells[ref];
      if (cell) {
        activeSheet.cells[ref] = { ...cell, format };
      } else {
        // Create a cell with the format if it doesn't exist
        activeSheet.cells[ref] = { value: null, type: "string", format };
      }
    });

    newSheets[activeSheetIndex] = activeSheet;
    setSheets(newSheets);
    setHasChanges(true);
  };

  // Add sheet
  const addSheet = () => {
    saveToHistory();
    const newSheets = [
      ...sheets,
      { name: `Sheet${sheets.length + 1}`, cells: {} },
    ];
    setSheets(newSheets);
    setActiveSheetIndex(newSheets.length - 1);
    setHasChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER CELL
  // ═══════════════════════════════════════════════════════════════════════════

  const renderCell = (row: number, col: number) => {
    const ref = getCellRef(row, col);
    const cell = sheets[activeSheetIndex]?.cells[ref];
    const isSelected = selectedCell === ref;
    const isEditing = editingCell === ref;
    const inSelection = isInSelection(row, col);

    // Use memoized fill handle position
    const showFillHandle = fillHandlePosition &&
      fillHandlePosition.row === row &&
      fillHandlePosition.col === col &&
      !isEditing &&
      !isFillDragging;

    // Check if this cell is in the fill preview area (uses memoized selectionBounds)
    const inFillPreview = isFillDragging && fillEnd && selectionBounds.hasSelection && (() => {
      const { minRow, maxRow, minCol, maxCol } = selectionBounds;
      // Fill down preview
      if (fillEnd.row > maxRow && fillEnd.col <= maxCol) {
        return row > maxRow && row <= fillEnd.row && col >= minCol && col <= maxCol;
      }
      // Fill right preview
      if (fillEnd.col > maxCol && fillEnd.row <= maxRow) {
        return col > maxCol && col <= fillEnd.col && row >= minRow && row <= maxRow;
      }
      return false;
    })();

    // Use memoized formula range bounds
    const inFormulaRange = formulaRangeBounds &&
      row >= formulaRangeBounds.minRow &&
      row <= formulaRangeBounds.maxRow &&
      col >= formulaRangeBounds.minCol &&
      col <= formulaRangeBounds.maxCol;

    // Use memoized formula reference colors (calculated once per render, not per cell)
    const formulaRefColorIndex = formulaRefColors.get(ref) ?? -1;
    const formulaRefClass = formulaRefColorIndex >= 0
      ? FORMULA_REF_COLORS[formulaRefColorIndex % FORMULA_REF_COLORS.length]
      : "";

    return (
      <div
        key={ref}
        className={cn(
          "border-r border-b border-border dark:border-border px-1 flex items-center overflow-hidden relative",
          isSelected && "ring-2 ring-blue-500 ring-inset z-10",
          inSelection && !isSelected && "bg-blue-100 dark:bg-blue-900/30",
          inFillPreview && "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 border-dashed",
          inFormulaRange && "bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500 ring-inset",
          formulaRefColorIndex >= 0 && !inFormulaRange && formulaRefClass,
          !isEditing && "cursor-cell"
        )}
        style={{ width: getColumnWidth(col), height: CELL_HEIGHT, minWidth: MIN_CELL_WIDTH }}
        onMouseDown={(e) => handleCellMouseDown(row, col, e)}
        onMouseEnter={() => handleCellMouseEnter(row, col)}
        onDoubleClick={() => handleCellDoubleClick(ref)}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            data-cell-input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={(e) => {
              // Don't commit if switching to formula bar (they share edit state)
              if (e.relatedTarget === formulaBarRef.current) {
                return;
              }
              handleCellBlur();
            }}
            onKeyDown={handleInputKeyDown}
            className="w-full h-full bg-transparent outline-none text-sm"
            autoFocus
          />
        ) : (
          <span className={cn(
            "text-sm truncate",
            cell?.type === "error" && "text-red-500 dark:text-red-400"
          )}>
            {formatCellValue(cell?.value ?? null, cell?.format)}
          </span>
        )}

        {/* Fill handle - small blue square in bottom-right corner */}
        {showFillHandle && (
          <div
            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-20 hover:bg-blue-600"
            onMouseDown={handleFillHandleMouseDown}
            title="Drag to fill"
          />
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/system/teeem-xl/list")}
        >
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

        <div className="h-6 w-px bg-border" />

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Copy/Cut/Paste */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => copySelection(false)}
          title="Copy (Ctrl+C)"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => copySelection(true)}
          title="Cut (Ctrl+X)"
        >
          <Scissors className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={pasteClipboard}
          disabled={!clipboard}
          title="Paste (Ctrl+V)"
        >
          <ClipboardPaste className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Number formatting */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => applyFormat({ type: "currency", decimals: 2, currency: "$" })}
          title="Format as Currency"
        >
          <DollarSign className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => applyFormat({ type: "percentage", decimals: 0 })}
          title="Format as Percentage"
        >
          <Percent className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => applyFormat({ type: "number", decimals: 2 })}
          title="Format as Number"
        >
          <Hash className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Job Picker */}
        <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-2",
                selectedJobId && "border-blue-500 bg-blue-50 dark:bg-blue-950"
              )}
            >
              <Briefcase className="h-4 w-4" />
              {selectedJobName ? (
                <span className="max-w-[150px] truncate">{selectedJobName}</span>
              ) : (
                <span className="text-muted-foreground">Attach to Job</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={jobSearchTerm}
                  onChange={(e) => setJobSearchTerm(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loadingJobs ? (
                <div className="flex items-center justify-center p-4">
                  <Spinner size={16} />
                </div>
              ) : jobs.length > 0 ? (
                <div className="p-1">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setSelectedJobName(job.name);
                        setJobSearchOpen(false);
                        setJobSearchTerm("");
                        setHasChanges(true);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded hover:bg-muted",
                        selectedJobId === job.id && "bg-blue-100 dark:bg-blue-900/30"
                      )}
                    >
                      {job.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {jobSearchTerm ? "No jobs found" : "No jobs available"}
                </div>
              )}
            </div>
            {selectedJobId && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => {
                    setSelectedJobId(null);
                    setSelectedJobName(null);
                    setJobSearchOpen(false);
                    setHasChanges(true);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove from Job
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {saving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Spinner size={12} /> Saving...
          </span>
        )}

        {hasChanges && !saving && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={saveSpreadsheet}
          disabled={saving}
        >
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
            <DropdownMenuItem
              onClick={() => router.push("/admin/system/teeem-xl/list")}
            >
              All Spreadsheets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-1 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-mono w-12 text-center select-none">
          {selectedCell || ""}
        </span>
        <div className="h-4 w-px bg-border" />
        <input
          ref={formulaBarRef}
          type="text"
          value={editingCell ? editValue : (selectedCell && (sheets[activeSheetIndex]?.cells[selectedCell]?.formula || sheets[activeSheetIndex]?.cells[selectedCell]?.value?.toString() || "")) || ""}
          onChange={(e) => setEditValue(e.target.value)}
          onMouseDown={handleFormulaBarMouseDown}
          onBlur={handleFormulaBarBlur}
          onKeyDown={handleInputKeyDown}
          disabled={!selectedCell}
          className="text-xs flex-1 font-mono bg-background border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={selectedCell ? "Enter value or formula" : "Select a cell"}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex sticky top-0 z-20 bg-muted">
            <div
              className="border-r border-b border-border dark:border-border bg-muted"
              style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}
            />
            {Array.from({ length: DEFAULT_COLS }, (_, col) => {
              const colWidth = getColumnWidth(col);
              return (
                <div
                  key={col}
                  className="border-r border-b border-border dark:border-border bg-muted flex items-center justify-center text-xs font-medium cursor-pointer hover:bg-muted/80 relative group"
                  style={{
                    width: colWidth,
                    height: CELL_HEIGHT,
                    minWidth: MIN_CELL_WIDTH,
                  }}
                  onClick={() => {
                    // Select entire column
                    setSelection({
                      start: { row: 0, col },
                      end: { row: DEFAULT_ROWS - 1, col },
                    });
                    setSelectedCell(getCellRef(0, col));
                  }}
                >
                  {getColumnLetter(col)}
                  {/* Resize handle */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-30",
                      resizingCol === col && "bg-blue-500"
                    )}
                    onMouseDown={(e) => handleColumnResizeStart(col, e)}
                  />
                </div>
              );
            })}
          </div>

          {/* Rows - virtualized for performance */}
          {/* Top spacer for rows above viewport */}
          {visibleRows.start > 0 && (
            <div style={{ height: visibleRows.start * CELL_HEIGHT }} />
          )}
          {/* Visible rows only */}
          {Array.from({ length: visibleRows.end - visibleRows.start }, (_, i) => {
            const row = visibleRows.start + i;
            return (
              <div key={row} className="flex">
                {/* Row header */}
                <div
                  className="border-r border-b border-border dark:border-border bg-muted flex items-center justify-center text-xs font-medium sticky left-0 z-10 cursor-pointer hover:bg-muted/80"
                  style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}
                  onClick={() => {
                    // Select entire row
                    setSelection({
                      start: { row, col: 0 },
                      end: { row, col: DEFAULT_COLS - 1 },
                    });
                    setSelectedCell(getCellRef(row, 0));
                  }}
                >
                  {row + 1}
                </div>
                {/* Cells */}
                {Array.from({ length: DEFAULT_COLS }, (_, col) =>
                  renderCell(row, col)
                )}
              </div>
            );
          })}
          {/* Bottom spacer for rows below viewport */}
          {visibleRows.end < DEFAULT_ROWS && (
            <div style={{ height: (DEFAULT_ROWS - visibleRows.end) * CELL_HEIGHT }} />
          )}
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
                ? "bg-background border-border dark:border-border"
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
