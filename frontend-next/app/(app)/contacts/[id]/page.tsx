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
import { ContactHeader } from "./components/ContactHeader";
import {
  ContactOverviewTab,
  ContactCorporateTab,
  ContactFinancialTab,
  ContactDirectorshipsTab,
  ContactCasesTab,
  ContactEmailsTab,
} from "./components";
import type {
  Contact,
  ContactPerson,
  ContactGroup,
  ContactEmail,
  ContactPhone,
  DirectorCompany,
  AdditionalCompany,
  LinkedCompanyDirector,
  LinkedCompanyShareholder,
  LinkedCompanyBankAccount,
  LinkedCompany,
  CompanyGroupMembership,
  Directorship,
  Shareholding,
  TrustRole,
  TrustRolesData,
  OwnershipNode,
  EmailMessage,
  EmailsPagination,
  CaseRelationship,
  ContactRelationship,
  RelationshipsResponse,
  RelationshipTypeMetadata,
} from "./types";
import { formatABN, formatACN, validateABN, formatPhoneNumber, validatePhoneNumber } from "./types";
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


// Contact data from company list API
interface CompanyListContact {
  id: number;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  entity_type: string | null;
  is_team_contact?: boolean;
  primary_company?: { id: number; name: string } | null;
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
    address: "",
    notes: "",
    is_active: true,
    is_family_member: false,
    is_team_contact: false,
    entity_type: "person",
    director_id: "",
    date_of_birth: "",
    place_of_birth: "",
    birth_state: "",
    birth_country: "",
    residential_address: "",
    drivers_licence: "",
    passport_number: "",
    tax_number: "",
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

