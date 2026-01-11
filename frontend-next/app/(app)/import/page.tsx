"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";

interface PreviewData {
  file_name: string;
  headers: string[];
  rows: string[][];
  total_rows: number;
  suggested_types: Record<string, string>;
  upload_id: string;
}

interface ColumnMapping {
  header: string;
  type: string;
  include: boolean;
}

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
];

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  // SSoT: URL state for wizard step (enables browser back/forward)
  const [urlState, setUrlState] = useUrlState({
    step: null as string | null,  // null = "upload"
  });
  const step = (urlState.step as "upload" | "preview") || "upload";
  const setStep = (newStep: "upload" | "preview") => {
    setUrlState({ step: newStep === "upload" ? null : newStep });
  };
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [tableName, setTableName] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
     
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/imports/preview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        setPreviewData(data);
        setTableName(file.name.replace(/\.(csv|xlsx|xls)$/i, ""));
        setColumnMappings(
          data.headers.map((header: string) => ({
            header,
            type: data.suggested_types[header] || "text",
            include: true,
          }))
        );
        setStep("preview");
      } else {
        throw new Error(data.error || "Failed to parse file");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!previewData || !tableName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a table name",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const response = await api.post<{ success: boolean; foundation_id: number; error?: string }>(
        "/api/v1/imports/create",
        {
          upload_id: previewData.upload_id,
          table_name: tableName,
          columns: columnMappings
            .filter((col) => col.include)
            .map((col) => ({
              header: col.header,
              type: col.type,
            })),
        }
      );

      if (response?.success) {
        toast({
          title: "Import successful",
          description: `Created table "${tableName}" with ${previewData.total_rows} rows`,
        });
        router.push(`/t/${response.foundation_id}`);
      } else {
        throw new Error(response?.error || "Import failed");
      }
    } catch (err) {
      console.error("Import failed:", err);
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleBack = () => {
    setStep("upload");
    setPreviewData(null);
    setColumnMappings([]);
    setTableName("");
  };

  const updateColumnMapping = (index: number, field: keyof ColumnMapping, value: string | boolean) => {
    setColumnMappings((prev) =>
      prev.map((col, i) => (i === index ? { ...col, [field]: value } : col))
    );
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Data</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a CSV or Excel file to automatically create a new table.
        </p>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Drag and drop a file or click to browse. Supports CSV and Excel formats.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <>
                  <Spinner size={48} className="text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">Processing file...</p>
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Drag and drop your file here, or{" "}
                    <label className="cursor-pointer text-primary hover:underline">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileInput}
                      />
                    </label>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    CSV, XLS, or XLSX up to 10MB
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && previewData && (
        <div className="space-y-6">
          {/* File Info */}
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-3">
                <DocumentIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{previewData.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {previewData.total_rows} rows, {previewData.headers.length} columns
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <XMarkIcon className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </CardContent>
          </Card>

          {/* Table Name */}
          <Card>
            <CardHeader>
              <CardTitle>Table Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter a name for your table"
              />
            </CardContent>
          </Card>

          {/* Column Mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Column Configuration</CardTitle>
              <CardDescription>
                Configure which columns to import and their data types.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Include</TableHead>
                    <TableHead>Column Name</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Sample Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((col, index) => (
                    <TableRow key={col.header}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={col.include}
                          onChange={(e) =>
                            updateColumnMapping(index, "include", e.target.checked)
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{col.header}</TableCell>
                      <TableCell>
                        <Select
                          value={col.type}
                          onValueChange={(value) => updateColumnMapping(index, "type", value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMN_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {previewData.rows
                          .slice(0, 3)
                          .map((row) => row[index])
                          .filter(Boolean)
                          .join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Showing first {Math.min(5, previewData.rows.length)} of {previewData.total_rows} rows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((header, i) => (
                        <TableHead
                          key={header}
                          className={!columnMappings[i]?.include ? "opacity-50" : ""}
                        >
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell
                            key={cellIndex}
                            className={!columnMappings[cellIndex]?.include ? "opacity-50" : ""}
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing || !tableName.trim()}>
              {importing ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="mr-2 h-4 w-4" />
                  Import {previewData.total_rows} rows
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
