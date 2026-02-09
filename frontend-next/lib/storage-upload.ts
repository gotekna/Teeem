/**
 * SSoT: Storage Upload Module
 *
 * Handles file uploads to the configured storage provider (Wasabi/S3 or SharePoint).
 * Provider is determined by WarehouseProvider.provider_type.
 *
 * Flow:
 * 1. Check provider via /api/v1/documents/status
 * 2. Route to appropriate upload method:
 *    - Wasabi/S3: POST /api/v1/jobs/{id}/photos/upload (backend handles S3)
 *    - SharePoint: Direct browser-to-SharePoint upload (faster, bypasses backend)
 */

import { api, getApiBaseUrl } from "./api";
import { getStorageItem, STORAGE_KEYS } from './storage-utils';

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
  warehouseFolderId?: string | number;
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
  const { jobId, folderId, folderPath, filename, warehouseFolderId, onProgress } = options;

  try {
    // Step 1: Get pre-authenticated upload URL from backend (instant)
    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: "preparing",
      message: "Preparing upload...",
    });

    console.log("[DirectUpload] Requesting upload session:", {
      filename: filename || file.name,
      file_size: file.size,
      folder_path: folderPath,
      job_id: jobId,
      warehouse_folder_id: warehouseFolderId,
    });

    let sessionResponse: UploadSessionResponse | null;
    try {
      sessionResponse = await api.post<UploadSessionResponse>(
        "/api/v1/sharepoint/upload_session",
        {
          filename: filename || file.name,
          file_size: file.size,
          folder_id: folderId,
          folder_path: folderPath,
          job_id: jobId,
          warehouse_folder_id: warehouseFolderId,
        }
      );
      console.log("[DirectUpload] Session response:", sessionResponse);
    } catch (apiError) {
      console.error("[DirectUpload] API error:", apiError);
      throw apiError;
    }

    if (!sessionResponse?.success || !sessionResponse.upload_url) {
      console.error("[DirectUpload] Invalid session response:", sessionResponse);
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

    // Always call upload_complete if we have a jobId - even without SharePoint ID
    // This ensures warehouse sync happens. Let backend handle missing ID gracefully.
    if (jobId) {
      await api.post("/api/v1/sharepoint/upload_complete", {
        job_id: jobId,
        filename: safeFilename,
        file_size: file.size,
        folder_path: folderPath,
        web_url: result.webUrl,
        sharepoint_item_id: result.id, // May be undefined - backend will sync by path
        warehouse_folder_id: warehouseFolderId,
      });
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
    // Upload session URLs (resumable upload) REQUIRE Content-Range header
    // even for single-chunk uploads. Format: "bytes start-end/total"
    const contentRange = `bytes 0-${file.size - 1}/${file.size}`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Length": file.size.toString(),
        "Content-Range": contentRange,
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

interface StorageStatus {
  connected: boolean;
  provider_type?: string;
}

/**
 * Get the current storage provider type
 * FRC (Feb 2026): Return actual configured provider, no hardcoded defaults
 */
export async function getStorageProviderType(): Promise<string | null> {
  try {
    const response = await api.get<StorageStatus>("/api/v1/documents/status");
    return response?.provider_type || null;
  } catch {
    return null;
  }
}

/**
 * Check if direct upload is available (SharePoint connected)
 * Can be used to fall back to legacy upload if needed
 */
export async function isDirectUploadAvailable(): Promise<boolean> {
  try {
    // Quick check - try to get org status
    const response = await api.get<StorageStatus>(
      "/api/v1/documents/status"
    );
    return response?.connected === true && response?.provider_type === "sharepoint";
  } catch {
    return false;
  }
}

/**
 * Upload a photo to storage - automatically chooses the right method based on provider.
 * For SharePoint: Uses direct browser-to-storage upload (faster)
 * For S3/Wasabi: Uses standard multipart upload through backend
 *
 * @param file - The file to upload
 * @param options - Upload options including jobId, folderPath, etc.
 * @returns Promise with upload result
 */
export async function uploadPhoto(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  const { jobId, folderPath, filename, warehouseFolderId, onProgress } = options;

  // Check provider type
  const providerType = await getStorageProviderType();
  console.log("[uploadPhoto] Storage provider:", providerType);

  // FRC (Feb 2026): Fail early if no provider configured
  if (!providerType) {
    return {
      success: false,
      error: "Storage provider not configured. Please configure storage in Settings > Connections.",
    };
  }

  if (providerType === "sharepoint") {
    // Use direct SharePoint upload (faster)
    return uploadToSharePointDirect(file, options);
  }

  // S3/Wasabi: Use standard multipart upload through backend
  onProgress?.({
    loaded: 0,
    total: file.size,
    percentage: 0,
    status: "preparing",
    message: "Preparing upload...",
  });

  try {
    const formData = new FormData();
    formData.append("file", file);
    if (folderPath) formData.append("folder_path", folderPath);
    if (filename) formData.append("filename", filename);
    if (warehouseFolderId) formData.append("warehouse_folder_id", String(warehouseFolderId));

    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: "uploading",
      message: "Uploading...",
    });

    // Use XMLHttpRequest for progress tracking
    const result = await new Promise<DirectUploadResult>((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percentage,
            status: "uploading",
            message: `Uploading... ${percentage}%`,
          });
        }
      };

      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && response.success) {
            resolve({
              success: true,
              webUrl: response.file?.web_url,
              itemId: response.file?.id,
              filename: response.file?.name || filename || file.name,
            });
          } else {
            resolve({
              success: false,
              error: response.error || `Upload failed: ${xhr.status}`,
            });
          }
        } catch {
          resolve({
            success: false,
            error: `Upload failed: ${xhr.status}`,
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          success: false,
          error: "Network error during upload",
        });
      };

      // Get auth token and build full URL (needed for Vercel → Heroku)
      const token = getStorageItem(STORAGE_KEYS.TOKEN, null, false);
      const baseUrl = getApiBaseUrl();
      xhr.open("POST", `${baseUrl}/api/v1/jobs/${jobId}/photos/upload`);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.send(formData);
    });

    if (result.success) {
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percentage: 100,
        status: "done",
        message: "Upload complete!",
      });
    } else {
      onProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: "error",
        message: result.error || "Upload failed",
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
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
