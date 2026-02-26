"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface QuoteExtraction {
  priceQuoted: number | null;
  quoteNumber: string | null;
  validTo: string | null;
  notesSummary: string | null;
  lineItems: Array<{ description: string; amount: number | null }>;
  confidence: number;
}

export function useQuoteExtraction() {
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<QuoteExtraction | null>(null);

  const extract = useCallback(async (supplierId: number) => {
    setExtracting(true);
    try {
      const res = await api.post<{ success: boolean; data: QuoteExtraction }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/extract_quote_data`
      );
      if (res?.data) setExtraction(res.data);
    } catch (err) {
      console.error("[useQuoteExtraction] extract error:", err);
    } finally {
      setExtracting(false);
    }
  }, []);

  const reset = useCallback(() => setExtraction(null), []);

  return { extracting, extraction, extract, reset };
}
