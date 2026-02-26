"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

interface PreviewData {
  url: string;
  filename: string;
  contentType: string;
}

export function useDocumentPreview() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async (supplierId: number) => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; url: string; filename: string; contentType: string }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/document_preview_url`
      );
      if (res?.url) {
        setPreview({ url: res.url, filename: res.filename, contentType: res.contentType });
      }
    } catch (err) {
      console.error("[useDocumentPreview] load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setPreview(null), []);

  return { preview, loading, loadPreview, reset };
}
