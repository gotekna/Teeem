/**
 * File Size Limits - Single Source of Truth (SSoT)
 *
 * All file size limits should be imported from this file.
 * Backend SSoT: backend/app/models/concerns/document_storage_constants.rb
 */

/** 2MB - Signature images, cached photos */
export const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;

/** 5MB - Rich text editor images, storage upload chunks, transaction attachments */
export const MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024;

/** 4MB - Threshold below which files upload in single request */
export const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024;

/** 5MB - Multipart upload chunk size */
export const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;

/** 10MB - Profile photos, document cache, payment attachments */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/** 25MB - Email attachment limit (also in email-constants.ts) */
export const MAX_EMAIL_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** 50MB - CSV/data import files */
export const MAX_IMPORT_SIZE = 50 * 1024 * 1024;
