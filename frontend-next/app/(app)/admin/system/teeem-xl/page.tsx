"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { FileSpreadsheet, Download, Upload, Check, AlertCircle, Code } from "lucide-react";

interface ParsedSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  preview: (string | number | boolean | Date | null)[][];
}

interface ParseResult {
  sheets: ParsedSheet[];
  totalCells: number;
  parseTime: number;
}

export default function TeeemXLPage() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParseResult(null);
      setParseError(null);
    }
  };

  // Parse Excel file using TeeemXL
  const handleParse = async () => {
    if (!selectedFile) return;

    setParsing(true);
    setParseError(null);
    setParseResult(null);

    const startTime = performance.now();

    try {
      const TeeemXL = await import("@/lib/teeem-xl");
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = await TeeemXL.read(arrayBuffer);

      const sheets: ParsedSheet[] = workbook.sheets.map((sheet) => {
        const rows = TeeemXL.getRows(sheet);
        const preview = rows.slice(0, 10);

        return {
          name: sheet.name,
          rowCount: rows.length,
          columnCount: rows[0]?.length || 0,
          preview,
        };
      });

      const totalCells = sheets.reduce(
        (sum, sheet) => sum + sheet.rowCount * sheet.columnCount,
        0
      );

      const parseTime = performance.now() - startTime;

      setParseResult({
        sheets,
        totalCells,
        parseTime,
      });
    } catch (error) {
      console.error("Parse error:", error);
      setParseError(error instanceof Error ? error.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  // Generate sample Excel file
  const handleGenerateSample = async () => {
    setGenerating(true);

    try {
      const TeeemXL = await import("@/lib/teeem-xl");

      // Create sample data
      const headerRow = ["ID", "Name", "Department", "Salary", "Start Date", "Active"];
      const dataRows = [
        [1, "Alice Johnson", "Engineering", 95000, new Date("2021-03-15"), true],
        [2, "Bob Smith", "Marketing", 72000, new Date("2020-07-22"), true],
        [3, "Carol Williams", "Engineering", 88000, new Date("2019-11-08"), true],
        [4, "David Brown", "Sales", 65000, new Date("2022-01-10"), false],
        [5, "Eve Davis", "HR", 58000, new Date("2021-09-03"), true],
        [6, "Frank Miller", "Engineering", 102000, new Date("2018-05-20"), true],
        [7, "Grace Wilson", "Marketing", 78000, new Date("2020-12-01"), true],
        [8, "Henry Taylor", "Sales", 71000, new Date("2021-06-15"), true],
        [9, "Ivy Anderson", "Engineering", 92000, new Date("2019-04-28"), false],
        [10, "Jack Thomas", "HR", 55000, new Date("2022-08-12"), true],
      ];

      const allData = [headerRow, ...dataRows];

      const blob = await TeeemXL.write(allData, {
        sheetName: "Employees",
        headerStyle: { bold: true, backgroundColor: "4F81BD" },
        freezeHeader: true,
        columnWidths: [8, 20, 15, 12, 15, 10],
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teeem-xl-sample.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Generate error:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">TeeemXL</h1>
          <p className="text-muted-foreground">
            Custom Excel library - lightweight, fast, zero external dependencies
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          v1.0
        </Badge>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              XLSX Read/Write
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Full OOXML support for reading and writing Excel files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Formulas & Styles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Preserves formulas, formatting, freeze panes, and column widths
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Roo-Compatible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Backend adapter provides drop-in replacement for Roo gem
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="read" className="space-y-4">
        <TabsList>
          <TabsTrigger value="read">
            <Upload className="h-4 w-4 mr-2" />
            Read Excel
          </TabsTrigger>
          <TabsTrigger value="write">
            <Download className="h-4 w-4 mr-2" />
            Write Excel
          </TabsTrigger>
          <TabsTrigger value="api">
            <Code className="h-4 w-4 mr-2" />
            API Reference
          </TabsTrigger>
        </TabsList>

        {/* Read Tab */}
        <TabsContent value="read" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parse Excel File</CardTitle>
              <CardDescription>
                Select an .xlsx file to parse using TeeemXL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="file">Excel File (.xlsx)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                  />
                </div>
                <Button
                  onClick={handleParse}
                  disabled={!selectedFile || parsing}
                >
                  {parsing ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Parse
                    </>
                  )}
                </Button>
              </div>

              {parseError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}

              {parseResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="outline">
                      {parseResult.sheets.length} sheet{parseResult.sheets.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline">
                      {parseResult.totalCells.toLocaleString()} cells
                    </Badge>
                    <Badge variant="secondary">
                      Parsed in {parseResult.parseTime.toFixed(1)}ms
                    </Badge>
                  </div>

                  {parseResult.sheets.map((sheet, idx) => (
                    <Card key={idx}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          {sheet.name}
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {sheet.rowCount} rows × {sheet.columnCount} cols
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <tbody>
                              {sheet.preview.map((row, rowIdx) => (
                                <tr key={rowIdx} className={rowIdx === 0 ? "bg-muted font-medium" : ""}>
                                  {row.map((cell, cellIdx) => (
                                    <td
                                      key={cellIdx}
                                      className="border px-2 py-1 max-w-[150px] truncate"
                                      title={String(cell ?? "")}
                                    >
                                      {cell instanceof Date
                                        ? cell.toLocaleDateString()
                                        : cell === true
                                        ? "TRUE"
                                        : cell === false
                                        ? "FALSE"
                                        : cell ?? ""}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {sheet.rowCount > 10 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Showing first 10 of {sheet.rowCount} rows
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Write Tab */}
        <TabsContent value="write" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Excel File</CardTitle>
              <CardDescription>
                Create a sample Excel file using TeeemXL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click the button below to generate and download a sample Excel file with:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>10 employee records with various data types</li>
                <li>Styled header row (bold, colored background)</li>
                <li>Frozen header row</li>
                <li>Custom column widths</li>
              </ul>

              <Button onClick={handleGenerateSample} disabled={generating}>
                {generating ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Sample Excel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Reference Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Frontend API</CardTitle>
              <CardDescription>TypeScript/JavaScript usage</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`import * as TeeemXL from '@/lib/teeem-xl';

// Read Excel file
const workbook = await TeeemXL.read(arrayBuffer);
workbook.sheets.forEach(sheet => {
  console.log(sheet.name, sheet.getRows());
});

// Write Excel file
const data = [
  ['Name', 'Age', 'Active'],
  ['Alice', 30, true],
  ['Bob', 25, false],
];

const blob = await TeeemXL.write(data, {
  sheetName: 'People',
  headerStyle: { bold: true, backgroundColor: '4F81BD' },
  freezeHeader: true,
  columnWidths: [20, 10, 10],
});`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backend API (Ruby)</CardTitle>
              <CardDescription>Roo-compatible adapter</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`# Read Excel file (Roo-compatible API)
spreadsheet = TeeemXl::SpreadsheetAdapter.open('file.xlsx')

spreadsheet.sheets          # => ['Sheet1', 'Sheet2']
spreadsheet.sheet('Sheet1') # Select sheet
spreadsheet.row(1)          # => ['Header1', 'Header2', ...]
spreadsheet.cell(1, 1)      # => 'Header1'
spreadsheet.last_row        # => 100
spreadsheet.last_column     # => 5

# Write Excel file
workbook = TeeemXl::Models::Workbook.new
sheet = workbook.add_sheet('Data')
sheet.add_row(['Name', 'Value'])
sheet.add_row(['Item', 100])
sheet.column_widths = [20, 15]
sheet.freeze_panes(row: 1)

TeeemXl.write(workbook, 'output.xlsx')`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        TeeemXL replaces ExcelJS (frontend) and Roo (backend) with a custom implementation.
        <br />
        No external dependencies. Full OOXML compatibility.
      </div>
    </div>
  );
}
