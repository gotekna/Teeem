/**
 * BOQ → TenderDocumentData transformer
 *
 * Pure function that converts BOQ groups (in tender sort mode) into
 * TenderDocumentData format for the live preview in Tender Builder.
 *
 * Groups BOQ items by tenderHeaderName → tenderName, filters out excluded
 * line item IDs, and builds the same structure TenderDocumentView expects.
 */

import type { BOQGroup, BOQLineItem } from "@/components/ui/bill-of-quantities";

// Matches the TenderDocumentItem shape from TenderDocumentView
interface PreviewTenderItem {
  id: number;
  tender_section_name: string;
  tender_section_code: string | null;
  section_sort_order: number;
  section_type: string;
  tender_header_name: string | null;
  tender_header_code: string | null;
  header_sort_order: number | null;
  default_note: string | null;
  line_number: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_amount: number | null;
  gst_code: string;
  item_type: string;
  notes: string | null;
  source_purchase_order_id: number | null;
  source_po_number: string | null;
  cost_centre_name: string | null;
  trade_name: string | null;
}

// Matches TenderDocumentData from TenderDocumentView
export interface PreviewTenderDocumentData {
  id: number;
  job_id: number;
  document_number: string;
  version: number;
  status: string;
  date_prepared: string;
  valid_until: string | null;
  subtotal: number;
  gst: number;
  total: number;
  job_name: string | null;
  job_address: string | null;
  job_code: string | null;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  salesperson_name: string | null;
  created_by_name: string | null;
  locked_by_name: string | null;
  locked_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  revision_notes: string | null;
  company_name?: string | null;
  plan_name?: string | null;
  sections_grouped: Record<string, PreviewTenderItem[]>;
  sections_grouped_by_header?: Record<string, Record<string, PreviewTenderItem[]>>;
  section_subtotals: Record<string, number>;
  header_subtotals?: Record<string, number>;
}

/**
 * Builds a line item key from group ID and item ID.
 * Must match the format used by the Tender Builder exclude toggles.
 */
export function lineItemKey(groupId: number | string, itemId: number | string): string {
  return `${groupId}:${itemId}`;
}

/**
 * Converts BOQ groups into TenderDocumentData for the preview panel.
 *
 * @param groups - BOQ groups from the API (all PO groups with items)
 * @param excludedIds - Set of "groupId:itemId" keys to exclude
 * @param jobInfo - Optional job metadata for the preview header
 */
export function buildTenderPreview(
  groups: BOQGroup[],
  excludedIds: Set<string>,
  jobInfo?: { jobName?: string; jobCode?: string }
): PreviewTenderDocumentData {
  // Group items by Header → Section → Items
  const headerMap = new Map<
    string,
    Map<string, PreviewTenderItem[]>
  >();

  let lineCounterBySection = new Map<string, number>();
  let idCounter = 1;

  for (const group of groups) {
    const headerName = group.tenderHeaderName || "Unallocated";
    const sectionName = group.tenderName || "Unallocated";

    if (!headerMap.has(headerName)) {
      headerMap.set(headerName, new Map());
    }
    const sectionMap = headerMap.get(headerName)!;

    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, []);
    }
    const items = sectionMap.get(sectionName)!;

    for (const item of group.items) {
      const key = lineItemKey(group.id, item.id);
      if (excludedIds.has(key)) continue;

      const sectionKey = sectionName;
      const lineNum = (lineCounterBySection.get(sectionKey) || 0) + 1;
      lineCounterBySection.set(sectionKey, lineNum);

      items.push({
        id: idCounter++,
        tender_section_name: sectionName,
        tender_section_code: null,
        section_sort_order: 0,
        section_type: "priced",
        tender_header_name: headerName,
        tender_header_code: null,
        header_sort_order: null,
        default_note: null,
        line_number: lineNum,
        description: item.description,
        quantity: item.quantity,
        unit: null,
        unit_price: item.unitPrice,
        total_amount: item.quantity * item.unitPrice,
        gst_code: item.gstCode || "GST",
        item_type: "priced",
        notes: null,
        source_purchase_order_id: typeof group.id === "number" ? group.id : null,
        source_po_number: group.name,
        cost_centre_name: group.costCentreName || null,
        trade_name: group.tradeName || null,
      });
    }
  }

  // Build sections_grouped_by_header and calculate subtotals
  const sectionsGroupedByHeader: Record<string, Record<string, PreviewTenderItem[]>> = {};
  const sectionsGrouped: Record<string, PreviewTenderItem[]> = {};
  const sectionSubtotals: Record<string, number> = {};
  const headerSubtotals: Record<string, number> = {};

  let subtotal = 0;

  for (const [headerName, sectionMap] of headerMap) {
    sectionsGroupedByHeader[headerName] = {};
    headerSubtotals[headerName] = 0;

    for (const [sectionName, items] of sectionMap) {
      sectionsGroupedByHeader[headerName][sectionName] = items;
      sectionsGrouped[sectionName] = [
        ...(sectionsGrouped[sectionName] || []),
        ...items,
      ];

      const sectionTotal = items.reduce(
        (sum, item) => sum + (item.total_amount || 0),
        0
      );
      sectionSubtotals[sectionName] = (sectionSubtotals[sectionName] || 0) + sectionTotal;
      headerSubtotals[headerName] += sectionTotal;
      subtotal += sectionTotal;
    }
  }

  const gst = subtotal * 0.1; // Default 10% GST
  const total = subtotal + gst;

  const today = new Date().toISOString().split("T")[0];

  return {
    id: 0,
    job_id: 0,
    document_number: "PREVIEW",
    version: 0,
    status: "draft",
    date_prepared: today,
    valid_until: null,
    subtotal,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
    job_name: jobInfo?.jobName || null,
    job_address: null,
    job_code: jobInfo?.jobCode || null,
    client_name: null,
    client_address: null,
    client_email: null,
    client_phone: null,
    salesperson_name: null,
    created_by_name: null,
    locked_by_name: null,
    locked_at: null,
    sent_at: null,
    accepted_at: null,
    declined_at: null,
    revision_notes: null,
    sections_grouped: sectionsGrouped,
    sections_grouped_by_header: sectionsGroupedByHeader,
    section_subtotals: sectionSubtotals,
    header_subtotals: headerSubtotals,
  };
}

/**
 * Returns summary stats about excluded items for the bottom bar.
 */
export function getExclusionSummary(
  groups: BOQGroup[],
  excludedIds: Set<string>
): { excludedCount: number; excludedTotal: number; includedCount: number; includedTotal: number } {
  let excludedCount = 0;
  let excludedTotal = 0;
  let includedCount = 0;
  let includedTotal = 0;

  for (const group of groups) {
    for (const item of group.items) {
      const key = lineItemKey(group.id, item.id);
      const amount = item.quantity * item.unitPrice;
      if (excludedIds.has(key)) {
        excludedCount++;
        excludedTotal += amount;
      } else {
        includedCount++;
        includedTotal += amount;
      }
    }
  }

  return { excludedCount, excludedTotal, includedCount, includedTotal };
}
