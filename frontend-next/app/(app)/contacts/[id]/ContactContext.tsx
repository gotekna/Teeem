"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Option } from "@/components/ui/multiple-selector";
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  CompanyGroupMembership,
  Directorship,
  Shareholding,
  TrustRolesData,
  OwnershipNode,
  CaseRelationship,
  EmailMessage,
  EmailsPagination,
  ContactRelationship,
  RelationshipTypeMetadata,
} from "./types";

// Form data shape
export interface ContactFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  display_name: string;
  company_name_or_trust: string;
  email: string;
  mobile_phone: string;
  office_phone: string;
  website: string;
  address: string;
  notes: string;
  is_active: boolean;
  is_family_member: boolean;
  is_team_contact: boolean;
  entity_type: string;
  director_id: string;
  date_of_birth: string;
  place_of_birth: string;
  birth_state: string;
  birth_country: string;
  residential_address: string;
  drivers_licence: string;
  passport_number: string;
}

// Entity type metadata from API
export interface EntityTypeMetadata {
  value: string;
  label: string;
  category: string;
  description: string;
}

// Context value shape
export interface ContactContextValue {
  // Core data
  contact: Contact | null;
  loading: boolean;
  error: string | null;
  refreshKey: number;

  // Form state
  formData: ContactFormData;
  hasChanges: boolean;
  saving: boolean;
  fieldErrors: Record<string, string>;

  // Form handlers
  handleInputChange: (field: string, value: string | boolean) => void;
  handleSave: () => Promise<void>;
  handleAutoSave: () => void;
  setFormData: React.Dispatch<React.SetStateAction<ContactFormData>>;

  // Contact emails/phones state
  contactEmails: ContactEmail[];
  setContactEmails: React.Dispatch<React.SetStateAction<ContactEmail[]>>;
  contactPhones: ContactPhone[];
  setContactPhones: React.Dispatch<React.SetStateAction<ContactPhone[]>>;

  // Entity type metadata
  entityTypeMetadata: EntityTypeMetadata[];

  // Company/Employee selection (for person contacts)
  availableCompanies: Option[];
  selectedCompanies: Option[];
  loadingCompanies: boolean;
  companyRoles: Record<string, string[]>;
  handleCompanyChange: (newOptions: Option[]) => void;
  showAddCompany: boolean;
  setShowAddCompany: React.Dispatch<React.SetStateAction<boolean>>;
  newCompanyName: string;
  setNewCompanyName: React.Dispatch<React.SetStateAction<string>>;
  creatingCompany: boolean;
  handleCreateCompany: () => Promise<void>;

  // Employee selection (for company contacts)
  availablePeople: Option[];
  selectedEmployees: Option[];
  loadingPeople: boolean;
  employeeRoles: Record<string, string[]>;
  handleEmployeeChange: (newOptions: Option[]) => void;
  handleEmployeeRolesChange: (employeeId: number, roleTypes: string[]) => void;
  handleEmployeeDragEnd: (event: any) => void;
  handleEmployeePositionChange: (employeeId: number, newPosition: number) => void;
  showAddEmployee: boolean;
  setShowAddEmployee: React.Dispatch<React.SetStateAction<boolean>>;
  newEmployeeFirstName: string;
  setNewEmployeeFirstName: React.Dispatch<React.SetStateAction<string>>;
  newEmployeeLastName: string;
  setNewEmployeeLastName: React.Dispatch<React.SetStateAction<string>>;
  creatingEmployee: boolean;
  handleCreateEmployee: () => Promise<void>;

  // Related entities
  relatedEntities: ContactRelationship[];
  loadingRelatedEntities: boolean;
  showAddRelatedEntity: boolean;
  setShowAddRelatedEntity: React.Dispatch<React.SetStateAction<boolean>>;
  availableContacts: Option[];
  relationshipTypeMetadata: RelationshipTypeMetadata[];
  handleAddRelatedEntity: (contactId: string, relationshipType: string) => Promise<void>;
  handleRemoveRelatedEntity: (relationshipId: number) => Promise<void>;

  // Corporate data
  directorships: Directorship[];
  loadingDirectorships: boolean;
  shareholdings: Shareholding[];
  loadingShareholdings: boolean;
  trustRoles: TrustRolesData | null;
  loadingTrustRoles: boolean;
  ownershipChain: OwnershipNode[];
  loadingOwnershipChain: boolean;
  memberships: CompanyGroupMembership[];
  loadingMemberships: boolean;

  // Cases
  caseRelationships: CaseRelationship[];
  loadingCaseRelationships: boolean;

  // Emails
  emails: EmailMessage[];
  loadingEmails: boolean;
  emailsPage: number;
  setEmailsPage: React.Dispatch<React.SetStateAction<number>>;
  emailsPagination: EmailsPagination | null;
  showAllInThread: boolean;
  setShowAllInThread: React.Dispatch<React.SetStateAction<boolean>>;
  loadEmails: () => Promise<void>;

  // Invoices
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: React.Dispatch<React.SetStateAction<string | null>>;
  showInvoiceDetail: boolean;
  setShowInvoiceDetail: React.Dispatch<React.SetStateAction<boolean>>;

  // Modals
  editModalOpen: boolean;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  refreshContact: () => void;
  handleEnrichFromWeb: () => Promise<void>;
  enrichingFromWeb: boolean;
  handleDelete: () => Promise<void>;

  // Toast
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}

// Create context with undefined default (must be used within provider)
const ContactContext = createContext<ContactContextValue | undefined>(undefined);

// Provider component props
interface ContactProviderProps {
  children: ReactNode;
  value: ContactContextValue;
}

// Provider component
export function ContactProvider({ children, value }: ContactProviderProps) {
  return (
    <ContactContext.Provider value={value}>
      {children}
    </ContactContext.Provider>
  );
}

// Hook to use contact context
export function useContactContext() {
  const context = useContext(ContactContext);
  if (context === undefined) {
    throw new Error("useContactContext must be used within a ContactProvider");
  }
  return context;
}

// Export context for advanced use cases
export { ContactContext };
