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
import { ComboboxDropdown, ComboboxItem } from "@/components/ui/combobox-dropdown";
import { ArrowLeft, Loader2, Building2, User, Users, DollarSign, Wrench, ClipboardList, Calculator } from "lucide-react";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";

interface SuburbSearchResult {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
}

// Dynamically import LocationMapSelector to avoid SSR issues
const LocationMapSelector = dynamic(
  () => import("@/components/jobs/LocationMapSelector").then((mod) => mod.LocationMapSelector),
  { ssr: false }
);

interface JobFormData {
  site_supervisor_name: string;
  address: string;
  description: string;
  lot_number: string;
  street_number: string;
  street_name: string;
  street_type: string;
  suburb: string;
  postcode: string;
  state: string;
  job_type_id: string;
  job_status_id: string;
  job_stage_id: string;
  contract_value: string;
  latitude: number | null;
  longitude: number | null;
}

interface JobType {
  id: number;
  name: string;
}

interface JobStatus {
  id: number;
  name: string;
}

interface JobStage {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  display_name?: string;
  company_name?: string;
  email?: string;
  mobile_phone?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface PeopleFormData {
  client1_id: number | null;
  client2_id: number | null;
  referrer_id: number | null;
  external_sales_id: number | null;
  supervisor_id: number | null;
  site_coordinator_id: number | null;
  estimator_id: number | null;
  internal_sales_id: number | null;
  coordinator_id: number | null;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [loadingLookups, setLoadingLookups] = React.useState(true);
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);

  // People state
  const [users, setUsers] = React.useState<User[]>([]);
  const [allContacts, setAllContacts] = React.useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [peopleData, setPeopleData] = React.useState<PeopleFormData>({
    client1_id: null,
    client2_id: null,
    referrer_id: null,
    external_sales_id: null,
    supervisor_id: null,
    site_coordinator_id: null,
    estimator_id: null,
    internal_sales_id: null,
    coordinator_id: null,
  });
  // Store selected contacts for display
  const [selectedContacts, setSelectedContacts] = React.useState<{
    client1?: Contact;
    client2?: Contact;
    referrer?: Contact;
    external_sales?: Contact;
  }>({});

  const [formData, setFormData] = React.useState<JobFormData>({
    site_supervisor_name: "",
    address: "",
    description: "",
    lot_number: "",
    street_number: "",
    street_name: "",
    street_type: "",
    suburb: "",
    postcode: "",
    state: "",
    job_type_id: "",
    job_status_id: "",
    job_stage_id: "",
    contract_value: "",
    latitude: null,
    longitude: null,
  });

  // Suburb search state
  const [suburbSearchQuery, setSuburbSearchQuery] = React.useState("");
  const [suburbSearchResults, setSuburbSearchResults] = React.useState<SuburbSearchResult[]>([]);
  const [suburbSearchLoading, setSuburbSearchLoading] = React.useState(false);
  const [showSuburbDropdown, setShowSuburbDropdown] = React.useState(false);
  const suburbInputRef = React.useRef<HTMLInputElement>(null);
  const suburbDropdownRef = React.useRef<HTMLDivElement>(null);

  // Load job types, statuses, stages, and users
  React.useEffect(() => {
    const loadLookupData = async () => {
      try {
        setLoadingLookups(true);
        const [typesData, statusesData, usersData] = await Promise.all([
          api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
          api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
          api.get<{ users?: User[] } | User[]>("/api/v1/users"),
        ]);

        setJobTypes(typesData?.job_types || []);
        setJobStatuses(statusesData?.job_statuses || []);
        setUsers(Array.isArray(usersData) ? usersData : usersData?.users || []);

        // Set default values if available
        if (typesData?.job_types && typesData.job_types.length > 0) {
          setFormData(prev => ({ ...prev, job_type_id: typesData.job_types[0].id.toString() }));
        }
        if (statusesData?.job_statuses && statusesData.job_statuses.length > 0) {
          // Default to "Enquiry" if it exists
          const enquiryStatus = statusesData.job_statuses.find(s => s.name === "Enquiry");
          const defaultStatus = enquiryStatus || statusesData.job_statuses[0];
          setFormData(prev => ({ ...prev, job_status_id: defaultStatus.id.toString() }));
        }
      } catch (error) {
        console.error("Failed to load lookup data:", error);
      } finally {
        setLoadingLookups(false);
      }
    };

    loadLookupData();
  }, []);

