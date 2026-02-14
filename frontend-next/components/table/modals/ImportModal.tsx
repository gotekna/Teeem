/**
 * ImportModal Component
 *
 * Multi-step wizard for importing data into existing Foundation tables.
 * Steps: Upload → Column Mapping → Preview → Import
 *
 * Supports:
 * - CSV, XLSX file upload via drag-and-drop
 * - Auto-detection of Databuild format
 * - Automatic column name matching with manual override
 * - Preview before import with error highlighting
 * - Server-side parsing (no frontend CSV parsers needed)
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { MAX_IMPORT_SIZE } from '@/lib/constants/file-size-limits';

// ============================================================================
// TYPES
// ============================================================================

interface FoundationColumn {
  column_name: string;
  display_name: string;
  column_type: string;
  required?: boolean;
}

interface PreviewData {
  session_key: string;
  source_type: 'databuild' | 'generic';
  headers: string[];
  preview_rows: Record<string, unknown>[];
  suggested_mapping: Record<string, string>;
  foundation_columns: FoundationColumn[];
  total_rows: number;
}

interface ImportResult {
  created_count: number;
  error_count: number;
  errors: Array<{ index: number; errors: string[] }>;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

// ============================================================================
// PROPS
// ============================================================================

export interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foundationSlug: string;
  foundationName?: string;
  onImportComplete?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportModal({
  open,
  onOpenChange,
  foundationSlug,
  foundationName,
  onImportComplete,
}: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Preview/mapping state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Import result state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
    },
    maxFiles: 1,
    maxSize: MAX_IMPORT_SIZE,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await api.postFormData<{ success: boolean; data: PreviewData; error?: string }>(
        `/api/v1/foundations/${foundationSlug}/import/preview`,
        formData
      );

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setPreviewData(result.data);
      setColumnMapping(result.data.suggested_mapping || {});
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // COLUMN MAPPING
  // ============================================================================

  const mappedColumnsCount = Object.values(columnMapping).filter(v => v && v !== '_skip').length;
  const totalSourceColumns = previewData?.headers.length ?? 0;

  const handleMappingChange = (sourceColumn: string, targetColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [sourceColumn]: targetColumn,
    }));
  };

  // ============================================================================
  // IMPORT EXECUTION
  // ============================================================================

  const handleImport = async () => {
    if (!previewData) return;
    setStep('importing');
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post<{ success: boolean; data?: ImportResult; created_count?: number; error_count?: number; errors?: unknown[]; error?: string }>(
        `/api/v1/foundations/${foundationSlug}/import/execute`,
        {
          session_key: previewData.session_key,
          column_mapping: columnMapping,
        }
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Import failed');
      }

      setImportResult(result?.data || {
        created_count: result?.created_count || 0,
        error_count: result?.error_count || 0,
        errors: (result?.errors || []) as ImportResult['errors'],
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('mapping'); // Go back to mapping on error
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RESET & CLOSE
  // ============================================================================

  const resetModal = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setColumnMapping({});
    setImportResult(null);
    setError(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    if (step === 'done') {
      onImportComplete?.();
    }
    resetModal();
    onOpenChange(false);
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderUploadStep = () => (
    <>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium">Drop the file here...</p>
        ) : (
          <>
            <p className="text-sm font-medium mb-1">
              Drag & drop a file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports CSV, XLSX, and XML (Databuild) files up to 50MB
            </p>
          </>
        )}
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border mt-4">
          <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );

  const renderMappingStep = () => {
    if (!previewData) return null;

    return (
      <div className="space-y-4">
        {/* Source info */}
        <div className="flex items-center gap-2 text-sm">
          {previewData.source_type === 'databuild' && (
            <Badge variant="default" className="text-xs">Databuild Detected</Badge>
          )}
          <span className="text-muted-foreground">
            {previewData.total_rows} rows, {totalSourceColumns} columns
          </span>
          <span className="text-muted-foreground ml-auto">
            {mappedColumnsCount} of {totalSourceColumns} mapped
          </span>
        </div>

        {/* Mapping table */}
        <div className="max-h-[350px] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Source Column</th>
                <th className="text-center p-2 font-medium w-8"></th>
                <th className="text-left p-2 font-medium">Map To</th>
              </tr>
            </thead>
            <tbody>
              {previewData.headers.map((header) => (
                <tr key={header} className="border-t">
                  <td className="p-2">
                    <span className="font-mono text-xs">{header}</span>
                    {previewData.preview_rows[0] && (
                      <span className="text-xs text-muted-foreground ml-2">
                        e.g. &quot;{String(previewData.preview_rows[0][header] ?? '').slice(0, 30)}&quot;
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <ArrowRight className="h-3 w-3 text-muted-foreground mx-auto" />
                  </td>
                  <td className="p-2">
                    <Select
                      value={columnMapping[header] || '_skip'}
                      onValueChange={(val) => handleMappingChange(header, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">
                          <span className="text-muted-foreground">Skip (don&apos;t import)</span>
                        </SelectItem>
                        {previewData.foundation_columns.map((col) => (
                          <SelectItem key={col.column_name} value={col.column_name}>
                            {col.display_name || col.column_name}
                            {col.required && <span className="text-red-500 ml-1">*</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Preview of first few rows */}
        {previewData.preview_rows.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Preview data ({previewData.preview_rows.length} rows)
            </summary>
            <div className="mt-2 overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {previewData.headers.filter(h => columnMapping[h] && columnMapping[h] !== '_skip').map(h => (
                      <th key={h} className="p-1.5 text-left font-medium whitespace-nowrap">
                        {columnMapping[h]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview_rows.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {previewData.headers.filter(h => columnMapping[h] && columnMapping[h] !== '_skip').map(h => (
                        <td key={h} className="p-1.5 whitespace-nowrap max-w-[200px] truncate">
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <Spinner size={32} />
      <p className="text-sm text-muted-foreground">
        Importing {previewData?.total_rows ?? 0} records...
      </p>
    </div>
  );

  const renderDoneStep = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-4 py-4">
        <div className="flex flex-col items-center gap-3">
          {importResult.error_count === 0 ? (
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {importResult.created_count} records imported
            </p>
            {importResult.error_count > 0 && (
              <p className="text-sm text-destructive">
                {importResult.error_count} rows had errors
              </p>
            )}
          </div>
        </div>

        {importResult.errors.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-destructive/5">
            <p className="text-xs font-medium text-destructive mb-2">Errors:</p>
            {importResult.errors.slice(0, 20).map((err, idx) => (
              <p key={idx} className="text-xs text-destructive/80 mb-1">
                Row {err.index + 1}: {err.errors.join(', ')}
              </p>
            ))}
            {importResult.errors.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2">
                ...and {importResult.errors.length - 20} more errors
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // STEP TITLES
  // ============================================================================

  const stepTitles: Record<Step, string> = {
    upload: 'Import Data',
    mapping: 'Map Columns',
    preview: 'Map Columns',
    importing: 'Importing...',
    done: 'Import Complete',
  };

  const stepDescriptions: Record<Step, string> = {
    upload: `Upload a file to import into ${foundationName || 'this table'}`,
    mapping: 'Match source columns to table columns',
    preview: 'Review the data before importing',
    importing: 'Please wait while records are created',
    done: 'Import has finished',
  };

  return (
    <Dialog open={open} onOpenChange={step === 'importing' ? undefined : handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>
            {stepDescriptions[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="py-2">
          {step === 'upload' && renderUploadStep()}
          {(step === 'mapping' || step === 'preview') && renderMappingStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'done' && renderDoneStep()}
        </div>

        {/* Footer */}
        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!selectedFile || isLoading}>
                {isLoading ? (
                  <><Spinner size={16} className="mr-2" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Upload & Preview</>
                )}
              </Button>
            </>
          )}

          {(step === 'mapping' || step === 'preview') && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setError(null); }}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={mappedColumnsCount === 0 || isLoading}
              >
                <Check className="h-4 w-4 mr-2" />
                Import {previewData?.total_rows ?? 0} Records
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
