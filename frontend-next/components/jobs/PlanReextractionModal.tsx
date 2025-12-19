"use client"

import { useState, useEffect, useCallback } from "react"
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
import { CheckCircle, AlertTriangle, Loader2, X } from "lucide-react"
import { api } from "@/lib/api"

interface ReextractionProgress {
  id: number
  job_id: number
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
  started_at: string | null
  completed_at: string | null
}

interface PlanReextractionModalProps {
  jobId: number
  reextractionId: number | null
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function PlanReextractionModal({
  jobId,
  reextractionId,
  open,
  onClose,
  onComplete,
}: PlanReextractionModalProps) {
  const [progress, setProgress] = useState<ReextractionProgress | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const fetchProgress = useCallback(async () => {
    if (!reextractionId) return

    try {
      const response = await api.get(
        `/api/v1/jobs/${jobId}/plan_reextractions/${reextractionId}`
      )
      if (response.success) {
        setProgress(response.data)
        return response.data
      }
    } catch (error) {
      console.error("Failed to fetch reextraction progress:", error)
    }
    return null
  }, [jobId, reextractionId])

  // Poll for progress while open and in progress
  useEffect(() => {
    if (!open || !reextractionId) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)

    // Initial fetch
    fetchProgress()

    // Poll every 1.5 seconds
    const interval = setInterval(async () => {
      const data = await fetchProgress()
      if (data && (data.status === "completed" || data.status === "failed")) {
        setIsPolling(false)
        clearInterval(interval)
      }
    }, 1500)

    return () => {
      clearInterval(interval)
      setIsPolling(false)
    }
  }, [open, reextractionId, fetchProgress])

  const handleClose = () => {
    if (progress?.status === "completed" || progress?.status === "failed") {
      onComplete()
    }
    onClose()
  }

  const isComplete = progress?.status === "completed"
  const isFailed = progress?.status === "failed"
  const isProcessing = progress?.status === "processing" || progress?.status === "pending"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {isComplete && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isFailed && <AlertTriangle className="h-5 w-5 text-red-500" />}
            Re-extracting Plans from PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progress?.current_step || "Preparing..."}</span>
              <span>
                {progress?.processed_plans || 0} of {progress?.total_plans || 0}
              </span>
            </div>
            <Progress value={progress?.progress_percent || 0} className="h-2" />
          </div>

          {/* Current plan being processed */}
          {isProcessing && progress?.current_plan_name && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Identifying: </span>
              <span className="text-sm font-medium">{progress.current_plan_name}</span>
            </div>
          )}

          {/* Updated plans scroll list */}
          {progress?.plans_updated && progress.plans_updated.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Updated Plans ({progress.plans_count})
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-1">
                  {progress.plans_updated.map((name, i) => (
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

          {/* Rename errors warning */}
          {progress?.rename_errors && progress.rename_errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {progress.rename_errors.length} file(s) could not be renamed in
                SharePoint. Display names were updated but filenames remain unchanged.
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {isFailed && progress?.error_message && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{progress.error_message}</AlertDescription>
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
