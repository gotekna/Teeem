"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Phone,
  Globe,
  Building2,
  MapPin,
  User,
  Users,
  ShieldCheck,
  ExternalLink,
  Loader2,
  FileText,
  Hash,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyContactName } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { EntityChat } from "@/components/chat/EntityChat";

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

interface ContactAddress {
  id: number;
  address_type: 'STREET' | 'POBOX' | 'DELIVERY';
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

interface Contact {
  id: number;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  website: string | null;
  abn: string | null;
  address: string | null; // Legacy - deprecated, use contact_addresses
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
  contact_addresses?: ContactAddress[]; // SSoT for addresses
  jobs_count: number;
  purchase_orders_count: number;
  quotes_count: number;
  company_name: string | null;
  position: string | null;
}

interface ContactDetailDrawerProps {
  contactId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatABN = (abn: string | null) => {
  if (!abn) return "";
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return abn;
};

const formatMobilePhone = (phone: string | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  return phone;
};

export function ContactDetailDrawer({ contactId, open, onOpenChange }: ContactDetailDrawerProps) {
  const router = useRouter();
  const [contact, setContact] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadContact = React.useCallback(async () => {
    if (!contactId) return;

    setLoading(true);
    try {
      const response = await api.get<{ contact: Contact }>(`/api/v1/contacts/${contactId}`);
      setContact(response.contact);
    } catch (error) {
      console.error("Failed to fetch contact:", error);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  React.useEffect(() => {
    if (open && contactId) {
      loadContact();
    }
  }, [open, contactId, loadContact]);

  const handleOpenFullPage = () => {
    if (contact) {
      const slug = slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.display_name);
      router.push(`/contacts/${slug}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !contact ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Contact not found</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-4 border-b shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl font-serif">{contact.display_name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                        Xero
                      </Badge>
                    )}
                    {!contact.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  {contact.company_name && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {contact.position && `${contact.position} at `}{contact.company_name}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenFullPage}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Full Page
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{contact.jobs_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Jobs</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{contact.purchase_orders_count || 0}</p>
                  <p className="text-xs text-muted-foreground">POs</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-lg font-bold font-mono">{contact.quotes_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Quotes</p>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Contact Information */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contact Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
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

                    {/* SSoT: Display primary street address from contact_addresses */}
                    {(() => {
                      const primaryAddr = contact.contact_addresses?.find(a => a.address_type === 'STREET');
                      const displayAddress = primaryAddr
                        ? [primaryAddr.line1, primaryAddr.line2, primaryAddr.city, primaryAddr.region, primaryAddr.postal_code].filter(Boolean).join(", ")
                        : contact.address; // Fallback to legacy
                      return displayAddress && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Address</p>
                            <p className="text-sm">{displayAddress}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {contact.abn && (
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">ABN</p>
                          <p className="text-sm font-mono">{formatABN(contact.abn)}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Persons */}
                {contact.contact_persons && contact.contact_persons.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Contact Persons
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {contact.contact_persons.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {contact.contact_persons.map((person) => (
                          <div
                            key={person.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded border text-sm",
                              person.is_primary && "bg-primary/5 border-primary/20"
                            )}
                          >
                            <div>
                              <span className="font-medium">
                                {person.first_name} {person.last_name}
                              </span>
                              {person.is_primary && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1">Primary</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {person.email || person.phone}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {contact.notes && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Contact Groups */}
                {contact.contact_groups && contact.contact_groups.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Groups</CardTitle>
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

                {/* Internal Chat */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Internal Chat
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <EntityChat
                      entityType="contact"
                      entityId={contact.id}
                      entityName={contact.display_name}
                      showOnlineUsers={false}
                      maxHeight="300px"
                    />
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
