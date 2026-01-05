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
import {
  Building2,
  User,
  Users,
  DollarSign,
  Wrench,
  ClipboardList,
  Calculator,
  Mail,
  FileText,
  AlertTriangle,
  Clock,
  Wallet,
  MessageSquare,
  Paperclip,
  CheckSquare,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { DEBOUNCE_SEARCH_MS } from "@/lib/constants/timeout-constants";
import { useSearchParams, usePathname } from "next/navigation";
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
  council: string;
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
  role_names?: string[];
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

interface EmailProposal {
  id: number;
  status: string;
  email?: {
    from_email: string;
    subject: string;
  };
  extracted_data?: {
    job_title?: string;
    property_address?: string;
    job_type?: string;
    contract_value?: number;
    description?: string;
    scope_of_work?: string;
    notes?: string;
    special_requirements?: string;
    timeline_notes?: string;
    budget_breakdown?: string;
    risk_factors?: string;
    communication_preferences?: string;
    attachments_summary?: string;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      contact_id?: number;
      contact_exists?: boolean;
    };
    customer2?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      contact_id?: number;
      contact_exists?: boolean;
    };
    referral_contact?: {
      name?: string;
      email?: string;
      phone?: string;
      contact_id?: number;
      contact_exists?: boolean;
    };
    external_sales?: Array<{
      name: string;
      email: string;
      contact_id?: number;
      contact_exists?: boolean;
    }>;
    internal_sales?: {
      user_id?: number;
      user_name?: string;
      user_email?: string;
    };
  };
}

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const proposalId = searchParams.get("from_proposal");

  // Parse status from path: /jobs/new/status/enquiry → "enquiry"
  // Also supports legacy ?status= query param for backward compatibility
  const statusFromPath = React.useMemo(() => {
    const parts = pathname.replace("/jobs/new", "").split("/").filter(Boolean);
    if (parts[0] === "status" && parts[1]) {
      return parts[1]; // e.g., "enquiry"
    }
    // Legacy query param support
    const queryStatus = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("status")
      : null;
    return queryStatus?.toLowerCase() || null;
  }, [pathname]);

  const [loading, setLoading] = React.useState(false);
  const [loadingLookups, setLoadingLookups] = React.useState(true);
  const [loadingProposal, setLoadingProposal] = React.useState(!!proposalId);
  const [proposal, setProposal] = React.useState<EmailProposal | null>(null);
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
    council: "",
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
          // Use status from path if provided, otherwise default to "Enquiry"
          let matchedStatus = null;
          if (statusFromPath) {
            // Case-insensitive match for path-based status
            matchedStatus = statusesData.job_statuses.find(
              s => s.name.toLowerCase() === statusFromPath.toLowerCase()
            );
          }
          if (!matchedStatus) {
            // Default to "Enquiry" if no path status or no match found
            matchedStatus = statusesData.job_statuses.find(s => s.name === "Enquiry");
          }
          const defaultStatus = matchedStatus || statusesData.job_statuses[0];
          setFormData(prev => ({ ...prev, job_status_id: defaultStatus.id.toString() }));
        }
      } catch (error) {
        console.error("Failed to load lookup data:", error);
      } finally {
        setLoadingLookups(false);
      }
    };

    loadLookupData();
  }, [statusFromPath]);

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

  // Load email proposal if from_proposal param is set
  React.useEffect(() => {
    if (!proposalId) return;

    const loadProposal = async () => {
      try {
        setLoadingProposal(true);
        const response = await api.get<{ proposal: EmailProposal }>(
          `/api/v1/email_job_proposals/${proposalId}`
        );
        const prop = response.proposal;
        setProposal(prop);

        // Pre-fill form with extracted data
        const data = prop.extracted_data || {};

        // Build description from email + extracted info
        const descriptionParts: string[] = [];

        if (data.description) {
          descriptionParts.push(data.description);
        }

        if (data.notes) {
          descriptionParts.push("--- NOTES ---\n" + data.notes);
        }

        if (data.scope_of_work) {
          descriptionParts.push("--- SCOPE OF WORK ---\n" + data.scope_of_work);
        }

        if (data.special_requirements) {
          descriptionParts.push("--- SPECIAL REQUIREMENTS ---\n" + data.special_requirements);
        }

        if (data.timeline_notes) {
          descriptionParts.push("--- TIMELINE ---\n" + data.timeline_notes);
        }

        if (data.budget_breakdown) {
          descriptionParts.push("--- BUDGET ---\n" + data.budget_breakdown);
        }

        if (data.risk_factors) {
          descriptionParts.push("--- RISKS ---\n" + data.risk_factors);
        }

        if (data.communication_preferences) {
          descriptionParts.push("--- COMMUNICATION ---\n" + data.communication_preferences);
        }

        if (data.attachments_summary) {
          descriptionParts.push("--- ATTACHMENTS ---\n" + data.attachments_summary);
        }

        if (prop.email?.subject) {
          descriptionParts.push(`[From email: ${prop.email.subject}]`);
        }

        const description = descriptionParts.join("\n\n");

        // Parse the property address to extract components if available
        const propertyAddress = data.property_address || data.job_title || "";

        // Try to parse address components from the property address
        // Format typically: "45 Smith Street, Paddington QLD 4064"
        let streetNumber = "";
        let streetName = "";
        let streetType = "";
        let suburb = "";
        let state = "";
        let postcode = "";

        // Simple regex to parse Australian address
        const addressMatch = propertyAddress.match(/^(\d+)\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres|Way|Lane|Ln|Boulevard|Blvd|Parade|Pde|Terrace|Tce),?\s*(.+?)(?:\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT))?\s*(\d{4})?$/i);

        if (addressMatch) {
          streetNumber = addressMatch[1] || "";
          streetName = addressMatch[2] || "";
          streetType = addressMatch[3] || "";
          suburb = addressMatch[4]?.trim() || "";
          state = addressMatch[5]?.toUpperCase() || "";
          postcode = addressMatch[6] || "";
        }

        console.log("Pre-filling form with:", {
          address: propertyAddress,
          description: description.substring(0, 100) + "...",
          contract_value: data.contract_value,
          streetNumber,
          streetName,
          streetType,
          suburb,
          state,
          postcode
        });

        setFormData(prev => ({
          ...prev,
          address: propertyAddress,
          description: description,
          contract_value: data.contract_value?.toString() || "",
          street_number: streetNumber || prev.street_number,
          street_name: streetName || prev.street_name,
          street_type: streetType || prev.street_type,
          suburb: suburb || prev.suburb,
          state: state || prev.state,
          postcode: postcode || prev.postcode,
        }));

        // Store contact IDs to populate after contacts load
        const contactIdsToPopulate = {
          client1_id: data.customer?.contact_id || null,
          client2_id: data.customer2?.contact_id || null,
          referrer_id: data.referral_contact?.contact_id || null,
          external_sales_id: data.external_sales?.[0]?.contact_id || null,
        };

        console.log("Proposal loaded with contact IDs:", contactIdsToPopulate);
        console.log("Internal sales user_id:", data.internal_sales?.user_id);

        // Set people data IDs
        setPeopleData(prev => ({
          ...prev,
          ...contactIdsToPopulate,
          internal_sales_id: data.internal_sales?.user_id || null,
        }));

      } catch (error) {
        console.error("Failed to load proposal:", error);
      } finally {
        setLoadingProposal(false);
      }
    };

    loadProposal();
  }, [proposalId]);

  // Track if we've already populated contacts from proposal
  const [hasPopulatedFromProposal, setHasPopulatedFromProposal] = React.useState(false);

  // Populate selectedContacts when contacts load and we have proposal IDs
  React.useEffect(() => {
    // Skip if already populated, no contacts, or no proposal
    if (hasPopulatedFromProposal || allContacts.length === 0 || !proposalId) return;

    // Check if we have any IDs to populate
    const hasIds =
      peopleData.client1_id ||
      peopleData.client2_id ||
      peopleData.referrer_id ||
      peopleData.external_sales_id;

    if (!hasIds) return;

    // Find and set the contact objects
    const newSelectedContacts: typeof selectedContacts = {};

    if (peopleData.client1_id) {
      const contact = allContacts.find(c => c.id === peopleData.client1_id);
      if (contact) newSelectedContacts.client1 = contact;
    }

    if (peopleData.client2_id) {
      const contact = allContacts.find(c => c.id === peopleData.client2_id);
      if (contact) newSelectedContacts.client2 = contact;
    }

    if (peopleData.referrer_id) {
      const contact = allContacts.find(c => c.id === peopleData.referrer_id);
      if (contact) newSelectedContacts.referrer = contact;
    }

    if (peopleData.external_sales_id) {
      const contact = allContacts.find(c => c.id === peopleData.external_sales_id);
      if (contact) newSelectedContacts.external_sales = contact;
    }

    if (Object.keys(newSelectedContacts).length > 0) {
      console.log("Populating contacts from proposal:", newSelectedContacts);
      setSelectedContacts(newSelectedContacts);
      setHasPopulatedFromProposal(true);
    }
  }, [allContacts, peopleData.client1_id, peopleData.client2_id, peopleData.referrer_id, peopleData.external_sales_id, proposalId, hasPopulatedFromProposal]);

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

  // Filter users by role for Internal Team dropdowns
  const supervisorUsers = React.useMemo(() =>
    users.filter(u => u.role_names?.includes("supervisor")), [users]);
  const siteCoordinatorUsers = React.useMemo(() =>
    users.filter(u => u.role_names?.includes("site_coordinator")), [users]);
  const estimatorUsers = React.useMemo(() =>
    users.filter(u => u.role_names?.includes("estimator")), [users]);
  const salesUsers = React.useMemo(() =>
    users.filter(u => u.role_names?.includes("sales")), [users]);
  const coordinatorUsers = React.useMemo(() =>
    users.filter(u => u.role_names?.includes("client_coordinator")), [users]);

  // Convert role-filtered users to combobox items
  const supervisorItems: ComboboxItem[] = supervisorUsers.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));
  const siteCoordinatorItems: ComboboxItem[] = siteCoordinatorUsers.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));
  const estimatorItems: ComboboxItem[] = estimatorUsers.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));
  const salesItems: ComboboxItem[] = salesUsers.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));
  const coordinatorItems: ComboboxItem[] = coordinatorUsers.map((u) => ({
    id: u.id.toString(),
    label: u.name || u.email,
  }));

  // Auto-fill Internal Team when only one user has that role
  React.useEffect(() => {
    if (users.length === 0) return;

    setPeopleData(prev => {
      const updates: Partial<PeopleFormData> = {};

      // Auto-fill supervisor if exactly one user has that role and not already set
      if (supervisorUsers.length === 1 && prev.supervisor_id === null) {
        updates.supervisor_id = supervisorUsers[0].id;
      }
      // Auto-fill site coordinator if exactly one user has that role and not already set
      if (siteCoordinatorUsers.length === 1 && prev.site_coordinator_id === null) {
        updates.site_coordinator_id = siteCoordinatorUsers[0].id;
      }
      // Auto-fill estimator if exactly one user has that role and not already set
      if (estimatorUsers.length === 1 && prev.estimator_id === null) {
        updates.estimator_id = estimatorUsers[0].id;
      }
      // Auto-fill internal sales if exactly one user has that role and not already set
      if (salesUsers.length === 1 && prev.internal_sales_id === null) {
        updates.internal_sales_id = salesUsers[0].id;
      }
      // Auto-fill client coordinator if exactly one user has that role and not already set
      if (coordinatorUsers.length === 1 && prev.coordinator_id === null) {
        updates.coordinator_id = coordinatorUsers[0].id;
      }

      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [supervisorUsers, siteCoordinatorUsers, estimatorUsers, salesUsers, coordinatorUsers]);

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

        // Set default stage
        if (stagesData?.stages && stagesData.stages.length > 0) {
          // If coming from email proposal, default to "Needs Pricing" stage
          if (proposalId) {
            const needsPricingStage = stagesData.stages.find(
              s => s.name.toLowerCase() === "needs pricing"
            );
            if (needsPricingStage) {
              setFormData(prev => ({ ...prev, job_stage_id: needsPricingStage.id.toString() }));
            } else {
              // Fallback to first stage if "Needs Pricing" doesn't exist
              setFormData(prev => ({ ...prev, job_stage_id: stagesData.stages[0].id.toString() }));
            }
          } else {
            // Default to first stage for manual job creation
            setFormData(prev => ({ ...prev, job_stage_id: stagesData.stages[0].id.toString() }));
          }
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

    // SSoT: Uses DEBOUNCE_SEARCH_MS from timeout-constants.ts
    const timeoutId = setTimeout(searchSuburbs, DEBOUNCE_SEARCH_MS);
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

  // Handle suburb selection - auto-fills postcode, state, and council
  const handleSuburbSelect = (suburb: SuburbSearchResult) => {
    setFormData(prev => ({
      ...prev,
      suburb: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      council: suburb.council || "",
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
          council: formData.council,
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

        // If this was from an email proposal, mark it as approved
        if (proposalId) {
          try {
            await api.post(`/api/v1/email_job_proposals/${proposalId}/approve`, {
              job_id: jobId,
            });
          } catch (error) {
            console.error("Failed to mark proposal as approved:", error);
            // Don't fail the job creation if this fails
          }
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

  // Show loading state if loading proposal
  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref={proposal ? "/leads/emails" : "/jobs"} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
            {proposal ? (
              <>
                <Mail className="h-6 w-6" />
                Create Job from Email Lead
              </>
            ) : (
              "New Job"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {proposal
              ? `Review and create job from: ${proposal.email?.subject || "Email proposal"}`
              : "Create a new construction project"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card>
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
                  initialSearchAddress={formData.address}
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
                          <Spinner size={16} className="inline mr-2" />
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

                <div>
                  <Label htmlFor="council">Council</Label>
                  <Input
                    id="council"
                    value={formData.council}
                    onChange={(e) => handleChange("council", e.target.value)}
                    placeholder="Auto-filled from suburb selection"
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Project Settings - Middle column */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Type, status, stage and financial details</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {loadingLookups ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-4">
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
                        <SelectValue placeholder={jobStages.length === 0 ? "No stages" : "Select stage"} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id.toString()}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                  <div className="flex-1 flex flex-col space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description..."
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      className="flex-1 min-h-[120px] resize-none"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* People - Right column */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                People
              </CardTitle>
              <CardDescription>Assign clients, referrer, and team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Clients */}
                <div className="space-y-3">
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

                {/* Referral & Sales */}
                <div className="space-y-3">
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
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-500" />
                    Internal Team
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="supervisor" className="flex items-center gap-1 text-xs">
                        <Wrench className="h-3 w-3" />
                        Supervisor
                      </Label>
                      <Select
                        value={peopleData.supervisor_id?.toString() || ""}
                        onValueChange={(value) => handleUserSelect("supervisor", value ? parseInt(value) : null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {supervisorItems.length > 0 ? (
                            supervisorItems.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__none" disabled>No supervisors available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site_coordinator" className="flex items-center gap-1 text-xs">
                        <ClipboardList className="h-3 w-3" />
                        Site Coordinator
                      </Label>
                      <Select
                        value={peopleData.site_coordinator_id?.toString() || ""}
                        onValueChange={(value) => handleUserSelect("site_coordinator", value ? parseInt(value) : null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {siteCoordinatorItems.length > 0 ? (
                            siteCoordinatorItems.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__none" disabled>No site coordinators available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimator" className="flex items-center gap-1 text-xs">
                        <Calculator className="h-3 w-3" />
                        Estimator
                      </Label>
                      <Select
                        value={peopleData.estimator_id?.toString() || ""}
                        onValueChange={(value) => handleUserSelect("estimator", value ? parseInt(value) : null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {estimatorItems.length > 0 ? (
                            estimatorItems.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__none" disabled>No estimators available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal_sales" className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3 w-3" />
                        Internal Sales
                      </Label>
                      <Select
                        value={peopleData.internal_sales_id?.toString() || ""}
                        onValueChange={(value) => handleUserSelect("internal_sales", value ? parseInt(value) : null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesItems.length > 0 ? (
                            salesItems.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__none" disabled>No sales users available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="coordinator" className="flex items-center gap-1 text-xs">
                        <ClipboardList className="h-3 w-3" />
                        Client Coordinator
                      </Label>
                      <Select
                        value={peopleData.coordinator_id?.toString() || ""}
                        onValueChange={(value) => handleUserSelect("coordinator", value ? parseInt(value) : null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {coordinatorItems.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Notes Section - Only shown when coming from email proposal */}
        {proposal?.extracted_data && (
          <Card className="mt-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Mail className="h-5 w-5" />
                Email Lead Information
              </CardTitle>
              <CardDescription>
                Review the extracted information from the email before creating the job
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Description */}
                {proposal.extracted_data.description && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Description
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.description}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {proposal.extracted_data.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-amber-500" />
                      Important Notes
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.notes}
                    </p>
                  </div>
                )}

                {/* Scope of Work */}
                {proposal.extracted_data.scope_of_work && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      Scope of Work
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.scope_of_work}
                    </p>
                  </div>
                )}

                {/* Special Requirements */}
                {proposal.extracted_data.special_requirements && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Special Requirements
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.special_requirements}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                {proposal.extracted_data.timeline_notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-500" />
                      Timeline
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.timeline_notes}
                    </p>
                  </div>
                )}

                {/* Budget */}
                {proposal.extracted_data.budget_breakdown && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-500" />
                      Budget Breakdown
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.budget_breakdown}
                    </p>
                  </div>
                )}

                {/* Risks */}
                {proposal.extracted_data.risk_factors && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Risk Factors
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.risk_factors}
                    </p>
                  </div>
                )}

                {/* Communication */}
                {proposal.extracted_data.communication_preferences && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Communication Preferences
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.communication_preferences}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                {proposal.extracted_data.attachments_summary && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      Attachments
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 p-3 rounded-md border">
                      {proposal.extracted_data.attachments_summary}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href={proposal ? "/leads/emails" : "/jobs"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || loadingLookups}>
            {loading ? (
              <>
                <Spinner size={16} className="mr-2" />
                Creating...
              </>
            ) : proposal ? (
              "Create Job from Email"
            ) : (
              "Create Job"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
