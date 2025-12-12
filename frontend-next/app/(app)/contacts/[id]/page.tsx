"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSetAtom } from "jotai";
import Link from "next/link";
import { currentFiltersAtom, currentFilterGroupsAtom, foundationViewsAtom, activeViewIdAtom } from "@/lib/view-state-atoms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Building2,
  MapPin,
  Pencil,
  Trash2,
  User,
  Hash,
  FileText,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Briefcase,
  Home,
  Lock,
  IdCard,
  CreditCard,
  FolderOpen,
  Percent,
  Network,
  Table,
  Loader2,
  Save,
  X,
  Plus,
  Link2,
  Scale,
  Landmark,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ContactEditModal } from "@/components/contacts/ContactEditModal";
import { XeroSyncSection } from "@/components/contacts/XeroSyncSection";
import { XeroTransactionsSection } from "@/components/contacts/XeroTransactionsSection";
import { XeroInvoiceDetailModal } from "@/components/contacts/XeroInvoiceDetailModal";
import { XeroInvoicesListByTenant } from "@/components/contacts/XeroInvoicesListByTenant";
import { PendingXeroReviewPanel } from "@/components/contacts/PendingXeroReviewPanel";
import TeeemTableView from "@/components/table/TeeemTableView";
import { type TableColumn } from "@/components/table/types";
import PersonStructureChart from "@/components/corporate/PersonStructureChart";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Code } from 'lucide-react';
import { useEntityTypes } from "@/hooks/useEntityTypes";
import {
  getEntityTypeLabel,
  hasFirstLastName,
  hasCompanyName,
  canHaveEmployees,
  canHaveEmployer,
  isPerson,
  isTrust,
  isPriceOnly
} from "@/lib/entity-types";

// Helper function to format ABN as XX XXX XXX XXX
const formatABN = (abn: string | null) => {
  if (!abn) return "";
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return abn;
};

// Helper function to format ACN as XXX XXX XXX
const formatACN = (acn: string | null) => {
  if (!acn) return "";
  const digits = acn.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }
  return acn;
};

// Validate ABN - must be 11 digits
const validateABN = (abn: string | null): { isValid: boolean; error?: string } => {
  if (!abn || abn.trim() === "") return { isValid: true }; // Empty is OK
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 0) return { isValid: true }; // Just spaces/formatting chars is OK
  if (digits.length !== 11) {
    return { isValid: false, error: `ABN must be 11 digits (got ${digits.length})` };
  }
  return { isValid: true };
};

// Format Australian phone number - handles mobile (04XX XXX XXX) and landline (0X XXXX XXXX)
const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";

  // Mobile: 04XX XXX XXX (10 digits starting with 04)
  if (digits.length === 10 && digits.startsWith("04")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  // Landline: 0X XXXX XXXX (10 digits starting with 0)
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
  }
  // International or other format - return as-is with spaces every 3-4 digits
  if (digits.length >= 8) {
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }
  return phone;
};

// Validate phone number - must be 8-15 digits
const validatePhoneNumber = (phone: string | null): { isValid: boolean; error?: string } => {
  if (!phone || phone.trim() === "") return { isValid: true }; // Empty is OK
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return { isValid: true };
  if (digits.length < 8) {
    return { isValid: false, error: `Phone must be at least 8 digits (got ${digits.length})` };
  }
  if (digits.length > 15) {
    return { isValid: false, error: `Phone must be at most 15 digits (got ${digits.length})` };
  }
  return { isValid: true };
};

interface ContactPerson {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  role: string | null;
  is_primary: boolean;
  include_in_emails: boolean;
}

interface ContactGroup {
  id: number;
  name: string;
}

interface ContactEmail {
  id?: number;
  email: string;
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

interface ContactPhone {
  id?: number;
  phone_number: string;
  phone_type: 'mobile' | 'office' | 'fax' | 'home';
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

interface Contact {
  id: number;
  display_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  website: string | null;
  tax_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  // Multiple emails and phones
  contact_emails?: ContactEmail[];
  contact_phones?: ContactPhone[];
  "is_supplier?": boolean;
  "is_customer?": boolean;
  "is_director?": boolean;
  is_family_member: boolean;
  is_team_contact: boolean;
  xero_contact_id: string | null;
  xero_id?: string | null;
  xero_contact_number?: string | null;
  xero_contact_status?: string | null;
  xero_account_number?: string | null;
  xero_synced?: boolean | null;
  xero_invoice_count?: number | null;
  xero_contact_types: string[];
  sync_with_xero: boolean;
  created_at: string;
  updated_at: string;
  contact_persons: ContactPerson[];
  contact_groups: ContactGroup[];
  jobs_count: number;
  purchase_orders_count: number;
  quotes_count: number;
  // Company/Business fields
  company_name: string | null;
  company_name_or_trust: string | null; // SSoT for company/trust display names
  position: string | null;
  department: string | null;
  // Director details
  director_id: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  birth_state: string | null;
  birth_country: string | null;
  residential_address: string | null;
  drivers_licence: string | null;
  passport_number: string | null;
  photo_url: string | null;
  // Bank details
  bank_bsb: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  // LGAs
  lgas: string[];
  // Entity type for SSoT
  entity_type: string | null;
  // Company/Employee linking
  primary_company_id?: number | null;
  primary_company?: {
    id: number;
    name: string;
    email?: string;
    website?: string;
    address?: string;
    abn?: string;
    acn?: string;
    contact_emails?: ContactEmail[];
    contact_phones?: ContactPhone[];
  } | null;
  employees?: Array<{
    id: number;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    mobile_phone: string | null;
    primary_role: string | null;
  }>;
  // Director companies
  director_companies?: DirectorCompany[];
  // Additional companies via relationships
  additional_companies?: AdditionalCompany[];
  // SSoT permission indicators
  can_view_confidential?: boolean;
  can_view_corporate?: boolean;
  can_edit_corporate?: boolean;
  can_view_cases?: boolean;
  // SSoT: Linked company data for company-type contacts
  linked_company?: LinkedCompany;
  // Financial fields
  accounts_receivable_outstanding?: number | null;
  accounts_receivable_overdue?: number | null;
  accounts_payable_outstanding?: number | null;
  accounts_payable_overdue?: number | null;
  default_discount?: number | null;
  bill_due_day?: number | null;
  bill_due_type?: string | null;
  sales_due_day?: number | null;
  sales_due_type?: string | null;
  // ABN verification fields
  abn_valid?: boolean | null;
  abn_entity_name?: string | null;
  abn_entity_type?: string | null;
  abn_gst_registered?: boolean | null;
  abn_verified_at?: string | null;
}

interface DirectorCompany {
  id: number;
  company_id: number;
  company_name: string;
  position: string;
  appointed_date: string | null;
  resigned_date: string | null;
  is_current: boolean;
}

interface AdditionalCompany {
  id: number;
  name: string;
  entity_type: string | null;
  relationship_type: string;
  role_in_relationship: string | null;
  ownership_percentage: number | null;
  context: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

// SSoT: Linked Company data for company-type contacts
interface LinkedCompanyDirector {
  id: number;
  contact_id: number;
  contact_name: string | null;
  position: string;
  formatted_position: string;
  appointment_date: string | null;
  resignation_date: string | null;
  is_current: boolean;
}

interface LinkedCompanyShareholder {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string | null;
  share_class: string | null;
  number_of_shares: number | null;
  beneficially_held: boolean | null;
  date_acquired: string | null;
}

// SSoT: Bank account data from bank_accounts table
interface LinkedCompanyBankAccount {
  id: number;
  institution_name: string;
  bsb: string | null;
  account_number: string;
  account_name: string | null;
  bank_code: string | null;
  xero_account_id: string | null;
  status: "active" | "closed";
  display_name: string;
  formatted_bsb: string | null;
  linked_to_xero: boolean;
}

interface LinkedCompany {
  id: number;
  name: string;
  acn: string | null;
  abn: string | null;
  status: string | null;
  entity_type: string | null;
  is_trustee: boolean;
  trust_name: string | null;
  date_incorporated: string | null;
  registered_office_address: string | null;
  principal_place_of_business: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  directors: LinkedCompanyDirector[];
  shareholdings: LinkedCompanyShareholder[];
  directors_count: number;
  shareholdings_count: number;
  documents_count: number;
  // SSoT: Bank accounts from bank_accounts table
  bank_accounts?: LinkedCompanyBankAccount[];
  bank_accounts_count?: number;
}

interface CompanyGroupMembership {
  id: number;
  contact_id: number;
  company_group_id: number;
  company_group_name: string;
  membership_type: string;
  company_id: number | null;
  company_name: string | null;
  can_view_confidential: boolean;
  can_edit: boolean;
  is_active: boolean;
}

// SSoT: Directorship from CompanyDirector table
interface Directorship {
  id: number;
  company_id: number;
  company_name: string;
  company_acn: string | null;
  company_abn: string | null;
  company_status: string | null;
  company_entity_type: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  position: string;
  formatted_position: string;
  appointment_date: string | null;
  resignation_date: string | null;
  is_current: boolean;
  din: string | null;
}

// SSoT: Shareholding from CompanyShareholding table
interface Shareholding {
  id: number;
  company_id: number;
  company_name: string;
  company_acn: string | null;
  company_abn: string | null;
  company_status: string | null;
  company_entity_type: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  share_class: string | null;
  number_of_shares: number | null;
  percentage_of_total: number | null;
  beneficially_held: boolean | null;
  acquisition_date: string | null;
  disposal_date: string | null;
  consideration_paid: number | null;
}

// SSoT: Trust role (trustee, beneficiary, appointor)
interface TrustRole {
  id: number;
  role_type: "trustee" | "beneficiary" | "appointor";
  trust_id: number;
  trust_name: string;
  trust_entity_type: string | null;
  ownership_percentage?: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
}

interface TrustRolesData {
  trustee_roles: TrustRole[];
  beneficiary_roles: TrustRole[];
  appointor_roles: TrustRole[];
  total_count: number;
}

// Ownership chain for corporate structure visualization
interface OwnershipNode {
  company_id: number;
  company_name: string;
  percentage: number;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  trust_id?: number;
  trust_entity_type?: string;
  children?: OwnershipNode[];
}

// Email from EmailWarehouse
interface EmailMessage {
  id: number;
  subject: string | null;
  from_email: string;
  display_from?: string;
  to_emails: string[];
  cc_emails?: string[];
  preview_body?: string;
  received_at: string;
  has_attachments?: boolean;
  attachment_count?: number;
}

interface EmailsPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// Case relationship for contacts linked to cases
interface CaseRelationship {
  id: number;
  case_id: number;
  case_number: string;
  case_title: string;
  relationship_type: string;
  formatted_relationship_type?: string;
  alignment: 'friendly' | 'opposing' | 'neutral' | null;
  role?: string | null;
  reason?: string | null;
  notes?: string | null;
  is_primary?: boolean;
  include_all_emails?: boolean;
  added_at?: string | null;
  added_by?: string | null;
}

// Contact data from company list API
interface CompanyListContact {
  id: number;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  entity_type: string | null;
}

// API response for company list
interface CompanyListResponse {
  success: boolean;
  contacts: CompanyListContact[];
  pagination?: {
    total: number;
    page: number;
    per_page: number;
  };
}

// Contact relationship data from relationships API
interface ContactRelationship {
  id: number;
  source_contact_id: number;
  target_contact_id: number;
  related_contact_id?: number; // Alias for target_contact_id in some API responses
  relationship_type: string;
  relationship_type_label?: string;
  direction?: 'outgoing' | 'incoming';
  role_in_relationship?: string | null;
  ownership_percentage?: number | null;
  context?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  notes?: string | null;
  other_contact?: {
    id: number;
    name: string;
    entity_type: string;
    email?: string;
    phone?: string;
    roles?: string[];
  };
  related_contact?: {
    id: number;
    display_name: string;
    email?: string;
    phone?: string;
    roles?: string[];
  };
}

// API response for relationships
interface RelationshipsResponse {
  success: boolean;
  relationships: {
    outgoing: ContactRelationship[];
    incoming: ContactRelationship[];
  };
}

// Relationship type metadata from API (SSoT)
interface RelationshipTypeMetadata {
  value: string;
  label: string;
  category: string;
  source_types: string[];
  target_types: string[];
  description: string;
  syncs_to_corporate: boolean;
}

// Fallback relationship types (used until API metadata loads)
const FALLBACK_RELATIONSHIP_TYPES: Option[] = [
  // Employment
  { value: "employee_of", label: "Employee" },
  { value: "contractor_for", label: "Contractor" },
  // Company roles
  { value: "director_of", label: "Director" },
  { value: "shareholder_of", label: "Shareholder" },
  { value: "authorized_signatory_of", label: "Authorized Signatory" },
  { value: "beneficial_owner_of", label: "Beneficial Owner" },
  { value: "partner_in", label: "Partner" },
  // Trust roles
  { value: "trustee_of", label: "Trustee" },
  { value: "beneficiary_of", label: "Beneficiary" },
  { value: "appointor_of", label: "Appointor" },
  // Ownership
  { value: "owner_of", label: "Owner" },
  { value: "co_owner_with", label: "Co-Owner" },
  // Corporate structure
  { value: "parent_company", label: "Parent Company" },
  { value: "subsidiary", label: "Subsidiary" },
  // General
  { value: "previous_client", label: "Previous Client" },
  { value: "referral", label: "Referral" },
  { value: "supplier_alternate", label: "Alternative Supplier" },
  { value: "related_project", label: "Related Project" },
  { value: "family_member", label: "Family Member" },
  { value: "other", label: "Other" },
];

// Helper to filter relationship types based on source and target entity types
function getValidRelationshipTypes(
  metadata: RelationshipTypeMetadata[],
  sourceEntityType: string | null,
  targetEntityType: string | null
): Option[] {
  if (!metadata || metadata.length === 0) {
    return FALLBACK_RELATIONSHIP_TYPES;
  }

  return metadata
    .filter(m => {
      const sourceMatch = !sourceEntityType || m.source_types.includes(sourceEntityType);
      const targetMatch = !targetEntityType || m.target_types.includes(targetEntityType);
      return sourceMatch && targetMatch;
    })
    .map(m => ({ value: m.value, label: m.label }));
}

// Sortable Employee Item Component
interface SortableEmployeeItemProps {
  employee: any;
  index: number;
  employeeRoles: Record<string, string[]>;
  onRolesChange: (employeeId: number, roleTypes: string[]) => void;
  onRemove: (employeeId: number) => void;
  onPositionChange: (employeeId: number, position: number) => void;
  isPrimary: boolean;
  availableRoleTypes: Option[]; // SSoT: Valid role types for this entity combination
}

function SortableEmployeeItem({
  employee,
  index,
  employeeRoles,
  onRolesChange,
  onRemove,
  onPositionChange,
  isPrimary,
  availableRoleTypes,
}: SortableEmployeeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const roles = employeeRoles[employee.id.toString()] || [];
  const roleOptions = roles.map(roleType => ({
    value: roleType,
    label: availableRoleTypes.find(r => r.value === roleType)?.label || roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  }));

  const [positionInput, setPositionInput] = useState(String(index + 1));

  // Update position input when index changes (after drag)
  useEffect(() => {
    setPositionInput(String(index + 1));
  }, [index]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isDragging ? "bg-accent" : "hover:bg-accent/50",
        isPrimary && "border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing mt-2 shrink-0"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Position Input */}
      <div className="shrink-0 mt-1">
        <Input
          type="number"
          min={1}
          value={positionInput}
          onChange={(e) => setPositionInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            const newPos = parseInt(positionInput);
            if (!isNaN(newPos) && newPos >= 1) {
              onPositionChange(employee.id, newPos);
            } else {
              setPositionInput(String(index + 1)); // Reset to current position
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newPos = parseInt(positionInput);
              if (!isNaN(newPos) && newPos >= 1) {
                onPositionChange(employee.id, newPos);
              }
            }
          }}
          className="w-14 h-8 text-center text-sm"
        />
      </div>

