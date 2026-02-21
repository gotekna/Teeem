"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

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

function SectionItemsTable({
  items,
  sectionSubtotal,
  jobId,
}: {
  items: TenderDocumentItem[];
  sectionSubtotal: number;
  jobId: number;
}) {
  const allNotes = items.every((item) => item.item_type === "note" && item.default_note);

  if (allNotes && items.length > 0) {
    return (
      <p className="text-sm italic text-muted-foreground py-2 pl-2">
        {items[0].default_note}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 w-10">#</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right w-20">Qty</th>
            <th className="py-2 text-right w-28">Unit Price</th>
            <th className="py-2 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/50">
              <td className="py-2 text-muted-foreground">{item.line_number}</td>
              <td className="py-2">
                {item.description}
                {item.notes && (
                  <span className="block text-xs text-muted-foreground">{item.notes}</span>
                )}
                {item.source_po_number && (
                  <span className="block text-xs text-muted-foreground">
                    PO:{" "}
                    {item.source_purchase_order_id ? (
                      <a
                        href={`/purchase_orders/${item.source_purchase_order_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.source_po_number}
                      </a>
                    ) : (
                      item.source_po_number
                    )}
                  </span>
                )}
              </td>
              {item.item_type === "priced" || item.item_type === "provisional" ? (
                <>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unit_price || 0)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(item.total_amount || 0)}</td>
                </>
              ) : (
                <td colSpan={3} className="py-2 text-right text-muted-foreground italic">
                  {item.item_type === "included" ? "Included" : "\u2014"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {sectionSubtotal > 0 && (
          <tfoot>
            <tr>
              <td colSpan={4} className="py-2 text-right text-muted-foreground text-xs">Section subtotal</td>
              <td className="py-2 text-right font-medium text-xs">{formatCurrency(sectionSubtotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded-sm transition-colors -mx-1 px-1"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground/80">{title}</span>
        </div>
        {subtitle}
      </button>
      {isOpen && <div className="pl-6">{children}</div>}
    </div>
  );
}

function CollapsibleCard({
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
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <span className="text-sm font-semibold">{subtitle}</span>
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-1">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export function TenderDocumentView({ document: doc, previewMode = false }: TenderDocumentViewProps) {
  const headerGroups = doc.sections_grouped_by_header;
  const hasTwoLevelData = headerGroups && Object.keys(headerGroups).length > 0;
  const flatSections = Object.entries(doc.sections_grouped || {});

  return (
    <div className={previewMode ? "space-y-3" : "space-y-6"}>
      {!previewMode && (
        <>
          {/* ═══════ COVER PAGE ═══════ */}
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center space-y-6">
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
          {(doc.estate || doc.developer_approval || doc.developer_contact || doc.land_registration || doc.building_contract_type || doc.development_application) && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-3 mt-6 pt-4 border-t">
              {doc.estate && (
                <>
                  <dt className="font-bold text-sm">ESTATE:</dt>
                  <dd className="text-sm">{doc.estate}</dd>
                </>
              )}

              {doc.developer_approval !== null && doc.developer_approval !== undefined && (
                <>
                  <dt className="font-bold text-sm">DEVELOPER APPROVAL:</dt>
                  <dd className="text-sm">{doc.developer_approval ? "Yes" : "No"}</dd>
                </>
              )}

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
          {(doc.client_email || doc.client_phone) && (
            <dl className="grid grid-cols-[200px_1fr] gap-x-6 mt-6 pt-4 border-t">
              <dt className="font-bold text-sm">PRIMARY CONTACT:</dt>
              <dd className="text-sm">
                <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5">
                  {doc.client_name && (
                    <>
                      <dt className="font-bold">Name:</dt>
                      <dd>
                        {doc.client_name.includes(" & ")
                          ? doc.client_name.split(" & ")[0]
                          : doc.client_name}
                      </dd>
                    </>
                  )}
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

      {/* Two-Level Sections (Header > Collapsible Section > Items) */}
      {hasTwoLevelData ? (
        Object.entries(headerGroups).map(([headerName, sections]) => {
          const headerTotal = doc.header_subtotals?.[headerName] || 0;
          const sectionEntries = Object.entries(sections);

          return (
            <CollapsibleCard
              key={headerName}
              title={headerName}
              subtitle={formatCurrency(headerTotal)}
            >
              {sectionEntries.map(([sectionName, items]) => {
                const sectionTotal = doc.section_subtotals?.[sectionName] || 0;
                const allNotes = items.every((item) => item.item_type === "note" && item.default_note);

                return (
                  <CollapsibleSection
                    key={sectionName}
                    title={sectionName}
                    subtitle={
                      <span className="text-xs font-medium text-muted-foreground mr-1">
                        {allNotes ? "\u2014" : formatCurrency(sectionTotal)}
                      </span>
                    }
                    defaultOpen={!allNotes}
                  >
                    <SectionItemsTable
                      items={items}
                      sectionSubtotal={sectionTotal}
                      jobId={doc.job_id}
                    />
                  </CollapsibleSection>
                );
              })}
            </CollapsibleCard>
          );
        })
      ) : (
        /* Flat sections fallback (legacy documents without header data) */
        flatSections.map(([sectionName, items]) => (
          <CollapsibleCard
            key={sectionName}
            title={sectionName}
            subtitle={formatCurrency(doc.section_subtotals?.[sectionName] || 0)}
          >
            <SectionItemsTable
              items={items}
              sectionSubtotal={doc.section_subtotals?.[sectionName] || 0}
              jobId={doc.job_id}
            />
          </CollapsibleCard>
        ))
      )}

      {/* ═══════ TOTALS ═══════ */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-right">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (excl. GST)</span>
              <span className="font-medium">{formatCurrency(doc.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST</span>
              <span className="font-medium">{formatCurrency(doc.gst)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-lg">Total (incl. GST)</span>
              <span className="font-bold text-lg">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
