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
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyContactName } from "@/lib/url-utils";
import { cn } from "@/lib/utils";

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
  phone: string | null;
  is_primary: boolean;
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
  director_name: string | null;
  director_email: string | null;
  director_phone: string | null;
  // Bank details
  bank_bsb: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  // LGAs
  lgas: string[];
  // Entity type for SSoT
  entity_type: string | null;
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

  const activeTab = searchParams.get("tab") || "overview";

  useEffect(() => {
    loadContact();
  }, [id]);

  // Load memberships when contact loads
  useEffect(() => {
    if (contact?.id) {
      loadMemberships();
    }
  }, [contact?.id]);

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
          <Button variant="outline">
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relationships">Related Contacts</TabsTrigger>
          <TabsTrigger value="coms">Communications</TabsTrigger>
          {contact["is_supplier?"] && (
            <TabsTrigger value="pricebook">Price Book</TabsTrigger>
          )}
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
          <TabsTrigger value="xero">Xero</TabsTrigger>
          <TabsTrigger value="company-groups">
            Company Groups
            {memberships.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">{memberships.length}</Badge>
            )}
          </TabsTrigger>
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
                                {person.phone && (
                                  <a href={`tel:${person.phone}`} className="hover:underline">
                                    {person.phone}
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

              {/* Business Details Card */}
              {contact.tax_number && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Business Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contact.tax_number && (
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">ABN</p>
                            <p className="text-sm font-mono">{formatABN(contact.tax_number)}</p>
                          </div>
                        </div>
                      )}

                      {/* Bank Details */}
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

        {/* Relationships Tab */}
        <TabsContent value="relationships" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                Related contacts and relationships will be shown here.
              </p>
            </CardContent>
          </Card>
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

        {/* Xero Tab */}
        <TabsContent value="xero" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Xero Integration
                {contact.xero_contact_id ? (
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="outline">Not Linked</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.xero_contact_id ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Connected to Xero</p>
                      <p className="text-xs text-muted-foreground">
                        Xero Contact ID: {contact.xero_contact_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sync enabled:</span>
                    <Badge variant={contact.sync_with_xero ? "default" : "secondary"}>
                      {contact.sync_with_xero ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    This contact is not linked to Xero.
                  </p>
                  <Button variant="outline">
                    Link to Xero Contact
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Groups Tab */}
        <TabsContent value="company-groups" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Group Memberships
                {memberships.length > 0 && (
                  <Badge variant="secondary">{memberships.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMemberships ? (
                <div className="flex items-center justify-center py-8">
                  <Loader />
                </div>
              ) : memberships.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    This contact is not a member of any company groups.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium">{membership.company_group_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className={
                                membership.membership_type === "director"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                  : membership.membership_type === "shareholder"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                              }
                            >
                              {membership.membership_type}
                            </Badge>
                            {membership.company_name && (
                              <span className="text-sm text-muted-foreground">
                                via {membership.company_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {membership.can_view_confidential && (
                          <Badge variant="outline" className="text-xs">
                            View Confidential
                          </Badge>
                        )}
                        {membership.can_edit && (
                          <Badge variant="outline" className="text-xs">
                            Can Edit
                          </Badge>
                        )}
                        {membership.is_active ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
