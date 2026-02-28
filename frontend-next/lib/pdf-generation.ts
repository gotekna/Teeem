import api from "@/lib/api";

export interface PdfGenerationStatus {
  id: number;
  status: "pending" | "processing" | "completed" | "failed";
  generatorType: string;
  filename: string | null;
  downloadUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, unknown>;
}

interface EnqueueResponse {
  success: boolean;
  data: {
    pdfGenerationId: number;
    status: string;
    statusUrl: string;
    downloadUrl: string;
    message: string;
  };
}

interface StatusResponse {
  success: boolean;
  data: PdfGenerationStatus;
}

/**
 * Poll a PDF generation job until complete or failed.
 * Returns the final status with downloadUrl.
 *
 * Usage:
 *   const result = await pollPdfGeneration(pdfGenerationId);
 *   if (result.status === "completed") window.open(result.downloadUrl);
 */
export async function pollPdfGeneration(
  pdfGenerationId: number,
  options: {
    intervalMs?: number;
    maxWaitMs?: number;
    onProgress?: (status: PdfGenerationStatus) => void;
  } = {}
): Promise<PdfGenerationStatus> {
  const { intervalMs = 1500, maxWaitMs = 120_000, onProgress } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await api.get<StatusResponse>(
      `/api/v1/pdf_generations/${pdfGenerationId}`
    );

    const status = response.data;
    onProgress?.(status);

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("PDF generation timed out");
}

/**
 * Enqueue a PDF generation and return the generation ID.
 * Use with pollPdfGeneration() for the full async flow.
 */
export async function enqueuePdfGeneration(
  generatorType: string,
  generatorParams: Record<string, unknown>
): Promise<number> {
  const response = await api.post<EnqueueResponse>("/api/v1/pdf_generations", {
    generator_type: generatorType,
    generator_params: generatorParams,
  });

  if (!response?.success) {
    throw new Error("Failed to enqueue PDF generation");
  }

  return response!.data.pdfGenerationId;
}

/**
 * Full async PDF generation flow: enqueue, poll, download.
 * Returns the download URL when complete.
 *
 * Usage:
 *   const url = await generateAndDownloadPdf("teeem_document", { template_key: "specifications", job_id: 123 });
 *   window.open(url, "_blank");
 */
export async function generateAndDownloadPdf(
  generatorType: string,
  generatorParams: Record<string, unknown>,
  options: {
    onProgress?: (status: PdfGenerationStatus) => void;
    maxWaitMs?: number;
  } = {}
): Promise<string> {
  const pdfGenId = await enqueuePdfGeneration(generatorType, generatorParams);
  const result = await pollPdfGeneration(pdfGenId, options);

  if (result.status === "failed") {
    throw new Error(result.error || "PDF generation failed");
  }

  if (!result.downloadUrl) {
    throw new Error("PDF generated but no download URL available");
  }

  return result.downloadUrl;
}

/**
 * Helper to handle the common pattern where a controller now returns
 * a pdfGenerationId instead of direct PDF data.
 * Detects whether response is async (has pdfGenerationId) or legacy sync.
 */
export function isAsyncPdfResponse(
  response: Record<string, unknown>
): response is { success: boolean; data: { pdfGenerationId: number; downloadUrl: string } } {
  return !!(response?.data as Record<string, unknown>)?.pdfGenerationId;
}
