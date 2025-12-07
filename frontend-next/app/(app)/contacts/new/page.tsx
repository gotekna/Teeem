"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Loader2, User, Building2, Plus, ChevronsUpDown, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ContactSearchResult {
  id: number;
  full_name: string;
  email: string | null;
  entity_type: string | null;
}

interface ContactFormData {
  entity_type: string;
  first_name: string;
  last_name: string;
  company_name_or_trust: string;
  email: string;
  mobile_phone: string;
  office_phone: string;
  address: string;
  notes: string;
  contact_type: string;
  primary_company_id: number | null;
}

export default function NewContactPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<ContactFormData>({
    entity_type: "person",
    first_name: "",
    last_name: "",
    company_name_or_trust: "",
    email: "",
    mobile_phone: "",
    office_phone: "",
    address: "",
    notes: "",
    contact_type: "supplier",
    primary_company_id: null,
  });

  // Company search state (for person -> company linking)
  const [companySearchOpen, setCompanySearchOpen] = React.useState(false);
  const [companySearchQuery, setCompanySearchQuery] = React.useState("");
  const [companySearchResults, setCompanySearchResults] = React.useState<ContactSearchResult[]>([]);
  const [searchingCompanies, setSearchingCompanies] = React.useState(false);
  const [selectedCompanyName, setSelectedCompanyName] = React.useState<string | null>(null);

  // Employee list for company contacts (people to link after creation)
  const [pendingEmployees, setPendingEmployees] = React.useState<Array<{ name: string; email?: string }>>([]);
  const [newEmployeeName, setNewEmployeeName] = React.useState("");

  // Search companies when query changes
  React.useEffect(() => {
    const searchCompanies = async () => {
      if (companySearchQuery.length < 2) {
        setCompanySearchResults([]);
        return;
      }
      setSearchingCompanies(true);
      try {
        const response = await api.get<{ contacts: ContactSearchResult[] }>("/api/v1/contacts", {
          params: { search: companySearchQuery, per_page: 20 },
        });
        // Filter out persons - keep company, trust, and blank entity_type
        const nonPersons = (response?.contacts || []).filter(
          c => c.entity_type !== "person"
        );
        setCompanySearchResults(nonPersons.slice(0, 10));
      } catch (error) {
        console.error("Failed to search companies:", error);
      } finally {
        setSearchingCompanies(false);
      }
    };
    const debounce = setTimeout(searchCompanies, 300);
    return () => clearTimeout(debounce);
  }, [companySearchQuery]);

  const handleChange = (field: keyof ContactFormData, value: string | number | null) => {
    // Clear related fields when entity type changes
    if (field === "entity_type" && typeof value === "string") {
      if (value === "company" || value === "trust") {
        setFormData(prev => ({
          ...prev,
          entity_type: value,
          first_name: "",
          last_name: "",
          primary_company_id: null,
        }));
        setSelectedCompanyName(null);
        setPendingEmployees([]);
      } else {
        setFormData(prev => ({
          ...prev,
          entity_type: value,
          company_name_or_trust: "",
        }));
        setPendingEmployees([]);
      }
      return;
    }

    // Handle other fields normally
    if (field === "primary_company_id") {
      setFormData(prev => ({ ...prev, [field]: value as number | null }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value as string }));
    }
  };

  // Company selection
  const selectCompany = (company: ContactSearchResult) => {
    setFormData(prev => ({ ...prev, primary_company_id: company.id }));
    setSelectedCompanyName(company.full_name);
    setCompanySearchOpen(false);
    setCompanySearchQuery("");
  };

  const createAndSelectCompany = async () => {
    if (!companySearchQuery.trim()) return;
    try {
      const response = await api.post<{ contact: { id: number; full_name: string } }>("/api/v1/contacts", {
        contact: {
          full_name: companySearchQuery,
          entity_type: "company",
        },
      });
      if (response?.contact) {
        setFormData(prev => ({ ...prev, primary_company_id: response.contact.id }));
        setSelectedCompanyName(response.contact.full_name);
        toast({ title: "Company created", description: `Created "${response.contact.full_name}"` });
      }
    } catch (error) {
      console.error("Failed to create company:", error);
      toast({ title: "Error", description: "Failed to create company", variant: "destructive" });
    }
    setCompanySearchOpen(false);
    setCompanySearchQuery("");
  };

  const clearCompany = () => {
    setFormData(prev => ({ ...prev, primary_company_id: null }));
    setSelectedCompanyName(null);
  };

  // Add pending employee (will be created after company)
  const addPendingEmployee = () => {
    if (!newEmployeeName.trim()) return;
    setPendingEmployees(prev => [...prev, { name: newEmployeeName.trim() }]);
    setNewEmployeeName("");
  };

  const removePendingEmployee = (index: number) => {
    setPendingEmployees(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isPerson = formData.entity_type === "person";
      const isCompanyOrTrust = formData.entity_type === "company" || formData.entity_type === "trust";

      // Build full_name based on entity type
      let full_name = "";
      if (isPerson) {
        full_name = [formData.first_name, formData.last_name].filter(Boolean).join(" ");
      } else if (isCompanyOrTrust) {
        full_name = formData.company_name_or_trust;
      }

      if (!full_name.trim()) {
        toast({
          title: "Error",
          description: isPerson ? "Please enter a name" : "Please enter a company/trust name",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Build the contact payload
      const contactPayload: Record<string, unknown> = {
        full_name,
        entity_type: formData.entity_type,
        email: formData.email || null,
        mobile_phone: formData.mobile_phone || null,
        office_phone: formData.office_phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
      };

      // Add entity-specific fields
      if (isPerson) {
        contactPayload.first_name = formData.first_name;
        contactPayload.last_name = formData.last_name;
        if (formData.primary_company_id) {
          contactPayload.primary_company_id = formData.primary_company_id;
        }
      } else if (isCompanyOrTrust) {
        contactPayload.company_name_or_trust = formData.company_name_or_trust;
      }

      // Set supplier/customer flags based on contact_type
      if (formData.contact_type === "supplier") {
        contactPayload.is_supplier = true;
        contactPayload.is_customer = false;
      } else if (formData.contact_type === "customer") {
        contactPayload.is_supplier = false;
        contactPayload.is_customer = true;
      } else if (formData.contact_type === "both") {
        contactPayload.is_supplier = true;
        contactPayload.is_customer = true;
      }

      const response = await api.post<{ contact: { id: number } }>("/api/v1/contacts", {
        contact: contactPayload,
      });

      const newContactId = response?.contact?.id;

      // If this is a company and we have pending employees, create them
      if (isCompanyOrTrust && newContactId && pendingEmployees.length > 0) {
        for (const emp of pendingEmployees) {
          try {
            await api.post("/api/v1/contacts", {
              contact: {
                full_name: emp.name,
                entity_type: "person",
                primary_company_id: newContactId,
              },
            });
          } catch (error) {
            console.error("Failed to create employee:", error);
          }
        }
        toast({
          title: "Success",
          description: `Contact created with ${pendingEmployees.length} employee(s)`
        });
      } else {
        toast({ title: "Success", description: "Contact created successfully" });
      }

      router.push(`/contacts/${newContactId || ""}`);
    } catch (error) {
      console.error("Failed to create contact:", error);
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isPerson = formData.entity_type === "person";
  const isCompanyOrTrust = formData.entity_type === "company" || formData.entity_type === "trust";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Add Contact</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add a new customer, supplier, or business contact
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entity Type Selection */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>What type of contact is this?</CardTitle>
              <CardDescription>Choose the entity type to see relevant fields</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.entity_type === "person" ? "default" : "outline"}
                  className="flex-1 h-20 flex-col gap-2"
                  onClick={() => handleChange("entity_type", "person")}
                >
                  <User className="h-6 w-6" />
                  <span>Person</span>
                </Button>
                <Button
                  type="button"
                  variant={formData.entity_type === "company" ? "default" : "outline"}
                  className="flex-1 h-20 flex-col gap-2"
                  onClick={() => handleChange("entity_type", "company")}
                >
                  <Building2 className="h-6 w-6" />
                  <span>Company</span>
                </Button>
                <Button
                  type="button"
                  variant={formData.entity_type === "trust" ? "default" : "outline"}
                  className="flex-1 h-20 flex-col gap-2"
                  onClick={() => handleChange("entity_type", "trust")}
                >
                  <Building2 className="h-6 w-6" />
                  <span>Trust</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isPerson ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                {isPerson ? "Person Details" : formData.entity_type === "trust" ? "Trust Details" : "Company Details"}
              </CardTitle>
              <CardDescription>
                {isPerson ? "Enter the person's information" : "Enter the organisation's information"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPerson ? (
                /* Person Name Fields */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      placeholder="e.g., John"
                      value={formData.first_name}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="e.g., Smith"
                      value={formData.last_name}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                /* Company/Trust Name Field */
                <div className="space-y-2">
                  <Label htmlFor="company_name_or_trust">
                    {formData.entity_type === "trust" ? "Trust Name *" : "Company Name *"}
                  </Label>
                  <Input
                    id="company_name_or_trust"
                    placeholder={formData.entity_type === "trust" ? "e.g., Smith Family Trust" : "e.g., Acme Corporation Pty Ltd"}
                    value={formData.company_name_or_trust}
                    onChange={(e) => handleChange("company_name_or_trust", e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Company Link (for Person) */}
              {isPerson && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company / Employer
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Link this person to their company (optional)
                  </p>
                  <div className="flex gap-2">
                    <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={companySearchOpen}
                          className="flex-1 justify-between"
                        >
                          {selectedCompanyName || "Search or create company..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Type to search companies..."
                            value={companySearchQuery}
                            onValueChange={setCompanySearchQuery}
                          />
                          <CommandList>
                            {searchingCompanies && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            )}
                            {!searchingCompanies && companySearchQuery.length >= 2 && companySearchResults.length === 0 && (
                              <CommandEmpty>
                                <div className="py-2 text-center">
                                  <p className="text-sm text-muted-foreground mb-2">No companies found</p>
                                  <Button type="button" size="sm" onClick={createAndSelectCompany}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Create &quot;{companySearchQuery}&quot;
                                  </Button>
                                </div>
                              </CommandEmpty>
                            )}
                            {companySearchResults.length > 0 && (
                              <CommandGroup heading="Companies">
                                {companySearchResults.map((company) => (
                                  <CommandItem
                                    key={company.id}
                                    value={company.id.toString()}
                                    onSelect={() => selectCompany(company)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.primary_company_id === company.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div className="font-medium">{company.full_name}</div>
                                      {company.email && (
                                        <div className="text-xs text-muted-foreground">{company.email}</div>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                                {companySearchQuery.length >= 2 && (
                                  <CommandItem onSelect={createAndSelectCompany}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create &quot;{companySearchQuery}&quot;
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {selectedCompanyName && (
                      <Button type="button" variant="ghost" size="icon" onClick={clearCompany}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Employees (for Company/Trust) */}
              {isCompanyOrTrust && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Employees / Key Contacts
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add people who work at this {formData.entity_type} (optional)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Employee name"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPendingEmployee();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addPendingEmployee}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {pendingEmployees.length > 0 && (
                    <div className="border rounded-lg divide-y mt-2">
                      {pendingEmployees.map((emp, index) => (
                        <div key={index} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{emp.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePendingEmployee(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g., contact@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_phone">Mobile Phone</Label>
                  <Input
                    id="mobile_phone"
                    placeholder="e.g., 0412 345 678"
                    value={formData.mobile_phone}
                    onChange={(e) => handleChange("mobile_phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="office_phone">Office Phone</Label>
                <Input
                  id="office_phone"
                  placeholder="e.g., 07 3000 0000"
                  value={formData.office_phone}
                  onChange={(e) => handleChange("office_phone", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Main Street, Brisbane QLD 4000"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this contact..."
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Type */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Type</CardTitle>
              <CardDescription>How you work with this contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_type">Type</Label>
                <Select
                  value={formData.contact_type}
                  onValueChange={(value) => handleChange("contact_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.contact_type === "customer" && "This contact is a client who hires you for jobs"}
                  {formData.contact_type === "supplier" && "This contact supplies materials or services to you"}
                  {formData.contact_type === "both" && "This contact is both a customer and supplier"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/contacts">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add {isPerson ? "Contact" : formData.entity_type === "trust" ? "Trust" : "Company"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
