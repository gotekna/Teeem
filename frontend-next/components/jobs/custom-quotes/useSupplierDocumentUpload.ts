"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface UploadResult {
  warehouseDocumentId: number;
  filename: string;
}

export function useSupplierDocumentUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadForSupplier = useCallback(async (
    supplierId: number,
    file: File
  ): Promise<UploadResult | null> => {
    setUploading(true);
    try {
      // 1. Get presigned URL
      const presignRes = await api.post<{
        success: boolean;
        upload_url: string;
        key: string;
        filename: string;
        content_type: string;
      }>(`/api/v1/custom_quote_suppliers/${supplierId}/presign_upload`, {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
      });

      if (!presignRes?.upload_url) {
        toast.error("Failed to get upload URL");
        return null;
      }

      // 2. Upload file directly to S3
      const uploadRes = await fetch(presignRes.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": presignRes.content_type },
      });

      if (!uploadRes.ok) {
        toast.error("Failed to upload file to storage");
        return null;
      }

      // 3. Confirm upload — creates WarehouseDocument + links to supplier
      const confirmRes = await api.post<{
        success: boolean;
        warehouseDocumentId: number;
        filename: string;
      }>(`/api/v1/custom_quote_suppliers/${supplierId}/confirm_upload`, {
        key: presignRes.key,
        filename: presignRes.filename,
        content_type: presignRes.content_type,
        file_size: file.size,
      });

      if (!confirmRes?.warehouseDocumentId) {
        toast.error("Failed to confirm upload");
        return null;
      }

      return {
        warehouseDocumentId: confirmRes.warehouseDocumentId,
        filename: confirmRes.filename,
      };
    } catch (err) {
      console.error("[useSupplierDocumentUpload] Upload failed:", err);
      toast.error("Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploading, uploadForSupplier };
}
