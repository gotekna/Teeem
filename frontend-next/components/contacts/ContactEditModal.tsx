"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Save, X, User, Building2, Phone, Globe, FileText, Plus, Star, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { isPerson as isPersonType, isCompany as isCompanyType } from "@/lib/entity-types";

interface ContactPerson {
  id?: number;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  role: string | null;
  is_primary: boolean;
  include_in_emails: boolean;
  _destroy?: boolean;
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
  tax_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  is_family_member: boolean;
  entity_type: string | null;
  sync_with_xero: boolean;
  xero_contact_id: string | null;
  primary_company_id?: number | null;
  primary_company?: { id: number; name: string } | null;
  contact_persons?: ContactPerson[];
  employees?: Array<{ id: number; display_name: string; email: string | null }>;
}

interface CompanySearchResult {
  id: number;
  display_name: string;
  email: string | null;
  entity_type: string | null;
}

interface ContactEditModalProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ContactEditModal({ contact, open, onOpenChange, onSaved }: ContactEditModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    first_name: "",
    last_name: "",
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
    primary_company_id: null as number | null,
  });

  // Contact persons (multiple emails/contacts)
  const [contactPersons, setContactPersons] = React.useState<ContactPerson[]>([]);

  // Company search state (for person -> company linking)
  const [companySearchOpen, setCompanySearchOpen] = React.useState(false);
  const [companySearchQuery, setCompanySearchQuery] = React.useState("");
  const [companySearchResults, setCompanySearchResults] = React.useState<CompanySearchResult[]>([]);
  const [searchingCompanies, setSearchingCompanies] = React.useState(false);
  const [selectedCompanyName, setSelectedCompanyName] = React.useState<string | null>(null);

  // Employee search state (for company -> person linking)
  const [employeeSearchOpen, setEmployeeSearchOpen] = React.useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = React.useState("");
  const [employeeSearchResults, setEmployeeSearchResults] = React.useState<CompanySearchResult[]>([]);
  const [searchingEmployees, setSearchingEmployees] = React.useState(false);
  const [employees, setEmployees] = React.useState<Array<{ id: number; display_name: string; email: string | null }>>([]);

  // Initialize form data when contact changes
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        mobile_phone: contact.mobile_phone || "",
        office_phone: contact.office_phone || "",
        website: contact.website || "",
        tax_number: contact.tax_number || "",
        address: contact.address || "",
        notes: contact.notes || "",
        is_active: contact.is_active,
        is_family_member: contact.is_family_member,
        entity_type: contact.entity_type || "person",
        sync_with_xero: contact.sync_with_xero,
        primary_company_id: contact.primary_company_id || null,
      });
      setSelectedCompanyName(contact.primary_company?.name || null);
      setContactPersons(contact.contact_persons || []);
      setEmployees(contact.employees || []);
    }
  }, [contact]);

  // Search companies when query changes
  // Search all contacts except persons (company, trust, or blank entity_type)
  React.useEffect(() => {
    const searchCompanies = async () => {
      if (companySearchQuery.length < 2) {
        setCompanySearchResults([]);
        return;
      }
      setSearchingCompanies(true);
      try {
        // Don't filter by entity_type - search all contacts and filter out persons client-side
        // This allows finding companies with blank entity_type (legacy data)
        const response = await api.get<{ contacts: CompanySearchResult[] }>("/api/v1/contacts", {
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

  // Search employees (people) when query changes
  React.useEffect(() => {
    const searchEmployees = async () => {
      if (employeeSearchQuery.length < 2) {
        setEmployeeSearchResults([]);
        return;
      }
      setSearchingEmployees(true);
      try {
        const response = await api.get<{ contacts: CompanySearchResult[] }>("/api/v1/contacts", {
          params: { entity_type: "person", search: employeeSearchQuery, per_page: 10 },
        });
        // Filter out people already linked as employees
        const existingIds = employees.map(e => e.id);
        setEmployeeSearchResults((response?.contacts || []).filter(c => !existingIds.includes(c.id)));
      } catch (error) {
        console.error("Failed to search employees:", error);
      } finally {
        setSearchingEmployees(false);
      }
    };
    const debounce = setTimeout(searchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [employeeSearchQuery, employees]);

  const handleInputChange = (field: string, value: string | boolean | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Contact persons management
  const addContactPerson = () => {
    setContactPersons([...contactPersons, {
      first_name: "",
      last_name: "",
      email: "",
      mobile: "",
      role: "",
      is_primary: contactPersons.length === 0, // First one is primary by default
      include_in_emails: true,
    }]);
  };

  const updateContactPerson = (index: number, field: keyof ContactPerson, value: string | boolean | null) => {
    const updated = [...contactPersons];
     
    (updated[index] as any)[field] = value;

    // If setting this one as primary, unset others
    if (field === "is_primary" && value === true) {
      updated.forEach((cp, i) => {
        if (i !== index) cp.is_primary = false;
      });
    }

    setContactPersons(updated);
  };

  const removeContactPerson = (index: number) => {
    const updated = [...contactPersons];
    const person = updated[index];
    if (person.id) {
      // Mark for destruction
      person._destroy = true;
    } else {
      // Remove from array if not saved yet
      updated.splice(index, 1);
    }
    setContactPersons(updated);
  };

  // Company selection
  const selectCompany = (company: CompanySearchResult) => {
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
      toast({ title: "Error", description: "Failed to create company", variant: "destructive" });
    }
    setCompanySearchOpen(false);
    setCompanySearchQuery("");
  };

  const clearCompany = () => {
    setFormData(prev => ({ ...prev, primary_company_id: null }));
    setSelectedCompanyName(null);
  };

  // Employee management (for company contacts)
  const addEmployee = async (employee: CompanySearchResult) => {
    if (!contact) return;
    try {
      await api.patch(`/api/v1/contacts/${employee.id}`, {
        contact: { primary_company_id: contact.id },
      });
      setEmployees([...employees, { id: employee.id, display_name: employee.display_name, email: employee.email }]);
      toast({ title: "Employee added", description: `${employee.display_name} linked to this company` });
    } catch (error) {
      console.error("Failed to add employee:", error);
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
    }
    setEmployeeSearchOpen(false);
    setEmployeeSearchQuery("");
  };

  const createAndAddEmployee = async () => {
    if (!contact || !employeeSearchQuery.trim()) return;
    try {
      const response = await api.post<{ contact: { id: number; display_name: string; email: string | null } }>("/api/v1/contacts", {
        contact: {
          display_name: employeeSearchQuery,
          entity_type: "person",
          primary_company_id: contact.id,
        },
      });
      if (response?.contact) {
        setEmployees([...employees, { id: response.contact.id, display_name: response.contact.display_name, email: response.contact.email }]);
        toast({ title: "Employee created", description: `Created and linked "${response.contact.display_name}"` });
      }
    } catch (error) {
      console.error("Failed to create employee:", error);
      toast({ title: "Error", description: "Failed to create employee", variant: "destructive" });
    }
    setEmployeeSearchOpen(false);
    setEmployeeSearchQuery("");
  };

  const removeEmployee = async (employeeId: number) => {
    try {
      await api.patch(`/api/v1/contacts/${employeeId}`, {
        contact: { primary_company_id: null },
      });
      setEmployees(employees.filter(e => e.id !== employeeId));
      toast({ title: "Employee removed", description: "Employee unlinked from this company" });
    } catch (error) {
      console.error("Failed to remove employee:", error);
      toast({ title: "Error", description: "Failed to remove employee", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!contact) return;

    setSaving(true);
    try {
      // Build display_name from first_name and last_name
      const display_name = [formData.first_name, formData.last_name].filter(Boolean).join(" ") || "Unknown";

      await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: {
          ...formData,
          display_name,
          contact_persons_attributes: contactPersons.filter(cp => !cp._destroy || cp.id), // Include marked for deletion if has ID
        },
      });

      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save contact:", error);
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!contact) return null;

  const isXeroSynced = !!contact.xero_contact_id;
  const isPerson = isPersonType(formData.entity_type);
  const isCompany = isCompanyType(formData.entity_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPerson ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            Edit {isPerson ? "Contact" : "Company"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact Details</TabsTrigger>
            <TabsTrigger value="relationships">{isPerson ? "Company" : "Employees"}</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">{isPerson ? "First Name" : "Display Name"}</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  placeholder={isPerson ? "First name" : "Display name"}
                />
              </div>
              {isPerson && (
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Primary Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="email@example.com"
                disabled={isXeroSynced}
              />
              {isXeroSynced && (
                <p className="text-xs text-muted-foreground">Email is synced from Xero</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type</Label>
              <select
                id="entity_type"
                value={formData.entity_type}
                onChange={(e) => handleInputChange("entity_type", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="person">Person</option>
                <option value="company">Company</option>
                <option value="trust">Trust</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Is this contact active?</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange("is_active", checked)}
              />
            </div>

            {isPerson && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Family Member</Label>
                  <p className="text-xs text-muted-foreground">Is this a family member?</p>
                </div>
                <Switch
                  checked={formData.is_family_member}
                  onCheckedChange={(checked) => handleInputChange("is_family_member", checked)}
                />
              </div>
            )}
          </TabsContent>

          {/* Contact Details Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            {/* Additional Contact Persons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Persons
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addContactPerson}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {contactPersons.filter(cp => !cp._destroy).length === 0 ? (
                <p className="text-sm text-muted-foreground">No additional contact persons. Click Add to create one.</p>
              ) : (
                <div className="space-y-3">
                  {contactPersons.map((person, index) => !person._destroy && (
                    <div key={person.id || `new-${index}`} className="border rounded-lg p-3 space-y-2 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {person.is_primary ? (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => updateContactPerson(index, "is_primary", true)}
                            >
                              Set as Primary
                            </Button>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => removeContactPerson(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="First name"
                          value={person.first_name}
                          onChange={(e) => updateContactPerson(index, "first_name", e.target.value)}
                        />
                        <Input
                          placeholder="Last name"
                          value={person.last_name}
                          onChange={(e) => updateContactPerson(index, "last_name", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="email"
                          placeholder="Email"
                          value={person.email || ""}
                          onChange={(e) => updateContactPerson(index, "email", e.target.value)}
                        />
                        <Input
                          placeholder="Mobile"
                          value={person.mobile || ""}
                          onChange={(e) => updateContactPerson(index, "mobile", e.target.value)}
                        />
                      </div>
                      <Input
                        placeholder="Role (e.g., Accountant, Director)"
                        value={person.role || ""}
                        onChange={(e) => updateContactPerson(index, "role", e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Mobile Phone
                  </Label>
                  <Input
                    id="mobile_phone"
                    value={formData.mobile_phone}
                    onChange={(e) => handleInputChange("mobile_phone", e.target.value)}
                    placeholder="0400 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="office_phone" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Office Phone
                  </Label>
                  <Input
                    id="office_phone"
                    value={formData.office_phone}
                    onChange={(e) => handleInputChange("office_phone", e.target.value)}
                    placeholder="07 0000 0000"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              {/* Address: Edit via the structured Address section on the contact detail page */}
              {/* SSoT: contact_addresses table is the source of truth for addresses */}
            </div>
          </TabsContent>

          {/* Relationships Tab - Company (for Person) or Employees (for Company) */}
          <TabsContent value="relationships" className="space-y-4 mt-4">
            {isPerson ? (
              /* Person -> Company linking */
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company / Employer
                </Label>
                <p className="text-sm text-muted-foreground">
                  Link this person to their employer or company
                </p>

                <div className="flex gap-2">
                  <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
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
                                <Button size="sm" onClick={createAndSelectCompany}>
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
                    <Button variant="ghost" size="icon" onClick={clearCompany}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : isCompany ? (
              /* Company -> Employees linking */
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Employees
                </Label>
                <p className="text-sm text-muted-foreground">
                  Link people who work at this company
                </p>

                <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Add employee...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search people or create new..."
                        value={employeeSearchQuery}
                        onValueChange={setEmployeeSearchQuery}
                      />
                      <CommandList>
                        {searchingEmployees && (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                        {!searchingEmployees && employeeSearchQuery.length >= 2 && employeeSearchResults.length === 0 && (
                          <CommandEmpty>
                            <div className="py-2 text-center">
                              <p className="text-sm text-muted-foreground mb-2">No people found</p>
                              <Button size="sm" onClick={createAndAddEmployee}>
                                <Plus className="h-4 w-4 mr-1" />
                                Create &quot;{employeeSearchQuery}&quot;
                              </Button>
                            </div>
                          </CommandEmpty>
                        )}
                        {employeeSearchResults.length > 0 && (
                          <CommandGroup heading="People">
                            {employeeSearchResults.map((person) => (
                              <CommandItem
                                key={person.id}
                                value={person.id.toString()}
                                onSelect={() => addEmployee(person)}
                              >
                                <User className="mr-2 h-4 w-4" />
                                <div>
                                  <div className="font-medium">{person.display_name}</div>
                                  {person.email && (
                                    <div className="text-xs text-muted-foreground">{person.email}</div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                            {employeeSearchQuery.length >= 2 && (
                              <CommandItem onSelect={createAndAddEmployee}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create &quot;{employeeSearchQuery}&quot;
                              </CommandItem>
                            )}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {employees.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {employees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{emp.display_name}</div>
                            {emp.email && (
                              <div className="text-xs text-muted-foreground">{emp.email}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeEmployee(emp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Trust entities don&apos;t have company/employee relationships.
              </p>
            )}
          </TabsContent>

          {/* Other Tab */}
          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="tax_number">ABN / Tax Number</Label>
              <Input
                id="tax_number"
                value={formData.tax_number}
                onChange={(e) => handleInputChange("tax_number", e.target.value)}
                placeholder="XX XXX XXX XXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Internal notes about this contact"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sync with Xero</Label>
                <p className="text-xs text-muted-foreground">Keep this contact synced with Xero</p>
              </div>
              <Switch
                checked={formData.sync_with_xero}
                onCheckedChange={(checked) => handleInputChange("sync_with_xero", checked)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
