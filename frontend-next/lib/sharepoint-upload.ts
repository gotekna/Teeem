/**
 * ULTRA MASTERPIECE: Direct Browser-to-SharePoint Uploads
 *
 * This module enables browsers to upload files directly to SharePoint,
 * bypassing the Heroku backend proxy entirely.
 *
 * Benefits:
 * - 50% faster uploads (1 hop instead of 2)
 * - Zero Heroku bandwidth/memory usage for file data
 * - No timeout risk
 * - Real-time progress tracking
 *
 * How it works:
 * 1. Browser calls backend to get a pre-authenticated upload URL
 * 2. Browser uploads directly to SharePoint (URL contains embedded token)
 * 3. Browser notifies backend of completion for activity logging + warehouse indexing
 *
 * The uploadUrl from Microsoft Graph is pre-authenticated - browsers can PUT directly
 * to it WITHOUT any Authorization header. The URL contains an embedded token.
 */

import { api } from "./api";

interface UploadSessionResponse {
  success: boolean;
  upload_url: string;
  expiration: string;
  filename: string;
  folder_id: string;
  chunk_size: number;
  file_size: number;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: "preparing" | "uploading" | "completing" | "done" | "error";
  message?: string;
}

export interface DirectUploadResult {
  success: boolean;
  webUrl?: string;
  itemId?: string;
  filename?: string;
  error?: string;
}

export interface DirectUploadOptions {
  jobId?: string | number;
  folderId?: string;
  folderPath?: string;
  filename?: string;
  onProgress?: (progress: UploadProgress) => void;
}

// Chunk size: 5MB (must be multiple of 320 KiB per Microsoft Graph API)
const CHUNK_SIZE = 5 * 1024 * 1024;
// Small file threshold: 4MB (below this, single PUT is sufficient)
const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024;

/**
 * Upload a file directly to SharePoint, bypassing the backend proxy.
 *
 * @param file - The file to upload
 * @param options - Upload options including jobId, folderPath, etc.
 * @returns Promise with upload result including SharePoint URL and item ID
 *
 * @example
 * ```typescript
 * const result = await uploadToSharePointDirect(file, {
 *   jobId: 123,
 *   folderPath: "06 Photo/01 SITE",
 *   filename: "photo_2024-01-15.jpg",
 *   onProgress: (p) => console.log(`${p.percentage}%`)
 * });
 *
 * if (result.success) {
 *   console.log("Uploaded to:", result.webUrl);
 * }
 * ```
 */
export async function uploadToSharePointDirect(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  const { jobId, folderId, folderPath, filename, onProgress } = options;

  try {
    // Step 1: Get pre-authenticated upload URL from backend (instant)
    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: "preparing",
      message: "Preparing upload...",
    });

    const sessionResponse = await api.post<UploadSessionResponse>(
      "/api/v1/sharepoint/upload_session",
      {
        filename: filename || file.name,
        file_size: file.size,
        folder_id: folderId,
        folder_path: folderPath,
        job_id: jobId,
      }
    );

    if (!sessionResponse?.success || !sessionResponse.upload_url) {
      return {
        success: false,
        error: sessionResponse?.error || "Failed to get upload URL",
      };
    }

    const { upload_url, chunk_size, filename: safeFilename } = sessionResponse;

    // Step 2: Upload directly to SharePoint (NO backend proxy!)
    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: "uploading",
      message: "Uploading to SharePoint...",
    });

    let result: SharePointUploadResult;

    if (file.size <= SMALL_FILE_THRESHOLD) {
      // Small file - single PUT request
      result = await uploadSmallFile(file, upload_url, onProgress);
    } else {
      // Large file - chunked upload for reliability
      result = await uploadLargeFileChunked(
        file,
        upload_url,
        chunk_size || CHUNK_SIZE,
        onProgress
      );
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Step 3: Notify backend of completion (for activity logging + warehouse indexing)
    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      status: "completing",
      message: "Finalizing...",
    });

    if (result.id && jobId) {
      try {
        await api.post("/api/v1/sharepoint/upload_complete", {
          job_id: jobId,
          filename: safeFilename,
          file_size: file.size,
          folder_path: folderPath,
          web_url: result.webUrl,
          sharepoint_item_id: result.id,
        });
      } catch (completeError) {
        // Don't fail the whole upload if completion notification fails
        // The file is already in SharePoint
        console.warn("Upload complete notification failed:", completeError);
      }
    }

    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      status: "done",
      message: "Upload complete!",
    });

    return {
      success: true,
      webUrl: result.webUrl,
      itemId: result.id,
      filename: safeFilename,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Upload failed";

    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: "error",
      message: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

interface SharePointUploadResult {
  success: boolean;
  id?: string;
  webUrl?: string;
  error?: string;
}

/**
 * Upload a small file (< 4MB) with a single PUT request
 */
async function uploadSmallFile(
  file: File,
  uploadUrl: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<SharePointUploadResult> {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Length": file.size.toString(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Small file upload failed:", response.status, errorText);
      return {
        success: false,
        error: `Upload failed: ${response.status}`,
      };
    }

    const result = await response.json();

    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      status: "uploading",
      message: "Upload complete",
    });

    return {
      success: true,
      id: result.id,
      webUrl: result.webUrl,
    };
  } catch (error) {
    console.error("Small file upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload a large file (>= 4MB) using chunked upload for reliability
 * Chunks must be multiples of 320 KiB per Microsoft Graph API requirements
 */
async function uploadLargeFileChunked(
  file: File,
  uploadUrl: string,
  chunkSize: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<SharePointUploadResult> {
  let offset = 0;
  let result: SharePointUploadResult = { success: false };

  try {
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);

      // Content-Range format: "bytes start-end/total"
      const contentRange = `bytes ${offset}-${end - 1}/${file.size}`;

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: chunk,
        headers: {
          "Content-Length": chunk.size.toString(),
          "Content-Range": contentRange,
        },
      });

      // 202 = Accepted (more chunks expected)
      // 200/201 = Complete (final chunk)
      if (!response.ok && response.status !== 202) {
        const errorText = await response.text();
        console.error(
          "Chunk upload failed:",
          response.status,
          contentRange,
          errorText
        );
        return {
          success: false,
          error: `Chunk upload failed: ${response.status}`,
        };
      }

      // Report progress
      onProgress?.({
        loaded: end,
        total: file.size,
        percentage: Math.round((end / file.size) * 100),
        status: "uploading",
        message: `Uploading... ${Math.round((end / file.size) * 100)}%`,
      });

      // Final chunk returns the completed item metadata
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        result = {
          success: true,
          id: data.id,
          webUrl: data.webUrl,
        };
      }

      offset = end;
    }

    return result;
  } catch (error) {
    console.error("Chunked upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chunked upload failed",
    };
  }
}

/**
 * Check if direct upload is available (SharePoint connected)
 * Can be used to fall back to legacy upload if needed
 */
export async function isDirectUploadAvailable(): Promise<boolean> {
  try {
    // Quick check - try to get org status
    const response = await api.get<{ connected: boolean }>(
      "/api/v1/organization_onedrive/status"
    );
    return response?.connected === true;
  } catch {
    return false;
  }
}
