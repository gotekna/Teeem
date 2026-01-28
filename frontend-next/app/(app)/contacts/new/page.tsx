"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  User,
  Building2,
  Plus,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { DEBOUNCE_SEARCH_MS } from "@/lib/constants/timeout-constants";
import { PAGE_SIZE_SEARCH } from "@/lib/constants/pagination-constants";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useEntityTypes } from "@/hooks/useEntityTypes";
import { hasFirstLastName, hasCompanyName, canHaveEmployees, canHaveEmployer, getEntityTypeIcon, isTrust } from "@/lib/entity-types";

interface ContactSearchResult {
  id: number;
  display_name: string;
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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { createFormTypes, loading: entityTypesLoading } = useEntityTypes();
  const [loading, setLoading] = React.useState(false);

  // Get prefill values from URL params (e.g., from Xero fuzzy match review)
  const prefillName = searchParams.get("name") || "";
  const prefillType = searchParams.get("type") || "";

  const [formData, setFormData] = React.useState<ContactFormData>(() => {
    // Determine entity type - if name contains "Pty Ltd", "Trust", etc., default to company
    const lowerName = prefillName.toLowerCase();
    const isLikelyCompany = lowerName.includes("pty") || lowerName.includes("ltd") ||
                            lowerName.includes("trust") || lowerName.includes("inc") ||
                            lowerName.includes("corp") || lowerName.includes("limited");
    const defaultType = prefillType || (isLikelyCompany ? "company" : "person");

    return {
      entity_type: defaultType,
      first_name: defaultType === "person" && prefillName ? prefillName.split(" ")[0] || "" : "",
      last_name: defaultType === "person" && prefillName ? prefillName.split(" ").slice(1).join(" ") || "" : "",
      company_name_or_trust: defaultType !== "person" ? prefillName : "",
      email: "",
      mobile_phone: "",
      office_phone: "",
      address: "",
      notes: "",
      contact_type: "supplier",
      primary_company_id: null,
    };
  });

  // Company search state (for person -> company linking)
  const [companySearchOpen, setCompanySearchOpen] = React.useState(false);
  const [companySearchQuery, setCompanySearchQuery] = React.useState("");
  const [companySearchResults, setCompanySearchResults] = React.useState<ContactSearchResult[]>([]);
  const [searchingCompanies, setSearchingCompanies] = React.useState(false);
  const [selectedCompanyName, setSelectedCompanyName] = React.useState<string | null>(null);

  // Employee list for company contacts (people to link after creation)
  const [pendingEmployees, setPendingEmployees] = React.useState<Array<{ id?: number; name: string; email?: string }>>([]);
  const [employeeSearchOpen, setEmployeeSearchOpen] = React.useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = React.useState("");
  const [employeeSearchResults, setEmployeeSearchResults] = React.useState<ContactSearchResult[]>([]);
  const [searchingEmployees, setSearchingEmployees] = React.useState(false);

