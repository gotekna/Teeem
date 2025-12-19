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
import { CheckCircle, AlertTriangle, Loader2, Upload, Sparkles } from "lucide-react"
import { api } from "@/lib/api"

// =============================================================================
// PlanProcessingModal - Unified progress modal for plan uploads & re-extractions
// =============================================================================
// This component is THE SSoT for showing plan processing progress.
// Used for:
// - Initial PDF uploads (dropping files into Plans tab)
// - Re-extract All from PDF (re-running AI identification)
// =============================================================================

type ProcessingMode = "upload" | "reextraction"

interface UploadProgress {
  id: number
  status: "pending" | "uploading" | "splitting" | "processing" | "completed" | "failed"
  current_step: string
  progress_percent: number
  total_pages: number | null
  processed_pages: number
  plans_created: string[]
  plans_count: number
  error_message: string | null
  duration: string | null
}

interface ReextractionProgress {
  id: number
  status: "pending" | "processing" | "completed" | "failed"
  current_step: string
  progress_percent: number
  total_plans: number
  processed_plans: number
  current_plan_name: string | null
  plans_updated: string[]
  plans_count: number
  rename_errors: { file: string; error: string }[]
  error_message: string | null
  duration: string | null
}

interface PlanProcessingModalProps {
  jobId: number
  mode: ProcessingMode
  processId: number | null
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function PlanProcessingModal({
  jobId,
  mode,
  processId,
  open,
  onClose,
  onComplete,
}: PlanProcessingModalProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [reextractionProgress, setReextractionProgress] = useState<ReextractionProgress | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isUpload = mode === "upload"
  const progress = isUpload ? uploadProgress : reextractionProgress

  // Fetch progress based on mode
  const fetchProgress = useCallback(async () => {
    if (!processId) return null

    try {
      const endpoint = isUpload
        ? `/api/v1/jobs/${jobId}/plan_uploads/${processId}`
        : `/api/v1/jobs/${jobId}/plan_reextractions/${processId}`

      const response = await api.get(endpoint) as { success: boolean; data: UploadProgress | ReextractionProgress }
      if (response.success) {
        if (isUpload) {
          setUploadProgress(response.data as UploadProgress)
        } else {
          setReextractionProgress(response.data as ReextractionProgress)
        }
        return response.data
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error)
    }
    return null
  }, [jobId, processId, isUpload])

  // Poll for progress while open
  useEffect(() => {
    if (!open || !processId) {
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
  }, [open, processId, fetchProgress])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setUploadProgress(null)
      setReextractionProgress(null)
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

  // Get display values based on mode
  const title = isUpload ? "Processing Plan Set" : "Re-extracting Plans from PDF"
  const icon = isUpload ? <Upload className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />

  const currentStep = progress?.current_step || "Preparing..."
  const progressPercent = progress?.progress_percent || 0

  // Progress counts
  const processedCount = isUpload
    ? (uploadProgress?.processed_pages || 0)
    : (reextractionProgress?.processed_plans || 0)
  const totalCount = isUpload
    ? (uploadProgress?.total_pages || 0)
    : (reextractionProgress?.total_plans || 0)
  const countLabel = isUpload ? "pages" : "plans"

  // Items list
  const items = isUpload
    ? (uploadProgress?.plans_created || [])
    : (reextractionProgress?.plans_updated || [])
  const itemsLabel = isUpload ? "Plans Created" : "Plans Updated"

  // Current item being processed (reextraction only)
  const currentItemName = !isUpload ? reextractionProgress?.current_plan_name : null

  // Errors
  const errorMessage = progress?.error_message
  const renameErrors = !isUpload ? (reextractionProgress?.rename_errors || []) : []

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

          {/* Current item being processed (reextraction only) */}
          {isProcessing && currentItemName && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Identifying: </span>
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

          {/* Rename errors warning (reextraction only) */}
          {renameErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {renameErrors.length} file(s) could not be renamed in SharePoint.
                Display names were updated but filenames remain unchanged.
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
