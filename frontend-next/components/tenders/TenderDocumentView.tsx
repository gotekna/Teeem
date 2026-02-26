"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import Image from "next/image";
import { formatCurrency } from "@/utils/formatters";

/** Builder's company logo - supports light/dark mode with separate URLs */
function CompanyLogo({ doc, className = "h-16 w-auto" }: { doc: TenderDocumentData; className?: string }) {
  if (!doc.company_logo_url && !doc.company_logo_dark_url) return null;

  return (
    <>
      {doc.company_logo_url && (
        <Image
          src={doc.company_logo_url}
          alt={doc.company_name || "Company Logo"}
          width={200}
          height={64}
          className={`${className} object-contain ${doc.company_logo_dark_url ? "dark:hidden" : ""}`}
          unoptimized
        />
      )}
      {doc.company_logo_dark_url && (
        <Image
          src={doc.company_logo_dark_url}
          alt={doc.company_name || "Company Logo"}
          width={200}
          height={64}
          className={`${className} object-contain hidden dark:block`}
          unoptimized
        />
      )}
    </>
  );
}

/** Strip leading numeric code prefix from section/cost centre names (e.g. "100 - SURVEYOR" → "Surveyor") */
function stripCodePrefix(name: string): string {
  return name.replace(/^\d+\s*[-–—]\s*/, "").trim();
}

/** Title-case a string (e.g. "SURVEYOR" → "Surveyor", "FRAMES & TRUSSES" → "Frames & Trusses") */
function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

/** Clean a section name for display in the tender document */
function cleanSectionName(name: string): string {
  return titleCase(stripCodePrefix(name));
}

