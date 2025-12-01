export type ContractType = "qbcc_domestic";

export type ContractStatus =
  | "draft"
  | "sent_for_signature"
  | "partially_signed"
  | "signed"
  | "declined";

export type ESignStatus =
  | "pending"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired";

export interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "builder" | "client";
  status: ESignStatus;
  signed_at?: string;
}

export interface QBCCContractData {
  // Builder Details (from org settings)
  builder_name: string;
  builder_abn: string;
  qbcc_licence_number: string;
  builder_address: string;
  builder_email: string;
  builder_phone: string;
  builder_insurance_policy: string;
  builder_insurance_expiry: string;

  // Client Details (from Lead)
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone?: string;

  // Site Details (from Lead)
  site_address: string;
  lot_plan_number?: string;

  // Project Details
  building_description: string;

  // Financial
  contract_price: number;
  deposit_amount: number;
  gst_included: boolean;

  // Timeline
  commencement_date: string;
  practical_completion_date: string;
  building_period_days: number;

  // Optional
  special_conditions?: string[];
}

export interface Contract {
  id: number;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;

  lead_id: number;
  job_id?: number;

  contract_data: QBCCContractData;

  // Generated PDF
  pdf_url?: string;
  generated_at?: string;

  // E-Signature
  docusign_envelope_id?: string;
  esign_status?: ESignStatus;
  signers?: ContractSigner[];
  sent_for_signature_at?: string;

  // Signed Document
  signed_pdf_url?: string;
  signed_at?: string;

  // Audit
  created_at: string;
  updated_at: string;
}

export const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: "Draft",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  sent_for_signature: {
    label: "Sent for Signature",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  partially_signed: {
    label: "Partially Signed",
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  signed: {
    label: "Signed",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  declined: {
    label: "Declined",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

export const ESIGN_STATUS_CONFIG: Record<
  ESignStatus,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "text-gray-500" },
  sent: { label: "Sent", color: "text-blue-500" },
  viewed: { label: "Viewed", color: "text-yellow-500" },
  signed: { label: "Signed", color: "text-green-500" },
  declined: { label: "Declined", color: "text-red-500" },
  expired: { label: "Expired", color: "text-gray-400" },
};
