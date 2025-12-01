import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";

// Types
export interface LineItem {
  name: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface InvoiceTemplate {
  title: string;
  logoUrl?: string;
  invoiceNoLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  fromLabel: string;
  customerLabel: string;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  subtotalLabel: string;
  vatLabel: string;
  taxLabel: string;
  totalSummaryLabel: string;
  paymentLabel: string;
  noteLabel: string;
  discountLabel: string;
  includeVat: boolean;
  includeTax: boolean;
  includeDiscount: boolean;
  includeDecimals: boolean;
  includeUnits: boolean;
  vatRate: number;
  taxRate: number;
  locale: string;
  currency: string;
  dateFormat: string;
  timezone: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  template: InvoiceTemplate;
  lineItems: LineItem[];
  customerName: string;
  customerDetails: string;
  fromDetails: string;
  paymentDetails: string;
  noteDetails?: string;
  currency: string;
  discount?: number;
}

// Helper to format currency
function formatCurrency(
  amount: number,
  currency: string,
  locale: string,
  includeDecimals: boolean
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(amount);
}

// Invoice Meta Component
interface InvoiceMetaProps {
  template: InvoiceTemplate;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
}

function InvoiceMeta({
  template,
  invoiceNumber,
  issueDate,
  dueDate,
}: InvoiceMetaProps) {
  return (
    <div className="mb-2">
      <h2 className="text-brand-lg font-medium mb-1 w-fit min-w-[100px]">
        {template.title}
      </h2>
      <div className="flex flex-col gap-0.5">
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.invoiceNoLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{invoiceNumber}</span>
        </div>
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.issueDateLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{issueDate}</span>
        </div>
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.dueDateLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{dueDate}</span>
        </div>
      </div>
    </div>
  );
}

// Invoice Logo Component
interface InvoiceLogoProps {
  logo: string;
  customerName: string;
}

function InvoiceLogo({ logo, customerName }: InvoiceLogoProps) {
  return (
    <div className="max-w-[300px]">
      <img
        src={logo}
        alt={customerName}
        style={{
          height: 80,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

// Invoice Line Items Component
interface InvoiceLineItemsProps {
  lineItems: LineItem[];
  currency: string;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  includeDecimals: boolean;
  locale: string;
  includeUnits: boolean;
}

function InvoiceLineItems({
  lineItems,
  currency,
  descriptionLabel,
  quantityLabel,
  priceLabel,
  totalLabel,
  includeDecimals,
  locale,
  includeUnits,
}: InvoiceLineItemsProps) {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-[1.5fr_15%_15%_15%] gap-4 items-center mb-2 pb-2 border-b border-border">
        <span className="text-brand-sm text-text-muted invisible md:visible">
          {descriptionLabel}
        </span>
        <span className="text-brand-sm text-text-muted text-right invisible md:visible">
          {priceLabel}
        </span>
        <span className="text-brand-sm text-text-muted text-right invisible md:visible">
          {quantityLabel}
        </span>
        <span className="text-brand-sm text-text-muted text-right">
          {totalLabel}
        </span>
      </div>

      {lineItems.map((item, index) => {
        const total = item.price * item.quantity;
        return (
          <div
            key={index}
            className="grid grid-cols-[1.5fr_15%_15%_15%] gap-4 items-center py-2 border-b border-border"
          >
            <span className="text-brand-sm truncate">{item.name}</span>
            <span className="text-brand-sm text-right font-mono">
              {formatCurrency(item.price, currency, locale, includeDecimals)}
            </span>
            <span className="text-brand-sm text-right font-mono">
              {item.quantity}
              {includeUnits && item.unit ? ` ${item.unit}` : ""}
            </span>
            <span className="text-brand-sm text-right font-mono">
              {formatCurrency(total, currency, locale, includeDecimals)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Invoice Summary Component
interface InvoiceSummaryProps {
  lineItems: LineItem[];
  currency: string;
  includeVat: boolean;
  includeTax: boolean;
  includeDiscount: boolean;
  vatRate: number;
  taxRate: number;
  discount?: number;
  subtotalLabel: string;
  vatLabel: string;
  taxLabel: string;
  discountLabel: string;
  totalLabel: string;
  locale: string;
  includeDecimals: boolean;
}

function InvoiceSummary({
  lineItems,
  currency,
  includeVat,
  includeTax,
  includeDiscount,
  vatRate,
  taxRate,
  discount = 0,
  subtotalLabel,
  vatLabel,
  taxLabel,
  discountLabel,
  totalLabel,
  locale,
  includeDecimals,
}: InvoiceSummaryProps) {
  const subtotal = lineItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const vatAmount = includeVat ? subtotal * (vatRate / 100) : 0;
  const taxAmount = includeTax ? subtotal * (taxRate / 100) : 0;
  const discountAmount = includeDiscount ? discount : 0;
  const total = subtotal + vatAmount + taxAmount - discountAmount;

  return (
    <div className="w-[320px] flex flex-col">
      <div className="flex justify-between py-2 border-b border-border">
        <span className="text-brand-sm text-text-muted">{subtotalLabel}</span>
        <span className="text-brand-sm font-mono">
          {formatCurrency(subtotal, currency, locale, includeDecimals)}
        </span>
      </div>

      {includeVat && (
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-brand-sm text-text-muted">
            {vatLabel} ({vatRate}%)
          </span>
          <span className="text-brand-sm font-mono">
            {formatCurrency(vatAmount, currency, locale, includeDecimals)}
          </span>
        </div>
      )}

      {includeTax && (
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-brand-sm text-text-muted">
            {taxLabel} ({taxRate}%)
          </span>
          <span className="text-brand-sm font-mono">
            {formatCurrency(taxAmount, currency, locale, includeDecimals)}
          </span>
        </div>
      )}

      {includeDiscount && discountAmount > 0 && (
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-brand-sm text-text-muted">{discountLabel}</span>
          <span className="text-brand-sm font-mono text-status-error-foreground">
            -{formatCurrency(discountAmount, currency, locale, includeDecimals)}
          </span>
        </div>
      )}

      <div className="flex justify-between py-3 mt-2">
        <span className="text-brand-lg font-medium">{totalLabel}</span>
        <span className="text-brand-lg font-mono font-medium">
          {formatCurrency(total, currency, locale, includeDecimals)}
        </span>
      </div>
    </div>
  );
}

// Main Invoice Component
export interface InvoiceProps {
  data: InvoiceData;
  width?: number;
  height?: number;
  className?: string;
}

function Invoice({
  data,
  width = 595,
  height = 842,
  className,
}: InvoiceProps) {
  if (!data) {
    return null;
  }

  const {
    invoiceNumber,
    issueDate,
    dueDate,
    template,
    lineItems,
    customerDetails,
    fromDetails,
    paymentDetails,
    noteDetails,
    currency,
    discount,
    customerName,
  } = data;

  return (
    <ScrollArea
      className={cn(
        "bg-background border border-border w-full md:w-auto h-full [&>div]:h-full",
        className
      )}
      style={{
        width: "100%",
        maxWidth: width,
        height,
      }}
    >
      <div
        className="p-4 sm:p-6 md:p-8 h-full flex flex-col"
        style={{ minHeight: height - 5 }}
      >
        <div className="flex justify-between">
          <InvoiceMeta
            template={template}
            invoiceNumber={invoiceNumber}
            issueDate={issueDate}
            dueDate={dueDate}
          />

          {template.logoUrl && (
            <InvoiceLogo logo={template.logoUrl} customerName={customerName} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6 mb-4">
          <div>
            <p className="text-brand-sm text-text-muted mb-2 block">
              {template.fromLabel}
            </p>
            <div className="text-brand-sm leading-5 whitespace-pre-line">
              {fromDetails}
            </div>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-brand-sm text-text-muted mb-2 block">
              {template.customerLabel}
            </p>
            <div className="text-brand-sm leading-5 whitespace-pre-line">
              {customerDetails}
            </div>
          </div>
        </div>

        <InvoiceLineItems
          lineItems={lineItems}
          currency={currency}
          descriptionLabel={template.descriptionLabel}
          quantityLabel={template.quantityLabel}
          priceLabel={template.priceLabel}
          totalLabel={template.totalLabel}
          includeDecimals={template.includeDecimals}
          locale={template.locale}
          includeUnits={template.includeUnits}
        />

        <div className="mt-10 md:mt-12 flex justify-end mb-6 md:mb-8">
          <InvoiceSummary
            lineItems={lineItems}
            currency={currency}
            includeVat={template.includeVat}
            includeTax={template.includeTax}
            includeDiscount={template.includeDiscount}
            vatRate={template.vatRate}
            taxRate={template.taxRate}
            discount={discount}
            subtotalLabel={template.subtotalLabel}
            vatLabel={template.vatLabel}
            taxLabel={template.taxLabel}
            discountLabel={template.discountLabel}
            totalLabel={template.totalSummaryLabel}
            locale={template.locale}
            includeDecimals={template.includeDecimals}
          />
        </div>

        <div className="flex flex-col space-y-6 md:space-y-8 mt-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <p className="text-brand-sm text-text-muted mb-2 block">
                {template.paymentLabel}
              </p>
              <div className="text-brand-sm leading-5 whitespace-pre-line">
                {paymentDetails}
              </div>
            </div>
            {noteDetails && (
              <div className="mt-4 md:mt-0">
                <p className="text-brand-sm text-text-muted mb-2 block">
                  {template.noteLabel}
                </p>
                <div className="text-brand-sm leading-5 whitespace-pre-line">
                  {noteDetails}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// Default template for demo purposes
const defaultTemplate: InvoiceTemplate = {
  title: "Invoice",
  invoiceNoLabel: "Invoice No",
  issueDateLabel: "Issue Date",
  dueDateLabel: "Due Date",
  fromLabel: "From",
  customerLabel: "To",
  descriptionLabel: "Description",
  quantityLabel: "Qty",
  priceLabel: "Price",
  totalLabel: "Total",
  subtotalLabel: "Subtotal",
  vatLabel: "VAT",
  taxLabel: "Tax",
  totalSummaryLabel: "Total",
  paymentLabel: "Payment Details",
  noteLabel: "Note",
  discountLabel: "Discount",
  includeVat: true,
  includeTax: false,
  includeDiscount: false,
  includeDecimals: true,
  includeUnits: false,
  vatRate: 25,
  taxRate: 0,
  locale: "en-US",
  currency: "USD",
  dateFormat: "MM/dd/yyyy",
  timezone: "UTC",
};

export {
  Invoice,
  InvoiceMeta,
  InvoiceLogo,
  InvoiceLineItems,
  InvoiceSummary,
  defaultTemplate,
};
