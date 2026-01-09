import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";

// Types
export interface POLineItem {
  name: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface PurchaseOrderTemplate {
  title: string;
  logoUrl?: string;
  poNumberLabel: string;
  issueDateLabel: string;
  deliveryDateLabel: string;
  fromLabel: string;
  toLabel: string;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  shippingLabel: string;
  totalSummaryLabel: string;
  termsLabel: string;
  notesLabel: string;
  includeTax: boolean;
  includeShipping: boolean;
  includeDecimals: boolean;
  includeUnits: boolean;
  taxRate: number;
  shippingCost: number;
  locale: string;
  currency: string;
  dateFormat: string;
}

export interface PurchaseOrderData {
  poNumber: string;
  issueDate: string;
  deliveryDate: string;
  template: PurchaseOrderTemplate;
  lineItems: POLineItem[];
  vendorName: string;
  fromDetails: string;
  toDetails: string;
  termsDetails?: string;
  notesDetails?: string;
  currency: string;
  shippingCost?: number;
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

// PO Meta Component
interface POMetaProps {
  template: PurchaseOrderTemplate;
  poNumber: string;
  issueDate: string;
  deliveryDate: string;
}

function POMeta({
  template,
  poNumber,
  issueDate,
  deliveryDate,
}: POMetaProps) {
  return (
    <div className="mb-2">
      <h2 className="text-brand-lg font-medium mb-1 w-fit min-w-[100px]">
        {template.title}
      </h2>
      <div className="flex flex-col gap-0.5">
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.poNumberLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{poNumber}</span>
        </div>
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.issueDateLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{issueDate}</span>
        </div>
        <div className="flex space-x-1 items-center">
          <span className="truncate text-brand-sm text-text-muted">
            {template.deliveryDateLabel}:
          </span>
          <span className="text-brand-sm flex-shrink-0">{deliveryDate}</span>
        </div>
      </div>
    </div>
  );
}

// PO Logo Component
interface POLogoProps {
  logo: string;
  vendorName: string;
}

function POLogo({ logo, vendorName }: POLogoProps) {
  return (
    <div className="max-w-[300px]">
      <img
        src={logo}
        alt={vendorName}
        style={{
          height: 80,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

// PO Line Items Component
interface POLineItemsProps {
  lineItems: POLineItem[];
  currency: string;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  includeDecimals: boolean;
  locale: string;
  includeUnits: boolean;
}

function POLineItems({
  lineItems,
  currency,
  descriptionLabel,
  quantityLabel,
  priceLabel,
  totalLabel,
  includeDecimals,
  locale,
  includeUnits,
}: POLineItemsProps) {
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
            <span className="text-xs text-right font-mono">
              {formatCurrency(item.price, currency, locale, includeDecimals)}
            </span>
            <span className="text-xs text-right font-mono">
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

// PO Summary Component
interface POSummaryProps {
  lineItems: POLineItem[];
  currency: string;
  includeTax: boolean;
  includeShipping: boolean;
  taxRate: number;
  shippingCost?: number;
  subtotalLabel: string;
  taxLabel: string;
  shippingLabel: string;
  totalLabel: string;
  locale: string;
  includeDecimals: boolean;
}

function POSummary({
  lineItems,
  currency,
  includeTax,
  includeShipping,
  taxRate,
  shippingCost = 0,
  subtotalLabel,
  taxLabel,
  shippingLabel,
  totalLabel,
  locale,
  includeDecimals,
}: POSummaryProps) {
  const subtotal = lineItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const taxAmount = includeTax ? subtotal * (taxRate / 100) : 0;
  const shipping = includeShipping ? shippingCost : 0;
  const total = subtotal + taxAmount + shipping;

  return (
    <div className="w-[320px] flex flex-col">
      <div className="flex justify-between py-2 border-b border-border">
        <span className="text-base text-text-muted">{subtotalLabel}</span>
        <span className="text-base font-mono">
          {formatCurrency(subtotal, currency, locale, includeDecimals)}
        </span>
      </div>

      {includeTax && (
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-base text-text-muted">
            {taxLabel} ({taxRate}%)
          </span>
          <span className="text-base font-mono">
            {formatCurrency(taxAmount, currency, locale, includeDecimals)}
          </span>
        </div>
      )}

      {includeShipping && shipping > 0 && (
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-brand-sm text-text-muted">{shippingLabel}</span>
          <span className="text-brand-sm font-mono">
            {formatCurrency(shipping, currency, locale, includeDecimals)}
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

// Main Purchase Order Component
export interface PurchaseOrderProps {
  data: PurchaseOrderData;
  width?: number;
  height?: number;
  className?: string;
}

function PurchaseOrder({
  data,
  width = 595,
  height = 842,
  className,
}: PurchaseOrderProps) {
  if (!data) {
    return null;
  }

  const {
    poNumber,
    issueDate,
    deliveryDate,
    template,
    lineItems,
    fromDetails,
    toDetails,
    termsDetails,
    notesDetails,
    currency,
    vendorName,
    shippingCost,
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
          <POMeta
            template={template}
            poNumber={poNumber}
            issueDate={issueDate}
            deliveryDate={deliveryDate}
          />

          {template.logoUrl && (
            <POLogo logo={template.logoUrl} vendorName={vendorName} />
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
              {template.toLabel}
            </p>
            <div className="text-brand-sm leading-5 whitespace-pre-line">
              {toDetails}
            </div>
          </div>
        </div>

        <POLineItems
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
          <POSummary
            lineItems={lineItems}
            currency={currency}
            includeTax={template.includeTax}
            includeShipping={template.includeShipping}
            taxRate={template.taxRate}
            shippingCost={shippingCost}
            subtotalLabel={template.subtotalLabel}
            taxLabel={template.taxLabel}
            shippingLabel={template.shippingLabel}
            totalLabel={template.totalSummaryLabel}
            locale={template.locale}
            includeDecimals={template.includeDecimals}
          />
        </div>

        <div className="flex flex-col space-y-6 md:space-y-8 mt-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {termsDetails && (
              <div>
                <p className="text-brand-sm text-text-muted mb-2 block">
                  {template.termsLabel}
                </p>
                <div className="text-brand-sm leading-5 whitespace-pre-line">
                  {termsDetails}
                </div>
              </div>
            )}
            {notesDetails && (
              <div className="mt-4 md:mt-0">
                <p className="text-brand-sm text-text-muted mb-2 block">
                  {template.notesLabel}
                </p>
                <div className="text-brand-sm leading-5 whitespace-pre-line">
                  {notesDetails}
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
const defaultPOTemplate: PurchaseOrderTemplate = {
  title: "Purchase Order",
  poNumberLabel: "PO Number",
  issueDateLabel: "Issue Date",
  deliveryDateLabel: "Delivery Date",
  fromLabel: "From",
  toLabel: "To",
  descriptionLabel: "Description",
  quantityLabel: "Qty",
  priceLabel: "Price",
  totalLabel: "Total",
  subtotalLabel: "Subtotal",
  taxLabel: "Tax",
  shippingLabel: "Shipping",
  totalSummaryLabel: "Total",
  termsLabel: "Terms & Conditions",
  notesLabel: "Notes",
  includeTax: true,
  includeShipping: true,
  includeDecimals: true,
  includeUnits: false,
  taxRate: 8.25,
  shippingCost: 0,
  locale: "en-US",
  currency: "USD",
  dateFormat: "MM/dd/yyyy",
};

export {
  PurchaseOrder,
  POMeta,
  POLogo,
  POLineItems,
  POSummary,
  defaultPOTemplate,
};
