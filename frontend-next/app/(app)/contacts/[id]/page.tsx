"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSetAtom } from "jotai";
import Link from "next/link";
import { currentFiltersAtom, currentFilterGroupsAtom, foundationViewsAtom, activeViewIdAtom } from "@/lib/view-state-atoms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ContactEditModal } from "@/components/contacts/ContactEditModal";
import { XeroSyncSection } from "@/components/contacts/XeroSyncSection";
import { XeroTransactionsSection } from "@/components/contacts/XeroTransactionsSection";
import { XeroInvoiceDetailModal } from "@/components/contacts/XeroInvoiceDetailModal";
import { XeroInvoicesList } from "@/components/contacts/XeroInvoicesList";
import TeeemTableView from "@/components/table/TeeemTableView";
import { type TableColumn } from "@/components/table/types";
import PersonStructureChart from "@/components/corporate/PersonStructureChart";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";

// Helper function to format ABN as XX XXX XXX XXX
const formatABN = (abn: string | null) => {
  if (!abn) return "";
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return abn;
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
  full_name: string;
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
  xero_contact_id: string | null;
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
    full_name: string;
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
  // SSoT permission indicator
  can_view_confidential?: boolean;
  // SSoT: Linked company data for company-type contacts
  linked_company?: LinkedCompany;
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
  full_name: string;
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
  role_in_relationship?: string | null;
  ownership_percentage?: number | null;
  context?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
}

// API response for relationships
interface RelationshipsResponse {
  success: boolean;
  relationships: {
    outgoing: ContactRelationship[];
    incoming: ContactRelationship[];
  };
}