  // Fetch all companies for multi-select dropdown - load when contact is a person type
  useEffect(() => {
    // Only fetch for person entity types that can have employers, and if not already loaded
    if (!contact || availableCompanies.length > 0) return;
    if (!canHaveEmployer(contact.entity_type)) return;

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
  }, [contact?.id, contact?.entity_type, availableCompanies.length]);

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
          params: { entity_type: "person", include_companies: "true" },
        });
        const people = response.contacts || [];
        const peopleOptions: Option[] = people.map((p: CompanyListContact) => {
          let label = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.display_name || "Unknown Person";
          // For team contacts, append company name to differentiate (e.g., "Accounts Team - Buildcraft")
          if (p.is_team_contact && p.primary_company?.name) {
            label = `${label} - ${p.primary_company.name}`;
          }
          return {
            value: p.id.toString(),
            label,
          };
        });
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
        address: contact.address || "",
        notes: contact.notes || "",
        is_active: contact.is_active ?? true,
        is_family_member: contact.is_family_member ?? false,
        is_team_contact: contact.is_team_contact ?? false,
        entity_type: contact.entity_type || "person",
        director_id: contact.director_id || "",
        date_of_birth: contact.date_of_birth || "",
        place_of_birth: contact.place_of_birth || "",
        birth_state: contact.birth_state || "",
        birth_country: contact.birth_country || "",
        residential_address: contact.residential_address || "",
        drivers_licence: contact.drivers_licence || "",
        passport_number: contact.passport_number || "",
        tax_number: contact.tax_number || "",
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
      <ContactHeader
        contact={contact}
        onBack={() => router.back()}
        onDelete={handleDelete}
        onEnrichFromWeb={handleEnrichFromWeb}
        enrichingFromWeb={enrichingFromWeb}
      />

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
          <ContactOverviewTab
            contact={contact}
            setContact={setContact}
            formData={formData}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
            saving={saving}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            handleInputChange={handleInputChange}
            handleAutoSave={handleAutoSave}
            handleSave={handleSave}
            handleTeamContactToggle={handleTeamContactToggle}
            entityTypeMetadata={entityTypeMetadata}
            availableCompanies={availableCompanies}
            selectedCompanies={selectedCompanies}
            loadingCompanies={loadingCompanies}
            companyRoles={companyRoles}
            handleCompanyChange={handleCompanyChange}
            handleCompanyDragEnd={handleCompanyDragEnd}
            handleCompanyRolesChange={handleCompanyRolesChange}
            handleCompanyPositionChange={handleCompanyPositionChange}
            showAddCompany={showAddCompany}
            setShowAddCompany={setShowAddCompany}
            newCompanyName={newCompanyName}
            setNewCompanyName={setNewCompanyName}
            creatingCompany={creatingCompany}
            handleCreateCompany={handleCreateCompany}
            availablePeople={availablePeople}
            selectedEmployees={selectedEmployees}
            loadingPeople={loadingPeople}
            employeeRoles={employeeRoles}
            handleEmployeeChange={handleEmployeeChange}
            handleEmployeeDragEnd={handleEmployeeDragEnd}
            handleEmployeeRolesChange={handleEmployeeRolesChange}
            handleEmployeePositionChange={handleEmployeePositionChange}
            handleRemoveEmployee={handleRemoveEmployee}
            showAddEmployee={showAddEmployee}
            setShowAddEmployee={setShowAddEmployee}
            newEmployeeFirstName={newEmployeeFirstName}
            setNewEmployeeFirstName={setNewEmployeeFirstName}
            newEmployeeLastName={newEmployeeLastName}
            setNewEmployeeLastName={setNewEmployeeLastName}
            creatingEmployee={creatingEmployee}
            handleCreateEmployee={handleCreateEmployee}
            relatedEntities={relatedEntities}
            loadingRelatedEntities={loadingRelatedEntities}
            showAddRelatedEntity={showAddRelatedEntity}
            setShowAddRelatedEntity={setShowAddRelatedEntity}
            availableContacts={availableContacts}
            relationshipTypeMetadata={relationshipTypeMetadata}
            newRelatedEntityContactId={newRelatedEntityContactId}
            setNewRelatedEntityContactId={setNewRelatedEntityContactId}
            newRelatedEntityType={newRelatedEntityType}
            setNewRelatedEntityType={setNewRelatedEntityType}
            addingRelatedEntity={addingRelatedEntity}
            handleAddRelatedEntity={handleAddRelatedEntity}
            handleRemoveRelatedEntity={handleRemoveRelatedEntity}
            getValidRelationshipTypes={getValidRelationshipTypes}
            setEditModalOpen={setEditModalOpen}
            sensors={sensors}
          />
        </TabsContent>

        {/* Corporate Tab - Identity and Summary with nested sub-tabs */}
        <TabsContent value="corporate" className="mt-6">
          <ContactCorporateTab
            contact={contact}
            activeSubTab={activeSubTab}
            handleCorporateSubTabChange={handleCorporateSubTabChange}
            directorships={directorships}
            loadingDirectorships={loadingDirectorships}
            shareholdings={shareholdings}
            loadingShareholdings={loadingShareholdings}
            trustRoles={trustRoles}
            loadingTrustRoles={loadingTrustRoles}
            memberships={memberships}
            loadingMemberships={loadingMemberships}
            ownershipChain={ownershipChain}
            loadingOwnershipChain={loadingOwnershipChain}
          />
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
          <ContactFinancialTab
            contact={contact}
            activeFinancialSubTab={activeFinancialSubTab}
            handleFinancialSubTabChange={handleFinancialSubTabChange}
            setContact={setContact}
            setSelectedInvoiceId={setSelectedInvoiceId}
            setShowInvoiceDetail={setShowInvoiceDetail}
            handleViewInvoiceDetail={handleViewInvoiceDetail}
          />
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
          <ContactCasesTab
            caseRelationships={caseRelationships}
            loadingCaseRelationships={loadingCaseRelationships}
          />
        </TabsContent>

        {/* Emails Tab - Using TeeemTableView */}
        <TabsContent value="emails" className="mt-6">
          <ContactEmailsTab
            emails={emails}
            loadingEmails={loadingEmails}
            emailsPagination={emailsPagination}
            emailsPage={emailsPage}
            showAllInThread={showAllInThread}
            setShowAllInThread={setShowAllInThread}
            loadEmails={loadEmails}
            contactEmail={contact.email}
          />
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
          <ContactDirectorshipsTab
            directorships={directorships}
            loadingDirectorships={loadingDirectorships}
          />
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
