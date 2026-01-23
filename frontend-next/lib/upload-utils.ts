/**
 * upload-utils.ts - THE ONE SSoT for file uploads
 *
 * All file uploads in the app should use this utility.
 * It uses presigned URLs to upload directly to S3, bypassing Heroku's 30-second timeout.
 *
 * Usage:
 *   import { uploadFile, uploadFiles } from '@/lib/upload-utils';
 *
 *   // Single file
 *   const result = await uploadFile(file, 'documents');
 *
 *   // Multiple files with progress
 *   const results = await uploadFiles(files, 'job_documents', {
 *     metadata: { job_id: 123 },
 *     onProgress: (completed, total) => console.log(`${completed}/${total}`)
 *   });
 */

import { api } from './api';

export type UploadScope =
  | 'documents'       // Corporate documents
  | 'user_documents'  // Personal/user documents
  | 'job_documents'   // Job-related documents
  | 'imports'         // CSV/data imports (no record created)
  | 'chat'            // Chat attachments (no record created)
  | 'transactions';   // Transaction receipts

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

/**
 * Upload a single file using presigned URL
 */
export async function uploadFile(
  file: File,
  scope: UploadScope,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { metadata = {} } = options;

  try {
    // Step 1: Get presigned URL
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

    // Step 2: Upload directly to S3
    const s3Response = await fetch(presignResponse.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': presignResponse.content_type || file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!s3Response.ok) {
      return {
        success: false,
        error: `Upload failed: ${s3Response.status} ${s3Response.statusText}`,
      };
    }

    // Step 3: Confirm upload
    const confirmResponse = await api.post<ConfirmResponse>('/api/v1/uploads/confirm', {
      key: presignResponse.key,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      scope,
      metadata,
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
