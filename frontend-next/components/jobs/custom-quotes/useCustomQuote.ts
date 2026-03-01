"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  CustomQuoteTemplate,
  CustomQuoteData,
  CustomQuoteSummary,
  CustomQuoteSupplierSummary,
  AllocationData,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────

export function useCustomQuoteTemplates() {
  const [templates, setTemplates] = useState<CustomQuoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: CustomQuoteTemplate[] }>(
        "/api/v1/custom_quote_templates?active_only=true"
      );
      if (res?.data) setTemplates(res.data);
    } catch (err) {
      console.error("[useCustomQuoteTemplates] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { templates, loading, fetchTemplates };
}

// ─────────────────────────────────────────────────────────────────────────
// PO Template Packs
// ─────────────────────────────────────────────────────────────────────────

export interface PoTemplatePackSummary {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  estimatedTotal: number;
}

export function usePoTemplatePacks() {
  const [packs, setPacks] = useState<PoTemplatePackSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPacks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: PoTemplatePackSummary[] }>(
        "/api/v1/po_template_packs"
      );
      if (res?.data) setPacks(res.data);
    } catch (err) {
      console.error("[usePoTemplatePacks] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { packs, loading, fetchPacks };
}

// ─────────────────────────────────────────────────────────────────────────
// Document Types (for CC/PO line document type selector)
// ─────────────────────────────────────────────────────────────────────────

export interface DocumentTypeOption {
  id: number;
  name: string;
}

export function useDocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);

  const fetchDocumentTypes = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: DocumentTypeOption[] }>(
        "/api/v1/custom_quotes/document_types"
      );
      if (res?.data) setDocumentTypes(res.data);
    } catch (err) {
      console.error("[useDocumentTypes] fetch error:", err);
    }
  }, []);

  return { documentTypes, fetchDocumentTypes };
}

// ─────────────────────────────────────────────────────────────────────────
// Job-level Custom Quote
// ─────────────────────────────────────────────────────────────────────────

