"use client";

import * as React from "react";
import TeeemXL, { getRows, Workbook } from "@/lib/teeem-xl";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ExcelDocumentPreviewProps {
  url: string;
  className?: string;
}

/**
 * Excel Document Preview Component
 * Fetches a .xlsx file and renders it as a table using TeeemXL
 */
export function ExcelDocumentPreview({ url, className }: ExcelDocumentPreviewProps) {
  const [workbook, setWorkbook] = React.useState<Workbook | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeSheet, setActiveSheet] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      setWorkbook(null);

      try {
        // Fetch the document from the URL
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Parse Excel file using TeeemXL
        const wb = await TeeemXL.read(arrayBuffer);

        if (!cancelled) {
          setWorkbook(wb);
          // Set first sheet as active
          if (wb.sheets.length > 0) {
            setActiveSheet(wb.sheets[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to load Excel document:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading spreadsheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!workbook || workbook.sheets.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-sm text-muted-foreground">No data found in spreadsheet</p>
      </div>
    );
  }

  const activeSheetData = workbook.sheets.find(s => s.name === activeSheet);
  const rows = activeSheetData ? getRows(activeSheetData) : [];

  return (
    <div className={`h-full flex flex-col bg-background ${className}`}>
      {/* Sheet tabs if multiple sheets */}
      {workbook.sheets.length > 1 && (
        <div className="border-b px-4 py-2 flex-shrink-0">
          <Tabs value={activeSheet} onValueChange={setActiveSheet}>
            <TabsList className="h-8">
              {workbook.sheets.map((sheet) => (
                <TabsTrigger
                  key={sheet.name}
                  value={sheet.name}
                  className="text-xs px-3 h-7"
                >
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Spreadsheet content */}
      <div className="flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Sheet is empty</p>
          </div>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={cn(
                      rowIndex === 0 && "bg-muted/50 font-medium",
                      "border-b last:border-b-0"
                    )}
                  >
                    {/* Row number */}
                    <td className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/30 border-r w-10 text-center">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className={cn(
                          "px-3 py-1.5 border-r last:border-r-0 whitespace-nowrap",
                          typeof cell === 'number' && "text-right font-mono"
                        )}
                      >
                        {cell !== null && cell !== undefined ? String(cell) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground flex-shrink-0">
        {rows.length} rows × {rows[0]?.length || 0} columns
        {workbook.sheets.length > 1 && ` • ${workbook.sheets.length} sheets`}
      </div>
    </div>
  );
}
