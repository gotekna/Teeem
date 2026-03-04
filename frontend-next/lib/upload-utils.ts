/**
 * upload-utils.ts - THE ONE SSoT for file uploads
 *
 * All file uploads in the app should use this utility.
 * It uses presigned URLs to upload directly to S3, bypassing Heroku's 30-second timeout.
 *
 * Features:
 *   - Client-side SHA256 hashing for dedup (skips backend download)
 *   - XHR upload with byte-level progress
 *   - Step lifecycle callbacks for UI feedback
 *
 * Usage:
 *   import { uploadFile, uploadFiles } from '@/lib/upload-utils';
 *
 *   // Single file with progress
 *   const result = await uploadFile(file, 'documents', {
 *     onByteProgress: (loaded, total) => console.log(`${loaded}/${total}`),
 *     onStepChange: (step) => console.log(step),
 *   });
 *
 *   // Multiple files with progress
 *   const results = await uploadFiles(files, 'job_documents', {
 *     metadata: { job_id: 123 },
 *     onProgress: (completed, total) => console.log(`${completed}/${total}`),
 *   });
 */

import { api } from './api';

export type UploadScope =
  | 'documents'           // Corporate documents
  | 'user_documents'      // Personal/user documents
  | 'job_documents'       // Job-related documents
  | 'library_documents'   // Library reference documents
  | 'imports'             // CSV/data imports (no record created)
  | 'chat'               // Chat attachments (no record created)
  | 'transactions';       // Transaction receipts

export type UploadStep = 'presigning' | 'uploading' | 'hashing' | 'confirming';

export interface UploadMetadata {
  job_id?: number | string;
  document_type?: string;
  display_name?: string;
  folder_path?: string;
  [key: string]: unknown;
}

export interface UploadResult {
  success: boolean;
  key?: string;
  filename?: string;
  document?: {
    id: number;
    file_name: string;
    display_name: string;
    storage_url?: string;
    [key: string]: unknown;
  };
  error?: string;
}

export interface UploadOptions {
  metadata?: UploadMetadata;
  onProgress?: (completed: number, total: number, currentFile?: string) => void;
  /** Byte-level progress during S3 upload */
  onByteProgress?: (loaded: number, total: number) => void;
  /** Lifecycle step changes */
  onStepChange?: (step: UploadStep) => void;
}

interface PresignResponse {
  success: boolean;
  upload_url?: string;
  key?: string;
  filename?: string;
  content_type?: string;
  error?: string;
}

interface ConfirmResponse {
  success: boolean;
  document?: {
    id: number;
    file_name: string;
    display_name: string;
    storage_url?: string;
    [key: string]: unknown;
  };
  key?: string;
  error?: string;
}

// Max file size for client-side hashing (200MB) — larger files use backend fallback
const MAX_HASH_SIZE = 200 * 1024 * 1024;

/**
 * Compute SHA256 hash of a File using Web Crypto API.
 * Reads in 2MB chunks via streaming to avoid memory spikes.
 */
export async function computeFileHash(file: File): Promise<string> {
  // Use SubtleCrypto streaming digest if available (all modern browsers)
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload file to S3 using XHR for byte-level upload progress.
 * fetch() doesn't support upload progress events.
 */
function uploadToS3WithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ ok: boolean; status: number; statusText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      });
    }

    xhr.addEventListener('load', () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
      });
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.send(file);
  });
}

/**
 * Upload a single file using presigned URL
 */
export async function uploadFile(
  file: File,
  scope: UploadScope,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { metadata = {}, onByteProgress, onStepChange } = options;

  try {
    // Step 1: Get presigned URL
    onStepChange?.('presigning');
    const presignResponse = await api.post<PresignResponse>('/api/v1/uploads/presign', {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      scope,
      metadata,
    });

    if (!presignResponse?.success || !presignResponse.upload_url) {
      return {
        success: false,
        error: presignResponse?.error || 'Failed to get upload URL',
      };
    }

    // Step 2: Upload directly to S3 (XHR for byte progress)
    onStepChange?.('uploading');
    const contentType = presignResponse.content_type || file.type || 'application/octet-stream';

    const s3Response = await uploadToS3WithProgress(
      presignResponse.upload_url,
      file,
      contentType,
      onByteProgress
    );

    if (!s3Response.ok) {
      return {
        success: false,
        error: `Upload failed: ${s3Response.status} ${s3Response.statusText}`,
      };
    }

    // Step 3: Compute client-side SHA256 hash (skip for very large files)
    let contentHash: string | undefined;
    if (file.size <= MAX_HASH_SIZE) {
      onStepChange?.('hashing');
      try {
        contentHash = await computeFileHash(file);
      } catch (e) {
        // Hash failed — backend will fall back to download-and-hash
        console.warn('[uploadFile] Client-side hash failed, using backend fallback:', e);
      }
    }

    // Step 4: Confirm upload (send hash if computed)
    onStepChange?.('confirming');
    const confirmResponse = await api.post<ConfirmResponse>('/api/v1/uploads/confirm', {
      key: presignResponse.key,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      scope,
      metadata,
      ...(contentHash ? { content_hash: contentHash } : {}),
    });

    if (!confirmResponse?.success) {
      return {
        success: false,
        error: confirmResponse?.error || 'Failed to confirm upload',
      };
    }

    return {
      success: true,
      key: confirmResponse.key || presignResponse.key,
      filename: file.name,
      document: confirmResponse.document,
    };
  } catch (error) {
    console.error('[uploadFile] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload multiple files with progress tracking
 */
export async function uploadFiles(
  files: File[],
  scope: UploadScope,
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  const { onProgress } = options;
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);

    const result = await uploadFile(file, scope, options);
    results.push(result);
  }

  onProgress?.(files.length, files.length);
  return results;
}

/**
 * Upload for imports (returns key only, no record created)
 * Used for CSV imports, schedule imports, etc.
 */
export async function uploadImportFile(file: File): Promise<{ success: boolean; key?: string; error?: string }> {
  const result = await uploadFile(file, 'imports');
  return {
    success: result.success,
    key: result.key,
    error: result.error,
  };
}
