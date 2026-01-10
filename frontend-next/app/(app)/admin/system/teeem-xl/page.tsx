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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/contexts/LayoutModeContext";

// Grid configuration
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26; // A-Z
const CELL_WIDTH = 100;
const CELL_HEIGHT = 28;
const ROW_HEADER_WIDTH = 50;

// Types
type CellValue = string | number | boolean | null;

interface CellData {
  value: CellValue;
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
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    col: colLetterToIndex(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULA FUNCTIONS (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

type FormulaFunction = (args: CellValue[]) => CellValue;

const FUNCTIONS: Record<string, FormulaFunction> = {
  // Math functions
  SUM: (args) => {
    return args.reduce((sum: number, val) => {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  },

  AVERAGE: (args) => {
    const nums = args
      .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },

  COUNT: (args) => {
    return args.filter(
      (v) => typeof v === "number" || !isNaN(parseFloat(String(v)))
    ).length;
  },

  COUNTA: (args) => {
    return args.filter((v) => v !== null && v !== "").length;
  },

  MIN: (args) => {
    const nums = args
      .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
      .filter((n) => !isNaN(n));
    return nums.length ? Math.min(...nums) : 0;
  },

  MAX: (args) => {
    const nums = args
      .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
      .filter((n) => !isNaN(n));
    return nums.length ? Math.max(...nums) : 0;
  },

  ROUND: (args) => {
    const [value, decimals = 0] = args;
    const num = typeof value === "number" ? value : parseFloat(String(value));
    const dec =
      typeof decimals === "number" ? decimals : parseInt(String(decimals));
    if (isNaN(num)) return "#VALUE!";
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  },

  ABS: (args) => {
    const num =
      typeof args[0] === "number" ? args[0] : parseFloat(String(args[0]));
    return isNaN(num) ? "#VALUE!" : Math.abs(num);
  },

  // Logical functions
  IF: (args) => {
    const [condition, trueValue, falseValue = ""] = args;
    return condition ? trueValue : falseValue;
  },

  AND: (args) => args.every((v) => Boolean(v)),

  OR: (args) => args.some((v) => Boolean(v)),

  NOT: (args) => !Boolean(args[0]),

  // Text functions
  CONCATENATE: (args) => args.map((v) => String(v ?? "")).join(""),

  LEN: (args) => String(args[0] ?? "").length,

  UPPER: (args) => String(args[0] ?? "").toUpperCase(),

  LOWER: (args) => String(args[0] ?? "").toLowerCase(),

  TRIM: (args) => String(args[0] ?? "").trim(),

  LEFT: (args) => {
    const [text, count = 1] = args;
    const n = typeof count === "number" ? count : parseInt(String(count));
    return String(text ?? "").substring(0, n);
  },

  RIGHT: (args) => {
    const [text, count = 1] = args;
    const str = String(text ?? "");
    const n = typeof count === "number" ? count : parseInt(String(count));
    return str.substring(str.length - n);
  },

  // Date functions
  TODAY: () => new Date().toISOString().split("T")[0],

  NOW: () => new Date().toISOString(),
};

// Parse range and return array of cell values (A1:A10)
function parseRange(
  range: string,
  cells: Record<string, CellData>
): CellValue[] {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return [];

  const [, startCol, startRow, endCol, endRow] = match;
  const startColIdx = colLetterToIndex(startCol);
  const endColIdx = colLetterToIndex(endCol);
  const startRowIdx = parseInt(startRow) - 1;
  const endRowIdx = parseInt(endRow) - 1;

  const values: CellValue[] = [];
  for (
    let r = Math.min(startRowIdx, endRowIdx);
    r <= Math.max(startRowIdx, endRowIdx);
    r++
  ) {
    for (
      let c = Math.min(startColIdx, endColIdx);
      c <= Math.max(startColIdx, endColIdx);
      c++
    ) {
      const ref = getCellRef(r, c);
      const cell = cells[ref];
      values.push(cell?.value ?? null);
    }
  }
  return values;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TeeemXLPage() {
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
  const [sheets, setSheets] = React.useState<SheetData[]>([
    { name: "Sheet1", cells: {} },
  ]);
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [hasChanges, setHasChanges] = React.useState(false);

  // Phase 1: Selection state
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Phase 1: Clipboard state
  const [clipboard, setClipboard] = React.useState<ClipboardData | null>(null);

  // Phase 1: History state (undo/redo)
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  const gridRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
  // FORMULA EVALUATOR (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  const evaluateFormula = (
    formula: string,
    cells: Record<string, CellData>
  ): CellValue => {
    try {
      let expr = formula.substring(1).trim();

      // Parse function calls recursively
      let iterations = 0;
      const maxIterations = 100;

      while (/[A-Z]+\([^()]*\)/i.test(expr) && iterations < maxIterations) {
        iterations++;
        expr = expr.replace(
          /([A-Z]+)\(([^()]*)\)/gi,
          (match, funcName, argsStr) => {
            const func = FUNCTIONS[funcName.toUpperCase()];
            if (!func) return "#NAME?";

            // Parse arguments
            const args: CellValue[] = [];
            if (argsStr.trim()) {
              // Split by comma, but be careful with nested quotes
              const argParts = argsStr.split(",").map((s: string) => s.trim());

              for (const arg of argParts) {
                if (arg.includes(":")) {
                  // Range reference (A1:A10)
                  args.push(...parseRange(arg, cells));
                } else if (/^[A-Z]+\d+$/i.test(arg)) {
                  // Single cell reference
                  const cell = cells[arg.toUpperCase()];
                  args.push(cell?.value ?? null);
                } else if (!isNaN(parseFloat(arg))) {
                  // Number
                  args.push(parseFloat(arg));
                } else if (arg.startsWith('"') && arg.endsWith('"')) {
                  // String literal
                  args.push(arg.slice(1, -1));
                } else if (arg.toUpperCase() === "TRUE") {
                  args.push(true);
                } else if (arg.toUpperCase() === "FALSE") {
                  args.push(false);
                } else {
                  // Expression or comparison - try to evaluate
                  args.push(arg);
                }
              }
            }

            const result = func(args);
            if (typeof result === "string" && result.startsWith("#")) {
              return result;
            }
            return typeof result === "string" ? `"${result}"` : String(result);
          }
        );
      }

      // Replace remaining cell references with values
      expr = expr.replace(/([A-Z]+)(\d+)/gi, (match) => {
        const cell = cells[match.toUpperCase()];
        const val = cell?.value ?? 0;
        return typeof val === "string" ? `"${val}"` : String(val);
      });

      // Check for error codes
      if (expr.includes("#")) {
        const errorMatch = expr.match(/#[A-Z!?]+/);
        if (errorMatch) return errorMatch[0];
      }

      // Evaluate - only if safe (numbers, math, comparison operators)
      if (/^[\d\s+\-*/().,"<>=!&|truefalse]+$/i.test(expr)) {
        const result = Function(`"use strict"; return (${expr})`)();
        return result;
      }

      // Try basic evaluation for simple expressions
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        const result = Function(`"use strict"; return (${expr})`)();
        return typeof result === "number" && !isNaN(result) ? result : "#ERROR";
      }

      return "#ERROR";
    } catch {
      return "#ERROR";
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const getSelectionBounds = () => {
    if (!selection)
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, hasSelection: false };
    return {
      minRow: Math.min(selection.start.row, selection.end.row),
      maxRow: Math.max(selection.start.row, selection.end.row),
      minCol: Math.min(selection.start.col, selection.end.col),
      maxCol: Math.max(selection.start.col, selection.end.col),
      hasSelection: true,
    };
  };

  const isInSelection = (row: number, col: number) => {
    if (!selection) return false;
    const { minRow, maxRow, minCol, maxCol } = getSelectionBounds();
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

  // Adjust formula references when pasting
  const adjustFormula = (
    formula: string,
    rowOffset: number,
    colOffset: number
  ): string => {
    return formula.replace(/([A-Z]+)(\d+)/gi, (match, colStr, rowStr) => {
      const newCol = getColumnLetter(colLetterToIndex(colStr) + colOffset);
      const newRow = parseInt(rowStr) + rowOffset;
      if (newRow < 1) return match; // Don't adjust to invalid reference
      return `${newCol}${newRow}`;
    });
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

    forEachSelectedCell((row, col, ref) => {
      delete activeSheet.cells[ref];
    });

    newSheets[activeSheetIndex] = activeSheet;
    setSheets(newSheets);
    setHasChanges(true);
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
    setEditingCell(null);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging && selection) {
      setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleCellDoubleClick = (ref: string) => {
    setSelectedCell(ref);
    setEditingCell(ref);
    const cell = sheets[activeSheetIndex].cells[ref];
    setEditValue(cell?.formula || cell?.value?.toString() || "");
    setTimeout(() => inputRef.current?.focus(), 0);
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
        let cellValue: CellValue = editValue;
        let cellType: "string" | "number" | "boolean" | "formula" = "string";
        let formula: string | undefined;

        if (editValue.startsWith("=")) {
          cellType = "formula";
          formula = editValue;
          cellValue = evaluateFormula(editValue, activeSheet.cells);
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
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      handleCellBlur();
      const newCol = e.shiftKey ? Math.max(0, parsed.col - 1) : parsed.col + 1;
      const newRef = getCellRef(parsed.row, newCol);
      setSelectedCell(newRef);
      setSelection({ start: { row: parsed.row, col: newCol }, end: { row: parsed.row, col: newCol } });
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      pasteClipboard();
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

    return (
      <div
        key={ref}
        className={cn(
          "border-r border-b border-gray-200 dark:border-gray-700 px-1 flex items-center overflow-hidden relative",
          isSelected && "ring-2 ring-blue-500 ring-inset z-10",
          inSelection && !isSelected && "bg-blue-100 dark:bg-blue-900/30",
          !isEditing && "cursor-cell"
        )}
        style={{ width: CELL_WIDTH, height: CELL_HEIGHT, minWidth: CELL_WIDTH }}
        onMouseDown={(e) => handleCellMouseDown(row, col, e)}
        onMouseEnter={() => handleCellMouseEnter(row, col)}
        onDoubleClick={() => handleCellDoubleClick(ref)}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleInputKeyDown}
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
        <span className="text-xs font-mono w-12 text-center">
          {selectedCell || ""}
        </span>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs flex-1 font-mono">
          {selectedCell &&
            (sheets[activeSheetIndex]?.cells[selectedCell]?.formula ||
              sheets[activeSheetIndex]?.cells[selectedCell]?.value?.toString() ||
              "")}
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
                className="border-r border-b border-gray-300 dark:border-gray-600 bg-muted flex items-center justify-center text-xs font-medium cursor-pointer hover:bg-muted/80"
                style={{
                  width: CELL_WIDTH,
                  height: CELL_HEIGHT,
                  minWidth: CELL_WIDTH,
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
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: DEFAULT_ROWS }, (_, row) => (
            <div key={row} className="flex">
              {/* Row header */}
              <div
                className="border-r border-b border-gray-300 dark:border-gray-600 bg-muted flex items-center justify-center text-xs font-medium sticky left-0 z-10 cursor-pointer hover:bg-muted/80"
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