interface TenderDocumentItem {
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

interface TenderDocumentData {
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
  company_logo_url?: string | null;
  company_logo_dark_url?: string | null;
  plan_name?: string | null;
  // Tender detail snapshots
  council?: string | null;
  estate?: string | null;
  facade?: string | null;
  design_name?: string | null;
  specification?: string | null;
  developer_approval?: boolean | null;
  developer_contact?: string | null;
  land_registration?: string | null;
  building_contract_type?: string | null;
  development_application?: string | null;
  sales_centre?: string | null;
  wind_classification?: string | null;
  soil_classification?: string | null;
  lot_address?: string | null;
  plan_number?: string | null;
  sections_grouped: Record<string, TenderDocumentItem[]>;
  sections_grouped_by_header?: Record<string, Record<string, TenderDocumentItem[]>>;
  section_subtotals: Record<string, number>;
  header_subtotals?: Record<string, number>;
  base_price?: number;
  pc_total?: number;
  ps_total?: number;
  changelog?: Changelog | null;
  has_changelog?: boolean;
  // Per-section document type references: { "Site Preparation": ["Plans", "Engineering"] }
  section_document_types?: Record<string, string[]>;
  // Rich text pages
  cover_letter_html?: string | null;
  terms_and_conditions_html?: string | null;
  base_specification_html?: string | null;
  acceptance_page_html?: string | null;
  notes_html?: string | null;
  validity_days?: number | null;
}

interface ChangelogChange {
  type: "added" | "removed" | "price_changed" | "type_changed";
  section: string;
  description: string;
  item_type: string;
  amount?: number;
  previous_amount?: number;
  previous_type?: string;
}

interface Changelog {
  previous_version: number;
  previous_total: number;
  current_total: number;
  changes: ChangelogChange[];
}

interface TenderDocumentViewProps {
  document: TenderDocumentData;
  /** In preview mode: hides cover page, status badges, details page - shows only pricing schedule + totals */
  previewMode?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  locked: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sent: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  revision_requested: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  superseded: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

function formatTenderDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/** Price Summary block showing header breakdown + builder-style totals.
 * Top: Header subtotals (Site Costs, Authority Conditions, Base Price, etc.)
 * Bottom: Base Price, Prime Costs (count), Provisional Sums (count), Contract Sum, GST (10%), Total.
 */
function PriceSummaryBlock({
  doc,
  headerGroups,
  widthClass = "w-40",
}: {
  doc: TenderDocumentData;
  headerGroups?: Record<string, Record<string, TenderDocumentItem[]>>;
  widthClass?: string;
}) {
  const pcTotal = doc.pc_total || 0;
  const psTotal = doc.ps_total || 0;
  const basePrice = doc.subtotal - pcTotal - psTotal;
  const hasPcOrPs = pcTotal > 0 || psTotal > 0;
  const hasHeaders = headerGroups && Object.keys(headerGroups).length > 0;

  // Count PC and PS items from sections data
  const allItems = Object.values(doc.sections_grouped).flat();
  const pcCount = allItems.filter(i => i.item_type === "priced").length;
  const psCount = allItems.filter(i => i.item_type === "provisional").length;

  return (
    <div className="py-4">
      {/* Header breakdown (Site Costs, Authority Conditions, Base Price, etc.) */}
      {hasHeaders && (
        <>
          {Object.entries(headerGroups!).map(([headerName, _sections]) => {
            const headerTotal = doc.header_subtotals?.[headerName] || 0;
            return (
              <div key={headerName} className="flex justify-between items-baseline py-0.5">
                <span className="text-sm">{cleanSectionName(headerName)}</span>
                <span className={`tabular-nums text-sm ${widthClass} text-right`}>{formatCurrency(headerTotal)}</span>
              </div>
            );
          })}
          <div className="border-t border-border/50 my-2" />
        </>
      )}

      {/* Base Price (excluding PC & PS) */}
      <div className="flex justify-between items-baseline py-1">
        <div>
          <span className="font-semibold text-sm">Base Price (ex GST)</span>
          {hasPcOrPs && (
            <span className="text-xs text-muted-foreground ml-1.5">excl. Prime Costs &amp; Provisional Sums</span>
          )}
        </div>
        <span className={`font-semibold tabular-nums text-sm ${widthClass} text-right`}>{formatCurrency(basePrice)}</span>
      </div>

      {/* Prime Costs */}
      {pcTotal > 0 && (
        <div className="flex justify-between items-baseline py-0.5">
          <span className="text-sm text-blue-700 dark:text-blue-400">
            + Prime Costs ({pcCount} {pcCount === 1 ? "item" : "items"})
          </span>
          <span className={`tabular-nums text-sm ${widthClass} text-right text-blue-700 dark:text-blue-400`}>{formatCurrency(pcTotal)}</span>
        </div>
      )}

      {/* Provisional Sums */}
      {psTotal > 0 && (
        <div className="flex justify-between items-baseline py-0.5">
          <span className="text-sm text-violet-700 dark:text-violet-400">
            + Provisional Sums ({psCount} {psCount === 1 ? "item" : "items"})
          </span>
          <span className={`tabular-nums text-sm ${widthClass} text-right text-violet-700 dark:text-violet-400`}>{formatCurrency(psTotal)}</span>
        </div>
      )}

      {/* Contract Sum (only shown when there are PC or PS items) */}
      {hasPcOrPs && (
        <div className="flex justify-between items-baseline py-1 border-t border-border/50 mt-1">
          <span className="text-sm font-medium">Contract Sum (ex GST)</span>
          <span className={`font-medium tabular-nums text-sm ${widthClass} text-right`}>{formatCurrency(doc.subtotal)}</span>
        </div>
      )}

      {/* GST */}
      <div className="flex justify-between items-baseline py-0.5">
        <span className="text-muted-foreground text-sm">GST (10%)</span>
        <span className={`text-muted-foreground tabular-nums text-sm ${widthClass} text-right`}>{formatCurrency(doc.gst)}</span>
      </div>

      {/* Total */}
      <div className="flex justify-between items-baseline py-2 border-t mt-1">
        <span className="font-bold text-base">Total (inc GST)</span>
        <span className={`font-bold text-base tabular-nums ${widthClass} text-right`}>{formatCurrency(doc.total)}</span>
      </div>
      <p className="text-sm font-bold text-muted-foreground">All our prices are GST inclusive</p>
    </div>
  );
}

/** Renders the right-side label/price for an item matching the Rawson format */
function ItemTypeLabel({ item }: { item: TenderDocumentItem }) {
  switch (item.item_type) {
    case "priced":
      return (
        <span className="text-right">
          <span className="font-medium block">{formatCurrency(item.total_amount || 0)}</span>
          <span className="text-xs text-muted-foreground italic">Prime Cost</span>
        </span>
      );
    case "provisional":
      return (
        <span className="text-right">
          <span className="font-medium block">{formatCurrency(item.total_amount || 0)}</span>
          <span className="text-xs text-muted-foreground italic">Provisional Sum</span>
        </span>
      );
    case "included":
      return <span className="text-right text-muted-foreground">Included</span>;
    case "included_qty":
      return <span className="text-right text-muted-foreground">Included</span>;
    case "complimentary":
      return <span className="text-right text-muted-foreground">Complimentary</span>;
    case "note":
      return <span className="text-right text-muted-foreground">Note</span>;
    default:
      return <span className="text-right text-muted-foreground">{"\u2014"}</span>;
  }
}

/** Renders items for a section, grouped by cost centre, matching Rawson PDF format */
function SectionItems({
  items,
  sectionNumber,
  sectionSubtotal,
  sectionName,
}: {
  items: TenderDocumentItem[];
  sectionNumber: number;
  sectionSubtotal: number;
  sectionName: string;
}) {
  // Group items by cost centre (preserving original order)
  const costCentreGroups = React.useMemo(() => {
    const groups: { name: string; items: TenderDocumentItem[] }[] = [];
    const groupMap = new Map<string, TenderDocumentItem[]>();

    for (const item of items) {
      const ccName = item.cost_centre_name || "";
      if (!groupMap.has(ccName)) {
        const arr: TenderDocumentItem[] = [];
        groupMap.set(ccName, arr);
        groups.push({ name: ccName, items: arr });
      }
      groupMap.get(ccName)!.push(item);
    }
    return groups;
  }, [items]);

  const hasCostCentres = costCentreGroups.length > 1 || (costCentreGroups.length === 1 && costCentreGroups[0].name !== "");
  let lineNum = 0;

  return (
    <div className="space-y-0">
      {costCentreGroups.map((group) => {
        // Cost centre subtotal (priced + provisional items only)
        const ccSubtotal = group.items
          .filter((i) => i.item_type === "priced" || i.item_type === "provisional" || i.item_type === "included" || i.item_type === "included_qty")
          .reduce((sum, i) => sum + (i.total_amount || 0), 0);

        return (
          <div key={group.name || "_none"}>
            {/* Cost centre header */}
            {hasCostCentres && group.name && (
              <div className="pt-3 pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {stripCodePrefix(group.name)}
                </span>
              </div>
            )}

            {/* Items in this cost centre */}
            {group.items.map((item) => {
              lineNum++;
              return (
                <div key={item.id} className="flex gap-4 py-3 border-b border-border/30">
                  {/* Line number: sectionNumber - sequential */}
                  <div className="w-14 shrink-0 text-sm text-muted-foreground">
                    {sectionNumber} - {lineNum}
                  </div>

                  {/* Description (with quantity prefix for included_qty items) */}
                  <div className="flex-1 text-sm min-w-0">
                    <p className="whitespace-pre-wrap">
                      {item.item_type === "included_qty" && item.quantity && item.quantity > 1
                        ? `${Math.round(item.quantity)}x ${item.description}`
                        : item.description}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>

                  {/* Price / Type label */}
                  <div className="w-28 shrink-0 text-sm text-right flex items-start justify-end">
                    <ItemTypeLabel item={item} />
                  </div>
                </div>
              );
            })}

            {/* Cost centre subtotal */}
            {hasCostCentres && group.name && ccSubtotal > 0 && (
              <div className="flex justify-end gap-4 py-2 border-b border-dashed border-border/50">
                <span className="text-xs font-medium text-muted-foreground">
                  {group.name.replace(/^\d+\s*[-–—]\s*/, "").trim()} subtotal
                </span>
                <span className="w-28 text-xs font-medium text-right tabular-nums">
                  {formatCurrency(ccSubtotal)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Section subtotal */}
      {sectionSubtotal > 0 && (
        <div className="flex justify-end gap-4 py-2">
          <span className="text-sm font-bold">Total {cleanSectionName(sectionName)}</span>
          <span className="w-28 text-sm font-bold text-right">{formatCurrency(sectionSubtotal)}</span>
        </div>
      )}
    </div>
  );
}

/** Collapsible section header (bold, underlined) matching Rawson PDF section titles */
function TenderSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-2 hover:bg-muted/50 rounded-sm transition-colors group"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-bold underline underline-offset-4 decoration-1">
          {title}
        </span>
      </button>
      {isOpen && <div className="pl-5">{children}</div>}
    </div>
  );
}

/** Header group (large bold title with underline) matching Rawson PDF header style */
function TenderHeaderGroup({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-lg font-bold tracking-wide uppercase">
              {title}
            </CardTitle>
          </div>
          <span className="text-sm font-bold">{subtitle}</span>
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-2 pt-0">
          {children}
          {/* Header total at the bottom */}
          <div className="flex justify-end gap-4 pt-2 border-t">
            <span className="text-sm font-bold uppercase">Total {title}</span>
            <span className="w-28 text-sm font-bold text-right">{subtitle}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Compute sequential section numbers across all headers.
 * Returns a map: sectionName → sectionNumber (1-based, sequential across entire doc).
 */
function computeSectionNumbers(
  headerGroups: Record<string, Record<string, TenderDocumentItem[]>>
): Map<string, number> {
  const sectionNumbers = new Map<string, number>();
  let counter = 1;
  for (const sections of Object.values(headerGroups)) {
    for (const sectionName of Object.keys(sections)) {
      if (!sectionNumbers.has(sectionName)) {
        sectionNumbers.set(sectionName, counter++);
      }
    }
  }
  return sectionNumbers;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  added: { label: "Added", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  removed: { label: "Removed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  price_changed: { label: "Price", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  type_changed: { label: "Type", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
};

/** Renders changelog between tender versions */
function ChangelogSection({ changelog }: { changelog: Changelog }) {
  const netChange = changelog.current_total - changelog.previous_total;
  const changesBySection = changelog.changes.reduce<Record<string, ChangelogChange[]>>((acc, change) => {
    const section = change.section || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(change);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold tracking-wide">
          <span className="underline underline-offset-4 decoration-1">
            CHANGES FROM VERSION {changelog.previous_version}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50 text-sm">
          <div>
            <span className="text-muted-foreground">Previous: </span>
            <span className="font-medium">{formatCurrency(changelog.previous_total)}</span>
          </div>
          <span className="text-muted-foreground">{"\u2192"}</span>
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-medium">{formatCurrency(changelog.current_total)}</span>
          </div>
          <div className="ml-auto">
            <span className="text-muted-foreground">Net: </span>
            <span className={`font-bold ${netChange > 0 ? "text-red-600 dark:text-red-400" : netChange < 0 ? "text-green-600 dark:text-green-400" : ""}`}>
              {netChange > 0 ? "+" : ""}{formatCurrency(netChange)}
            </span>
          </div>
        </div>

        {/* Changes grouped by section */}
        {Object.entries(changesBySection).map(([section, changes]) => (
          <div key={section}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {section}
            </h4>
            <div className="space-y-1">
              {changes.map((change, idx) => {
                const config = CHANGE_TYPE_CONFIG[change.type] || CHANGE_TYPE_CONFIG.added;
                return (
                  <div key={idx} className="flex items-center gap-3 py-1.5 border-b border-border/20 text-sm">
                    <Badge className={`text-[10px] shrink-0 ${config.color}`}>
                      {config.label}
                    </Badge>
                    <span className="flex-1 min-w-0 truncate">{change.description}</span>
                    {change.type === "price_changed" && change.previous_amount !== undefined && (
                      <span className="shrink-0 text-muted-foreground text-xs">
                        {formatCurrency(change.previous_amount)} {"\u2192"} {formatCurrency(change.amount || 0)}
                      </span>
                    )}
                    {change.type === "type_changed" && change.previous_type && (
                      <span className="shrink-0 text-muted-foreground text-xs">
                        {change.previous_type} {"\u2192"} {change.item_type}
                      </span>
                    )}
                    {(change.type === "added" || change.type === "removed") && change.amount !== undefined && change.amount !== 0 && (
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {formatCurrency(change.amount)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground pt-2">
          {changelog.changes.length} change{changelog.changes.length !== 1 ? "s" : ""} from Version {changelog.previous_version}
        </p>
      </CardContent>
    </Card>
  );
}

/** Page footer matching Rawson format: page number + job ref + client initial area */
function PageFooter({ doc, label }: { doc: TenderDocumentData; label: string }) {
  const jobRef = [doc.job_code, doc.lot_address || doc.job_address].filter(Boolean).join(" - ");
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-4 mt-6 border-t border-border/30">
      <span>{jobRef}</span>
      <span>{label}</span>
      <span>Client: ___________</span>
    </div>
  );
}

/** Cover Letter page - generated from tender data (matches Rawson page 13) */
function CoverLetterPage({ doc }: { doc: TenderDocumentData }) {
  const headerGroups = doc.sections_grouped_by_header;
  const hasTwoLevelData = headerGroups && Object.keys(headerGroups).length > 0;
  const validityDays = doc.validity_days || 30;

  return (
    <Card>
      <CardContent className="pt-8 pb-6 space-y-6">
        {/* Letterhead with logo */}
        <div className="flex justify-between items-start">
          <div>
            <CompanyLogo doc={doc} className="h-12 w-auto mb-2" />
            {doc.company_name && <p className="font-bold text-sm">{doc.company_name}</p>}
          </div>
          <div className="text-sm text-right">
            <p>{formatTenderDate(doc.date_prepared)}</p>
            {doc.client_name && <p className="font-medium mt-2">{doc.client_name}</p>}
            {doc.client_address && <p className="text-muted-foreground">{doc.client_address}</p>}
          </div>
        </div>

        {/* Greeting */}
        <div className="text-sm space-y-4">
          <p>Dear {doc.client_name || "Valued Client"},</p>

          <p>
            We thank you for the opportunity of presenting this tender to construct your new
            {doc.company_name ? ` ${doc.company_name}` : ""} home at;
          </p>

          <p className="font-bold">{doc.lot_address || doc.job_address || doc.job_name}</p>

          <p>
            This tender supersedes all previous tenders and offers. It is based upon our recent
            site inspection, known council and statutory authority requirements and the disclosure
            of all related information about your land including restrictions and/or covenants.
          </p>
        </div>

        {/* Price Summary Table */}
        <PriceSummaryBlock doc={doc} headerGroups={headerGroups} widthClass="w-40" />

        {/* Validity */}
        <p className="text-sm">
          The tender price will remain fixed for {validityDays} days provided that, within 7 days from the
          original tender date (or {doc.valid_until ? formatTenderDate(doc.valid_until) : "the valid until date"})
          you have paid an acceptance fee and signed the tender.
        </p>

        {/* Acceptance Checklist */}
        <div className="text-sm space-y-2">
          <p>Upon your acceptance of this tender we will:</p>
          <div className="space-y-2 pl-4">
            <label className="flex items-center gap-3">
              <div className="w-4 h-4 border border-foreground/50 rounded-sm shrink-0" />
              <span>Prepare preliminary plans for your approval</span>
            </label>
            <label className="flex items-center gap-3">
              <div className="w-4 h-4 border border-foreground/50 rounded-sm shrink-0" />
              <span>Prepare Development Application Plans and Documents</span>
            </label>
            {doc.developer_approval && (
              <label className="flex items-center gap-3">
                <div className="w-4 h-4 border border-foreground/50 rounded-sm shrink-0" />
                <span>Obtain Developer approval (if applicable)</span>
              </label>
            )}
          </div>
        </div>

        {/* Closing */}
        <div className="text-sm space-y-4 pt-4">
          <p>
            Once again, we would like to thank you for the opportunity to present this tender for the
            construction of your new home and trust that it meets with your satisfaction. We take great
            pride in the homes we build, their quality and design, and we are confident that you too will
            be extremely proud of your new home.
          </p>

          <div className="pt-4">
            <p>Yours Sincerely,</p>
            <p className="font-bold pt-8">{doc.company_name?.toUpperCase() || "THE BUILDER"}</p>
          </div>
        </div>

        <PageFooter doc={doc} label="Cover Letter" />
      </CardContent>
    </Card>
  );
}

/** Terms & Conditions / "PLEASE NOTE" page */
function TermsPage({ doc }: { doc: TenderDocumentData }) {
  if (!doc.terms_and_conditions_html) return null;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-xl font-bold tracking-wide">
          <span className="underline underline-offset-8 decoration-2 decoration-primary">
            PLEASE NOTE
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div
          className="prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2"
          dangerouslySetInnerHTML={{ __html: doc.terms_and_conditions_html }}
        />
        <PageFooter doc={doc} label="Terms & Conditions" />
      </CardContent>
    </Card>
  );
}

/** Base Specification page (two-column spec sheet) */
function BaseSpecificationPage({ doc }: { doc: TenderDocumentData }) {
  if (!doc.base_specification_html) return null;

  const specTitle = doc.specification
    ? `${doc.specification} Specification`
    : "Base Specification";

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-xl font-bold tracking-wide">
          <span className="underline underline-offset-8 decoration-2 decoration-primary">
            {specTitle.toUpperCase()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div
          className="prose prose-sm dark:prose-invert max-w-none columns-1 md:columns-2 gap-8 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:uppercase [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:text-xs [&_p]:mb-1 [&_ul]:text-xs [&_ul]:pl-3 [&_li]:mb-0.5"
          dangerouslySetInnerHTML={{ __html: doc.base_specification_html }}
        />
        <PageFooter doc={doc} label="Base Specification" />
      </CardContent>
    </Card>
  );
}

/** Acceptance of Tender page (matches Rawson page 19) */
/** Schedule table for PC or PS items — used on the acceptance page and as a contract attachment */
function PcPsScheduleTable({
  title,
  items,
  colorClass,
  description,
}: {
  title: string;
  items: TenderDocumentItem[];
  colorClass: string;
  description?: string;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-bold ${colorClass}`}>{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground italic leading-relaxed">{description}</p>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-foreground/20">
            <th className="text-left py-1.5 pr-4 font-semibold w-10">#</th>
            <th className="text-left py-1.5 pr-4 font-semibold">Description</th>
            <th className="text-left py-1.5 pr-4 font-semibold w-36">Trade / Section</th>
            <th className="text-right py-1.5 font-semibold w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="border-b border-border/30">
              <td className="py-1.5 pr-4 text-muted-foreground">{idx + 1}</td>
              <td className="py-1.5 pr-4">{item.description}</td>
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">
                {item.trade_name || stripCodePrefix(item.tender_section_name)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(item.total_amount || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/20">
            <td colSpan={3} className="py-2 font-semibold text-right pr-4">Total {title}</td>
            <td className="py-2 text-right font-semibold tabular-nums">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AcceptancePage({ doc }: { doc: TenderDocumentData }) {
  // Items are already stored at the correct level by TenderDocumentService:
  // per-PO classified → one summary row per PO, per-item → individual rows
  const allItems = Object.values(doc.sections_grouped).flat();
  const pcItems = allItems.filter(i => i.item_type === "priced");
  const psItems = allItems.filter(i => i.item_type === "provisional");

  return (
    <Card>
      <CardContent className="pt-8 pb-6 space-y-6">
        {/* Header with logo */}
        <div className="flex justify-between items-start">
          <div>
            <CompanyLogo doc={doc} className="h-12 w-auto mb-2" />
            {doc.company_name && <p className="font-bold text-sm">{doc.company_name}</p>}
          </div>
          <div className="text-sm text-right">
            {doc.client_name && <p className="font-medium">{doc.client_name}</p>}
            {doc.client_address && <p className="text-muted-foreground">{doc.client_address}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="border-2 border-foreground p-4 text-center">
          <h2 className="text-lg font-bold tracking-wide">
            ACCEPTANCE OF TENDER AND INSTRUCTION FOR PREPARATION
            OF DEVELOPMENT APPLICATION PLANS
          </h2>
        </div>

        {/* Key Details */}
        <dl className="grid grid-cols-[220px_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="font-bold">Construction of Dwelling at:</dt>
          <dd>{doc.lot_address || doc.job_address || doc.job_name}</dd>

          <dt className="font-bold">Tender Date:</dt>
          <dd>{formatTenderDate(doc.date_prepared)}</dd>

          <dt className="font-bold">Total Tender Price:</dt>
          <dd className="font-bold">{formatCurrency(doc.total)}</dd>
        </dl>

        {/* Acceptance Text */}
        {doc.acceptance_page_html ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: doc.acceptance_page_html }}
          />
        ) : (
          <div className="text-sm space-y-4">
            <p>
              I/We hereby accept your tender for the construction of our new home at the above address.
              We have initialled and attached the tender and any plans to this acceptance.
            </p>

            <p>
              I/We hereby acknowledge that this tender price will remain fixed for a period of{" "}
              <span className="underline">{doc.validity_days || 180}</span> days from the Tender 1 date,
              which is {doc.valid_until ? formatTenderDate(doc.valid_until) : "___/___/___"} and subject
              to the terms of the building contract will remain fixed on the condition that the building
              works commence construction on or before this date.
            </p>

            <p>
              You are hereby authorised to prepare all necessary documentation for submission to the
              Authorities for approval, including architectural working drawings, structural engineer
              design and specifications.
            </p>
          </div>
        )}

        {/* Prime Cost & Provisional Sum Schedules */}
        {(pcItems.length > 0 || psItems.length > 0) && (
          <div className="space-y-6 pt-2">
            <PcPsScheduleTable
              title="Schedule of Prime Cost Items"
              items={pcItems}
              colorClass="text-blue-700 dark:text-blue-400"
              description="A Prime Cost is an allowance for items where the actual cost is not yet determined. The contract price will be adjusted to reflect the actual cost of these items when purchased or completed."
            />
            <PcPsScheduleTable
              title="Schedule of Provisional Sum Items"
              items={psItems}
              colorClass="text-violet-700 dark:text-violet-400"
              description="A Provisional Sum is an allowance for work that cannot be fully defined at the time of tendering. The contract price will be adjusted based on the actual cost when the work is carried out."
            />
          </div>
        )}

        {/* Signature Lines */}
        {(() => {
          const clientNames = doc.client_name?.includes(" & ")
            ? doc.client_name.split(" & ")
            : [doc.client_name || null, null];
          return (
            <div className="pt-8 space-y-8">
              <p className="font-bold text-sm">Accepted By:</p>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8 flex items-end pb-1">
                    {clientNames[0] && <span className="text-sm">{clientNames[0]}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Client Name :(1)</p>
                </div>
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8" />
                  <p className="text-xs text-muted-foreground">Client Signature :(1)</p>
                </div>
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8" />
                  <p className="text-xs text-muted-foreground">Date :</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8 flex items-end pb-1">
                    {clientNames[1] && <span className="text-sm">{clientNames[1]}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Client Name :(2)</p>
                </div>
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8" />
                  <p className="text-xs text-muted-foreground">Client Signature :(2)</p>
                </div>
                <div className="space-y-2">
                  <div className="border-b border-foreground h-8" />
                  <p className="text-xs text-muted-foreground">Date :</p>
                </div>
              </div>
            </div>
          );
        })()}

        <PageFooter doc={doc} label="Acceptance of Tender" />
      </CardContent>
    </Card>
  );
}

export function TenderDocumentView({ document: doc, previewMode = false }: TenderDocumentViewProps) {
  const headerGroups = doc.sections_grouped_by_header;
  const hasTwoLevelData = headerGroups && Object.keys(headerGroups).length > 0;
  const flatSections = Object.entries(doc.sections_grouped || {});

  // Compute sequential section numbers across all sections
  const sectionNumbers = React.useMemo(
    () => (hasTwoLevelData ? computeSectionNumbers(headerGroups!) : new Map<string, number>()),
    [hasTwoLevelData, headerGroups]
  );

  return (
    <div className={previewMode ? "space-y-3" : "space-y-6"}>
      {!previewMode && (
        <>
          {/* ═══════ COVER PAGE ═══════ */}
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center space-y-6">
              {/* Builder's logo */}
              <CompanyLogo doc={doc} className="h-20 w-auto" />

              {/* Company name (shown if no logo, or as subtitle under logo) */}
              {doc.company_name && (
                <h2 className="text-2xl font-bold tracking-widest uppercase">
                  {doc.company_name}
                </h2>
              )}

              <h1 className="text-5xl font-bold tracking-[0.15em]">TENDER</h1>

              <div className="space-y-1">
                <p className="text-lg text-muted-foreground">Presented to</p>
                <p className="text-2xl font-bold">{doc.client_name || "\u2014"}</p>
              </div>

              <p className="text-lg text-muted-foreground">
                For the construction of your new home
              </p>

              <div className="space-y-1">
                {(doc.plan_name || doc.design_name) && (
                  <p className="text-2xl font-bold">{doc.plan_name || doc.design_name}</p>
                )}
                {doc.facade && (
                  <p className="text-lg font-medium">{doc.facade} Facade</p>
                )}
                <p className="text-lg text-muted-foreground">at</p>
                <p className="text-2xl font-bold uppercase">
                  {doc.lot_address || doc.job_address || doc.job_name || "\u2014"}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!previewMode && (
        <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-xl font-bold tracking-wide">
            <span className="underline underline-offset-8 decoration-2 decoration-primary">
              DETAILS
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Tender Identity */}
          <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-3">
            <dt className="font-bold text-sm">TENDER ISSUE:</dt>
            <dd className="text-sm flex items-center gap-2">
              {doc.version}
              <Badge className={STATUS_COLORS[doc.status] || ""}>
                {doc.status.replace(/_/g, " ")}
              </Badge>
            </dd>

            <dt className="font-bold text-sm">TENDER PREPARED:</dt>
            <dd className="text-sm">{formatTenderDate(doc.date_prepared)}</dd>

            {doc.valid_until && (
              <>
                <dt className="font-bold text-sm">TENDER VALID UNTIL:</dt>
                <dd className="text-sm">{formatTenderDate(doc.valid_until)}</dd>
              </>
            )}

            <dt className="font-bold text-sm">JOB NUMBER:</dt>
            <dd className="text-sm">{doc.job_code || "\u2014"}</dd>

            {doc.salesperson_name && (
              <>
                <dt className="font-bold text-sm">SALES PERSON:</dt>
                <dd className="text-sm">{doc.salesperson_name}</dd>
              </>
            )}

            {doc.sales_centre && (
              <>
                <dt className="font-bold text-sm">SALES CENTRE:</dt>
                <dd className="text-sm">{doc.sales_centre}</dd>
              </>
            )}

            {doc.created_by_name && (
              <>
                <dt className="font-bold text-sm">PREPARED BY:</dt>
                <dd className="text-sm">{doc.created_by_name}</dd>
              </>
            )}

            {doc.council && (
              <>
                <dt className="font-bold text-sm">COUNCIL:</dt>
                <dd className="text-sm">{doc.council}</dd>
              </>
            )}
          </dl>

          {/* Site Details */}
          {(doc.estate || doc.developer_approval != null || doc.developer_contact || doc.land_registration || doc.building_contract_type || doc.development_application) && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-3 mt-6 pt-4 border-t">
              {doc.estate && (
                <>
                  <dt className="font-bold text-sm">ESTATE:</dt>
                  <dd className="text-sm">{doc.estate}</dd>
                </>
              )}

              <dt className="font-bold text-sm">DEVELOPER APPROVAL:</dt>
              <dd className="text-sm">{doc.developer_approval ? "Yes" : "No"}</dd>

              {doc.developer_contact && (
                <>
                  <dt className="font-bold text-sm">DEVELOPER CONTACT:</dt>
                  <dd className="text-sm">{doc.developer_contact}</dd>
                </>
              )}

              {doc.land_registration && (
                <>
                  <dt className="font-bold text-sm">LAND REGISTRATION:</dt>
                  <dd className="text-sm">{doc.land_registration}</dd>
                </>
              )}

              {doc.building_contract_type && (
                <>
                  <dt className="font-bold text-sm">BUILDING CONTRACT:</dt>
                  <dd className="text-sm">{doc.building_contract_type}</dd>
                </>
              )}

              {doc.development_application && (
                <>
                  <dt className="font-bold text-sm">DEVELOPMENT APPLICATION:</dt>
                  <dd className="text-sm">{doc.development_application}</dd>
                </>
              )}

              {doc.wind_classification && (
                <>
                  <dt className="font-bold text-sm">WIND CLASSIFICATION:</dt>
                  <dd className="text-sm">{doc.wind_classification}</dd>
                </>
              )}

              {doc.soil_classification && (
                <>
                  <dt className="font-bold text-sm">SOIL CLASSIFICATION:</dt>
                  <dd className="text-sm">{doc.soil_classification}</dd>
                </>
              )}
            </dl>
          )}

          {/* FOR: Client Info */}
          {doc.client_name && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 mt-6 pt-4 border-t">
              <dt className="font-bold text-sm">FOR:</dt>
              <dd className="text-sm space-y-0.5">
                <p className="font-medium">{doc.client_name}</p>
                {doc.client_address && (
                  <p className="text-muted-foreground">{doc.client_address}</p>
                )}
              </dd>
            </dl>
          )}

          {/* PRIMARY CONTACT */}
          {doc.client_name && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 mt-6 pt-4 border-t">
              <dt className="font-bold text-sm">PRIMARY CONTACT:</dt>
              <dd className="text-sm">
                <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5">
                  <dt className="font-bold">Name:</dt>
                  <dd>
                    {doc.client_name.includes(" & ")
                      ? doc.client_name.split(" & ")[0]
                      : doc.client_name}
                  </dd>
                  {doc.client_phone && (
                    <>
                      <dt className="font-bold">Mobile:</dt>
                      <dd>{doc.client_phone}</dd>
                    </>
                  )}
                  {doc.client_email && (
                    <>
                      <dt className="font-bold">Email:</dt>
                      <dd>{doc.client_email}</dd>
                    </>
                  )}
                </dl>
              </dd>
            </dl>
          )}

          {/* TO CONSTRUCT */}
          {(doc.design_name || doc.facade || doc.specification) && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 mt-6 pt-4 border-t">
              <dt className="font-bold text-sm">TO CONSTRUCT:</dt>
              <dd className="text-sm space-y-0.5">
                {doc.design_name && <p className="font-medium">{doc.design_name}</p>}
                {doc.facade && <p>{doc.facade} Facade</p>}
                {doc.specification && <p>{doc.specification}</p>}
              </dd>
            </dl>
          )}

          {/* AT: Lot Address */}
          {doc.lot_address && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 mt-4">
              <dt className="font-bold text-sm">AT:</dt>
              <dd className="text-sm font-medium uppercase">{doc.lot_address}</dd>
            </dl>
          )}
        </CardContent>
      </Card>
      )}

      {/* ═══════ PRICING SCHEDULE ═══════ */}
      {!previewMode && (
        <div className="pt-2">
          <h3 className="text-xl font-bold tracking-wide">
            <span className="underline underline-offset-8 decoration-2 decoration-primary">
              PRICING SCHEDULE
            </span>
          </h3>
        </div>
      )}

      {/* Two-Level: Header > Section > Items (Rawson format) */}
      {hasTwoLevelData ? (
        Object.entries(headerGroups!).map(([headerName, sections]) => {
          const headerTotal = doc.header_subtotals?.[headerName] || 0;
          const sectionEntries = Object.entries(sections);

          return (
            <TenderHeaderGroup
              key={headerName}
              title={cleanSectionName(headerName)}
              subtitle={formatCurrency(headerTotal)}
            >
              {sectionEntries.map(([sectionName, items]) => {
                const sectionTotal = doc.section_subtotals?.[sectionName] || 0;
                const secNum = sectionNumbers.get(sectionName) || 0;
                const allNotes = items.every((item) => item.item_type === "note");

                const sectionDocTypes = doc.section_document_types?.[sectionName] || [];

                return (
                  <TenderSection
                    key={sectionName}
                    title={cleanSectionName(sectionName)}
                    defaultOpen={!allNotes || items.length <= 2}
                  >
                    <SectionItems
                      items={items}
                      sectionNumber={secNum}
                      sectionSubtotal={sectionTotal}
                      sectionName={cleanSectionName(sectionName)}
                    />
                    {sectionDocTypes.length > 0 && (
                      <div className="pt-2 pb-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                          <Paperclip className="h-3 w-3" />
                          Reference Documents:
                        </p>
                        <ul className="text-xs text-muted-foreground pl-5 list-disc space-y-0.5">
                          {sectionDocTypes.map((dt) => (
                            <li key={dt}>{dt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TenderSection>
                );
              })}
            </TenderHeaderGroup>
          );
        })
      ) : (
        /* Flat sections fallback (legacy documents without header data) */
        flatSections.map(([sectionName, items], idx) => {
          const sectionTotal = doc.section_subtotals?.[sectionName] || 0;
          return (
            <Card key={sectionName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">{cleanSectionName(sectionName)}</CardTitle>
              </CardHeader>
              <CardContent>
                <SectionItems
                  items={items}
                  sectionNumber={idx + 1}
                  sectionSubtotal={sectionTotal}
                  sectionName={cleanSectionName(sectionName)}
                />
              </CardContent>
            </Card>
          );
        })
      )}

      {/* ═══════ COVER LETTER WITH TOTALS (Rawson page 13) ═══════ */}
      {!previewMode && (
        <CoverLetterPage doc={doc} />
      )}

      {/* Totals summary (always visible, including in preview mode) */}
      {previewMode && (
        <Card>
          <CardContent className="pt-6">
            <PriceSummaryBlock doc={doc} headerGroups={headerGroups} widthClass="w-32" />
          </CardContent>
        </Card>
      )}

      {/* ═══════ TERMS & CONDITIONS / "PLEASE NOTE" (Rawson pages 14-15) ═══════ */}
      {!previewMode && <TermsPage doc={doc} />}

      {/* ═══════ BASE SPECIFICATION (Rawson pages 16-18) ═══════ */}
      {!previewMode && <BaseSpecificationPage doc={doc} />}

      {/* ═══════ ACCEPTANCE OF TENDER (Rawson page 19) ═══════ */}
      {!previewMode && <AcceptancePage doc={doc} />}

      {/* Changelog (version-to-version comparison) */}
      {!previewMode && doc.has_changelog && doc.changelog && (
        <ChangelogSection changelog={doc.changelog} />
      )}

      {/* Revision Notes */}
      {!previewMode && doc.revision_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-600 dark:text-orange-400">Revision Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{doc.revision_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type { TenderDocumentData, TenderDocumentItem };
