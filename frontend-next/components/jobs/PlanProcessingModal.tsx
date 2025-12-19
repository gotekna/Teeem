"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, Loader2, Upload, Sparkles, FolderSearch, FileCheck } from "lucide-react"
import { api } from "@/lib/api"

// =============================================================================
// PlanProcessingModal - Unified progress modal for ALL batch operations
// =============================================================================
// This component is THE SSoT for showing batch operation progress.
// Uses BatchOperation API (SSoT for all batch operations)
//
// Supports:
// - plan_upload: Upload and split multi-page PDF into plans
// - plan_reextract: Re-extract and rename existing plans from PDF
// - folder_scan: Scan SharePoint folders for new plan files
// - folder_process: Process pending scanned files into plans
// =============================================================================

export type OperationType = "plan_upload" | "plan_reextract" | "folder_scan" | "folder_process"

// Unified progress interface from BatchOperation.as_json_status
interface BatchOperationProgress {
  id: number
  job_id: number | null
  operation_type: OperationType
  operation_title: string
  status: "pending" | "processing" | "completed" | "failed"
  current_step: string
  progress_percent: number
  total_items: number
  processed_items: number
  items_label: string
  current_item_name: string | null
  items_completed: string[]
  items_count: number
  completed_items_label: string
  operation_errors: { item: string; message: string }[]
  error_message: string | null
  duration: string | null
  metadata: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface PlanProcessingModalProps {
  jobId?: number  // Optional for global operations (folder_scan, folder_process)
  operationType: OperationType
  operationId: number | null
  open: boolean
  onClose: () => void
  onComplete: () => void
}

// Icon mapping for operation types
const operationIcons: Record<OperationType, React.ReactNode> = {
  plan_upload: <Upload className="h-5 w-5" />,
  plan_reextract: <Sparkles className="h-5 w-5" />,
  folder_scan: <FolderSearch className="h-5 w-5" />,
  folder_process: <FileCheck className="h-5 w-5" />,
}

export function PlanProcessingModal({
  jobId,
  operationType,
  operationId,
  open,
  onClose,
  onComplete,
}: PlanProcessingModalProps) {
  const [progress, setProgress] = useState<BatchOperationProgress | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Build API endpoint based on whether operation is job-scoped or global
  const getEndpoint = useCallback(() => {
    if (!operationId) return null
    if (jobId) {
      return `/api/v1/jobs/${jobId}/batch_operations/${operationId}`
    }
    return `/api/v1/batch_operations/${operationId}`
  }, [jobId, operationId])

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    const endpoint = getEndpoint()
    if (!endpoint) return null

    try {
      const response = await api.get(endpoint) as { success: boolean; data: BatchOperationProgress }
      if (response.success) {
        setProgress(response.data)
        return response.data
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error)
    }
    return null
  }, [getEndpoint])

  // Poll for progress while open
  useEffect(() => {
    if (!open || !operationId) {
      return
    }

    // Initial fetch
    fetchProgress()

    // Poll every 1.5 seconds
    pollIntervalRef.current = setInterval(async () => {
      const data = await fetchProgress()
      if (data && (data.status === "completed" || data.status === "failed")) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }, 1500)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [open, operationId, fetchProgress])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setProgress(null)
    }
  }, [open])

  const handleClose = () => {
    if (progress?.status === "completed" || progress?.status === "failed") {
      onComplete()
    }
    onClose()
  }

  const isComplete = progress?.status === "completed"
  const isFailed = progress?.status === "failed"
  const isProcessing = !isComplete && !isFailed

  // Get display values from unified progress
  const title = progress?.operation_title || "Processing..."
  const icon = operationIcons[operationType]
  const currentStep = progress?.current_step || "Preparing..."
  const progressPercent = progress?.progress_percent || 0
  const processedCount = progress?.processed_items || 0
  const totalCount = progress?.total_items || 0
  const countLabel = progress?.items_label || "items"
  const items = progress?.items_completed || []
  const itemsLabel = progress?.completed_items_label || "Items Completed"
  const currentItemName = progress?.current_item_name
  const errorMessage = progress?.error_message
  const operationErrors = progress?.operation_errors || []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {isComplete && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isFailed && <AlertTriangle className="h-5 w-5 text-red-500" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{currentStep}</span>
              <span>
                {processedCount} of {totalCount || "?"} {countLabel}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Current item being processed */}
          {isProcessing && currentItemName && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Processing: </span>
              <span className="text-sm font-medium">{currentItemName}</span>
            </div>
          )}

          {/* Items scroll list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {itemsLabel} ({items.length})
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-1">
                  {items.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Operation errors warning */}
          {operationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {operationErrors.length} item(s) had errors during processing.
                <ul className="mt-2 text-xs space-y-1">
                  {operationErrors.slice(0, 3).map((err, i) => (
                    <li key={i}>• {err.item}: {err.message}</li>
                  ))}
                  {operationErrors.length > 3 && (
                    <li>...and {operationErrors.length - 3} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {isFailed && errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Duration */}
          {progress?.duration && (isComplete || isFailed) && (
            <div className="text-sm text-muted-foreground text-center">
              Completed in {progress.duration}
            </div>
          )}

          {/* Close button when complete */}
          {(isComplete || isFailed) && (
            <div className="flex justify-end">
              <Button onClick={handleClose}>
                {isComplete ? "Done" : "Close"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
