/**
 * Xero Integration Types
 * TypeScript definitions for Xero API responses and data structures
 */

export interface XeroLink {
  id: number;
  contact_id: number;
  xero_contact_id: string;
  xero_tenant_id: string;
  xero_tenant_name: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface XeroTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_type: string;
  created_at: string;
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  ContactNumber?: string;
  AccountNumber?: string;
  ContactStatus?: string;
  TaxNumber?: string;
  BankAccountDetails?: string;
  Addresses?: XeroAddress[];
  Phones?: XeroPhone[];
  ContactPersons?: XeroContactPerson[];
  ContactGroups?: XeroContactGroup[];
  IsSupplier?: boolean;
  IsCustomer?: boolean;
  DefaultCurrency?: string;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
  Balances?: {
    AccountsReceivable?: {
      Outstanding?: number;
      Overdue?: number;
    };
    AccountsPayable?: {
      Outstanding?: number;
      Overdue?: number;
    };
  };
}

export interface XeroAddress {
  AddressType: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
}

export interface XeroPhone {
  PhoneType: string;
  PhoneNumber?: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
}

export interface XeroContactPerson {
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  IncludeInEmails?: boolean;
}

export interface XeroContactGroup {
  Name: string;
  Status?: string;
  ContactGroupID?: string;
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: string;
  Contact: {
    ContactID: string;
    Name: string;
  };
  Date: string;
  DueDate: string;
  Status: string;
  LineAmountTypes: string;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  AmountCredited: number;
  CurrencyCode: string;
  Reference?: string;
  BrandingThemeID?: string;
  Url?: string;
  UpdatedDateUTC: string;
  LineItems?: XeroLineItem[];
  Payments?: XeroPayment[];
}

export interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode?: string;
  TaxType?: string;
  TaxAmount?: number;
  LineAmount: number;
  DiscountRate?: number;
}

export interface XeroPayment {
  PaymentID: string;
  Date: string;
  Amount: number;
  Reference?: string;
  CurrencyRate?: number;
  PaymentType?: string;
  Status?: string;
  UpdatedDateUTC: string;
}

export interface XeroCreditNote {
  CreditNoteID: string;
  CreditNoteNumber: string;
  Type: string;
  Contact: {
    ContactID: string;
    Name: string;
  };
  Date: string;
  Status: string;
  Total: number;
  SubTotal: number;
  TotalTax: number;
  RemainingCredit: number;
  CurrencyCode: string;
  Reference?: string;
  UpdatedDateUTC: string;
}

export interface XeroQuote {
  QuoteID: string;
  QuoteNumber: string;
  Contact: {
    ContactID: string;
    Name: string;
  };
  Date: string;
  ExpiryDate?: string;
  Status: string;
  Total: number;
  SubTotal: number;
  TotalTax: number;
  CurrencyCode: string;
  Reference?: string;
  Title?: string;
  Summary?: string;
  UpdatedDateUTC: string;
}

export interface SyncConfiguration {
  id: number;
  xero_tenant_id: string;
  field_mappings: {
    [key: string]: 'import' | 'export' | 'bidirectional' | 'none';
  };
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
}

export interface FieldMapping {
  teeemField: string;
  xeroField: string;
  direction: 'import' | 'export' | 'bidirectional' | 'none';
  teeemValue: unknown;
  xeroValue: unknown;
  isDifferent: boolean;
  isReadOnly: boolean;
}