export function useCustomQuote(jobId: string | number) {
  const [quotes, setQuotes] = useState<CustomQuoteSummary[]>([]);
  const [activeQuote, setActiveQuote] = useState<CustomQuoteData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: CustomQuoteSummary[] }>(
        `/api/v1/jobs/${jobId}/custom_quotes`
      );
      if (res?.data) setQuotes(res.data);
    } catch (err) {
      console.error("[useCustomQuote] fetch quotes error:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const fetchQuoteTree = useCallback(async (quoteId: number) => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: CustomQuoteData }>(
        `/api/v1/custom_quotes/${quoteId}`
      );
      if (res?.data) setActiveQuote(res.data);
    } catch (err) {
      console.error("[useCustomQuote] fetch tree error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createQuote = useCallback(async (templateId?: number, name?: string, populateFrom?: string, poTemplatePackId?: number) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteData }>(
        `/api/v1/jobs/${jobId}/custom_quotes`,
        { template_id: templateId, name, populate_from: populateFrom, po_template_pack_id: poTemplatePackId }
      );
      if (res?.data) {
        setActiveQuote(res.data);
        toast.success("Custom quote created");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] create error:", err);
      toast.error("Failed to create custom quote");
    }
    return null;
  }, [jobId]);

  const updateLine = useCallback(async (lineId: number, updates: Record<string, unknown>) => {
    try {
      await api.patch(`/api/v1/custom_quote_lines/${lineId}`, updates);
    } catch (err) {
      console.error("[useCustomQuote] update line error:", err);
      toast.error("Failed to update line");
    }
  }, []);

  const addSupplier = useCallback(async (lineId: number, supplierId: number, contactEmail?: string) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteSupplierSummary }>(
        `/api/v1/custom_quote_lines/${lineId}/add_supplier`,
        { supplier_id: supplierId, contact_email: contactEmail }
      );
      if (res?.data) {
        toast.success("Supplier added");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] add supplier error:", err);
      toast.error("Failed to add supplier");
    }
    return null;
  }, []);

  const addChildLine = useCallback(async (parentLineId: number, name: string) => {
    try {
      const res = await api.post<{ success: boolean }>(
        `/api/v1/custom_quote_lines/${parentLineId}/add_child`,
        { name }
      );
      if (res?.success) {
        toast.success("Line added");
        return true;
      }
    } catch (err) {
      console.error("[useCustomQuote] add child error:", err);
      toast.error("Failed to add line");
    }
    return false;
  }, []);

  const recordResponse = useCallback(async (
    supplierId: number,
    data: { price_quoted: number; quote_number?: string; timeframe?: string; response_notes?: string; valid_to?: string; warehouse_document_id?: number }
  ) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteSupplierSummary }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/record_response`,
        data
      );
      if (res?.data) {
        toast.success("Response recorded");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] record response error:", err);
      toast.error("Failed to record response");
    }
    return null;
  }, []);

  const acceptQuote = useCallback(async (supplierId: number) => {
    try {
      const res = await api.post<{ success: boolean }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/accept`
      );
      if (res?.success) {
        toast.success("Quote accepted, PO created");
        return true;
      }
    } catch (err) {
      console.error("[useCustomQuote] accept error:", err);
      toast.error("Failed to accept quote");
    }
    return false;
  }, []);

  const rejectQuote = useCallback(async (supplierId: number) => {
    try {
      await api.post(`/api/v1/custom_quote_suppliers/${supplierId}/reject`);
      toast.success("Quote rejected");
      return true;
    } catch (err) {
      console.error("[useCustomQuote] reject error:", err);
      toast.error("Failed to reject quote");
    }
    return false;
  }, []);

  const markSent = useCallback(async (supplierId: number) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteSupplierSummary }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/mark_sent`
      );
      if (res?.data) {
        toast.success("Marked as sent");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] mark sent error:", err);
      toast.error("Failed to mark as sent");
    }
    return null;
  }, []);

  const saveAsTemplate = useCallback(async (quoteId: number, name: string) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteTemplate }>(
        `/api/v1/custom_quotes/${quoteId}/save_as_template`,
        { name }
      );
      if (res?.data) {
        toast.success("Saved as template");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] save as template error:", err);
      toast.error("Failed to save as template");
    }
    return null;
  }, []);

  const overwriteTemplate = useCallback(async (quoteId: number) => {
    try {
      const res = await api.post<{ success: boolean; data: CustomQuoteTemplate }>(
        `/api/v1/custom_quotes/${quoteId}/overwrite_template`
      );
      if (res?.data) {
        toast.success(`Template "${res.data.name}" updated`);
        return true;
      }
    } catch (err) {
      console.error("[useCustomQuote] overwrite template error:", err);
      toast.error("Failed to update template");
    }
    return false;
  }, []);

  const fetchAllocations = useCallback(async (supplierId: number) => {
    try {
      const res = await api.get<{ success: boolean; data: AllocationData[] }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/allocations`
      );
      return res?.data || [];
    } catch (err) {
      console.error("[useCustomQuote] fetch allocations error:", err);
      return [];
    }
  }, []);

  const createAllocation = useCallback(async (
    supplierId: number,
    lineId: number,
    amount: number,
    notes?: string
  ) => {
    try {
      const res = await api.post<{ success: boolean; data: AllocationData }>(
        `/api/v1/custom_quote_suppliers/${supplierId}/allocations`,
        { line_id: lineId, allocated_amount: amount, notes }
      );
      if (res?.data) {
        toast.success("Allocation created");
        return res.data;
      }
    } catch (err) {
      console.error("[useCustomQuote] create allocation error:", err);
      toast.error("Failed to create allocation");
    }
    return null;
  }, []);

  const deleteQuote = useCallback(async (quoteId: number) => {
    try {
      await api.delete(`/api/v1/custom_quotes/${quoteId}`);
      setActiveQuote(null);
      setQuotes([]);
      toast.success("Custom quote deleted");
      return true;
    } catch (err) {
      console.error("[useCustomQuote] delete error:", err);
      toast.error("Failed to delete custom quote");
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    if (activeQuote) {
      await fetchQuoteTree(activeQuote.id);
    }
  }, [activeQuote, fetchQuoteTree]);

  return {
    quotes,
    activeQuote,
    loading,
    fetchQuotes,
    fetchQuoteTree,
    createQuote,
    updateLine,
    addSupplier,
    addChildLine,
    recordResponse,
    markSent,
    acceptQuote,
    rejectQuote,
    deleteQuote,
    saveAsTemplate,
    overwriteTemplate,
    fetchAllocations,
    createAllocation,
    refresh,
  };
}