  // Search companies when query changes
  React.useEffect(() => {
    const searchCompanies = async () => {
      if (companySearchQuery.length < 2) {
        setCompanySearchResults([]);
        return;
      }
      setSearchingCompanies(true);
      try {
        // SSoT: Uses PAGE_SIZE_SEARCH from pagination-constants.ts
        const response = await api.get<{ contacts: ContactSearchResult[] }>("/api/v1/contacts", {
          params: { search: companySearchQuery, per_page: PAGE_SIZE_SEARCH },
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
    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    const debounce = setTimeout(searchCompanies, DEBOUNCE_SEARCH_MS);
    return () => clearTimeout(debounce);
  }, [companySearchQuery]);

  // Search people when query changes (for employee selection - PEOPLE ONLY)
  React.useEffect(() => {
    const searchPeople = async () => {
      if (employeeSearchQuery.length < 2) {
        setEmployeeSearchResults([]);
        return;
      }
      setSearchingEmployees(true);
      try {
        // SSoT: Uses PAGE_SIZE_SEARCH from pagination-constants.ts
        const response = await api.get<{ contacts: ContactSearchResult[] }>("/api/v1/contacts", {
          params: {
            search: employeeSearchQuery,
            entity_type: "person",  // Only search people
            per_page: PAGE_SIZE_SEARCH
          },
        });
        // Filter out already selected people
        const selectedIds = pendingEmployees.filter(e => e.id).map(e => e.id);
        const availablePeople = (response?.contacts || []).filter(
          c => !selectedIds.includes(c.id)
        );
        setEmployeeSearchResults(availablePeople.slice(0, 10));
      } catch (error) {
        console.error("Failed to search people:", error);
      } finally {
        setSearchingEmployees(false);
      }
    };
    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    const debounce = setTimeout(searchPeople, DEBOUNCE_SEARCH_MS);
    return () => clearTimeout(debounce);
  }, [employeeSearchQuery, pendingEmployees]);

  const handleChange = (field: keyof ContactFormData, value: string | number | null) => {
    // Clear related fields when entity type changes
    if (field === "entity_type" && typeof value === "string") {
      // Company/Trust use company_name_or_trust field, Person/Sole Trader use first/last name
      if (hasCompanyName(value)) {
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
    setSelectedCompanyName(company.display_name);
    setCompanySearchOpen(false);
    setCompanySearchQuery("");
  };

  const createAndSelectCompany = async () => {
    if (!companySearchQuery.trim()) return;
    try {
      const response = await api.post<{ contact: { id: number; display_name: string } }>("/api/v1/contacts", {
        contact: {
          display_name: companySearchQuery,
          entity_type: "company",
        },
      });
      if (response?.contact) {
        setFormData(prev => ({ ...prev, primary_company_id: response.contact.id }));
        setSelectedCompanyName(response.contact.display_name);
        toast({ title: "Company created", description: `Created "${response.contact.display_name}"` });
      }
    } catch (error) {
      console.error("Failed to create company:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to create company";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
    setCompanySearchOpen(false);
    setCompanySearchQuery("");
  };

  const clearCompany = () => {
    setFormData(prev => ({ ...prev, primary_company_id: null }));
    setSelectedCompanyName(null);
  };

  // Select an existing person as employee
  const selectEmployee = (person: ContactSearchResult) => {
    setPendingEmployees(prev => [...prev, {
      id: person.id,
      name: person.display_name,
      email: person.email || undefined
    }]);
    setEmployeeSearchOpen(false);
    setEmployeeSearchQuery("");
  };

  // Create a new pending employee (will be created after company)
  const createAndAddEmployee = () => {
    if (!employeeSearchQuery.trim()) return;
    setPendingEmployees(prev => [...prev, { name: employeeSearchQuery.trim() }]);
    setEmployeeSearchOpen(false);
    setEmployeeSearchQuery("");
  };

  const removePendingEmployee = (index: number) => {
    setPendingEmployees(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use SSoT helper functions
      const useFirstLastName = hasFirstLastName(formData.entity_type);
      const useCompanyName = hasCompanyName(formData.entity_type);
      const entityCanHaveEmployees = canHaveEmployees(formData.entity_type);

      // Build display_name based on entity type
      let display_name = "";
      if (useFirstLastName) {
        display_name = [formData.first_name, formData.last_name].filter(Boolean).join(" ");
      } else if (useCompanyName) {
        display_name = formData.company_name_or_trust;
      }

      if (!display_name.trim()) {
        toast({
          title: "Error",
          description: useFirstLastName ? "Please enter a name" : "Please enter a company/trust name",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Build the contact payload
      const contactPayload: Record<string, unknown> = {
        display_name,
        entity_type: formData.entity_type,
        email: formData.email || null,
        mobile_phone: formData.mobile_phone || null,
        office_phone: formData.office_phone || null,
        notes: formData.notes || null,
      };

      // SSoT: Create contact_addresses_attributes if address is provided
      if (formData.address?.trim()) {
        contactPayload.contact_addresses_attributes = [{
          address_type: 'STREET',
          line1: formData.address.trim(),
          is_primary: true,
        }];
      }

      // Add entity-specific fields based on SSoT helpers
      if (useFirstLastName) {
        contactPayload.first_name = formData.first_name;
        contactPayload.last_name = formData.last_name;
        if (formData.primary_company_id) {
          contactPayload.primary_company_id = formData.primary_company_id;
        }
      } else if (useCompanyName) {
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

      console.log("Creating contact with payload:", JSON.stringify(contactPayload, null, 2));
      const response = await api.post<{ contact: { id: number } }>("/api/v1/contacts", {
        contact: contactPayload,
      });

      const newContactId = response?.contact?.id;

      // If this entity can have employees and we have pending employees, link/create them
      if (entityCanHaveEmployees && newContactId && pendingEmployees.length > 0) {
        let linkedCount = 0;
        let createdCount = 0;

        for (const emp of pendingEmployees) {
          try {
            if (emp.id) {
              // Existing person - create employee_of relationship
              await api.post(`/api/v1/contacts/${emp.id}/relationships`, {
                relationship: {
                  related_contact_id: newContactId,
                  relationship_type: "employee_of",
                },
              });
              linkedCount++;
            } else {
              // New person - create contact and link
              await api.post("/api/v1/contacts", {
                contact: {
                  display_name: emp.name,
                  entity_type: "person",
                  primary_company_id: newContactId,
                },
              });
              createdCount++;
            }
          } catch (error) {
            console.error("Failed to link/create employee:", error);
          }
        }

        const parts = [];
        if (linkedCount > 0) parts.push(`${linkedCount} linked`);
        if (createdCount > 0) parts.push(`${createdCount} created`);
        toast({
          title: "Success",
          description: `Contact created with ${parts.join(", ")} employee(s)`
        });
      } else {
        toast({ title: "Success", description: "Contact created successfully" });
      }

      router.push(`/contacts/${newContactId || ""}`);
    } catch (error) {
      console.error("Failed to create contact:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to create contact";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Use helper functions from entity-types.ts (SSoT)
  const showFirstLastName = hasFirstLastName(formData.entity_type);
  const showCompanyName = hasCompanyName(formData.entity_type);
  const showEmployees = canHaveEmployees(formData.entity_type);
  const showEmployer = canHaveEmployer(formData.entity_type);
  const entityIcon = getEntityTypeIcon(formData.entity_type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/contacts" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Add Contact</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add a new customer, supplier, or business contact
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {entityIcon === "user" ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                {createFormTypes.find(t => t.value === formData.entity_type)?.label || "Contact"} Details
              </CardTitle>
              <CardDescription>
                {showFirstLastName ? "Enter the person's information" : "Enter the organisation's information"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showFirstLastName ? (
                /* Person/Sole Trader Name Fields */
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
              ) : showCompanyName ? (
                /* Company/Trust Name Field */
                <div className="space-y-2">
                  <Label htmlFor="company_name_or_trust">
                    Display Name *
                  </Label>
                  <Input
                    id="company_name_or_trust"
                    placeholder={isTrust(formData.entity_type) ? "e.g., Smith Family Trust" : "e.g., Acme Corporation Pty Ltd"}
                    value={formData.company_name_or_trust}
                    onChange={(e) => handleChange("company_name_or_trust", e.target.value)}
                    required
                  />
                </div>
              ) : null}

              {/* Company Link (for Person only - can have employer) */}
              {showEmployer && (
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
                                <Spinner size={16} />
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
                                      <div className="font-medium">{company.display_name}</div>
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

              {/* Employees (for Company/Trust/Sole Trader - can have employees) */}
              {showEmployees && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Employees / Key Contacts
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Search existing people or create new ones to link to this {createFormTypes.find(t => t.value === formData.entity_type)?.label?.toLowerCase() || "entity"} (optional)
                  </p>
                  <div className="flex gap-2">
                    <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={employeeSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          <span className="text-muted-foreground">Search people...</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search people by name..."
                            value={employeeSearchQuery}
                            onValueChange={setEmployeeSearchQuery}
                          />
                          <CommandList>
                            {searchingEmployees && (
                              <CommandEmpty>
                                <Spinner size={16} className="mx-auto" />
                              </CommandEmpty>
                            )}
                            {!searchingEmployees && employeeSearchQuery.length < 2 && (
                              <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
                            )}
                            {!searchingEmployees && employeeSearchQuery.length >= 2 && employeeSearchResults.length === 0 && (
                              <CommandEmpty>No people found</CommandEmpty>
                            )}
                            {employeeSearchResults.length > 0 && (
                              <CommandGroup heading="People">
                                {employeeSearchResults.map((person) => (
                                  <CommandItem
                                    key={person.id}
                                    value={person.id.toString()}
                                    onSelect={() => selectEmployee(person)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        pendingEmployees.some(e => e.id === person.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div className="font-medium">{person.display_name}</div>
                                      {person.email && (
                                        <div className="text-xs text-muted-foreground">{person.email}</div>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {employeeSearchQuery.length >= 2 && (
                              <CommandGroup heading="Create New">
                                <CommandItem onSelect={createAndAddEmployee}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Create &quot;{employeeSearchQuery}&quot; as new person
                                </CommandItem>
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {pendingEmployees.length > 0 && (
                    <div className="border rounded-lg divide-y mt-2">
                      {pendingEmployees.map((emp, index) => (
                        <div key={index} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm">{emp.name}</span>
                              {emp.id ? (
                                <span className="ml-2 text-xs text-green-600 dark:text-green-400">(existing)</span>
                              ) : (
                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(will be created)</span>
                              )}
                            </div>
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

          {/* Entity Type - SSoT: Loaded from API */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Type</CardTitle>
              <CardDescription>What kind of contact is this?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {entityTypesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner />
                  </div>
                ) : (
                  createFormTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                        formData.entity_type === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => handleChange("entity_type", type.value)}
                    >
                      {type.icon === "user" ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </button>
                  ))
                )}
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
                <Spinner size={16} className="mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add {createFormTypes.find(t => t.value === formData.entity_type)?.label || "Contact"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