// Relationship types available for company relationships
const COMPANY_RELATIONSHIP_TYPES: Option[] = [
  { value: "employee_of", label: "Employee" },
  { value: "contractor_for", label: "Contractor" },
  { value: "director_of", label: "Director" },
  { value: "shareholder_of", label: "Shareholder" },
  { value: "authorized_signatory_of", label: "Authorized Signatory" },
  { value: "beneficial_owner_of", label: "Beneficial Owner" },
  { value: "partner_in", label: "Partner" },
];

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<CompanyGroupMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [enrichingFromWeb, setEnrichingFromWeb] = useState(false);


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
    full_name: "",
    email: "",
    mobile_phone: "",
    office_phone: "",
    website: "",
    tax_number: "",
    address: "",
    notes: "",
    is_active: true,
    is_family_member: false,
    entity_type: "person",
    sync_with_xero: false,
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Company multi-select state (for person contacts)
  const [availableCompanies, setAvailableCompanies] = useState<Option[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Option[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Track roles for each company (companyId -> roleTypes[])
  const [companyRoles, setCompanyRoles] = useState<Record<string, string[]>>({});

  // Employee multi-select state (for company contacts)
  const [availablePeople, setAvailablePeople] = useState<Option[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Option[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // Track roles for each employee (employeeId -> roleTypes[])
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, string[]>>({});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [id]);

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

  // Load memberships when contact loads
  useEffect(() => {
    if (contact?.id) {
      loadMemberships();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only watching contact?.id
  }, [contact?.id]);

  // Fetch all companies for multi-select dropdown
  useEffect(() => {
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
          label: c.full_name || c.first_name || "Unknown Company",
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
  }, []);

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
          label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || "Unknown Person",
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
        label: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || "Unknown Person",
      }));
      console.log('[Employee useEffect] Setting selectedEmployees to:', selected);
      setSelectedEmployees(selected);

      // Fetch roles for each employee by getting their relationships to this company
      const fetchEmployeeRoles = async () => {
        if (!contact?.id) return;
        try {
          const response = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
          const incoming = response.relationships?.incoming || [];

          // Group relationships by employee ID and collect role types
          const rolesMap: Record<string, string[]> = {};
          incoming.forEach((rel: ContactRelationship) => {
            const employeeId = rel.source_contact_id.toString();
            if (!rolesMap[employeeId]) {
              rolesMap[employeeId] = [];
            }
            // Only include company-related roles
            if (['employee_of', 'director_of', 'shareholder_of', 'contractor_for', 'partner_in',
                 'authorized_signatory_of', 'beneficial_owner_of'].includes(rel.relationship_type)) {
              rolesMap[employeeId].push(rel.relationship_type);
            }
          });

          setEmployeeRoles(rolesMap);
        } catch (err) {
          console.error('Failed to fetch employee roles:', err);
        }
      };
      fetchEmployeeRoles();
    } else {
      console.log('[Employee useEffect] No employees found on contact');
      setEmployeeRoles({});
    }
  }, [contact?.employees, contact?.id]);

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
    } catch (err) {
      console.error("Failed to load contact:", err);
      setError("Failed to load contact");
    } finally {
      setLoading(false);
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
    try {
      setLoadingMemberships(true);
      const response = await api.get<{ success: boolean; data: CompanyGroupMembership[] }>(
        `/api/v1/contacts/${contact?.id}/company_group_memberships`
      );
      setMemberships(response.data || []);
    } catch (err) {
      console.error("Failed to load memberships:", err);
      setMemberships([]);
    } finally {
      setLoadingMemberships(false);
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
        full_name: contact.full_name || "",
        email: contact.email || "",
        mobile_phone: contact.mobile_phone || "",
        office_phone: contact.office_phone || "",
        website: contact.website || "",
        tax_number: contact.tax_number || "",
        address: contact.address || "",
        notes: contact.notes || "",
        is_active: contact.is_active ?? true,
        is_family_member: contact.is_family_member ?? false,
        entity_type: contact.entity_type || "person",
        sync_with_xero: contact.sync_with_xero ?? false,
      });
      setHasChanges(false);
    }
  }, [contact]);

  // Handle inline form field changes
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
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
        const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
        const relsToDelete = relationshipsResponse.relationships.outgoing.filter(
          (r) => r.target_contact_id.toString() === companyId
        );
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
      // Fetch existing relationships for this company
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${contact.id}/relationships`);
      const existingRels = relationshipsResponse.relationships.outgoing.filter(
        (r) => (r.related_contact_id || r.target_contact_id).toString() === companyId
      );

      const existingRoleTypes = existingRels.map((r) => r.relationship_type);

      // Find roles to add (in newRoles but not in existingRoleTypes)
      const rolesToAdd = newRoles.filter(role => !existingRoleTypes.includes(role));

      // Find roles to remove (in existingRoleTypes but not in newRoles)
      const rolesToRemove = existingRoleTypes.filter((role: string) => !newRoles.includes(role));

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

      // Update local state
      setCompanyRoles({
        ...companyRoles,
        [companyId]: newRoles
      });

      // Reload contact data
      await loadContact();
    } catch (err) {
      console.error("Failed to update company roles:", err);
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
        const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${personId}/relationships`);
        const rel = relationshipsResponse.relationships.outgoing.find(
          (r) => (r.related_contact_id || r.target_contact_id) === contact.id && r.relationship_type === 'employee_of'
        );
        if (rel) {
          await api.delete(`/api/v1/contacts/${personId}/relationships/${rel.id}`);
          console.log('[Employee Change] Relationship deleted successfully for:', personId);
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
      // Find and delete the employee_of relationship
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${employeeId}/relationships`);
      const rel = relationshipsResponse.relationships.outgoing.find(
        (r) => (r.related_contact_id || r.target_contact_id) === contact.id && r.relationship_type === 'employee_of'
      );

      if (rel) {
        await api.delete(`/api/v1/contacts/${employeeId}/relationships/${rel.id}`);
        await loadContact();
      }
    } catch (err) {
      console.error("Failed to remove employee:", err);
      alert("Failed to remove employee");
    }
  };

  // Handle updating roles for an employee
  const handleEmployeeRolesChange = async (employeeId: number, newRoleTypes: string[]) => {
    if (!contact) return;

    try {
      // Get current relationships for this employee to this company
      const relationshipsResponse = await api.get<RelationshipsResponse>(`/api/v1/contacts/${employeeId}/relationships`);
      const currentRels = relationshipsResponse.relationships.outgoing.filter(
        (r) => (r.related_contact_id || r.target_contact_id) === contact.id
      );

      const currentRoleTypes = currentRels.map((r) => r.relationship_type);

      // Find roles to add
      const rolesToAdd = newRoleTypes.filter((rt: string) => !currentRoleTypes.includes(rt));

      // Find roles to remove
      const rolesToRemove = currentRoleTypes.filter((rt: string) => !newRoleTypes.includes(rt));

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

      // Update local state
      const newEmployeeRoles = { ...employeeRoles };
      newEmployeeRoles[employeeId.toString()] = newRoleTypes;
      setEmployeeRoles(newEmployeeRoles);
    } catch (err) {
      console.error("Failed to update employee roles:", err);
      alert("Failed to update employee roles");
    }
  };

  // Save contact changes
  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      const full_name = [formData.first_name, formData.last_name].filter(Boolean).join(" ") || "Unknown";

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
          full_name,
          // Keep legacy fields in sync for backwards compatibility
          email: primaryEmail?.email || formData.email,
          mobile_phone: primaryMobile?.phone_number || formData.mobile_phone,
          office_phone: primaryOffice?.phone_number || formData.office_phone,
          contact_emails_attributes,
          contact_phones_attributes
        },
      });
      setHasChanges(false);
      loadContact();
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setSaving(false);
    }
  };

  // SSoT: Load tab-specific data when tab changes
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only watching activeTab and contact?.id
  }, [activeTab, contact?.id]);

  // Reload emails when showAllInThread changes
  useEffect(() => {
    if (activeTab === "emails" && contact?.email) {
      loadEmails(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only watching showAllInThread
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
        <Loader />
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
          <Button variant="ghost" onClick={() => router.push('/contacts')}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Contacts
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {contact.full_name}
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
            disabled={enrichingFromWeb || !contact?.email}
          >
            {enrichingFromWeb ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Get Info from Web
              </>
            )}
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {contact.linked_company && (
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
          <TabsTrigger value="cases">
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            Cases
            {caseRelationships.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {caseRelationships.length}
              </Badge>
            )}
          </TabsTrigger>
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
            <TabsTrigger value="bills">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Bills
            </TabsTrigger>
          )}
          {contact["is_supplier?"] && (
            <TabsTrigger value="pricebook">Price Book</TabsTrigger>
          )}
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
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
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {formData.entity_type === "person" ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input id="first_name" value={formData.first_name} onChange={(e) => handleInputChange("first_name", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="middle_name">Middle Name</Label>
                            <Input id="middle_name" value={formData.middle_name} onChange={(e) => handleInputChange("middle_name", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input id="last_name" value={formData.last_name} onChange={(e) => handleInputChange("last_name", e.target.value)} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="full_name">Name</Label>
                          <Input id="full_name" value={formData.full_name} onChange={(e) => handleInputChange("full_name", e.target.value)} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entity_type">Entity Type</Label>
                      <select id="entity_type" value={formData.entity_type} onChange={(e) => handleInputChange("entity_type", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="person">Person</option>
                        <option value="company">Company</option>
                        <option value="trust">Trust</option>
                        <option value="sole_trader">Sole Trader</option>
                      </select>
                    </div>
                    {/* Company multi-select - show for person and sole_trader entity types */}
                    {(formData.entity_type === 'person' || formData.entity_type === 'sole_trader') && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Companies</Label>
                          <MultipleSelector
                            value={selectedCompanies}
                            onChange={handleCompanyChange}
                            placeholder="Click to search companies..."
                            options={availableCompanies}
                            emptyIndicator={
                              <p className="text-center text-sm text-muted-foreground">
                                {loadingCompanies ? "Loading companies..." : "No companies found"}
                              </p>
                            }
                            disabled={loadingCompanies}
                            className="w-full"
                            hidePlaceholderWhenSelected
                          />
                          <p className="text-xs text-muted-foreground">
                            {formData.entity_type === 'sole_trader'
                              ? 'Add your own business or other companies you work with. View and edit roles in the Overview tab.'
                              : 'Add companies this person is associated with. View and edit roles in the Overview tab.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Linked Company - removed for companies (redundant to show company its own details) */}
                    {/* Employee multi-select - show for company/trust entity types */}
                    {(formData.entity_type === 'company' || formData.entity_type === 'trust') && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Employees</Label>
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
                          <p className="text-xs text-muted-foreground">Add people who work for this {formData.entity_type === 'trust' ? 'trust' : 'company'}. View and edit roles in the Overview tab.</p>
                        </div>
                      </div>
                    )}
                    {/* Primary Company - show for person entity type */}
                    {formData.entity_type === 'person' && contact.primary_company && (
                      <div className="space-y-2">
                        <Label>Primary Company (Auto-synced)</Label>
                        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact.primary_company.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Synced from employee relationships
                            </p>
                          </div>
                          <Link href={`/contacts/${contact.primary_company.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2">
                      <div><Label>Active</Label><p className="text-xs text-muted-foreground">Is this contact active?</p></div>
                      <Switch checked={formData.is_active} onCheckedChange={(c) => handleInputChange("is_active", c)} />
                    </div>
                    {formData.entity_type === "person" && (
                      <div className="flex items-center justify-between py-2">
                        <div><Label>Family Member</Label></div>
                        <Switch checked={formData.is_family_member} onCheckedChange={(c) => handleInputChange("is_family_member", c)} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Contact Details
                      {formData.entity_type === 'person' && contact.primary_company && (
                        <Badge variant="outline" className="ml-2">
                          <Building2 className="h-3 w-3 mr-1" />
                          Company Details
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Direct/Personal Contact Details Section Header */}
                    {formData.entity_type === 'person' && contact.primary_company && (
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="h-4 w-4" />
                        Direct Contact (Personal)
                      </div>
                    )}

                    {/* Emails Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{formData.entity_type === 'person' && contact.primary_company ? 'Direct Email Addresses' : 'Emails'}</Label>
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
                          .filter(e => !e._destroy)
                          .sort((a, b) => {
                            if (a.is_primary && !b.is_primary) return -1;
                            if (!a.is_primary && b.is_primary) return 1;
                            return a.position - b.position;
                          })
                          .map((email, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={email.email}
                              onChange={(e) => {
                                const updated = [...(contact.contact_emails || [])];
                                updated[index] = { ...updated[index], email: e.target.value };
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
                              }}
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
                                  is_primary: i === index
                                }));
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
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
                                  updated[index] = { ...updated[index], _destroy: true };
                                } else {
                                  updated.splice(index, 1);
                                }
                                setContact({ ...contact, contact_emails: updated });
                                setHasChanges(true);
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
                          <Label>{formData.entity_type === 'person' && contact.primary_company ? 'Direct Phone Numbers' : 'Phones'}</Label>
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
                        {formData.entity_type === 'person' && contact.primary_company && (
                          <p className="text-xs text-muted-foreground">Personal/direct line, mobile, or extension</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(contact.contact_phones || [])
                          .filter(p => !p._destroy)
                          .sort((a, b) => {
                            if (a.is_primary && !b.is_primary) return -1;
                            if (!a.is_primary && b.is_primary) return 1;
                            return a.position - b.position;
                          })
                          .map((phone, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <select
                              value={phone.phone_type}
                              onChange={(e) => {
                                const updated = [...(contact.contact_phones || [])];
                                updated[index] = { ...updated[index], phone_type: e.target.value as ContactPhone['phone_type'] };
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                              }}
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
                                updated[index] = { ...updated[index], phone_number: e.target.value };
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                              }}
                              placeholder="0400 000 000"
                              className={phone.is_primary ? 'border-primary' : ''}
                            />
                            <Button
                              type="button"
                              variant={phone.is_primary ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const updated = (contact.contact_phones || []).map((p, i) => ({
                                  ...p,
                                  is_primary: i === index
                                }));
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
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
                                  updated[index] = { ...updated[index], _destroy: true };
                                } else {
                                  updated.splice(index, 1);
                                }
                                setContact({ ...contact, contact_phones: updated });
                                setHasChanges(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Website and Address - only show if NOT part of a company */}
                    {!(formData.entity_type === 'person' && contact.primary_company) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="website">Website</Label>
                          <Input id="website" value={formData.website} onChange={(e) => handleInputChange("website", e.target.value)} placeholder="https://example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address</Label>
                          <Textarea id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} placeholder="Full address" rows={2} />
                        </div>
                      </>
                    )}

                    {/* Company Contact Details - Show when person has a primary company */}
                    {formData.entity_type === 'person' && contact.primary_company && (
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
                                <span className="font-mono">{contact.primary_company.abn}</span>
                              </div>
                            )}
                            {contact.primary_company.acn && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-xs text-muted-foreground font-medium">ACN:</span>
                                <span className="font-mono">{contact.primary_company.acn}</span>
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

              {/* Associated People Card - for company/trust entity types */}
              {(formData.entity_type === 'company' || formData.entity_type === 'trust') && contact.employees && contact.employees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      People
                      <Badge variant="secondary" className="ml-2">{contact.employees.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.employees.map((employee) => {
                        const roles = employeeRoles[employee.id.toString()] || [];
                        const roleOptions = roles.map(roleType => ({
                          value: roleType,
                          label: COMPANY_RELATIONSHIP_TYPES.find(r => r.value === roleType)?.label || roleType,
                        }));

                        return (
                          <div key={employee.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link href={`/contacts/${employee.id}`} className="text-sm font-medium hover:underline">
                                {employee.full_name}
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
                                    handleEmployeeRolesChange(employee.id, roleTypes);
                                  }}
                                  placeholder="Select roles..."
                                  options={COMPANY_RELATIONSHIP_TYPES}
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
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEmployee(employee.id)}
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
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Associated Companies Card - for person entity type */}
              {formData.entity_type === 'person' && selectedCompanies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Companies
                      <Badge variant="secondary" className="ml-2">{selectedCompanies.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedCompanies.map((company) => {
                        const roles = companyRoles[company.value] || [];
                        const roleOptions = roles.map(roleType => ({
                          value: roleType,
                          label: COMPANY_RELATIONSHIP_TYPES.find(r => r.value === roleType)?.label || roleType,
                        }));

                        return (
                          <div key={company.value} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
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
                                    handleCompanyRolesChange(company.value, roleTypes);
                                  }}
                                  placeholder="Select roles..."
                                  options={COMPANY_RELATIONSHIP_TYPES}
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
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newSelected = selectedCompanies.filter(c => c.value !== company.value);
                                  handleCompanyChange(newSelected);
                                }}
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
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Business & Tax Card - Hide for people with primary company */}
              {!(formData.entity_type === 'person' && contact.primary_company) && (
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
                        {formData.entity_type === 'person' ? 'ABN (Sole Trader)' : 'ABN / Tax Number'}
                      </Label>
                      <Input id="tax_number" value={formData.tax_number} onChange={(e) => handleInputChange("tax_number", e.target.value)} placeholder="XX XXX XXX XXX" />
                      {formData.entity_type === 'person' && (
                        <p className="text-xs text-muted-foreground">For sole traders/contractors only. ACN is company-only.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div><Label>Sync with Xero</Label><p className="text-xs text-muted-foreground">Keep synced with Xero</p></div>
                      <Switch checked={formData.sync_with_xero} onCheckedChange={(c) => handleInputChange("sync_with_xero", c)} />
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
                  <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} placeholder="Internal notes..." rows={4} />
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
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
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
                      <Loader />
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
                      <Loader />
                    </div>
                  ) : ownershipChain.length > 0 || directorships.length > 0 ? (
                    <PersonStructureChart
                      personName={contact.full_name}
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

        {/* Financial Tab with nested sub-tabs (Bank Details, Xero) */}
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
                      <p className="text-xs text-muted-foreground">Tax File Number (TFN)</p>
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Xero Sub-Tab */}
            <TabsContent value="xero" className="mt-4">
              <div className="space-y-6">
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
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <Loader />
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
                <XeroInvoicesList
                  contactId={contact.id}
                  xeroContactId={contact.xero_contact_id}
                  type="ACCREC"
                  onViewInvoiceDetail={handleViewInvoiceDetail}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Bills Tab */}
        {contact["is_supplier?"] && (
          <TabsContent value="bills" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Bills</CardTitle>
              </CardHeader>
              <CardContent>
                <XeroInvoicesList
                  contactId={contact.id}
                  xeroContactId={contact.xero_contact_id}
                  type="ACCPAY"
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
