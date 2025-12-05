"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  Calendar,
  Hash,
  FileText,
  Users,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Briefcase,
  Home,
  Lock,
  IdCard,
  CreditCard,
  Share2,
  FolderOpen,
  Percent,
  Table,
  Network,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyContactName } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { ContactEditModal } from "@/components/contacts/ContactEditModal";
import { XeroSyncSection } from "@/components/contacts/XeroSyncSection";
import { XeroTransactionsSection } from "@/components/contacts/XeroTransactionsSection";
import { XeroInvoiceDetailModal } from "@/components/contacts/XeroInvoiceDetailModal";
import TeeemTableView from "@/components/table/TeeemTableView";
import { type TableColumn } from "@/components/table/types";
import type { XeroLink } from "@/types/xero";
import PersonStructureChart from "@/components/corporate/PersonStructureChart";

// Helper function to format ABN as XX XXX XXX XXX
const formatABN = (abn: string | null) => {
  if (!abn) return "";
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return abn;
};

// Helper function to format Australian mobile phone as XXXX XXX XXX
const formatMobilePhone = (phone: string | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  return phone;
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

interface Contact {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  website: string | null;
  tax_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  "is_supplier?": boolean;
  "is_customer?": boolean;
  "is_director?": boolean;
  is_family_member: boolean;
  xero_contact_id: string | null;
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
  primary_company?: { id: number; name: string } | null;
  employees?: Array<{ id: number; full_name: string; email: string | null }>;
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

  // SSoT: Dedicated state for rich data tabs
  const [directorships, setDirectorships] = useState<Directorship[]>([]);
  const [loadingDirectorships, setLoadingDirectorships] = useState(false);
  const [shareholdings, setShareholdings] = useState<Shareholding[]>([]);
  const [loadingShareholdings, setLoadingShareholdings] = useState(false);
  const [trustRoles, setTrustRoles] = useState<TrustRolesData | null>(null);
  const [loadingTrustRoles, setLoadingTrustRoles] = useState(false);
  const [ownershipChain, setOwnershipChain] = useState<OwnershipNode[]>([]);
  const [loadingOwnershipChain, setLoadingOwnershipChain] = useState(false);
  const [selectedXeroLink, setSelectedXeroLink] = useState<XeroLink | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  const activeTab = searchParams.get("tab") || "overview";
  const activeSubTab = searchParams.get("subtab") || "identity";

  useEffect(() => {
    loadContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [id]);

  // Load memberships when contact loads
  useEffect(() => {
    if (contact?.id) {
      loadMemberships();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only watching contact?.id
  }, [contact?.id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only watching activeTab and contact?.id
  }, [activeTab, contact?.id]);

  const handleTabChange = (value: string) => {
    // Use slug for URL, don't show ?tab= for default "overview" tab
    const slug = contact
      ? slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name)
      : id;
    const newUrl = value === "overview"
      ? `/contacts/${slug}`
      : `/contacts/${slug}?tab=${value}`;
    router.push(newUrl);
  };

  const handleCorporateSubTabChange = (value: string) => {
    const slug = contact
      ? slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name)
      : id;
    const newUrl = value === "identity"
      ? `/contacts/${slug}?tab=corporate`
      : `/contacts/${slug}?tab=corporate&subtab=${value}`;
    router.push(newUrl);
  };

  const handleFinancialSubTabChange = (value: string) => {
    const slug = contact
      ? slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name)
      : id;
    const newUrl = value === "bank"
      ? `/contacts/${slug}?tab=financial`
      : `/contacts/${slug}?tab=financial&subtab=${value}`;
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
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
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
          <Button variant="outline" onClick={() => setEditModalOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
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
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="financial">
            Financial
            {!contact.can_view_confidential && <Lock className="h-3 w-3 ml-1 text-amber-500" />}
          </TabsTrigger>
          <TabsTrigger value="coms">Communications</TabsTrigger>
          {contact["is_supplier?"] && (
            <TabsTrigger value="pricebook">Price Book</TabsTrigger>
          )}
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Email */}
                    {contact.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <a href={`mailto:${contact.email}`} className="text-sm hover:underline text-primary">
                            {contact.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Mobile Phone */}
                    {contact.mobile_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Mobile</p>
                          <a href={`tel:${contact.mobile_phone}`} className="text-sm hover:underline">
                            {formatMobilePhone(contact.mobile_phone)}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Office Phone */}
                    {contact.office_phone && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Office</p>
                          <a href={`tel:${contact.office_phone}`} className="text-sm hover:underline">
                            {contact.office_phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Website */}
                    {contact.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Website</p>
                          <a
                            href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm hover:underline text-primary flex items-center gap-1"
                          >
                            {contact.website}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {contact.address && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm">{contact.address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {contact.notes && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Notes</p>
                          <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Contact Persons Card */}
              {contact.contact_persons && contact.contact_persons.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contact Persons
                      <Badge variant="secondary" className="ml-2">
                        {contact.contact_persons.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.contact_persons.map((person) => (
                        <div
                          key={person.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            person.is_primary && "bg-primary/5 border-primary/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {person.first_name} {person.last_name}
                                {person.is_primary && (
                                  <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>
                                )}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {person.email && (
                                  <a href={`mailto:${person.email}`} className="hover:underline">
                                    {person.email}
                                  </a>
                                )}
                                {person.mobile && (
                                  <a href={`tel:${person.mobile}`} className="hover:underline">
                                    {person.mobile}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Business Details Card - Enhanced for company-type contacts */}
              {(contact.tax_number || contact.linked_company) && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Business Details
                    </CardTitle>
                    {contact.linked_company && (
                      <Link href={`/corporate/companies/${contact.linked_company.id}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Corporate Record
                        </Button>
                      </Link>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Basic Business Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(contact.tax_number || contact.linked_company?.abn) && (
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">ABN</p>
                            <p className="text-sm font-mono">{formatABN(contact.tax_number || contact.linked_company?.abn || "")}</p>
                          </div>
                        </div>
                      )}

                      {contact.linked_company?.acn && (
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">ACN</p>
                            <p className="text-sm font-mono">{contact.linked_company.acn}</p>
                          </div>
                        </div>
                      )}

                      {contact.linked_company?.status && (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <Badge variant={contact.linked_company.status === "active" ? "default" : "secondary"}>
                              {contact.linked_company.status}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Show Contact's entity_type (SSoT) - prefer this over linked_company.entity_type */}
                      {(contact.entity_type || contact.linked_company?.entity_type) && (
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Entity Type</p>
                            <Badge
                              className={cn(
                                "capitalize",
                                contact.entity_type === "trust" && "bg-red-100 text-red-700",
                                contact.entity_type === "person" && "bg-blue-100 text-blue-700",
                                contact.entity_type === "company" && "bg-green-100 text-green-700",
                                !contact.entity_type && "bg-gray-100 text-gray-700"
                              )}
                            >
                              {contact.entity_type || contact.linked_company?.entity_type || "unknown"}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {contact.linked_company?.date_incorporated && (
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Date Incorporated</p>
                            <p className="text-sm">{new Date(contact.linked_company.date_incorporated).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}

                      {contact.linked_company?.company_group_name && (
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Company Group</p>
                            <Link href="/company-groups" className="text-sm text-primary hover:underline">
                              {contact.linked_company.company_group_name}
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Addresses */}
                    {(contact.linked_company?.registered_office_address || contact.linked_company?.principal_place_of_business) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contact.linked_company?.registered_office_address && (
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Registered Office</p>
                                <p className="text-sm">{contact.linked_company.registered_office_address}</p>
                              </div>
                            </div>
                          )}

                          {contact.linked_company?.principal_place_of_business && (
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Principal Place of Business</p>
                                <p className="text-sm">{contact.linked_company.principal_place_of_business}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Directors */}
                    {contact.linked_company?.directors && contact.linked_company.directors.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Directors ({contact.linked_company.directors.filter(d => d.is_current).length} current)
                          </p>
                          <div className="space-y-2">
                            {contact.linked_company.directors.filter(d => d.is_current).map((director) => (
                              <div key={director.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <Link href={`/contacts/${director.contact_id}`} className="text-sm hover:underline text-primary">
                                    {director.contact_name || "Unknown"}
                                  </Link>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{director.formatted_position}</Badge>
                                  {director.appointment_date && (
                                    <span className="text-xs text-muted-foreground">
                                      Since {new Date(director.appointment_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Shareholdings */}
                    {contact.linked_company?.shareholdings && contact.linked_company.shareholdings.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Shareholdings ({contact.linked_company.shareholdings.length})
                          </p>
                          <div className="space-y-2">
                            {contact.linked_company.shareholdings.map((sh) => (
                              <div key={sh.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{sh.shareholder_name || "Unknown"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {sh.share_class && (
                                    <Badge variant="outline" className="text-xs">{sh.share_class}</Badge>
                                  )}
                                  {sh.number_of_shares && (
                                    <span className="text-xs text-muted-foreground">
                                      {sh.number_of_shares.toLocaleString()} shares
                                    </span>
                                  )}
                                  {sh.beneficially_held && (
                                    <Badge variant="secondary" className="text-xs">
                                      Beneficial
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Bank Details - only show if no linked_company or user wants to see contact-level bank */}
                    {(contact.bank_bsb || contact.bank_account_number || contact.bank_account_name) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contact.bank_bsb && (
                            <div className="flex items-center gap-3">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">Bank BSB</p>
                                <p className="text-sm font-mono">{contact.bank_bsb}</p>
                              </div>
                            </div>
                          )}

                          {contact.bank_account_number && (
                            <div className="flex items-center gap-3">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">Account Number</p>
                                <p className="text-sm font-mono">{contact.bank_account_number}</p>
                              </div>
                            </div>
                          )}

                          {contact.bank_account_name && (
                            <div className="flex items-center gap-3">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">Account Name</p>
                                <p className="text-sm">{contact.bank_account_name}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Contact Groups */}
              {contact.contact_groups && contact.contact_groups.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contact Groups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.contact_groups.map((group) => (
                        <Badge key={group.id} variant="secondary">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* LGAs */}
              {contact.lgas && contact.lgas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Service Areas (LGAs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.lgas.map((lga, index) => (
                        <Badge key={index} variant="outline">
                          {lga}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
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

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">System Info</CardTitle>
                </CardHeader>
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
                      <span className="font-mono text-xs truncate max-w-[120px]" title={contact.xero_contact_id}>
                        {contact.xero_contact_id.slice(0, 8)}...
                      </span>
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
                        <span>Restricted - You don't have permission to view this field</span>
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
                  xeroLink={selectedXeroLink}
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