  // Load contacts on mount
  React.useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const response = await api.get<{ contacts?: Contact[] } | Contact[]>("/api/v1/contacts");
        const contacts = Array.isArray(response) ? response : response?.contacts || [];
        setAllContacts(contacts);
      } catch (error) {
        console.error("Failed to load contacts:", error);
      } finally {
        setLoadingContacts(false);
      }
    };
    loadContacts();
  }, []);

  // Convert contacts to combobox items
  const contactItems: ComboboxItem[] = allContacts.map((c: Contact) => ({
    id: c.id.toString(),
    label: c.display_name || c.company_name || `Contact ${c.id}`,
  }));

  // Convert users to combobox items
  const userItems: ComboboxItem[] = users.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));

  // Handle contact selection for a role
  const handleContactSelect = (
    role: "client1" | "client2" | "referrer" | "external_sales",
    contact: Contact | null
  ) => {
    setPeopleData((prev) => ({
      ...prev,
      [`${role}_id`]: contact?.id || null,
    }));
    setSelectedContacts((prev) => ({
      ...prev,
      [role]: contact || undefined,
    }));
  };

  // Handle user selection for internal roles
  const handleUserSelect = (
    role: "supervisor" | "site_coordinator" | "estimator" | "internal_sales" | "coordinator",
    userId: number | null
  ) => {
    setPeopleData((prev) => ({
      ...prev,
      [`${role}_id`]: userId,
    }));
  };

  // Load stages when type and status are selected
  React.useEffect(() => {
    const loadStages = async () => {
      if (!formData.job_type_id || !formData.job_status_id) {
        setJobStages([]);
        setFormData(prev => ({ ...prev, job_stage_id: "" }));
        return;
      }

      try {
        const stagesData = await api.get<{ stages: JobStage[] }>(
          `/api/v1/job_types/${formData.job_type_id}/statuses/${formData.job_status_id}/stages`
        );

        setJobStages(stagesData?.stages || []);

        // Set first stage as default if available
        if (stagesData?.stages && stagesData.stages.length > 0) {
          setFormData(prev => ({ ...prev, job_stage_id: stagesData.stages[0].id.toString() }));
        } else {
          setFormData(prev => ({ ...prev, job_stage_id: "" }));
        }
      } catch (error) {
        console.error("Failed to load stages:", error);
        setJobStages([]);
        setFormData(prev => ({ ...prev, job_stage_id: "" }));
      }
    };

    loadStages();
  }, [formData.job_type_id, formData.job_status_id]);

  // Debounced suburb search
  React.useEffect(() => {
    const searchSuburbs = async () => {
      if (suburbSearchQuery.length < 2) {
        setSuburbSearchResults([]);
        return;
      }

      setSuburbSearchLoading(true);
      try {
        const response = await api.get<{ suburbs: SuburbSearchResult[] }>(
          `/api/v1/suburbs/search?q=${encodeURIComponent(suburbSearchQuery)}`
        );
        setSuburbSearchResults(response.suburbs || []);
      } catch (error) {
        console.error("Failed to search suburbs:", error);
        setSuburbSearchResults([]);
      } finally {
        setSuburbSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(searchSuburbs, 300);
    return () => clearTimeout(timeoutId);
  }, [suburbSearchQuery]);

  // Close suburb dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suburbDropdownRef.current &&
        !suburbDropdownRef.current.contains(event.target as Node) &&
        suburbInputRef.current &&
        !suburbInputRef.current.contains(event.target as Node)
      ) {
        setShowSuburbDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle suburb selection - auto-fills postcode and state
  const handleSuburbSelect = (suburb: SuburbSearchResult) => {
    setFormData(prev => ({
      ...prev,
      suburb: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
    }));
    setSuburbSearchQuery("");
    setShowSuburbDropdown(false);
  };

  const handleChange = (field: keyof JobFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (data: {
    location?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    lotNumber?: string;
    streetNumber?: string;
    streetName?: string;
    streetType?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      address: data.location || prev.address,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      lot_number: data.lotNumber || prev.lot_number,
      street_number: data.streetNumber || prev.street_number,
      street_name: data.streetName || prev.street_name,
      street_type: data.streetType || prev.street_type,
      suburb: data.suburb || prev.suburb,
      postcode: data.postcode || prev.postcode,
      state: data.state || prev.state,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post<{ id: number }>("/api/v1/jobs", {
        job: {
          // name: Auto-generated on backend from address components
          // job_number: Auto-created on backend
          site_supervisor_name: formData.site_supervisor_name,
          location: formData.address,
          latitude: formData.latitude,
          longitude: formData.longitude,
          lot_number: formData.lot_number,
          street_number: formData.street_number,
          street_name: formData.street_name,
          street_type: formData.street_type,
          suburb: formData.suburb,
          postcode: formData.postcode,
          state: formData.state,
          description: formData.description,
          job_type_id: formData.job_type_id ? parseInt(formData.job_type_id) : null,
          job_status_id: formData.job_status_id ? parseInt(formData.job_status_id) : null,
          job_stage_id: formData.job_stage_id ? parseInt(formData.job_stage_id) : null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : 0,
        },
      });

      const jobId = response?.id;
      if (jobId) {
        // Add job contacts after job creation
        const contactPromises: Promise<unknown>[] = [];

        // External contacts (using contact_id)
        if (peopleData.client1_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { contact_id: peopleData.client1_id, role: "client", primary: true },
            })
          );
        }
        if (peopleData.client2_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { contact_id: peopleData.client2_id, role: "client", primary: false },
            })
          );
        }
        if (peopleData.referrer_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { contact_id: peopleData.referrer_id, role: "referral" },
            })
          );
        }
        if (peopleData.external_sales_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { contact_id: peopleData.external_sales_id, role: "external_sales" },
            })
          );
        }

        // Internal team (using user_id)
        if (peopleData.supervisor_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { user_id: peopleData.supervisor_id, role: "supervisor" },
            })
          );
        }
        if (peopleData.site_coordinator_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { user_id: peopleData.site_coordinator_id, role: "site_coordinator" },
            })
          );
        }
        if (peopleData.estimator_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { user_id: peopleData.estimator_id, role: "estimator" },
            })
          );
        }
        if (peopleData.internal_sales_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { user_id: peopleData.internal_sales_id, role: "internal_sales" },
            })
          );
        }
        if (peopleData.coordinator_id) {
          contactPromises.push(
            api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
              job_contact: { user_id: peopleData.coordinator_id, role: "coordinator" },
            })
          );
        }

        // Execute all contact additions (don't fail the whole job if contacts fail)
        if (contactPromises.length > 0) {
          await Promise.allSettled(contactPromises);
        }

        // Navigate to the new job
        router.push(`/jobs/${jobId}`);
      } else {
        router.push("/jobs");
      }
    } catch (error) {
      console.error("Failed to create job:", error);
      router.push("/jobs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">New Job</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new construction project
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>Basic information about the job</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Map Selector - Moved to top */}
              <div className="space-y-2">
                <Label>Location Pin</Label>
                <LocationMapSelector
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onLocationChange={handleLocationChange}
                />
              </div>

              {/* Address Details */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Address Details</Label>
                <p className="text-xs text-muted-foreground">
                  These fields auto-populate from the map or can be edited manually
                </p>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="lot_number">Lot Number</Label>
                    <Input
                      id="lot_number"
                      value={formData.lot_number}
                      onChange={(e) => handleChange("lot_number", e.target.value)}
                      placeholder="Enter lot number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="street_number">Street Number</Label>
                    <Input
                      id="street_number"
                      value={formData.street_number}
                      onChange={(e) => handleChange("street_number", e.target.value)}
                      placeholder="Enter street number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="street_name">Street Name</Label>
                    <Input
                      id="street_name"
                      value={formData.street_name}
                      onChange={(e) => handleChange("street_name", e.target.value)}
                      placeholder="e.g., Alperton"
                    />
                  </div>
                  <div>
                    <Label htmlFor="street_type">Street Type</Label>
                    <Input
                      id="street_type"
                      value={formData.street_type}
                      onChange={(e) => handleChange("street_type", e.target.value)}
                      placeholder="e.g., Road, ST"
                    />
                  </div>
                </div>

                <div className="relative">
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input
                    ref={suburbInputRef}
                    id="suburb"
                    value={suburbSearchQuery || formData.suburb}
                    onChange={(e) => {
                      setSuburbSearchQuery(e.target.value);
                      setShowSuburbDropdown(true);
                      handleChange("suburb", e.target.value);
                    }}
                    onFocus={() => {
                      if (suburbSearchQuery.length >= 2 || formData.suburb.length >= 2) {
                        setShowSuburbDropdown(true);
                      }
                    }}
                    placeholder="Search suburb or postcode..."
                    autoComplete="off"
                  />
                  {/* Suburb search dropdown */}
                  {showSuburbDropdown && (suburbSearchResults.length > 0 || suburbSearchLoading) && (
                    <div
                      ref={suburbDropdownRef}
                      className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                      {suburbSearchLoading ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Searching...
                        </div>
                      ) : (
                        suburbSearchResults.map((suburb) => (
                          <button
                            key={suburb.id}
                            type="button"
                            onClick={() => handleSuburbSelect(suburb)}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between text-sm"
                          >
                            <span>
                              <span className="font-medium">{suburb.name}</span>
                              <span className="text-muted-foreground ml-2">{suburb.postcode}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {suburb.state}
                              {suburb.council && (
                                <span className="ml-1 text-green-600 dark:text-green-400">
                                  ({suburb.council.replace(" Council", "").replace(" Regional", "").replace(" City", "")})
                                </span>
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="e.g., QLD"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => handleChange("postcode", e.target.value)}
                      placeholder="e.g., 4000"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Project Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Type, status, stage and financial details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLookups ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="job_type_id">Job Type *</Label>
                    <Select
                      value={formData.job_type_id}
                      onValueChange={(value) => handleChange("job_type_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_status_id">Job Status *</Label>
                    <Select
                      value={formData.job_status_id}
                      onValueChange={(value) => handleChange("job_status_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_stage_id">Job Stage</Label>
                    <Select
                      value={formData.job_stage_id}
                      onValueChange={(value) => handleChange("job_stage_id", value)}
                      disabled={jobStages.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={jobStages.length === 0 ? "No stages available" : "Select stage"} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id.toString()}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {jobStages.length === 0 && formData.job_type_id && formData.job_status_id && (
                      <p className="text-xs text-muted-foreground">
                        No stages configured for this type and status combination
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract_value">Contract Value ($)</Label>
                    <Input
                      id="contract_value"
                      type="number"
                      placeholder="e.g., 500000"
                      value={formData.contract_value}
                      onChange={(e) => handleChange("contract_value", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the project..."
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* People */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              People
            </CardTitle>
            <CardDescription>Assign clients, referrer, and team members to this job</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* External Contacts */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  Clients
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="client1">Client 1 (Primary)</Label>
                  <ComboboxDropdown
                    placeholder="Search contacts..."
                    items={contactItems}
                    selectedItem={selectedContacts.client1 ? {
                      id: selectedContacts.client1.id.toString(),
                      label: selectedContacts.client1.display_name || selectedContacts.client1.company_name || "",
                    } : undefined}
                    onSelect={(item) => {
                      const contact = allContacts.find((c: Contact) => c.id.toString() === item.id);
                      handleContactSelect("client1", contact || null);
                    }}
                    isLoading={loadingContacts}
                    clearable
                    onClear={() => handleContactSelect("client1", null)}
                    searchInTrigger
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client2">Client 2</Label>
                  <ComboboxDropdown
                    placeholder="Search contacts..."
                    items={contactItems}
                    selectedItem={selectedContacts.client2 ? {
                      id: selectedContacts.client2.id.toString(),
                      label: selectedContacts.client2.display_name || selectedContacts.client2.company_name || "",
                    } : undefined}
                    onSelect={(item) => {
                      const contact = allContacts.find((c: Contact) => c.id.toString() === item.id);
                      handleContactSelect("client2", contact || null);
                    }}
                    isLoading={loadingContacts}
                    clearable
                    onClear={() => handleContactSelect("client2", null)}
                    searchInTrigger
                  />
                </div>
              </div>

              {/* Referrer & External Sales */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-green-500" />
                  Referral & Sales
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="referrer">Referrer</Label>
                  <ComboboxDropdown
                    placeholder="Search contacts..."
                    items={contactItems}
                    selectedItem={selectedContacts.referrer ? {
                      id: selectedContacts.referrer.id.toString(),
                      label: selectedContacts.referrer.display_name || selectedContacts.referrer.company_name || "",
                    } : undefined}
                    onSelect={(item) => {
                      const contact = allContacts.find((c: Contact) => c.id.toString() === item.id);
                      handleContactSelect("referrer", contact || null);
                    }}
                    isLoading={loadingContacts}
                    clearable
                    onClear={() => handleContactSelect("referrer", null)}
                    searchInTrigger
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="external_sales">External Sales</Label>
                  <ComboboxDropdown
                    placeholder="Search contacts..."
                    items={contactItems}
                    selectedItem={selectedContacts.external_sales ? {
                      id: selectedContacts.external_sales.id.toString(),
                      label: selectedContacts.external_sales.display_name || selectedContacts.external_sales.company_name || "",
                    } : undefined}
                    onSelect={(item) => {
                      const contact = allContacts.find((c: Contact) => c.id.toString() === item.id);
                      handleContactSelect("external_sales", contact || null);
                    }}
                    isLoading={loadingContacts}
                    clearable
                    onClear={() => handleContactSelect("external_sales", null)}
                    searchInTrigger
                  />
                </div>
              </div>

              {/* Internal Team */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-500" />
                  Internal Team
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="supervisor" className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Supervisor
                  </Label>
                  <Select
                    value={peopleData.supervisor_id?.toString() || ""}
                    onValueChange={(value) => handleUserSelect("supervisor", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {userItems.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site_coordinator" className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" />
                    Site Coordinator
                  </Label>
                  <Select
                    value={peopleData.site_coordinator_id?.toString() || ""}
                    onValueChange={(value) => handleUserSelect("site_coordinator", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site coordinator" />
                    </SelectTrigger>
                    <SelectContent>
                      {userItems.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimator" className="flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Estimator
                  </Label>
                  <Select
                    value={peopleData.estimator_id?.toString() || ""}
                    onValueChange={(value) => handleUserSelect("estimator", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select estimator" />
                    </SelectTrigger>
                    <SelectContent>
                      {userItems.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internal_sales" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Internal Sales
                  </Label>
                  <Select
                    value={peopleData.internal_sales_id?.toString() || ""}
                    onValueChange={(value) => handleUserSelect("internal_sales", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select internal sales" />
                    </SelectTrigger>
                    <SelectContent>
                      {userItems.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coordinator" className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" />
                    Client Coordinator
                  </Label>
                  <Select
                    value={peopleData.coordinator_id?.toString() || ""}
                    onValueChange={(value) => handleUserSelect("coordinator", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select coordinator" />
                    </SelectTrigger>
                    <SelectContent>
                      {userItems.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/jobs">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || loadingLookups}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Job"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