      {/* Primary Star */}
      {isPrimary && (
        <div className="shrink-0 mt-2" title="Primary Contact">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-primary" />
      </div>

      {/* Employee Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/contacts/${employee.id}`} className="text-sm font-medium hover:underline">
          {employee.display_name}
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {employee.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {employee.email}
            </span>
          )}
          {employee.mobile_phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {employee.mobile_phone}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Role:</span>
          <MultipleSelector
            value={roleOptions}
            onChange={(selectedRoles) => {
              const roleTypes = selectedRoles.map(r => r.value);
              onRolesChange(employee.id, roleTypes);
            }}
            placeholder="Select roles..."
            options={availableRoleTypes}
            className="flex-1 max-w-md"
            badgeClassName="text-xs"
            hidePlaceholderWhenSelected
            emptyIndicator={
              <p className="text-center text-xs text-muted-foreground">
                No role types available
              </p>
            }
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(employee.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Link href={`/contacts/${employee.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Sortable Company Item Component (for person contacts)
interface SortableCompanyItemProps {
  company: Option;
  index: number;
  companyRoles: Record<string, string[]>;
  onRolesChange: (companyId: string, roleTypes: string[]) => void;
  onRemove: () => void;
  onPositionChange: (companyId: string, position: number) => void;
  isPrimary: boolean;
  availableRoleTypes: Option[]; // SSoT: Valid role types for this entity combination
}

function SortableCompanyItem({
  company,
  index,
  companyRoles,
  onRolesChange,
  onRemove,
  onPositionChange,
  isPrimary,
  availableRoleTypes,
}: SortableCompanyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: company.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const roles = companyRoles[company.value] || [];
  const roleOptions = roles.map(roleType => ({
    value: roleType,
    label: availableRoleTypes.find(r => r.value === roleType)?.label || roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  }));

  const [positionInput, setPositionInput] = useState(String(index + 1));

  // Update position input when index changes (after drag)
  useEffect(() => {
    setPositionInput(String(index + 1));
  }, [index]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isDragging ? "bg-accent" : "hover:bg-accent/50",
        isPrimary && "border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing mt-2 shrink-0"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Position Input */}
      <div className="shrink-0 mt-1">
        <Input
          type="number"
          min={1}
          value={positionInput}
          onChange={(e) => setPositionInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            const newPos = parseInt(positionInput);
            if (!isNaN(newPos) && newPos >= 1) {
              onPositionChange(company.value, newPos);
            } else {
              setPositionInput(String(index + 1)); // Reset to current position
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newPos = parseInt(positionInput);
              if (!isNaN(newPos) && newPos >= 1) {
                onPositionChange(company.value, newPos);
              }
            }
          }}
          className="w-14 h-8 text-center text-sm"
        />
      </div>

      {/* Primary Star */}
      {isPrimary && (
        <div className="shrink-0 mt-2" title="Primary Company">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Company Icon */}
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
      </div>

      {/* Company Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/contacts/${company.value}`} className="text-sm font-medium hover:underline">
          {company.label}
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Role:</span>
          <MultipleSelector
            value={roleOptions}
            onChange={(selectedRoles) => {
              const roleTypes = selectedRoles.map(r => r.value);
              onRolesChange(company.value, roleTypes);
            }}
            placeholder="Select roles..."
            options={availableRoleTypes}
            className="flex-1 max-w-md"
            badgeClassName="text-xs"
            hidePlaceholderWhenSelected
            emptyIndicator={
              <p className="text-center text-xs text-muted-foreground">
                No role types available
              </p>
            }
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Link href={`/contacts/${company.value}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const id = params.id as string;

  // SSoT: Entity types from API
  const { metadata: entityTypeMetadata } = useEntityTypes();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<CompanyGroupMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [enrichingFromWeb, setEnrichingFromWeb] = useState(false);

  // Track if component is mounted to prevent state updates after deletion/navigation
  const mountedRef = useRef(true);

  // Refresh key to force tab data reload after save
  const [refreshKey, setRefreshKey] = useState(0);

  // SSoT: Dedicated state for rich data tabs
  const [directorships, setDirectorships] = useState<Directorship[]>([]);
  const [loadingDirectorships, setLoadingDirectorships] = useState(false);
  const [shareholdings, setShareholdings] = useState<Shareholding[]>([]);
  const [loadingShareholdings, setLoadingShareholdings] = useState(false);
  const [trustRoles, setTrustRoles] = useState<TrustRolesData | null>(null);
  const [loadingTrustRoles, setLoadingTrustRoles] = useState(false);
  const [ownershipChain, setOwnershipChain] = useState<OwnershipNode[]>([]);
  const [loadingOwnershipChain, setLoadingOwnershipChain] = useState(false);
  const [caseRelationships, setCaseRelationships] = useState<CaseRelationship[]>([]);
  const [loadingCaseRelationships, setLoadingCaseRelationships] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  // Email warehouse state
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsPagination, setEmailsPagination] = useState<EmailsPagination | null>(null);
  const [showAllInThread, setShowAllInThread] = useState(false);

  // Inline edit form state
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    display_name: "",
    company_name_or_trust: "", // SSoT for company/trust names
    email: "",
    mobile_phone: "",
    office_phone: "",
    website: "",
    tax_number: "",
    address: "",
    notes: "",
    is_active: true,
    is_family_member: false,
    is_team_contact: false,
    entity_type: "person",
    sync_with_xero: false,
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Validation errors for fields
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Company multi-select state (for person contacts)
  const [availableCompanies, setAvailableCompanies] = useState<Option[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Option[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Add Company state
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Track roles for each company (companyId -> roleTypes[])
  const [companyRoles, setCompanyRoles] = useState<Record<string, string[]>>({});

  // Employee multi-select state (for company contacts)
  const [availablePeople, setAvailablePeople] = useState<Option[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Option[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // Track roles for each employee (employeeId -> roleTypes[])
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, string[]>>({});

  // SSoT: Relationship type metadata from API
  const [relationshipTypeMetadata, setRelationshipTypeMetadata] = useState<RelationshipTypeMetadata[]>([]);

  // Related Entities state (for company-to-company, person-to-person relationships)
  const [relatedEntities, setRelatedEntities] = useState<ContactRelationship[]>([]);
  const [loadingRelatedEntities, setLoadingRelatedEntities] = useState(false);
  const [showAddRelatedEntity, setShowAddRelatedEntity] = useState(false);
  const [newRelatedEntityContactId, setNewRelatedEntityContactId] = useState<string>("");
  const [newRelatedEntityType, setNewRelatedEntityType] = useState<string>("");
  const [addingRelatedEntity, setAddingRelatedEntity] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Option[]>([]);

  // Add Employee state (for company contacts)
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeFirstName, setNewEmployeeFirstName] = useState("");
  const [newEmployeeLastName, setNewEmployeeLastName] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  // Drag and drop sensors for employee ordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTab = searchParams.get("tab") || "overview";
  const activeSubTab = searchParams.get("subtab") || "identity";

  // Jotai atom setters for resetting view state when switching to emails tab
  const setCascadeFilters = useSetAtom(currentFiltersAtom);
  const setFilterGroups = useSetAtom(currentFilterGroupsAtom);
  const setSavedViews = useSetAtom(foundationViewsAtom);
  const setActiveViewId = useSetAtom(activeViewIdAtom);

  // Reset all view state when entering the emails tab to prevent stale state from Contacts list
  const resetFiltersForEmailsTab = useCallback(() => {
    setCascadeFilters([]);
    setFilterGroups([{ id: "default", logic: "AND" }]);
    setSavedViews([]); // Clear saved views so Contacts views don't show
    setActiveViewId(null); // Clear active view
  }, [setCascadeFilters, setFilterGroups, setSavedViews, setActiveViewId]);

  useEffect(() => {
    loadContact();

  }, [id]);

  // Load directorships on page load to show tab immediately if data exists
  useEffect(() => {
    if (contact?.id && directorships.length === 0 && !loadingDirectorships) {
      loadDirectorships();
    }
  }, [contact?.id]);

  // Initialize contact_emails and contact_phones from legacy fields if needed
  useEffect(() => {
    if (contact && (!contact.contact_emails || contact.contact_emails.length === 0)) {
      const emails: ContactEmail[] = [];
      if (contact.email) {
        emails.push({
          email: contact.email,
          is_primary: true,
          label: null,
          position: 0
        });
      }
      setContact({ ...contact, contact_emails: emails });
    }

    if (contact && (!contact.contact_phones || contact.contact_phones.length === 0)) {
      const phones: ContactPhone[] = [];
      if (contact.mobile_phone) {
        phones.push({
          phone_number: contact.mobile_phone,
          phone_type: 'mobile',
          is_primary: true,
          label: null,
          position: 0
        });
      }
      if (contact.office_phone) {
        phones.push({
          phone_number: contact.office_phone,
          phone_type: 'office',
          is_primary: !contact.mobile_phone, // Primary only if no mobile
          label: null,
          position: 1
        });
      }
      setContact({ ...contact, contact_phones: phones });
    }
  }, [contact?.id]);

  // Cleanup: Set mounted to false when component unmounts
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load memberships when contact loads
  useEffect(() => {
    if (contact?.id) {
      loadMemberships();
    }
     
  }, [contact?.id]);

  // Fetch all companies for multi-select dropdown - lazy load when edit modal opens
  useEffect(() => {
    // Only fetch when edit modal opens and we haven't loaded companies yet
    if (!editModalOpen || availableCompanies.length > 0) return;

    const fetchCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const response = await api.get<CompanyListResponse>("/api/v1/contacts", {
          params: { entity_type: "company" },
        });
        const companies = response.contacts || [];
        console.log('[Company Multi-Select] Loaded companies:', companies.length);
        const companyOptions: Option[] = companies.map((c: CompanyListContact) => ({
          value: c.id.toString(),
          label: c.display_name || c.first_name || "Unknown Company",
        }));
        console.log('[Company Multi-Select] Company options:', companyOptions);
        setAvailableCompanies(companyOptions);
      } catch (err) {
        console.error("Failed to fetch companies:", err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [editModalOpen, availableCompanies.length]);

  // Populate selected companies and roles from contact.additional_companies
  useEffect(() => {
    if (contact?.additional_companies) {
      // Group by company ID to get unique companies and their roles
      const companyMap = new Map<string, { name: string; roles: string[] }>();

      contact.additional_companies
        .filter((ac: AdditionalCompany) => ac.is_active)
        .forEach((ac: AdditionalCompany) => {
          const companyId = ac.id.toString();
          if (!companyMap.has(companyId)) {
            companyMap.set(companyId, { name: ac.name || "Unknown Company", roles: [] });
          }
          companyMap.get(companyId)!.roles.push(ac.relationship_type);
        });

      // Convert to selectedCompanies array
      const selected: Option[] = Array.from(companyMap.entries()).map(([id, data]) => ({
        value: id,
        label: data.name,
      }));

      // Build companyRoles object
      const roles: Record<string, string[]> = {};
      companyMap.forEach((data, id) => {
        roles[id] = data.roles;
      });

      setSelectedCompanies(selected);
      setCompanyRoles(roles);
    }
  }, [contact?.additional_companies]);

  // Fetch all people for employee multi-select dropdown (for company contacts)
  useEffect(() => {
    const fetchPeople = async () => {
      setLoadingPeople(true);
      try {
        const response = await api.get<CompanyListResponse>("/api/v1/contacts", {
          params: { entity_type: "person" },
        });
        const people = response.contacts || [];
        const peopleOptions: Option[] = people.map((p: CompanyListContact) => ({
          value: p.id.toString(),
          label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.display_name || "Unknown Person",
        }));
        setAvailablePeople(peopleOptions);
      } catch (err) {
        console.error("Failed to fetch people:", err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  // Populate selected employees from contact.employees (for company contacts)
  useEffect(() => {
    console.log('[Employee useEffect] Triggered. contact.employees:', contact?.employees);
    if (contact?.employees) {
      const selected: Option[] = contact.employees.map((emp) => ({
        value: emp.id.toString(),
        label: emp.display_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || "Unknown Person",
      }));
      console.log('[Employee useEffect] Setting selectedEmployees to:', selected);
      setSelectedEmployees(selected);

      // Fetch roles for each employee by getting their relationships to this company
      const fetchEmployeeRoles = async () => {
        if (!contact?.id) {
          console.log('[Employee useEffect] Skipping fetchEmployeeRoles - no contact.id');
          return;
        }

        console.log('[Employee useEffect] Fetching roles for contact.id:', contact.id);
        try {
          const response = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
          const incoming = response.relationships?.incoming || [];

          // Store metadata if returned
          if ((response as any).relationship_types_metadata) {
            setRelationshipTypeMetadata((response as any).relationship_types_metadata);
          }

          // Group relationships by employee ID and collect role types
          const rolesMap: Record<string, string[]> = {};
          incoming.forEach((rel: ContactRelationship) => {
            const employeeId = rel.source_contact_id.toString();
            if (!rolesMap[employeeId]) {
              rolesMap[employeeId] = [];
            }
            // Include all valid relationship types (no hardcoded filter)
            rolesMap[employeeId].push(rel.relationship_type);
          });

          console.log('[Employee useEffect] Employee roles fetched:', rolesMap);
          setEmployeeRoles(rolesMap);
        } catch (err) {
          console.error('[Employee useEffect] Failed to fetch employee roles for contact.id:', contact.id, 'Error:', err);
        }
      };
      fetchEmployeeRoles();
    } else {
      console.log('[Employee useEffect] No employees found on contact');
      setEmployeeRoles({});
    }
  }, [contact?.employees, contact?.id]);

  // SSoT: Fetch relationship type metadata and related entities from API
  useEffect(() => {
    const fetchRelationshipsAndMetadata = async () => {
      if (!contact?.id) return;

      setLoadingRelatedEntities(true);
      try {
        const response = await api.get<{
          relationships: {
            outgoing: ContactRelationship[];
            incoming: ContactRelationship[];
          };
          relationship_types_metadata: RelationshipTypeMetadata[];
        }>(`/api/v1/contacts/${contact.id}/relationships`);

        if (response.relationship_types_metadata) {
          setRelationshipTypeMetadata(response.relationship_types_metadata);
        }

        // Filter relationships that don't fit the existing UI sections:
        // - Person's "Companies" card shows: person → company/trust relationships
        // - Company's "Employees" card shows: person → this company relationships
        // "Related Entities" shows everything else:
        // - Company → Company (parent/subsidiary, shareholder)
        // - Company → Trust (shareholdings, beneficial ownership)
        // - Person → Person (family, co-owner)
        // - Trust → Trust (beneficiary chains)
        const allRelationships = [
          ...(response.relationships?.outgoing || []),
          ...(response.relationships?.incoming || [])
        ];

        const filteredRelationships = allRelationships.filter(rel => {
          const otherEntityType = rel.other_contact?.entity_type;
          const thisEntityType = contact.entity_type;

          // Skip inactive relationships
          if (!rel.is_active) return false;

          // For persons: Companies card handles person → company/trust
          if (isPerson(thisEntityType)) {
            // Exclude relationships already shown in Companies card
            if (otherEntityType && ['company', 'trust', 'sole_trader'].includes(otherEntityType)) {
              return false;
            }
          }

          // For companies/trusts: Employees card handles incoming person → this company
          if (canHaveEmployees(thisEntityType)) {
            // Exclude incoming person relationships (shown in Employees card)
            if (rel.direction === 'incoming' && otherEntityType === 'person') {
              return false;
            }
          }

          // Include everything else
          return true;
        });

        // Deduplicate (in case a relationship appears in both outgoing and incoming)
        const uniqueRelationships = filteredRelationships.reduce((acc, rel) => {
          if (!acc.find(r => r.id === rel.id)) {
            acc.push(rel);
          }
          return acc;
        }, [] as ContactRelationship[]);

        setRelatedEntities(uniqueRelationships);
      } catch (err) {
        console.error("Failed to fetch relationships:", err);
      } finally {
        setLoadingRelatedEntities(false);
      }
    };
    fetchRelationshipsAndMetadata();
  }, [contact?.id, contact?.entity_type]);

  // Fetch all contacts for the related entity selector - lazy load when edit modal opens
  useEffect(() => {
    // Only fetch when edit modal opens and we haven't loaded contacts yet
    if (!editModalOpen || availableContacts.length > 0 || !contact?.id) return;

    const fetchAllContacts = async () => {
      try {
        const response = await api.get<{ contacts: any[] }>("/api/v1/contacts", {
          params: { limit: 500 }
        });
        const contacts = response.contacts || [];
        const options: Option[] = contacts
          .filter((c: any) => c.id !== contact?.id) // Exclude current contact
          .map((c: any) => ({
            value: c.id.toString(),
            label: `${c.display_name || c.first_name || 'Unknown'} (${c.entity_type || 'unknown'})`,
          }));
        setAvailableContacts(options);
      } catch (err) {
        console.error("Failed to fetch contacts for related entity selector:", err);
      }
    };
    fetchAllContacts();
  }, [editModalOpen, availableContacts.length, contact?.id]);

  // SSoT: Auto-open edit modal when ?edit=true is in URL (e.g., from CG page)
  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam === "true" && contact && !loading) {
      setEditModalOpen(true);
      // Remove the ?edit=true from URL to clean it up
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, contact, loading]);

  const loadContact = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ contact: Contact }>(`/api/v1/contacts/${id}`);
      setContact(response.contact);
    } catch (err: any) {
      // Silently redirect if contact not found (404) or forbidden (403)
      if (err?.status === 404 || err?.status === 403 || err?.message?.includes('not found')) {
        console.log("Contact not found, using client-side redirect");
        // Use replace instead of push to avoid SSR and keep browser history clean
        router.replace('/contacts');
      } else {
        console.error("Failed to load contact:", err);
        setError(err?.message || "Failed to load contact");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;

    if (!confirm(`Delete contact "${contact.display_name}"?`)) {
      return;
    }

    try {
      const response = await api.delete<{
        success: boolean;
        archived?: boolean;
        message?: string;
        archive_reasons?: string[];
      }>(`/api/v1/foundations/contacts/records/${contact.id}`);

      // Check if contact was archived instead of deleted
      if (response?.archived) {
        alert(`✓ ${response.message}\n\nThe contact was archived (not permanently deleted) to preserve important records.`);
      }

      router.push('/contacts');
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      // Show specific error message from backend if available
      const errorMessage = error?.message || error?.error || "Failed to delete contact. Please try again.";
      alert(errorMessage);
    }
  };

  const handleViewInvoiceDetail = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setShowInvoiceDetail(true);
  };

  const handleEnrichFromWeb = async () => {
    if (!contact) return;

    setEnrichingFromWeb(true);
    try {
      const response = await api.post<{
        success: boolean;
        is_sole_trader?: boolean;
        company_created?: boolean;
        company_linked?: boolean;
        company_found_from_domain?: boolean;
        found_from_contact?: { name: string; email: string };
        company?: { name: string };
        website_details?: { phone?: string; abn?: string; acn?: string; address?: string };
        error?: string;
      }>(`/api/v1/contacts/${contact.id}/enrich_from_web`);

      if (response?.success) {
        const { is_sole_trader, company_created, company_linked, company_found_from_domain, found_from_contact, company, website_details } = response;

        let message = "";

        if (company_found_from_domain && found_from_contact && company) {
          message = `Found existing company from ${found_from_contact.name} (${found_from_contact.email})\n\nLinked to: ${company.name}`;
        } else if (company_created && company) {
          message = "Contact enriched from website!\n\nCreated and linked to company: " + company.name;
        } else if (company_linked && company) {
          message = "Contact enriched from website!\n\nLinked to existing company: " + company.name;
        } else if (is_sole_trader) {
          message = "Contact enriched from website!\n\n(Identified as sole trader)";
        } else {
          message = "Contact enriched from website!";
        }

        if (website_details) {
          message += "\n\nUpdated details:";
          if (website_details.phone) message += `\n• Phone: ${website_details.phone}`;
          if (website_details.abn) message += `\n• ABN: ${website_details.abn}`;
          if (website_details.acn) message += `\n• ACN: ${website_details.acn}`;
          if (website_details.address) message += `\n• Address: ${website_details.address}`;
        }

        alert(message);
        await loadContact(); // Reload contact to show updated details
      } else {
        alert(`Failed: ${response?.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      console.error("Error enriching contact:", error);
      const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || "Failed to enrich contact from web");
    } finally {
      setEnrichingFromWeb(false);
    }
  };

  const loadMemberships = async () => {
    if (!mountedRef.current) return;

    try {
      setLoadingMemberships(true);
      const response = await api.get<{ success: boolean; data: CompanyGroupMembership[] }>(
        `/api/v1/contacts/${contact?.id}/company_group_memberships`
      );
      if (!mountedRef.current) return;
      setMemberships(response.data || []);
    } catch (err) {
      // Silently ignore "Contact not found" errors (happens when contact is deleted during navigation)
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes("Contact not found") && mountedRef.current) {
        console.error("Failed to load memberships:", err);
      }
      if (mountedRef.current) {
        setMemberships([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoadingMemberships(false);
      }
    }
  };

  // SSoT: Load directorships from dedicated endpoint
  const loadDirectorships = async () => {
    if (!contact?.id) return;
    try {
      setLoadingDirectorships(true);
      const response = await api.get<{ success: boolean; data: Directorship[] }>(
        `/api/v1/contacts/${contact.id}/directorships`
      );
      setDirectorships(response.data || []);
    } catch (err) {
      console.error("Failed to load directorships:", err);
      setDirectorships([]);
    } finally {
      setLoadingDirectorships(false);
    }
  };

  // SSoT: Load shareholdings from dedicated endpoint
  const loadShareholdings = async () => {
    if (!contact?.id) return;
    try {
      setLoadingShareholdings(true);
      const response = await api.get<{ success: boolean; data: Shareholding[] }>(
        `/api/v1/contacts/${contact.id}/shareholdings`
      );
      setShareholdings(response.data || []);
    } catch (err) {
      console.error("Failed to load shareholdings:", err);
      setShareholdings([]);
    } finally {
      setLoadingShareholdings(false);
    }
  };

  // SSoT: Load trust roles from dedicated endpoint
  const loadTrustRoles = async () => {
    if (!contact?.id) return;
    try {
      setLoadingTrustRoles(true);
      const response = await api.get<{ success: boolean; data: TrustRolesData }>(
        `/api/v1/contacts/${contact.id}/trust_roles`
      );
      setTrustRoles(response.data || null);
    } catch (err) {
      console.error("Failed to load trust roles:", err);
      setTrustRoles(null);
    } finally {
      setLoadingTrustRoles(false);
    }
  };

  // Load ownership chain for corporate structure visualization
  const loadOwnershipChain = async () => {
    if (!contact?.id) return;
    try {
      setLoadingOwnershipChain(true);
      const response = await api.get<{ success: boolean; data: OwnershipNode[] }>(
        `/api/v1/contacts/${contact.id}/ownership_chain`
      );
      setOwnershipChain(response.data || []);
    } catch (err) {
      console.error("Failed to load ownership chain:", err);
      setOwnershipChain([]);
    } finally {
      setLoadingOwnershipChain(false);
    }
  };

  // Load case relationships for this contact
  const loadCaseRelationships = async () => {
    if (!contact?.id) return;
    try {
      setLoadingCaseRelationships(true);
      const response = await api.get<{ success: boolean; data: CaseRelationship[]; total_count: number }>(
        `/api/v1/contacts/${contact.id}/case_relationships`
      );
      setCaseRelationships(response.data || []);
    } catch (err) {
      console.error("Failed to load case relationships:", err);
      setCaseRelationships([]);
    } finally {
      setLoadingCaseRelationships(false);
    }
  };

  // Load emails from EmailWarehouse for this contact
  const loadEmails = async (page = 1) => {
    if (!contact?.email) return;
    try {
      setLoadingEmails(true);
      const response = await api.get<{ emails: EmailMessage[]; pagination: EmailsPagination }>(
        "/api/v1/email_warehouse",
        {
          params: {
            email: contact.email,
            page,
            per_page: 50,
            latest_only: !showAllInThread,
          },
        }
      );
      setEmails(response.emails || []);
      setEmailsPagination(response.pagination || null);
      setEmailsPage(page);
    } catch (err) {
      console.error("Failed to load emails:", err);
      setEmails([]);
    } finally {
      setLoadingEmails(false);
    }
  };

  // Initialize form data when contact loads
  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        middle_name: contact.middle_name || "",
        last_name: contact.last_name || "",
        display_name: contact.display_name || "",
        company_name_or_trust: contact.company_name_or_trust || "", // SSoT for company/trust names
        email: contact.email || "",
        mobile_phone: contact.mobile_phone || "",
        office_phone: contact.office_phone || "",
        website: contact.website || "",
        tax_number: contact.tax_number || "",
        address: contact.address || "",
        notes: contact.notes || "",
        is_active: contact.is_active ?? true,
        is_family_member: contact.is_family_member ?? false,
        is_team_contact: contact.is_team_contact ?? false,
        entity_type: contact.entity_type || "person",
        sync_with_xero: contact.sync_with_xero ?? false,
      });
      setHasChanges(false);
    }
  }, [contact]);

  // Handle inline form field changes
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Handle entity_type changes - transfer name data between fields
      if (field === 'entity_type') {
        const prevType = prev.entity_type;
        const newType = value as string;
        const isPrevPersonType = hasFirstLastName(prevType);
        const isNewPersonType = hasFirstLastName(newType);

        // Switching from person/sole_trader to company/trust
        // Populate display_name and company_name_or_trust from first/middle/last name, then clear person fields
        if (isPrevPersonType && !isNewPersonType) {
          const constructedName = [prev.first_name, prev.middle_name, prev.last_name].filter(Boolean).join(" ");
          if (constructedName) {
            if (!updated.display_name || updated.display_name === 'Unknown') {
              updated.display_name = constructedName;
            }
            // For company/trust, set company_name_or_trust (SSoT for company names)
            if (!updated.company_name_or_trust) {
              updated.company_name_or_trust = constructedName;
            }
          }
          // Clear person-specific fields - companies don't have first/middle/last names
          updated.first_name = '';
          updated.middle_name = '';
          updated.last_name = '';
        }

        // Switching from company/trust to person/sole_trader
        // Try to parse display_name or company_name_or_trust into first/last name if they're empty
        if (!isPrevPersonType && isNewPersonType) {
          const nameSource = prev.company_name_or_trust || prev.display_name;
          if (nameSource && (!prev.first_name && !prev.last_name)) {
            const nameParts = nameSource.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              updated.first_name = nameParts[0];
              updated.last_name = nameParts.slice(1).join(" ");
            } else if (nameParts.length === 1) {
              updated.first_name = nameParts[0];
            }
          }
          // Clear company-specific field - persons don't have company_name_or_trust
          updated.company_name_or_trust = '';
        }
      }

      return updated;
    });
    setHasChanges(true);
  };

  // Handle team contact toggle with auto-save
  const handleTeamContactToggle = async (checked: boolean) => {
    if (!contact) return;

    // Safety check: Team contacts require a company (UI should prevent this, but double-check)
    if (checked && !contact.primary_company && selectedCompanies.length === 0) {
      return;
    }

    // Update local state immediately for responsive UI
    setFormData(prev => ({ ...prev, is_team_contact: checked }));

    // Auto-save the change
    setSaving(true);
    try {
      await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: { is_team_contact: checked }
      });
      // Reload to get updated display_name from server
      loadContact();
    } catch (err) {
      console.error("Failed to save team contact setting:", err);
      toast({
        title: "Failed to save",
        description: "Could not update team contact setting. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      setFormData(prev => ({ ...prev, is_team_contact: !checked }));
    } finally {
      setSaving(false);
    }
  };

  // Handle company selection changes
  const handleCompanyChange = async (newSelectedCompanies: Option[]) => {
    if (!contact) return;

    const previousIds = selectedCompanies.map((c) => c.value);
    const newIds = newSelectedCompanies.map((c) => c.value);

    // Find added companies (in newIds but not in previousIds)
    const addedIds = newIds.filter((id) => !previousIds.includes(id));

    // Find removed companies (in previousIds but not in newIds)
    const removedIds = previousIds.filter((id) => !newIds.includes(id));

    try {
      // For added companies, initialize roles as empty (user will select them)
      const newCompanyRoles = { ...companyRoles };
      for (const companyId of addedIds) {
        newCompanyRoles[companyId] = ['employee_of']; // Default to employee
      }

      // Delete ALL relationships for removed companies
      for (const companyId of removedIds) {
        console.log('[Company Change] Fetching relationships to delete for company:', companyId);
        const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
        const relsToDelete = relationshipsResponse.relationships.outgoing.filter(
          (r) => r.target_contact_id.toString() === companyId
        );
        console.log('[Company Change] Found', relsToDelete.length, 'relationships to delete for company:', companyId);
        for (const rel of relsToDelete) {
          await api.delete(`/api/v1/contacts/${contact.id}/relationships/${rel.id}`);
        }
        // Remove from companyRoles state
        delete newCompanyRoles[companyId];
      }

      // Update local state
      setSelectedCompanies(newSelectedCompanies);
      setCompanyRoles(newCompanyRoles);

      // Create initial relationship for newly added companies
      for (const companyId of addedIds) {
        await api.post(`/api/v1/contacts/${contact.id}/relationships`, {
          contact_relationship: {
            related_contact_id: parseInt(companyId),
            relationship_type: 'employee_of',
            is_active: true,
          },
        });
      }

      // Reload contact data to get updated relationships
      await loadContact();
    } catch (err) {
      console.error("Failed to update company relationships:", err);
      // Revert on error
      setSelectedCompanies(selectedCompanies);
    }
  };

  // Handle role changes for a specific company
  const handleCompanyRolesChange = async (companyId: string, newRoles: string[]) => {
    if (!contact) return;

    try {
      console.log('[Company Roles] Fetching relationships for company:', companyId);
      // Fetch existing relationships for this company
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
      const existingRels = relationshipsResponse.relationships.outgoing.filter(
        (r) => (r.related_contact_id || r.target_contact_id).toString() === companyId
      );

      const existingRoleTypes = existingRels.map((r) => r.relationship_type);
      console.log('[Company Roles] Current roles:', existingRoleTypes, 'New roles:', newRoles);

      // Find roles to add (in newRoles but not in existingRoleTypes)
      const rolesToAdd = newRoles.filter(role => !existingRoleTypes.includes(role));

      // Find roles to remove (in existingRoleTypes but not in newRoles)
      const rolesToRemove = existingRoleTypes.filter((role: string) => !newRoles.includes(role));

      console.log('[Company Roles] Roles to add:', rolesToAdd, 'Roles to remove:', rolesToRemove);

      // Create new relationships for added roles
      for (const roleType of rolesToAdd) {
        await api.post(`/api/v1/contacts/${contact.id}/relationships`, {
          contact_relationship: {
            related_contact_id: parseInt(companyId),
            relationship_type: roleType,
            is_active: true,
          },
        });
      }

      // Delete relationships for removed roles
      for (const roleType of rolesToRemove) {
        const relToDelete = existingRels.find((r) => r.relationship_type === roleType);
        if (relToDelete) {
          await api.delete(`/api/v1/contacts/${contact.id}/relationships/${relToDelete.id}`);
        }
      }

      console.log('[Company Roles] Successfully updated roles for company:', companyId);
      // Update local state
      setCompanyRoles({
        ...companyRoles,
        [companyId]: newRoles
      });

      // Reload contact data
      await loadContact();
    } catch (err) {
      console.error("[Company Roles] Failed to update roles for company:", companyId, "Error:", err);
    }
  };

  // Handle drag end for company reordering
  const handleCompanyDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedCompanies) return;

    const oldIndex = selectedCompanies.findIndex(c => c.value === active.id);
    const newIndex = selectedCompanies.findIndex(c => c.value === over.id);
    if (oldIndex === newIndex) return;

    // Optimistically update UI
    const newCompanies = arrayMove(selectedCompanies, oldIndex, newIndex);
    setSelectedCompanies(newCompanies);

    // Save to backend
    try {
      const company_ids = newCompanies.map(c => parseInt(c.value));
      await api.post(`/api/v1/contacts/${contact!.id}/reorder_companies`, { company_ids });
      // Reload to update Primary Company display
      await loadContact();
    } catch (err) {
      console.error("Failed to reorder companies:", err);
      alert("Failed to save company order");
      loadContact(); // Reload on error
    }
  };

  const handleCompanyPositionChange = async (companyId: string, newPosition: number) => {
    if (!selectedCompanies) return;
    const oldIndex = selectedCompanies.findIndex(c => c.value === companyId);
    if (oldIndex === -1) return;

    const newIndex = Math.max(0, Math.min(newPosition - 1, selectedCompanies.length - 1));
    if (oldIndex === newIndex) return;

    const newCompanies = arrayMove(selectedCompanies, oldIndex, newIndex);
    setSelectedCompanies(newCompanies);

    try {
      const company_ids = newCompanies.map(c => parseInt(c.value));
      await api.post(`/api/v1/contacts/${contact!.id}/reorder_companies`, { company_ids });
      // Reload to update Primary Company display
      await loadContact();
    } catch (err) {
      console.error("Failed to reorder companies:", err);
      loadContact();
    }
  };

  // Handle employee selection changes (for company contacts)
  const handleEmployeeChange = async (newSelectedEmployees: Option[]) => {
    console.log('[Employee Change] Called with:', newSelectedEmployees);
    if (!contact) return;

    const previousIds = selectedEmployees.map((e) => e.value);
    const newIds = newSelectedEmployees.map((e) => e.value);
    console.log('[Employee Change] Previous:', previousIds, 'New:', newIds);

    const addedIds = newIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !newIds.includes(id));
    console.log('[Employee Change] Added:', addedIds, 'Removed:', removedIds);

    try {
      // Create relationships FROM person TO company for added employees
      for (const personId of addedIds) {
        console.log('[Employee Change] Creating relationship for person:', personId);
        try {
          await api.post(`/api/v1/contacts/${personId}/relationships`, {
            contact_relationship: {
              related_contact_id: contact.id,
              relationship_type: 'employee_of',
              is_active: true,
            },
          });
          console.log('[Employee Change] Relationship created successfully for:', personId);
        } catch (err: unknown) {
          // Skip if relationship already exists
          const error = err as { response?: { data?: { error?: string } } };
          if (error?.response?.data?.error?.includes('already exists')) {
            console.log(`[Employee Change] Skipping duplicate relationship for person ${personId}`);
            continue;
          }
          throw err; // Re-throw if it's a different error
        }
      }

      // Delete relationships for removed employees
      for (const personId of removedIds) {
        console.log('[Employee Change] Deleting relationship for person:', personId);
        try {
          const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${personId}/relationships`);
          const rel = relationshipsResponse.relationships.outgoing.find(
            (r) => (r.related_contact_id || r.target_contact_id) === contact.id && r.relationship_type === 'employee_of'
          );
          if (rel) {
            await api.delete(`/api/v1/contacts/${personId}/relationships/${rel.id}`);
            console.log('[Employee Change] Relationship deleted successfully for:', personId);
          } else {
            console.log('[Employee Change] No employee_of relationship found for person:', personId);
          }
        } catch (err) {
          console.error('[Employee Change] Failed to fetch/delete relationship for person:', personId, 'Error:', err);
          // Continue with other deletions even if one fails
        }
      }

      console.log('[Employee Change] Setting selectedEmployees to:', newSelectedEmployees);
      setSelectedEmployees(newSelectedEmployees);
      console.log('[Employee Change] Calling loadContact()...');
      await loadContact();
      console.log('[Employee Change] loadContact() completed');
    } catch (err) {
      console.error("Failed to update employee relationships:", err);
      setSelectedEmployees(selectedEmployees);
    }
  };

  // Handle removing an employee from the People list
  const handleRemoveEmployee = async (employeeId: number) => {
    if (!contact) return;

    if (!confirm("Remove this person from the company?")) return;

    try {
      console.log('[Remove Employee] Fetching relationships for employee:', employeeId);
      // Find and delete the employee_of relationship
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${employeeId}/relationships`);
      const rel = relationshipsResponse.relationships.outgoing.find(
        (r) => (r.related_contact_id || r.target_contact_id) === contact.id && r.relationship_type === 'employee_of'
      );

      if (rel) {
        console.log('[Remove Employee] Deleting relationship:', rel.id);
        await api.delete(`/api/v1/contacts/${employeeId}/relationships/${rel.id}`);
        await loadContact();
        console.log('[Remove Employee] Successfully removed employee:', employeeId);
      } else {
        console.log('[Remove Employee] No relationship found for employee:', employeeId);
      }
    } catch (err) {
      console.error("[Remove Employee] Failed to remove employee:", employeeId, "Error:", err);
      alert("Failed to remove employee");
    }
  };

  // Handle updating roles for an employee
  const handleEmployeeRolesChange = async (employeeId: number, newRoleTypes: string[]) => {
    if (!contact) return;

    try {
      console.log('[Employee Roles] Fetching relationships for employee:', employeeId);
      // Get current relationships for this employee to this company
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${employeeId}/relationships`);
      const currentRels = relationshipsResponse.relationships.outgoing.filter(
        (r) => (r.related_contact_id || r.target_contact_id) === contact.id
      );

      const currentRoleTypes = currentRels.map((r) => r.relationship_type);
      console.log('[Employee Roles] Current roles:', currentRoleTypes, 'New roles:', newRoleTypes);

      // Find roles to add
      const rolesToAdd = newRoleTypes.filter((rt: string) => !currentRoleTypes.includes(rt));

      // Find roles to remove
      const rolesToRemove = currentRoleTypes.filter((rt: string) => !newRoleTypes.includes(rt));

      console.log('[Employee Roles] Roles to add:', rolesToAdd, 'Roles to remove:', rolesToRemove);

      // Add new roles
      for (const roleType of rolesToAdd) {
        await api.post(`/api/v1/contacts/${employeeId}/relationships`, {
          contact_relationship: {
            related_contact_id: contact.id,
            relationship_type: roleType,
            is_active: true,
          },
        });
      }

      // Remove old roles
      for (const roleType of rolesToRemove) {
        const rel = currentRels.find((r) => r.relationship_type === roleType);
        if (rel) {
          await api.delete(`/api/v1/contacts/${employeeId}/relationships/${rel.id}`);
        }
      }

      console.log('[Employee Roles] Successfully updated roles for employee:', employeeId);
      // Update local state
      const newEmployeeRoles = { ...employeeRoles };
      newEmployeeRoles[employeeId.toString()] = newRoleTypes;
      setEmployeeRoles(newEmployeeRoles);
    } catch (err) {
      console.error("[Employee Roles] Failed to update roles for employee:", employeeId, "Error:", err);
      alert("Failed to update employee roles");
    }
  };

  // Handle adding a new related entity
  const handleAddRelatedEntity = async () => {
    if (!contact || !newRelatedEntityContactId || !newRelatedEntityType) return;

    setAddingRelatedEntity(true);
    try {
      await api.post(`/api/v1/contacts/${contact.id}/relationships`, {
        contact_relationship: {
          related_contact_id: parseInt(newRelatedEntityContactId),
          relationship_type: newRelatedEntityType,
          is_active: true,
        },
      });

      // Reload relationships
      const response = await api.get<{
        relationships: {
          outgoing: ContactRelationship[];
          incoming: ContactRelationship[];
        };
      }>(`/api/v1/contacts/${contact.id}/relationships`);

      // Refilter relationships
      const allRelationships = [
        ...(response.relationships?.outgoing || []),
        ...(response.relationships?.incoming || [])
      ];

      const filteredRelationships = allRelationships.filter(rel => {
        const otherEntityType = rel.other_contact?.entity_type;
        const thisEntityType = contact.entity_type;
        if (!rel.is_active) return false;
        if (isPerson(thisEntityType)) {
          if (otherEntityType && ['company', 'trust', 'sole_trader'].includes(otherEntityType)) {
            return false;
          }
        }
        if (canHaveEmployees(thisEntityType)) {
          if (rel.direction === 'incoming' && otherEntityType === 'person') {
            return false;
          }
        }
        return true;
      });

      const uniqueRelationships = filteredRelationships.reduce((acc, rel) => {
        if (!acc.find(r => r.id === rel.id)) {
          acc.push(rel);
        }
        return acc;
      }, [] as ContactRelationship[]);

      setRelatedEntities(uniqueRelationships);

      // Reset form
      setNewRelatedEntityContactId("");
      setNewRelatedEntityType("");
      setShowAddRelatedEntity(false);
    } catch (err) {
      console.error("Failed to add related entity:", err);
      alert("Failed to add relationship");
    } finally {
      setAddingRelatedEntity(false);
    }
  };

  // Handle removing a related entity
  const handleRemoveRelatedEntity = async (relationshipId: number, sourceContactId: number) => {
    if (!contact) return;
    if (!confirm("Remove this relationship?")) return;

    try {
      await api.delete(`/api/v1/contacts/${sourceContactId}/relationships/${relationshipId}`);
      // Remove from local state
      setRelatedEntities(prev => prev.filter(r => r.id !== relationshipId));
    } catch (err) {
      console.error("Failed to remove related entity:", err);
      alert("Failed to remove relationship");
    }
  };

  // Handle drag end for employee reordering
  const handleEmployeeDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !contact?.employees) return;

    const oldIndex = contact.employees.findIndex(e => e.id === active.id);
    const newIndex = contact.employees.findIndex(e => e.id === over.id);

    if (oldIndex === newIndex) return;

    // Optimistically update UI
    const newEmployees = arrayMove(contact.employees, oldIndex, newIndex);
    setContact({ ...contact, employees: newEmployees });

    // Save to backend
    try {
      const employee_ids = newEmployees.map(e => e.id);
      await api.post(`/api/v1/contacts/${contact.id}/reorder_employees`, {
        employee_ids
      });
    } catch (err) {
      console.error("Failed to reorder employees:", err);
      alert("Failed to save employee order");
      // Reload to get correct order from server
      loadContact();
    }
  };

  // Handle manual position change via input
  const handleEmployeePositionChange = async (employeeId: number, newPosition: number) => {
    if (!contact?.employees) return;

    const oldIndex = contact.employees.findIndex(e => e.id === employeeId);
    if (oldIndex === -1) return;

    // Convert 1-based position to 0-based index
    const newIndex = Math.max(0, Math.min(newPosition - 1, contact.employees.length - 1));

    if (oldIndex === newIndex) return;

    // Optimistically update UI
    const newEmployees = arrayMove(contact.employees, oldIndex, newIndex);
    setContact({ ...contact, employees: newEmployees });

    // Save to backend
    try {
      const employee_ids = newEmployees.map(e => e.id);
      await api.post(`/api/v1/contacts/${contact.id}/reorder_employees`, {
        employee_ids
      });
    } catch (err) {
      console.error("Failed to reorder employees:", err);
      alert("Failed to save employee order");
      // Reload to get correct order from server
      loadContact();
    }
  };

  // Save contact changes
  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      // For person/sole_trader: construct display_name from first/last name
      // For company/trust: use company_name_or_trust (SSoT) - backend syncs this to display_name
      // For price_only: use display_name directly (AUTO-UPPERCASE)
      let display_name = hasFirstLastName(formData.entity_type)
        ? [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(" ") || "Unknown"
        : hasCompanyName(formData.entity_type)
          ? formData.company_name_or_trust || "Unknown"
          : formData.display_name || "Unknown";

      // Price Only contacts are always saved in CAPITALS
      if (isPriceOnly(formData.entity_type)) {
        display_name = display_name.toUpperCase();
      }

      // Ensure is_team_contact is false if no company is linked (prevents backend validation error)
      const is_team_contact = (contact.primary_company || selectedCompanies.length > 0)
        ? formData.is_team_contact
        : false;

      // Prepare contact_emails_attributes (filtering out destroyed items for new records)
      const contact_emails_attributes = (contact.contact_emails || [])
        .filter(e => e.id || (!e.id && !e._destroy)) // Keep if has ID or is new and not destroyed
        .map(e => ({
          id: e.id,
          email: e.email,
          is_primary: e.is_primary,
          label: e.label,
          position: e.position,
          _destroy: e._destroy
        }));

      // Prepare contact_phones_attributes (filtering out destroyed items for new records)
      const contact_phones_attributes = (contact.contact_phones || [])
        .filter(p => p.id || (!p.id && !p._destroy)) // Keep if has ID or is new and not destroyed
        .map(p => ({
          id: p.id,
          phone_number: p.phone_number,
          phone_type: p.phone_type,
          is_primary: p.is_primary,
          label: p.label,
          position: p.position,
          _destroy: p._destroy
        }));

      // Backward compatibility: sync primary email/phone to legacy fields
      const primaryEmail = contact.contact_emails?.find(e => e.is_primary && !e._destroy);
      const primaryMobile = contact.contact_phones?.find(p => p.phone_type === 'mobile' && p.is_primary && !p._destroy);
      const primaryOffice = contact.contact_phones?.find(p => p.phone_type === 'office' && p.is_primary && !p._destroy);

      await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: {
          ...formData,
          display_name,
          is_team_contact, // Override formData value with validated value
          // Keep legacy fields in sync for backwards compatibility
          email: primaryEmail?.email || formData.email,
          mobile_phone: primaryMobile?.phone_number || formData.mobile_phone,
          office_phone: primaryOffice?.phone_number || formData.office_phone,
          contact_emails_attributes,
          contact_phones_attributes
        },
      });
      setHasChanges(false);
      // Signal that contacts list needs refresh when navigating back
      sessionStorage.setItem('contacts_needs_refresh', 'true');
      loadContact();
      // Increment refresh key to force tab data reload (directorships, shareholdings, etc.)
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save ref to track timeout
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save on blur (debounced to avoid saving while user tabs between fields)
  // Note: We always attempt to save - handleSave will check if there's anything to save
  // Using a ref to always get the latest handleSave to avoid stale closure issues
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleAutoSave = useCallback(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    // Set a short delay to allow user to tab to another field without triggering save
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (!saving) {
        handleSaveRef.current();
      }
    }, 300);
  }, [saving]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Create a new company and link current person as employee
  const handleCreateCompany = async () => {
    if (!contact?.id || !newCompanyName.trim()) return;
    setCreatingCompany(true);
    try {
      // Check if person has Xero data to transfer
      const hasXeroData = contact.xero_id;

      // Create the new company contact, optionally transferring Xero data
      const companyData: Record<string, unknown> = {
        entity_type: "company",
        company_name_or_trust: newCompanyName.trim(),
        display_name: newCompanyName.trim(),
      };

      // Transfer Xero data from person to company if it exists
      if (hasXeroData) {
        companyData.xero_id = contact.xero_id;
        companyData.sync_with_xero = contact.sync_with_xero;
        companyData.xero_contact_number = contact.xero_contact_number;
        companyData.xero_contact_status = contact.xero_contact_status;
        companyData.xero_account_number = contact.xero_account_number;
        companyData.xero_synced = contact.xero_synced;
        companyData.xero_invoice_count = contact.xero_invoice_count;
        companyData.xero_contact_types = contact.xero_contact_types;
      }

      const response = await api.post<{ contact?: { id: number }; id?: number }>("/api/v1/contacts", {
        contact: companyData,
      });
      const newCompanyId = response?.contact?.id || (response as { id?: number })?.id;
      if (!newCompanyId) throw new Error("Failed to get new company ID");

      // Clear Xero data from the person if it was transferred
      if (hasXeroData) {
        await api.patch(`/api/v1/contacts/${contact.id}`, {
          contact: {
            xero_id: null,
            sync_with_xero: false,
            xero_contact_number: null,
            xero_contact_status: null,
            xero_account_number: null,
            xero_synced: false,
            xero_invoice_count: null,
            xero_contact_types: null,
            xero_sync_error: null,
          },
        });
      }

      // Link current person as employee of the new company
      // Use the nested route: POST /api/v1/contacts/:contact_id/relationships
      await api.post(`/api/v1/contacts/${contact.id}/relationships`, {
        contact_relationship: {
          related_contact_id: newCompanyId,
          relationship_type: "employee_of",
          is_active: true,
        },
      });

      // Reset and refresh
      setNewCompanyName("");
      setShowAddCompany(false);

      // Navigate to the new company
      router.push(`/contacts/${newCompanyId}`);
    } catch (err) {
      console.error("Failed to create company:", err);
    } finally {
      setCreatingCompany(false);
    }
  };

  // Create a new employee and link to current company
  const handleCreateEmployee = async () => {
    if (!contact?.id || !newEmployeeFirstName.trim()) return;
    setCreatingEmployee(true);
    try {
      // Create the new person contact
      const fullName = [newEmployeeFirstName.trim(), newEmployeeLastName.trim()].filter(Boolean).join(" ");
      const response = await api.post<{ contact?: { id: number }; id?: number }>("/api/v1/contacts", {
        contact: {
          entity_type: "person",
          first_name: newEmployeeFirstName.trim(),
          last_name: newEmployeeLastName.trim(),
          display_name: fullName,
        },
      });
      const newEmployeeId = response?.contact?.id || (response as { id?: number })?.id;
      if (!newEmployeeId) throw new Error("Failed to get new employee ID");

      // Link new person as employee of current company
      // Use the nested route: POST /api/v1/contacts/:contact_id/relationships
      await api.post(`/api/v1/contacts/${newEmployeeId}/relationships`, {
        contact_relationship: {
          related_contact_id: contact.id,
          relationship_type: "employee_of",
          is_active: true,
        },
      });

      // Reset and refresh
      setNewEmployeeFirstName("");
      setNewEmployeeLastName("");
      setShowAddEmployee(false);

      // Navigate to the new employee
      router.push(`/contacts/${newEmployeeId}`);
    } catch (err) {
      console.error("Failed to create employee:", err);
    } finally {
      setCreatingEmployee(false);
    }
  };

  // SSoT: Load tab-specific data when tab changes (initial load only when data is empty)
  useEffect(() => {
    if (!contact?.id) return;

    if (activeTab === "corporate") {
      // Load all corporate data for the Corporate tab (Identity + Summary)
      if (directorships.length === 0 && !loadingDirectorships) loadDirectorships();
      if (shareholdings.length === 0 && !loadingShareholdings) loadShareholdings();
      if (!trustRoles && !loadingTrustRoles) loadTrustRoles();
      if (ownershipChain.length === 0 && !loadingOwnershipChain) loadOwnershipChain();
    }

    if (activeTab === "cases" && caseRelationships.length === 0 && !loadingCaseRelationships) {
      loadCaseRelationships();
    }

    if (activeTab === "emails" && contact?.email && emails.length === 0 && !loadingEmails) {
      // Reset filters when entering emails tab (handles direct navigation to ?tab=emails)
      resetFiltersForEmailsTab();
      loadEmails();
    }

  }, [activeTab, contact?.id]);

  // Force reload current tab data when refreshKey changes (after save)
  useEffect(() => {
    if (!contact?.id || refreshKey === 0) return; // Skip initial render

    if (activeTab === "corporate") {
      loadDirectorships();
      loadShareholdings();
      loadTrustRoles();
      loadOwnershipChain();
    }
    if (activeTab === "cases") {
      loadCaseRelationships();
    }
    if (activeTab === "emails" && contact?.email) {
      loadEmails(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Reload emails when showAllInThread changes
  useEffect(() => {
    if (activeTab === "emails" && contact?.email) {
      loadEmails(1);
    }
     
  }, [showAllInThread]);

  const handleTabChange = (value: string) => {
    // Reset filters when switching to emails tab to prevent stale filters from Contacts list
    if (value === "emails") {
      resetFiltersForEmailsTab();
    }

    // Use current URL id, don't show ?tab= for default "overview" tab
    const newUrl = value === "overview"
      ? `/contacts/${id}`
      : `/contacts/${id}?tab=${value}`;
    router.push(newUrl);
  };

  const handleCorporateSubTabChange = (value: string) => {
    const newUrl = value === "identity"
      ? `/contacts/${id}?tab=corporate`
      : `/contacts/${id}?tab=corporate&subtab=${value}`;
    router.push(newUrl);
  };

  const handleFinancialSubTabChange = (value: string) => {
    const newUrl = value === "bank"
      ? `/contacts/${id}?tab=financial`
      : `/contacts/${id}?tab=financial&subtab=${value}`;
    router.push(newUrl);
  };

  // Get appropriate sub-tab based on active main tab
  const activeFinancialSubTab = activeTab === "financial" ? (searchParams.get("subtab") || "bank") : "bank";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600">{error || "Contact not found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Contacts
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {contact.display_name || contact.display_name}
              </h1>
              {contact["is_supplier?"] && (
                <Badge className="bg-purple-100 text-purple-700">Supplier</Badge>
              )}
              {contact["is_customer?"] && (
                <Badge className="bg-blue-100 text-blue-700">Customer</Badge>
              )}
              {contact.is_family_member && (
                <Badge className="bg-green-100 text-green-700">Family</Badge>
              )}
              {contact.xero_contact_id && (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Xero Linked
                </Badge>
              )}
            </div>
            {contact.company_name && (
              <p className="text-sm text-muted-foreground mt-1">
                {contact.position && `${contact.position} at `}{contact.company_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleEnrichFromWeb}
            disabled={enrichingFromWeb || (!contact?.email && !contact?.website)}
          >
            {enrichingFromWeb ? (
              <>
                <Spinner2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Get Info from Web
              </>
            )}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {contact.linked_company && contact.can_view_corporate && (
            <TabsTrigger value="corporate">
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Corporate
              {(directorships.length > 0 || shareholdings.length > 0 || (trustRoles && trustRoles.total_count > 0) || memberships.length > 0) && (
                <Badge variant="secondary" className="ml-1.5">
                  {directorships.length + shareholdings.length + (trustRoles?.total_count || 0) + memberships.length}
                </Badge>
              )}
              {!contact.can_view_confidential && <Lock className="h-3 w-3 ml-1 text-amber-500" />}
            </TabsTrigger>
          )}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="financial">
            Financial
            {!contact.can_view_confidential && <Lock className="h-3 w-3 ml-1 text-amber-500" />}
          </TabsTrigger>
          <TabsTrigger value="coms">Communications</TabsTrigger>
          {contact.can_view_cases && (
            <TabsTrigger value="cases">
              <Briefcase className="h-3.5 w-3.5 mr-1" />
              Cases
              {caseRelationships.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {caseRelationships.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {contact.email && (
            <TabsTrigger value="emails">
              <Mail className="h-3.5 w-3.5 mr-1" />
              Emails
              {emailsPagination && emailsPagination.total > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {emailsPagination.total}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {contact["is_customer?"] && (
            <TabsTrigger value="invoices">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Invoices
            </TabsTrigger>
          )}
          {contact["is_supplier?"] && (
            <TabsTrigger value="pricebook">Price Book</TabsTrigger>
          )}
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
          {directorships.length > 0 && (
            <TabsTrigger value="directorships">
              <Briefcase className="h-3.5 w-3.5 mr-1" />
              Directorships
              <Badge variant="secondary" className="ml-1.5">
                {directorships.filter(d => d.is_current).length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Edit Form Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info and Contact Details - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Basic Information
                    </CardTitle>
                    {hasChanges && (
                      <Button onClick={handleSave} disabled={saving} size="sm">
                        {saving ? <Spinner2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {/* Person and Sole Trader show first/middle/last name fields */}
                      {hasFirstLastName(formData.entity_type) ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input id="first_name" value={formData.first_name} onChange={(e) => handleInputChange("first_name", e.target.value)} onBlur={handleAutoSave} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="middle_name">Middle Name</Label>
                            <Input id="middle_name" value={formData.middle_name} onChange={(e) => handleInputChange("middle_name", e.target.value)} onBlur={handleAutoSave} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input id="last_name" value={formData.last_name} onChange={(e) => handleInputChange("last_name", e.target.value)} onBlur={handleAutoSave} />
                          </div>
                          {/* Show display_name from database as read-only (SSoT) */}
                          <div className="space-y-2">
                            <Label htmlFor="display_name_display">Display Name (SSoT)</Label>
                            <Input
                              id="display_name_display"
                              value={contact.display_name || ""}
                              disabled
                              className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">Database value - updated on save from First + Middle + Last name</p>
                          </div>
                        </>
                      ) : (
                        /* Company, Trust use company_name_or_trust (SSoT), Price Only shows display_name read-only */
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="company_name_or_trust">
                              {isPriceOnly(formData.entity_type) ? "Display Name" : "Company/Trust Name"}
                            </Label>
                            <Input
                              id="company_name_or_trust"
                              value={isPriceOnly(formData.entity_type) ? formData.display_name : formData.company_name_or_trust}
                              onChange={(e) => {
                                if (isPriceOnly(formData.entity_type)) {
                                  // For Price Only, update display_name directly
                                  handleInputChange("display_name", e.target.value);
                                } else {
                                  handleInputChange("company_name_or_trust", e.target.value);
                                }
                              }}
                              onBlur={handleAutoSave}
                              placeholder={isPriceOnly(formData.entity_type) ? "e.g. INTERNAL STAIRS" : "e.g. ABC Pty Ltd"}
                            />
                            {isPriceOnly(formData.entity_type) && (
                              <p className="text-xs text-muted-foreground">Will be saved in CAPITALS automatically</p>
                            )}
                          </div>
                          {/* Show display_name from database as read-only (SSoT) for Company/Trust */}
                          {!isPriceOnly(formData.entity_type) && (
                            <div className="space-y-2">
                              <Label htmlFor="display_name_display">Display Name (SSoT)</Label>
                              <Input
                                id="display_name_display"
                                value={contact.display_name || ""}
                                disabled
                                className="bg-muted"
                              />
                              <p className="text-xs text-muted-foreground">Database value - updated on save from Company/Trust Name</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entity_type">Entity Type</Label>
                      <select id="entity_type" value={formData.entity_type} onChange={(e) => handleInputChange("entity_type", e.target.value)} onBlur={handleAutoSave} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {/* SSoT: Entity types from API */}
                        {entityTypeMetadata.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Company multi-select - show for person entity type (employees can work for companies) */}
                    {canHaveEmployer(formData.entity_type) && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Companies</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddCompany(!showAddCompany)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Company
                            </Button>
                          </div>

                          {/* Add Company inline form */}
                          {showAddCompany && (
                            <div className="p-3 border rounded-md bg-muted/30 space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="new-company-name">Company Name</Label>
                                <Input
                                  id="new-company-name"
                                  value={newCompanyName}
                                  onChange={(e) => setNewCompanyName(e.target.value)}
                                  placeholder="Enter company name..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newCompanyName.trim()) {
                                      handleCreateCompany();
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleCreateCompany}
                                  disabled={creatingCompany || !newCompanyName.trim()}
                                >
                                  {creatingCompany ? (
                                    <Spinner2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Plus className="h-3 w-3 mr-1" />
                                  )}
                                  Create & Link
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setShowAddCompany(false);
                                    setNewCompanyName("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Creates a new company and adds {formData.first_name || "this person"} as an employee.
                              </p>
                            </div>
                          )}

                          {/* Companies multi-selector */}
                          <MultipleSelector
                            value={selectedCompanies}
                            onChange={(newOptions) => {
                              handleCompanyChange(newOptions);
                            }}
                            placeholder="🔍 Search and add companies..."
                            options={availableCompanies}
                            emptyIndicator={
                              <p className="text-center text-sm text-muted-foreground">
                                {loadingCompanies ? "Loading companies..." : "No companies found"}
                              </p>
                            }
                            disabled={loadingCompanies}
                            hidePlaceholderWhenSelected={false}
                            className="w-full bg-white dark:bg-gray-950"
                          />

                          <p className="text-xs text-muted-foreground">
                            Search above to add companies. Selected companies shown in blue boxes. View and edit roles in the Overview tab.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Linked Company - removed for companies (redundant to show company its own details) */}
                    {/* Employee multi-select - show for company/trust entity types */}
                    {canHaveEmployees(formData.entity_type) && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Employees</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddEmployee(!showAddEmployee)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Employee
                            </Button>
                          </div>

                          {/* Add Employee inline form */}
                          {showAddEmployee && (
                            <div className="p-3 border rounded-md bg-muted/30 space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label htmlFor="new-employee-first">First Name</Label>
                                  <Input
                                    id="new-employee-first"
                                    value={newEmployeeFirstName}
                                    onChange={(e) => setNewEmployeeFirstName(e.target.value)}
                                    placeholder="First name..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="new-employee-last">Last Name</Label>
                                  <Input
                                    id="new-employee-last"
                                    value={newEmployeeLastName}
                                    onChange={(e) => setNewEmployeeLastName(e.target.value)}
                                    placeholder="Last name..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && newEmployeeFirstName.trim()) {
                                        handleCreateEmployee();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleCreateEmployee}
                                  disabled={creatingEmployee || !newEmployeeFirstName.trim()}
                                >
                                  {creatingEmployee ? (
                                    <Spinner2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Plus className="h-3 w-3 mr-1" />
                                  )}
                                  Create & Link
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setShowAddEmployee(false);
                                    setNewEmployeeFirstName("");
                                    setNewEmployeeLastName("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Creates a new person and adds them as an employee of {formData.company_name_or_trust || "this company"}.
                              </p>
                            </div>
                          )}

                          <MultipleSelector
                            value={selectedEmployees}
                            onChange={handleEmployeeChange}
                            placeholder="Click to search employees..."
                            options={availablePeople}
                            emptyIndicator={
                              <p className="text-center text-sm text-muted-foreground">
                                {loadingPeople ? "Loading people..." : "No people found"}
                              </p>
                            }
                            disabled={loadingPeople}
                            className="w-full"
                            hidePlaceholderWhenSelected
                          />
                          <p className="text-xs text-muted-foreground">Add people who work for this {isTrust(formData.entity_type) ? 'trust' : 'company'}. View and edit roles in the Overview tab.</p>
                        </div>
                      </div>
                    )}
                    {/* Primary Company - show for person entity type */}
                    {isPerson(formData.entity_type) && contact.primary_company && (
                      <div className="space-y-2">
                        <Label>Primary Company (Auto-synced)</Label>
                        <div className="p-3 rounded-md border bg-muted/30">
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100 px-3 py-1.5 text-sm font-medium inline-flex items-center gap-2"
                          >
                            <Building2 className="h-4 w-4" />
                            {contact.primary_company.name}
                            <Link href={`/contacts/${contact.primary_company.id}`}>
                              <ExternalLink className="h-3.5 w-3.5 ml-1 hover:text-green-700 dark:hover:text-green-300" />
                            </Link>
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-2">
                            <CheckCircle className="inline h-3 w-3 mr-1" />
                            Automatically synced from employee relationships
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2">
                      <div><Label>Active</Label><p className="text-xs text-muted-foreground">Is this contact active?</p></div>
                      <Switch checked={formData.is_active} onCheckedChange={(c) => { handleInputChange("is_active", c); handleAutoSave(); }} />
                    </div>
                    {isPerson(formData.entity_type) && (
                      <div className="flex items-center justify-between py-2">
                        <div><Label>Family Member</Label></div>
                        <Switch checked={formData.is_family_member} onCheckedChange={(c) => { handleInputChange("is_family_member", c); handleAutoSave(); }} />
                      </div>
                    )}
                    {isPerson(formData.entity_type) && (
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <Label className={!contact.primary_company && selectedCompanies.length === 0 ? "text-muted-foreground" : ""}>Team Contact</Label>
                          <p className="text-xs text-muted-foreground">
                            {!contact.primary_company && selectedCompanies.length === 0
                              ? "Add a company first to enable this option"
                              : "Append company name to avoid duplicates (e.g., \"Accounts Team - Buildcraft\")"}
                          </p>
                        </div>
                        <Switch
                          checked={formData.is_team_contact}
                          onCheckedChange={handleTeamContactToggle}
                          disabled={saving || (!contact.primary_company && selectedCompanies.length === 0)}
                        />
                      </div>
                    )}

                    {/* Xero Link Status - SSoT display */}
                    {contact.xero_id && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-sm font-medium">Linked to Xero</span>
                          </div>
                          {contact.xero_invoice_count && (
                            <Badge variant="secondary">{contact.xero_invoice_count} invoices</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Xero ID: {contact.xero_id}
                          {contact.xero_contact_number && ` • Contact #${contact.xero_contact_number}`}
                        </p>
                      </div>
                    )}

                    {/* Raw Data Section - Collapsible */}
                    <details className="mt-4 pt-4 border-t">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Raw Data (Debug)
                      </summary>
                      <div className="mt-3 p-3 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                          {JSON.stringify(contact, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </CardContent>
                </Card>

                {/* Contact Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Contact Details
                      {canHaveEmployer(formData.entity_type) && contact.primary_company && (
                        <Badge variant="outline" className="ml-2">
                          <Building2 className="h-3 w-3 mr-1" />
                          Company Details
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Direct/Personal Contact Details Section Header */}
                    {canHaveEmployer(formData.entity_type) && contact.primary_company && (
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="h-4 w-4" />
                        Direct Contact (Personal)
                      </div>
                    )}

                    {/* Emails Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{canHaveEmployer(formData.entity_type) && contact.primary_company ? 'Direct Email Addresses' : 'Emails'}</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newEmail: ContactEmail = {
                              email: '',
                              is_primary: (contact.contact_emails?.length || 0) === 0,
                              label: null,
                              position: (contact.contact_emails?.length || 0)
                            };
                            const updated = [...(contact.contact_emails || []), newEmail];
                            setContact({ ...contact, contact_emails: updated });
                            setHasChanges(true);
                          }}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Add Email
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(contact.contact_emails || [])
                          .map((email, originalIndex) => ({ email, originalIndex }))
                          .filter(({ email }) => !email._destroy)
                          .sort((a, b) => {
                            if (a.email.is_primary && !b.email.is_primary) return -1;
                            if (!a.email.is_primary && b.email.is_primary) return 1;
                            return a.email.position - b.email.position;
                          })
                          .map(({ email, originalIndex }) => (
                          <div key={email.id || `new-${originalIndex}`} className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={email.email}
                              onChange={(e) => {
                                const updated = [...(contact.contact_emails || [])];
                                updated[originalIndex] = { ...updated[originalIndex], email: e.target.value };
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
                              }}
                              onBlur={handleAutoSave}
                              placeholder="email@example.com"
                              className={email.is_primary ? 'border-primary' : ''}
                            />
                            <Button
                              type="button"
                              variant={email.is_primary ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const updated = (contact.contact_emails || []).map((e, i) => ({
                                  ...e,
                                  is_primary: i === originalIndex
                                }));
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
                                handleAutoSave();
                              }}
                              title="Set as primary"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = [...(contact.contact_emails || [])];
                                if (email.id) {
                                  updated[originalIndex] = { ...updated[originalIndex], _destroy: true };
                                } else {
                                  updated.splice(originalIndex, 1);
                                }
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
                                handleAutoSave();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Phones Section */}
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <Label>{canHaveEmployer(formData.entity_type) && contact.primary_company ? 'Direct Phone Numbers' : 'Phones'}</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                            const newPhone: ContactPhone = {
                              phone_number: '',
                              phone_type: 'mobile',
                              is_primary: (contact.contact_phones?.length || 0) === 0,
                              label: null,
                              position: (contact.contact_phones?.length || 0)
                            };
                            const updated = [...(contact.contact_phones || []), newPhone];
                            setContact({ ...contact, contact_phones: updated });
                            setHasChanges(true);
                          }}
                        >
                            <Phone className="h-3 w-3 mr-1" />
                            Add Phone
                          </Button>
                        </div>
                        {canHaveEmployer(formData.entity_type) && contact.primary_company && (
                          <p className="text-xs text-muted-foreground">Personal/direct line, mobile, or extension</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(contact.contact_phones || [])
                          .map((phone, originalIndex) => ({ phone, originalIndex }))
                          .filter(({ phone }) => !phone._destroy)
                          .sort((a, b) => {
                            if (a.phone.is_primary && !b.phone.is_primary) return -1;
                            if (!a.phone.is_primary && b.phone.is_primary) return 1;
                            return a.phone.position - b.phone.position;
                          })
                          .map(({ phone, originalIndex }) => (
                          <div key={phone.id || `new-${originalIndex}`} className="flex items-center gap-2">
                            <select
                              value={phone.phone_type}
                              onChange={(e) => {
                                const updated = [...(contact.contact_phones || [])];
                                updated[originalIndex] = { ...updated[originalIndex], phone_type: e.target.value as ContactPhone['phone_type'] };
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                              }}
                              onBlur={handleAutoSave}
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="mobile">Mobile</option>
                              <option value="office">Office</option>
                              <option value="fax">Fax</option>
                              <option value="home">Home</option>
                            </select>
                            <Input
                              type="tel"
                              value={phone.phone_number}
                              onChange={(e) => {
                                const updated = [...(contact.contact_phones || [])];
                                updated[originalIndex] = { ...updated[originalIndex], phone_number: e.target.value };
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                                // Clear error on change
                                setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: '' }));
                              }}
                              onBlur={() => {
                                // Validate and format
                                const validation = validatePhoneNumber(phone.phone_number);
                                if (!validation.isValid) {
                                  setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: validation.error || 'Invalid phone' }));
                                } else {
                                  // Format the number
                                  const formatted = formatPhoneNumber(phone.phone_number);
                                  if (formatted !== phone.phone_number) {
                                    const updated = [...(contact.contact_phones || [])];
                                    updated[originalIndex] = { ...updated[originalIndex], phone_number: formatted };
                                    setContact({ ...contact, contact_phones: updated });
                                  }
                                  setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: '' }));
                                }
                                // Always trigger auto-save - the ref pattern ensures latest state is used
                                handleAutoSave();
                              }}
                              placeholder="0400 000 000"
                              className={cn(
                                phone.is_primary ? 'border-primary' : '',
                                fieldErrors[`phone_${originalIndex}`] && 'border-red-500 focus-visible:ring-red-500'
                              )}
                            />
                            {fieldErrors[`phone_${originalIndex}`] && (
                              <p className="text-xs text-red-500">{fieldErrors[`phone_${originalIndex}`]}</p>
                            )}
                            <Button
                              type="button"
                              variant={phone.is_primary ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const updated = (contact.contact_phones || []).map((p, i) => ({
                                  ...p,
                                  is_primary: i === originalIndex
                                }));
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                                handleAutoSave();
                              }}
                              title="Set as primary"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = [...(contact.contact_phones || [])];
                                if (phone.id) {
                                  updated[originalIndex] = { ...updated[originalIndex], _destroy: true };
                                } else {
                                  updated.splice(originalIndex, 1);
                                }
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                                handleAutoSave();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Website and Address - only show if NOT part of a company */}
                    {!(canHaveEmployer(formData.entity_type) && contact.primary_company) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="website">Website</Label>
                          <Input id="website" value={formData.website} onChange={(e) => handleInputChange("website", e.target.value)} onBlur={handleAutoSave} placeholder="https://example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address</Label>
                          <Textarea id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} onBlur={handleAutoSave} placeholder="Full address" rows={2} />
                        </div>
                      </>
                    )}

                    {/* Company Contact Details - Show when person/sole_trader has a primary company */}
                    {canHaveEmployer(formData.entity_type) && contact.primary_company && (
                      <div className="space-y-4 p-4 rounded-lg border bg-muted/30 mt-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          {contact.primary_company.name} Contact Info
                        </div>

                        {/* Company ABN/ACN */}
                        {(contact.primary_company.abn || contact.primary_company.acn) && (
                          <div className="flex flex-wrap gap-3">
                            {contact.primary_company.abn && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-xs text-muted-foreground font-medium">ABN:</span>
                                <span className="font-mono">{formatABN(contact.primary_company.abn)}</span>
                              </div>
                            )}
                            {contact.primary_company.acn && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-xs text-muted-foreground font-medium">ACN:</span>
                                <span className="font-mono">{formatACN(contact.primary_company.acn)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Company Emails */}
                        {contact.primary_company.contact_emails && contact.primary_company.contact_emails.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Emails</Label>
                            {contact.primary_company.contact_emails
                              .sort((a, b) => {
                                if (a.is_primary && !b.is_primary) return -1;
                                if (!a.is_primary && b.is_primary) return 1;
                                return a.position - b.position;
                              })
                              .map((email, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span>{email.email}</span>
                                  {email.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Company Phones */}
                        {contact.primary_company.contact_phones && contact.primary_company.contact_phones.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Phones</Label>
                            {contact.primary_company.contact_phones
                              .sort((a, b) => {
                                if (a.is_primary && !b.is_primary) return -1;
                                if (!a.is_primary && b.is_primary) return 1;
                                return a.position - b.position;
                              })
                              .map((phone, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <Badge variant="outline" className="text-xs">{phone.phone_type}</Badge>
                                  <span>{phone.phone_number}</span>
                                  {phone.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Company Website */}
                        {contact.primary_company.website && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <a href={contact.primary_company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {contact.primary_company.website}
                            </a>
                          </div>
                        )}

                        {/* Company Address */}
                        {contact.primary_company.address && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                            <span className="whitespace-pre-line">{contact.primary_company.address}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Associated People Card - for company/trust/sole_trader entity types */}
              {canHaveEmployees(formData.entity_type) && contact.employees && contact.employees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      People
                      <Badge variant="secondary" className="ml-2">{contact.employees.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleEmployeeDragEnd}
                    >
                      <SortableContext
                        items={contact.employees.map(e => e.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {contact.employees.map((employee, index) => (
                            <SortableEmployeeItem
                              key={employee.id}
                              employee={employee}
                              index={index}
                              employeeRoles={employeeRoles}
                              onRolesChange={handleEmployeeRolesChange}
                              onRemove={handleRemoveEmployee}
                              onPositionChange={handleEmployeePositionChange}
                              isPrimary={index === 0}
                              availableRoleTypes={getValidRelationshipTypes(
                                relationshipTypeMetadata,
                                'person', // employee is a person
                                formData.entity_type // target is this company/trust
                              )}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>
              )}

              {/* Associated Companies Card - for person entity type */}
              {canHaveEmployer(formData.entity_type) && selectedCompanies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Companies
                      <Badge variant="secondary" className="ml-2">{selectedCompanies.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleCompanyDragEnd}
                    >
                      <SortableContext
                        items={selectedCompanies.map(c => c.value)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {selectedCompanies.map((company, index) => (
                            <SortableCompanyItem
                              key={company.value}
                              company={company}
                              index={index}
                              companyRoles={companyRoles}
                              onRolesChange={handleCompanyRolesChange}
                              onRemove={() => {
                                const newSelected = selectedCompanies.filter(c => c.value !== company.value);
                                handleCompanyChange(newSelected);
                              }}
                              onPositionChange={handleCompanyPositionChange}
                              isPrimary={index === 0}
                              availableRoleTypes={getValidRelationshipTypes(
                                relationshipTypeMetadata,
                                formData.entity_type, // this person is the source
                                'company' // target is company (we filter companies only)
                              )}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>
              )}

              {/* Related Entities Card - for relationships not covered by Companies/Employees */}
              {/* Shows: Company→Company, Person→Person, Trust→Trust, etc. */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Related Entities
                      {relatedEntities.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{relatedEntities.length}</Badge>
                      )}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddRelatedEntity(!showAddRelatedEntity)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Relationship
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Add Relationship Form */}
                  {showAddRelatedEntity && (
                    <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Related Contact</Label>
                          <Select
                            value={newRelatedEntityContactId}
                            onValueChange={setNewRelatedEntityContactId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select contact..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableContacts.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Relationship Type</Label>
                          <Select
                            value={newRelatedEntityType}
                            onValueChange={setNewRelatedEntityType}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getValidRelationshipTypes(relationshipTypeMetadata, formData.entity_type, null).map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddRelatedEntity}
                          disabled={!newRelatedEntityContactId || !newRelatedEntityType || addingRelatedEntity}
                        >
                          {addingRelatedEntity ? "Adding..." : "Add"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAddRelatedEntity(false);
                            setNewRelatedEntityContactId("");
                            setNewRelatedEntityType("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Related Entities List */}
                  {loadingRelatedEntities ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Loading relationships...
                    </div>
                  ) : relatedEntities.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No related entities</p>
                      <p className="text-xs mt-1">
                        Add relationships like parent companies, subsidiaries, family members, or business partners
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {relatedEntities.map((rel) => (
                        <div
                          key={rel.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          {/* Entity Icon */}
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {rel.other_contact?.entity_type === 'person' ? (
                              <User className="h-5 w-5 text-primary" />
                            ) : rel.other_contact?.entity_type === 'trust' ? (
                              <Scale className="h-5 w-5 text-primary" />
                            ) : (
                              <Building2 className="h-5 w-5 text-primary" />
                            )}
                          </div>

                          {/* Entity Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/contacts/${rel.other_contact?.id}`} className="text-sm font-medium hover:underline">
                                {rel.other_contact?.name || 'Unknown'}
                              </Link>
                              <Badge variant="outline" className="text-xs">
                                {rel.other_contact?.entity_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {rel.direction === 'outgoing' ? '→' : '←'} {rel.relationship_type_label || rel.relationship_type.replace(/_/g, ' ')}
                              </Badge>
                              {rel.ownership_percentage && (
                                <span className="text-xs text-muted-foreground">
                                  {rel.ownership_percentage}%
                                </span>
                              )}
                            </div>
                            {rel.other_contact?.email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Mail className="h-3 w-3" />
                                {rel.other_contact.email}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRelatedEntity(rel.id, rel.source_contact_id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Link href={`/contacts/${rel.other_contact?.id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Business & Tax Card - Hide for people with primary company */}
              {!(canHaveEmployer(formData.entity_type) && contact.primary_company) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Business & Tax
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax_number">
                        {isPerson(formData.entity_type) ? 'ABN (Sole Trader)' : 'ABN / Tax Number'}
                      </Label>
                      <Input
                        id="tax_number"
                        value={formData.tax_number}
                        onChange={(e) => {
                          handleInputChange("tax_number", e.target.value);
                          // Clear error on change
                          setFieldErrors(prev => ({ ...prev, tax_number: '' }));
                        }}
                        onBlur={() => {
                          // Validate and format ABN
                          const validation = validateABN(formData.tax_number);
                          if (!validation.isValid) {
                            setFieldErrors(prev => ({ ...prev, tax_number: validation.error || 'Invalid ABN' }));
                          } else {
                            // Format the ABN
                            const formatted = formatABN(formData.tax_number);
                            if (formatted !== formData.tax_number) {
                              handleInputChange("tax_number", formatted);
                            }
                            setFieldErrors(prev => ({ ...prev, tax_number: '' }));
                          }
                          handleAutoSave();
                        }}
                        placeholder="XX XXX XXX XXX"
                        className={cn(fieldErrors.tax_number && 'border-red-500 focus-visible:ring-red-500')}
                      />
                      {fieldErrors.tax_number && (
                        <p className="text-xs text-red-500">{fieldErrors.tax_number}</p>
                      )}
                      {isPerson(formData.entity_type) && !fieldErrors.tax_number && (
                        <p className="text-xs text-muted-foreground">For sole traders/contractors only. ACN is company-only.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div><Label>Sync with Xero</Label><p className="text-xs text-muted-foreground">Keep synced with Xero</p></div>
                      <Switch checked={formData.sync_with_xero} onCheckedChange={(c) => { handleInputChange("sync_with_xero", c); handleAutoSave(); }} />
                    </div>
                    {contact.linked_company && (
                      <Link href={`/corporate/companies/${contact.linked_company.id}`}>
                        <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-4 w-4 mr-2" />View Corporate Record</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notes Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} onBlur={handleAutoSave} placeholder="Internal notes..." rows={4} />
                </CardContent>
              </Card>

              {/* Contact Persons (read-only) */}
              {contact.contact_persons && contact.contact_persons.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contact Persons
                      <Badge variant="secondary" className="ml-2">{contact.contact_persons.length}</Badge>
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.contact_persons.map((person) => (
                        <div key={person.id} className={cn("flex items-center justify-between p-3 rounded-lg border", person.is_primary && "bg-primary/5 border-primary/20")}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                            <div>
                              <p className="text-sm font-medium">{person.first_name} {person.last_name}{person.is_primary && <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>}</p>
                              <p className="text-xs text-muted-foreground">{person.email} {person.mobile && `| ${person.mobile}`}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OLD: Contact Information - keep groups/LGAs display */}
              {(contact.contact_groups && contact.contact_groups.length > 0) && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Groups</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.contact_groups.map((group) => (<Badge key={group.id} variant="secondary">{group.name}</Badge>))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {contact.lgas && contact.lgas.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Service Areas (LGAs)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.lgas.map((lga, idx) => (<Badge key={idx} variant="outline">{lga}</Badge>))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar Column - REMOVED old contact info cards, keep only stats/system */}
            <div className="space-y-6">
              {hasChanges && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="pt-6">
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                      {saving ? <Spinner2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-lg">Quick Stats</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Jobs</span>
                    <span className="text-lg font-semibold">{contact.jobs_count || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Purchase Orders</span>
                    <span className="text-lg font-semibold">{contact.purchase_orders_count || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Quotes</span>
                    <span className="text-lg font-semibold">{contact.quotes_count || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">System Info</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{contact.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(contact.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{new Date(contact.updated_at).toLocaleDateString()}</span>
                  </div>
                  {contact.xero_contact_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Xero ID</span>
                      <span className="font-mono text-xs truncate max-w-[120px]">{contact.xero_contact_id.slice(0, 8)}...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Corporate Tab - Identity and Summary with nested sub-tabs */}
        <TabsContent value="corporate" className="mt-6">
          <Tabs value={activeSubTab} onValueChange={handleCorporateSubTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="identity">
                <IdCard className="h-3.5 w-3.5 mr-1" />
                Identity
              </TabsTrigger>
              <TabsTrigger value="summary">
                <Table className="h-3.5 w-3.5 mr-1" />
                Summary
                {(directorships.length > 0 || shareholdings.length > 0 || (trustRoles && trustRoles.total_count > 0) || memberships.length > 0) && (
                  <Badge variant="secondary" className="ml-1.5">
                    {directorships.length + shareholdings.length + (trustRoles?.total_count || 0) + memberships.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="structure">
                <Network className="h-3.5 w-3.5 mr-1" />
                Structure
              </TabsTrigger>
            </TabsList>

            {/* Identity Sub-Tab */}
            <TabsContent value="identity" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Identity Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IdCard className="h-5 w-5" />
                      Identity Information
                      {!contact.can_view_confidential && (
                        <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Date of Birth */}
                      <div>
                        <p className="text-xs text-muted-foreground">Date of Birth</p>
                        <p className="text-sm font-medium">
                          {contact.date_of_birth === "[RESTRICTED]" ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Restricted
                            </span>
                          ) : contact.date_of_birth ? (
                            new Date(contact.date_of_birth).toLocaleDateString()
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </p>
                      </div>

                      {/* Place of Birth */}
                      <div>
                        <p className="text-xs text-muted-foreground">Place of Birth</p>
                        <p className="text-sm font-medium">
                          {contact.place_of_birth === "[RESTRICTED]" ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Restricted
                            </span>
                          ) : contact.place_of_birth ? (
                            `${contact.place_of_birth}${contact.birth_state ? `, ${contact.birth_state}` : ""}${contact.birth_country ? `, ${contact.birth_country}` : ""}`
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </p>
                      </div>

                      {/* Director ID (DIN) */}
                      <div>
                        <p className="text-xs text-muted-foreground">Director ID (DIN)</p>
                        <p className="text-sm font-medium font-mono">
                          {contact.director_id || <span className="text-muted-foreground">Not set</span>}
                        </p>
                      </div>

                      {/* TFN */}
                      <div>
                        <p className="text-xs text-muted-foreground">Tax File Number</p>
                        <p className="text-sm font-medium font-mono">
                          {contact.tax_number === "[RESTRICTED]" ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Restricted
                            </span>
                          ) : contact.tax_number ? (
                            contact.tax_number
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Passport */}
                    <div>
                      <p className="text-xs text-muted-foreground">Passport Number</p>
                      <p className="text-sm font-medium font-mono">
                        {contact.passport_number === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.passport_number ? (
                          contact.passport_number
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>

                    {/* Drivers Licence */}
                    <div>
                      <p className="text-xs text-muted-foreground">Drivers Licence</p>
                      <p className="text-sm font-medium font-mono">
                        {contact.drivers_licence === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.drivers_licence ? (
                          contact.drivers_licence
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Residential Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Residential Address
                      {!contact.can_view_confidential && (
                        <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contact.residential_address === "[RESTRICTED]" ? (
                      <div className="text-amber-600 flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span>Restricted - You don&apos;t have permission to view this field</span>
                      </div>
                    ) : contact.residential_address ? (
                      <p className="text-sm whitespace-pre-line">{contact.residential_address}</p>
                    ) : (
                      <p className="text-muted-foreground text-sm">No residential address on file</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Summary Sub-Tab - All corporate roles in one view */}
            <TabsContent value="summary" className="mt-4">
              {(loadingDirectorships || loadingShareholdings || loadingTrustRoles || loadingMemberships) ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                      <Spinner />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Directorships Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-green-600" />
                        Directorships ({directorships.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {directorships.length > 0 ? (
                        <TeeemTableView
                          entries={directorships.map(d => ({
                            id: d.id,
                            company_id: d.company_id,
                            company_name: d.company_name,
                            position: d.formatted_position || d.position,
                            company_group: d.company_group_name || "-",
                            status: d.is_current ? "Current" : "Former",
                            appointed: d.appointment_date ? new Date(d.appointment_date).toLocaleDateString() : "-",
                            resigned: d.resignation_date ? new Date(d.resignation_date).toLocaleDateString() : "-",
                          }))}
                          columns={[
                            { key: "company_name", label: "Company", column_type: "text" },
                            { key: "position", label: "Position", column_type: "text" },
                            { key: "company_group", label: "Group", column_type: "text" },
                            { key: "status", label: "Status", column_type: "text" },
                            { key: "appointed", label: "Appointed", column_type: "text" },
                            { key: "resigned", label: "Resigned", column_type: "text" },
                          ] as TableColumn[]}
                          tableName="Directorships"
                          viewOnly={true}
                          onRowClick={(row) => router.push(`/corporate/companies/${row.company_id}`)}
                          customCellRenderer={(entry, columnKey) => {
                            if (columnKey === "status") {
                              const status = entry.status as string;
                              return (
                                <Badge className={status === "Current" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                  {status}
                                </Badge>
                              );
                            }
                            return null;
                          }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No directorships found.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Shareholdings Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Percent className="h-5 w-5 text-blue-600" />
                        Shareholdings ({shareholdings.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {shareholdings.length > 0 ? (
                        <TeeemTableView
                          entries={shareholdings.map(sh => ({
                            id: sh.id,
                            company_id: sh.company_id,
                            company_name: sh.company_name,
                            share_class: sh.share_class || "Ordinary",
                            shares: sh.number_of_shares?.toLocaleString() || "-",
                            percentage: sh.percentage_of_total != null ? `${sh.percentage_of_total.toFixed(1)}%` : "-",
                            company_group: sh.company_group_name || "-",
                            status: !sh.disposal_date ? "Current" : "Disposed",
                            acquired: sh.acquisition_date ? new Date(sh.acquisition_date).toLocaleDateString() : "-",
                          }))}
                          columns={[
                            { key: "company_name", label: "Company", column_type: "text" },
                            { key: "share_class", label: "Class", column_type: "text" },
                            { key: "shares", label: "Shares", column_type: "text" },
                            { key: "percentage", label: "%", column_type: "text" },
                            { key: "company_group", label: "Group", column_type: "text" },
                            { key: "status", label: "Status", column_type: "text" },
                            { key: "acquired", label: "Acquired", column_type: "text" },
                          ] as TableColumn[]}
                          tableName="Shareholdings"
                          viewOnly={true}
                          onRowClick={(row) => router.push(`/corporate/companies/${row.company_id}`)}
                          customCellRenderer={(entry, columnKey) => {
                            if (columnKey === "status") {
                              const status = entry.status as string;
                              return (
                                <Badge className={status === "Current" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                                  {status}
                                </Badge>
                              );
                            }
                            return null;
                          }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No shareholdings found.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Company Bank Accounts - SSoT: Read-only view of linked company's bank accounts */}
                  {contact.linked_company && contact.linked_company.bank_accounts && contact.linked_company.bank_accounts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Landmark className="h-5 w-5 text-emerald-600" />
                          Company Bank Accounts ({contact.linked_company.bank_accounts.length})
                          <Link
                            href={`/corporate/companies/${contact.linked_company.id}?subtab=bank-accounts`}
                            className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            Edit in Corporate <ExternalLink className="h-3 w-3" />
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Bank</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium">BSB</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Account</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Name</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Xero</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {contact.linked_company.bank_accounts.filter(ba => ba.status === "active").map((account) => (
                                <tr key={account.id} className="hover:bg-muted/30">
                                  <td className="px-4 py-2 font-medium">{account.institution_name}</td>
                                  <td className="px-4 py-2 font-mono">{account.formatted_bsb || account.bsb || "-"}</td>
                                  <td className="px-4 py-2 font-mono">****{account.account_number.slice(-4)}</td>
                                  <td className="px-4 py-2">{account.account_name || "-"}</td>
                                  <td className="px-4 py-2">
                                    {account.linked_to_xero ? (
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Linked
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Trust Roles Table */}
                  {trustRoles && trustRoles.total_count > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-purple-600" />
                          Trust Roles ({trustRoles.total_count})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TeeemTableView
                          entries={[
                            ...trustRoles.trustee_roles.map(r => ({
                              id: r.id,
                              trust_id: r.trust_id,
                              trust_name: r.trust_name,
                              role: "Trustee",
                              entitlement: "-",
                              status: r.is_active ? "Active" : "Inactive",
                              since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
                            })),
                            ...trustRoles.beneficiary_roles.map(r => ({
                              id: r.id,
                              trust_id: r.trust_id,
                              trust_name: r.trust_name,
                              role: "Beneficiary",
                              entitlement: r.ownership_percentage != null ? `${r.ownership_percentage.toFixed(1)}%` : "-",
                              status: r.is_active ? "Active" : "Inactive",
                              since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
                            })),
                            ...trustRoles.appointor_roles.map(r => ({
                              id: r.id,
                              trust_id: r.trust_id,
                              trust_name: r.trust_name,
                              role: "Appointor",
                              entitlement: "-",
                              status: r.is_active ? "Active" : "Inactive",
                              since: r.start_date ? new Date(r.start_date).toLocaleDateString() : "-",
                            })),
                          ]}
                          columns={[
                            { key: "trust_name", label: "Trust", column_type: "text" },
                            { key: "role", label: "Role", column_type: "text" },
                            { key: "entitlement", label: "Entitlement", column_type: "text" },
                            { key: "status", label: "Status", column_type: "text" },
                            { key: "since", label: "Since", column_type: "text" },
                          ] as TableColumn[]}
                          tableName="Trust Roles"
                          viewOnly={true}
                          onRowClick={(row) => router.push(`/corporate/companies/${row.trust_id}`)}
                          customCellRenderer={(entry, columnKey) => {
                            if (columnKey === "role") {
                              const role = entry.role as string;
                              const colorClass = role === "Trustee"
                                ? "bg-purple-100 text-purple-700"
                                : role === "Beneficiary"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700";
                              return <Badge className={colorClass}>{role}</Badge>;
                            }
                            if (columnKey === "status") {
                              const status = entry.status as string;
                              return (
                                <Badge className={status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                  {status}
                                </Badge>
                              );
                            }
                            return null;
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Company Groups Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                        Company Groups ({memberships.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {memberships.length > 0 ? (
                        <TeeemTableView
                          entries={memberships.map(m => ({
                            id: m.id,
                            company_group_id: m.company_group_id,
                            company_group_name: m.company_group_name,
                            membership_type: m.membership_type,
                            company_name: m.company_name || "-",
                            can_view: m.can_view_confidential ? "Yes" : "No",
                            can_edit: m.can_edit ? "Yes" : "No",
                            status: m.is_active ? "Active" : "Inactive",
                          }))}
                          columns={[
                            { key: "company_group_name", label: "Group", column_type: "text" },
                            { key: "membership_type", label: "Type", column_type: "text" },
                            { key: "company_name", label: "Via Company", column_type: "text" },
                            { key: "can_view", label: "View Confidential", column_type: "text" },
                            { key: "can_edit", label: "Can Edit", column_type: "text" },
                            { key: "status", label: "Status", column_type: "text" },
                          ] as TableColumn[]}
                          tableName="Company Groups"
                          viewOnly={true}
                          customCellRenderer={(entry, columnKey) => {
                            if (columnKey === "membership_type") {
                              const type = entry.membership_type as string;
                              const colorClass = type === "director"
                                ? "bg-purple-100 text-purple-700"
                                : type === "shareholder"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600";
                              return <Badge className={colorClass}>{type}</Badge>;
                            }
                            if (columnKey === "status") {
                              const status = entry.status as string;
                              return (
                                <Badge className={status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                  {status}
                                </Badge>
                              );
                            }
                            return null;
                          }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-4">Not a member of any company groups.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Structure Sub-Tab - Corporate Structure Visualization */}
            <TabsContent value="structure" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Network className="h-5 w-5 text-indigo-600" />
                    Corporate Structure
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Visual representation of all company relationships for this person
                  </p>
                </CardHeader>
                <CardContent>
                  {loadingOwnershipChain || loadingDirectorships ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner />
                    </div>
                  ) : ownershipChain.length > 0 || directorships.length > 0 ? (
                    <PersonStructureChart
                      personName={contact.display_name}
                      personEmail={contact.email}
                      ownershipChain={ownershipChain}
                      directorRoles={directorships.map(d => ({
                        company_id: d.company_id,
                        company_name: d.company_name,
                        position: d.formatted_position || d.position,
                        is_current: d.is_current,
                      }))}
                      onCompanyClick={(companyId) => router.push(`/corporate/companies/${companyId}`)}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No corporate structure data available</p>
                      <p className="text-sm mt-1">This contact has no shareholdings or directorships</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Documents linked to this contact will be shown here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab with nested sub-tabs (Bank Details, Xero, Bills, Jobs, Purchase Orders) */}
        <TabsContent value="financial" className="mt-6">
          <Tabs value={activeFinancialSubTab} onValueChange={handleFinancialSubTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="bank">
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Bank Details
              </TabsTrigger>
              <TabsTrigger value="xero">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Xero
              </TabsTrigger>
              {contact["is_supplier?"] && (
                <TabsTrigger value="bills">
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Bills
                </TabsTrigger>
              )}
              <TabsTrigger value="jobs">
                <Briefcase className="h-3.5 w-3.5 mr-1" />
                Jobs
              </TabsTrigger>
              {contact["is_supplier?"] && (
                <TabsTrigger value="purchase-orders">
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Purchase Orders
                </TabsTrigger>
              )}
            </TabsList>

            {/* Bank Details Sub-Tab */}
            <TabsContent value="bank" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bank Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Bank Details
                      {!contact.can_view_confidential && (
                        <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">BSB</p>
                      <p className="text-sm font-medium font-mono">
                        {contact.bank_bsb === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.bank_bsb ? (
                          contact.bank_bsb
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Account Number</p>
                      <p className="text-sm font-medium font-mono">
                        {contact.bank_account_number === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.bank_account_number ? (
                          contact.bank_account_number
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Account Name</p>
                      <p className="text-sm font-medium">
                        {contact.bank_account_name === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.bank_account_name ? (
                          contact.bank_account_name
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Tax Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Tax Information
                      {!contact.can_view_confidential && (
                        <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">ABN / TFN</p>
                      <p className="text-sm font-medium font-mono">
                        {contact.tax_number === "[RESTRICTED]" ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : contact.tax_number ? (
                          formatABN(contact.tax_number)
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    </div>

                    {/* ABN Verification Status */}
                    {contact.tax_number && contact.tax_number !== "[RESTRICTED]" && contact.tax_number.replace(/\D/g, "").length === 11 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">ABN Verification</p>
                          {contact.abn_valid ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : contact.abn_valid === false ? (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Not Verified
                            </Badge>
                          )}
                        </div>
                        {contact.abn_entity_name && (
                          <div className="text-sm">
                            <p className="font-medium">{contact.abn_entity_name}</p>
                            {contact.abn_entity_type && (
                              <p className="text-xs text-muted-foreground">{contact.abn_entity_type}</p>
                            )}
                          </div>
                        )}
                        {contact.abn_gst_registered && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            GST Registered
                          </p>
                        )}
                        {contact.abn_verified_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Verified: {new Date(contact.abn_verified_at).toLocaleDateString("en-AU")}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary and Payment Terms Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Financial Summary */}
                {(contact["is_supplier?"] || contact["is_customer?"]) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Financial Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {contact["is_customer?"] && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Accounts Receivable:</span>
                            <span className="text-sm font-medium">
                              {contact.accounts_receivable_outstanding != null
                                ? `$${contact.accounts_receivable_outstanding.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "-"}
                            </span>
                          </div>
                          {contact.accounts_receivable_overdue != null && contact.accounts_receivable_overdue > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">AR Overdue:</span>
                              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                ${contact.accounts_receivable_overdue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {contact["is_supplier?"] && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Accounts Payable:</span>
                            <span className="text-sm font-medium">
                              {contact.accounts_payable_outstanding != null
                                ? `$${contact.accounts_payable_outstanding.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "-"}
                            </span>
                          </div>
                          {contact.accounts_payable_overdue != null && contact.accounts_payable_overdue > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">AP Overdue:</span>
                              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                ${contact.accounts_payable_overdue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Payment Terms */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Payment Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contact["is_supplier?"] && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Bill Payment Terms</p>
                        <p className="text-sm font-medium">
                          {contact.bill_due_day && contact.bill_due_type
                            ? `${contact.bill_due_day} days (${contact.bill_due_type})`
                            : "-"}
                        </p>
                      </div>
                    )}
                    {contact["is_customer?"] && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sales Payment Terms</p>
                        <p className="text-sm font-medium">
                          {contact.sales_due_day && contact.sales_due_type
                            ? `${contact.sales_due_day} days (${contact.sales_due_type})`
                            : "-"}
                        </p>
                      </div>
                    )}
                    {contact.default_discount != null && contact.default_discount > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Default Discount</p>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          {contact.default_discount}%
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Xero Sub-Tab */}
            <TabsContent value="xero" className="mt-4">
              <div className="space-y-6">
                <PendingXeroReviewPanel />
                <XeroSyncSection
                  contact={contact}
                  onContactUpdate={(updatedContact) => setContact(updatedContact as Contact)}
                />
                <XeroTransactionsSection
                  contactId={contact.id}
                  xeroLink={null}
                  onViewInvoiceDetail={(invoiceId) => {
                    setSelectedInvoiceId(invoiceId);
                    setShowInvoiceDetail(true);
                  }}
                />
              </div>
            </TabsContent>

            {/* Bills Sub-Tab */}
            {contact["is_supplier?"] && (
              <TabsContent value="bills" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Bills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <XeroInvoicesListByTenant
                      contactId={contact.id}
                      type="ACCPAY"
                      onViewInvoiceDetail={handleViewInvoiceDetail}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Jobs Sub-Tab */}
            <TabsContent value="jobs" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  {(contact as any).related_jobs && (contact as any).related_jobs.length > 0 ? (
                    <div className="space-y-3">
                      {(contact as any).related_jobs.map((job: any) => (
                        <div key={job.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {job.title || `Job #${job.id}`}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {job.status && (
                            <Badge variant="secondary" className="mt-2">
                              {job.status}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No jobs associated with this contact.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Purchase Orders Sub-Tab */}
            {contact["is_supplier?"] && (
              <TabsContent value="purchase-orders" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(contact as any).purchase_orders && (contact as any).purchase_orders.length > 0 ? (
                      <div className="space-y-3">
                        {(contact as any).purchase_orders.map((po: any) => (
                          <div key={po.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold">PO #{po.po_number || po.id}</div>
                                {po.job_title && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    Job: {po.job_title}
                                  </div>
                                )}
                                {po.total && (
                                  <div className="text-sm font-medium mt-2">
                                    Total: ${po.total.toLocaleString()}
                                  </div>
                                )}
                              </div>
                              {po.status && (
                                <Badge variant="secondary">{po.status}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No purchase orders for this supplier.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="coms" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                Communication history will be shown here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Case Involvement History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCaseRelationships ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : caseRelationships && caseRelationships.length > 0 ? (
                <div className="space-y-4">
                  {caseRelationships.map((rel: CaseRelationship) => (
                    <div key={rel.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Link
                            href={`/cases/${rel.case_id}`}
                            className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {rel.case_number}: {rel.case_title}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <div className="mt-2 space-y-1 text-sm">
                            {rel.relationship_type && (
                              <div>
                                <strong>Relationship:</strong> {rel.formatted_relationship_type || rel.relationship_type}
                              </div>
                            )}
                            {rel.alignment && (
                              <div className="flex items-center gap-2">
                                <strong>Alignment:</strong>
                                <Badge
                                  variant={
                                    rel.alignment === 'friendly' ? 'default' :
                                    rel.alignment === 'opposing' ? 'destructive' :
                                    'secondary'
                                  }
                                >
                                  {rel.alignment}
                                </Badge>
                              </div>
                            )}
                            {rel.role && (
                              <div><strong>Role:</strong> {rel.role}</div>
                            )}
                            {rel.reason && (
                              <div>
                                <strong>Reason:</strong> {rel.reason}
                              </div>
                            )}
                            {rel.notes && (
                              <div className="text-muted-foreground">
                                <strong>Notes:</strong> {rel.notes}
                              </div>
                            )}
                            {rel.is_primary && (
                              <Badge variant="outline" className="mt-1">Primary Contact</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {rel.added_at && (
                            <>
                              Added {new Date(rel.added_at).toLocaleDateString()}<br/>
                              {rel.added_by && `by ${rel.added_by}`}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  This contact has not been linked to any cases yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab - Using TeeemTableView */}
        <TabsContent value="emails" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span className="font-medium">Emails</span>
              {emailsPagination && (
                <Badge variant="secondary">{emailsPagination.total}</Badge>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showAllInThread}
                onChange={(e) => setShowAllInThread(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show all in thread
            </label>
          </div>
          {loadingEmails ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : emails.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No emails found for {contact.email}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <TeeemTableView
                tableName="Contact Emails"
                preloadedViews={[]}
                columns={[
                  {
                    key: "direction",
                    label: "Direction",
                    column_type: "choice",
                    width: 80,
                    choices: ["From", "To", "CC"],
                    filterable: true,
                  },
                  {
                    key: "subject",
                    label: "Subject",
                    column_type: "text",
                    width: 350,
                    filterable: true,
                  },
                  {
                    key: "from_or_to",
                    label: "From/To",
                    column_type: "text",
                    width: 250,
                    filterable: true,
                  },
                  {
                    key: "received_at",
                    label: "Date",
                    column_type: "date_and_time",
                    width: 150,
                    sortable: true,
                  },
                  {
                    key: "attachments",
                    label: "Files",
                    column_type: "whole_number",
                    width: 70,
                    filterable: true,
                  },
                ]}
                entries={emails.map((email) => {
                  const contactEmailLower = contact.email?.toLowerCase() || "";
                  const isFrom = email.from_email?.toLowerCase() === contactEmailLower;
                  const isCc = email.cc_emails?.some(e => e.toLowerCase() === contactEmailLower);
                  return {
                    id: email.id,
                    direction: isFrom ? "From" : isCc ? "CC" : "To",
                    subject: email.subject || "(no subject)",
                    from_or_to: isFrom
                      ? email.to_emails?.join(", ") || "-"
                      : email.display_from || email.from_email,
                    received_at: email.received_at,
                    attachments: email.has_attachments ? (email.attachment_count || 1) : 0,
                    // Include original email fields for Email to Contacts extraction feature
                    from_email: email.from_email,
                    to_emails: email.to_emails,
                    cc_emails: email.cc_emails,
                  };
                })}
                viewOnly={true}
              />
              {/* Pagination */}
              {emailsPagination && emailsPagination.total_pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emailsPage === 1}
                    onClick={() => loadEmails(emailsPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {emailsPage} of {emailsPagination.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emailsPage >= emailsPagination.total_pages}
                    onClick={() => loadEmails(emailsPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Price Book Tab */}
        <TabsContent value="pricebook" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                Supplier price book and pricing history will be shown here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        {contact["is_customer?"] && (
          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <XeroInvoicesListByTenant
                  contactId={contact.id}
                  type="ACCREC"
                  onViewInvoiceDetail={handleViewInvoiceDetail}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Portal Access Tab */}
        <TabsContent value="portal" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                Portal user access settings will be shown here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Directorships Tab */}
        <TabsContent value="directorships" className="mt-6">
          <div className="space-y-6">
            {/* Current Directorships */}
            {directorships.filter(d => d.is_current).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Current Directorships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {directorships
                      .filter(d => d.is_current)
                      .sort((a, b) => new Date(b.appointment_date || 0).getTime() - new Date(a.appointment_date || 0).getTime())
                      .map((dir) => (
                        <div key={dir.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/corporate/companies/${dir.company_id}`}
                                className="text-lg font-semibold hover:underline flex items-center gap-2"
                              >
                                <Building2 className="h-4 w-4" />
                                {dir.company_name}
                              </Link>
                              <Badge variant="default" className="bg-green-600">
                                Current
                              </Badge>
                              <Badge variant="outline">
                                {dir.formatted_position}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              {dir.company_acn && (
                                <div>
                                  <span className="font-medium">ACN:</span> {dir.company_acn}
                                </div>
                              )}
                              {dir.company_abn && (
                                <div>
                                  <span className="font-medium">ABN:</span> {dir.company_abn}
                                </div>
                              )}
                              {dir.appointment_date && (
                                <div>
                                  <span className="font-medium">Appointed:</span>{" "}
                                  {new Date(dir.appointment_date).toLocaleDateString()}
                                </div>
                              )}
                              {dir.company_group_name && (
                                <div>
                                  <span className="font-medium">Group:</span> {dir.company_group_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historical Directorships */}
            {directorships.filter(d => !d.is_current).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Historical Directorships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {directorships
                      .filter(d => !d.is_current)
                      .sort((a, b) => new Date(b.resignation_date || b.appointment_date || 0).getTime() - new Date(a.resignation_date || a.appointment_date || 0).getTime())
                      .map((dir) => (
                        <div key={dir.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/corporate/companies/${dir.company_id}`}
                                className="text-lg font-semibold hover:underline flex items-center gap-2 text-muted-foreground"
                              >
                                <Building2 className="h-4 w-4" />
                                {dir.company_name}
                              </Link>
                              <Badge variant="secondary">
                                Historical
                              </Badge>
                              <Badge variant="outline">
                                {dir.formatted_position}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              {dir.company_acn && (
                                <div>
                                  <span className="font-medium">ACN:</span> {dir.company_acn}
                                </div>
                              )}
                              {dir.company_abn && (
                                <div>
                                  <span className="font-medium">ABN:</span> {dir.company_abn}
                                </div>
                              )}
                              {dir.appointment_date && (
                                <div>
                                  <span className="font-medium">Appointed:</span>{" "}
                                  {new Date(dir.appointment_date).toLocaleDateString()}
                                </div>
                              )}
                              {dir.resignation_date && (
                                <div>
                                  <span className="font-medium">Resigned:</span>{" "}
                                  {new Date(dir.resignation_date).toLocaleDateString()}
                                </div>
                              )}
                              {dir.company_group_name && (
                                <div className="col-span-2">
                                  <span className="font-medium">Group:</span> {dir.company_group_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingDirectorships && (
              <div className="flex items-center justify-center py-8">
                <Spinner2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loadingDirectorships && directorships.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center py-8">
                    No directorships found for this contact.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Xero Invoice Detail Modal */}
        <XeroInvoiceDetailModal
          isOpen={showInvoiceDetail}
          onClose={() => {
            setShowInvoiceDetail(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
        />

      </Tabs>

      {/* Edit Modal */}
      <ContactEditModal
        contact={contact}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSaved={loadContact}
      />
    </div>
  );
}
