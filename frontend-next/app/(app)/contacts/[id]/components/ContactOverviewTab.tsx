"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  Globe,
  Building2,
  MapPin,
  Pencil,
  Trash2,
  User,
  FileText,
  Users,
  CheckCircle,
  ExternalLink,
  Save,
  Plus,
  Link2,
  Scale,
  Code,
  GripVertical,
  Star,
  Search,
  Loader2,
  Home,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  hasFirstLastName,
  canHaveEmployees,
  canHaveEmployer,
  isPerson,
  isTrust,
  isPriceOnly,
  type EntityTypeMetadata,
} from "@/lib/entity-types";
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactRelationship,
  RelationshipTypeMetadata,
} from "../types";
import {
  formatABN,
  formatACN,
  validateABN,
  formatPhoneNumber,
  validatePhoneNumber,
} from "../types";

// Form data shape
interface ContactFormData {
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
  tax_number: string;
  sync_with_xero: boolean;
}

interface ContactOverviewTabProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  formData: ContactFormData;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleAutoSave: () => void;
  handleSave: () => Promise<void>;
  handleTeamContactToggle: (checked: boolean) => void;
  // Entity type metadata
  entityTypeMetadata: EntityTypeMetadata[];
  // Company selection (for persons)
  availableCompanies: Option[];
  selectedCompanies: Option[];
  loadingCompanies: boolean;
  companyRoles: Record<string, string[]>;
  handleCompanyChange: (newOptions: Option[]) => void;
  handleCompanyDragEnd: (event: any) => void;
  handleCompanyRolesChange: (companyId: string, roleTypes: string[]) => void;
  handleCompanyPositionChange: (companyId: string, newPosition: number) => void;
  showAddCompany: boolean;
  setShowAddCompany: React.Dispatch<React.SetStateAction<boolean>>;
  newCompanyName: string;
  setNewCompanyName: React.Dispatch<React.SetStateAction<string>>;
  creatingCompany: boolean;
  handleCreateCompany: () => Promise<void>;
  // Employee selection (for companies)
  availablePeople: Option[];
  selectedEmployees: Option[];
  loadingPeople: boolean;
  employeeRoles: Record<string, string[]>;
  handleEmployeeChange: (newOptions: Option[]) => void;
  handleEmployeeDragEnd: (event: any) => void;
  handleEmployeeRolesChange: (employeeId: number, roleTypes: string[]) => void;
  handleEmployeePositionChange: (employeeId: number, newPosition: number) => void;
  handleRemoveEmployee: (employeeId: number) => void;
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
  newRelatedEntityContactId: string;
  setNewRelatedEntityContactId: React.Dispatch<React.SetStateAction<string>>;
  newRelatedEntityType: string;
  setNewRelatedEntityType: React.Dispatch<React.SetStateAction<string>>;
  addingRelatedEntity: boolean;
  handleAddRelatedEntity: () => Promise<void>;
  handleRemoveRelatedEntity: (relationshipId: number, sourceContactId: number) => void;
  getValidRelationshipTypes: (metadata: RelationshipTypeMetadata[], sourceType: string, targetType: string | null) => { value: string; label: string }[];
  // Modals
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // DnD sensors
  sensors: ReturnType<typeof useSensors>;
}

export function ContactOverviewTab({
  contact,
  setContact,
  formData,
  hasChanges,
  setHasChanges,
  saving,
  fieldErrors,
  setFieldErrors,
  handleInputChange,
  handleAutoSave,
  handleSave,
  handleTeamContactToggle,
  entityTypeMetadata,
  availableCompanies,
  selectedCompanies,
  loadingCompanies,
  companyRoles,
  handleCompanyChange,
  handleCompanyDragEnd,
  handleCompanyRolesChange,
  handleCompanyPositionChange,
  showAddCompany,
  setShowAddCompany,
  newCompanyName,
  setNewCompanyName,
  creatingCompany,
  handleCreateCompany,
  availablePeople,
  selectedEmployees,
  loadingPeople,
  employeeRoles,
  handleEmployeeChange,
  handleEmployeeDragEnd,
  handleEmployeeRolesChange,
  handleEmployeePositionChange,
  handleRemoveEmployee,
  showAddEmployee,
  setShowAddEmployee,
  newEmployeeFirstName,
  setNewEmployeeFirstName,
  newEmployeeLastName,
  setNewEmployeeLastName,
  creatingEmployee,
  handleCreateEmployee,
  relatedEntities,
  loadingRelatedEntities,
  showAddRelatedEntity,
  setShowAddRelatedEntity,
  availableContacts,
  relationshipTypeMetadata,
  newRelatedEntityContactId,
  setNewRelatedEntityContactId,
  newRelatedEntityType,
  setNewRelatedEntityType,
  addingRelatedEntity,
  handleAddRelatedEntity,
  handleRemoveRelatedEntity,
  getValidRelationshipTypes,
  setEditModalOpen,
  sensors,
}: ContactOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Edit Form Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info and Contact Details - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info Card */}
          <BasicInfoCard
            contact={contact}
            setContact={setContact}
            formData={formData}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
            saving={saving}
            handleInputChange={handleInputChange}
            handleAutoSave={handleAutoSave}
            handleSave={handleSave}
            handleTeamContactToggle={handleTeamContactToggle}
            entityTypeMetadata={entityTypeMetadata}
            availableCompanies={availableCompanies}
            selectedCompanies={selectedCompanies}
            loadingCompanies={loadingCompanies}
            handleCompanyChange={handleCompanyChange}
            showAddCompany={showAddCompany}
            setShowAddCompany={setShowAddCompany}
            newCompanyName={newCompanyName}
            setNewCompanyName={setNewCompanyName}
            creatingCompany={creatingCompany}
            handleCreateCompany={handleCreateCompany}
            availablePeople={availablePeople}
            selectedEmployees={selectedEmployees}
            loadingPeople={loadingPeople}
            handleEmployeeChange={handleEmployeeChange}
            showAddEmployee={showAddEmployee}
            setShowAddEmployee={setShowAddEmployee}
            newEmployeeFirstName={newEmployeeFirstName}
            setNewEmployeeFirstName={setNewEmployeeFirstName}
            newEmployeeLastName={newEmployeeLastName}
            setNewEmployeeLastName={setNewEmployeeLastName}
            creatingEmployee={creatingEmployee}
            handleCreateEmployee={handleCreateEmployee}
          />

          {/* Contact Details Card */}
          <ContactDetailsCard
            contact={contact}
            setContact={setContact}
            formData={formData}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            handleInputChange={handleInputChange}
            handleAutoSave={handleAutoSave}
          />
        </div>

        {/* Address Card */}
        <AddressCard
          contact={contact}
          setContact={setContact}
          setHasChanges={setHasChanges}
          handleAutoSave={handleAutoSave}
        />

        {/* Associated People Card - for company/trust entity types */}
        {canHaveEmployees(formData.entity_type) && contact.employees && contact.employees.length > 0 && (
          <AssociatedPeopleCard
            contact={contact}
            formData={formData}
            employeeRoles={employeeRoles}
            handleEmployeeRolesChange={handleEmployeeRolesChange}
            handleRemoveEmployee={handleRemoveEmployee}
            handleEmployeeDragEnd={handleEmployeeDragEnd}
            handleEmployeePositionChange={handleEmployeePositionChange}
            relationshipTypeMetadata={relationshipTypeMetadata}
            getValidRelationshipTypes={getValidRelationshipTypes}
            sensors={sensors}
          />
        )}

        {/* Associated Companies Card - for person entity type */}
        {canHaveEmployer(formData.entity_type) && selectedCompanies.length > 0 && (
          <AssociatedCompaniesCard
            formData={formData}
            selectedCompanies={selectedCompanies}
            companyRoles={companyRoles}
            handleCompanyChange={handleCompanyChange}
            handleCompanyDragEnd={handleCompanyDragEnd}
            handleCompanyRolesChange={handleCompanyRolesChange}
            handleCompanyPositionChange={handleCompanyPositionChange}
            relationshipTypeMetadata={relationshipTypeMetadata}
            getValidRelationshipTypes={getValidRelationshipTypes}
            sensors={sensors}
          />
        )}

        {/* Related Entities Card */}
        <RelatedEntitiesCard
          formData={formData}
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
        />

        {/* Business & Tax Card - Hide for people with primary company */}
        {!(canHaveEmployer(formData.entity_type) && contact.primary_company) && (
          <BusinessTaxCard
            contact={contact}
            formData={formData}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            handleInputChange={handleInputChange}
            handleAutoSave={handleAutoSave}
          />
        )}

        {/* Notes Card */}
        <NotesCard
          formData={formData}
          handleInputChange={handleInputChange}
          handleAutoSave={handleAutoSave}
        />

        {/* Contact Persons (read-only) */}
        {contact.contact_persons && contact.contact_persons.length > 0 && (
          <ContactPersonsCard
            contact={contact}
            setEditModalOpen={setEditModalOpen}
          />
        )}

        {/* Groups and LGAs Cards */}
        {contact.contact_groups && contact.contact_groups.length > 0 && (
          <GroupsCard contact={contact} />
        )}

        {contact.lgas && contact.lgas.length > 0 && (
          <LGAsCard contact={contact} />
        )}
      </div>

      {/* Sidebar Column */}
      <div className="space-y-6">
        {hasChanges && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Spinner className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        )}

        <QuickStatsCard contact={contact} />
        <SystemInfoCard contact={contact} />
      </div>
    </div>
  );
}

// ================================
// Basic Info Card
// ================================

interface BasicInfoCardProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  formData: ContactFormData;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleAutoSave: () => void;
  handleSave: () => Promise<void>;
  handleTeamContactToggle: (checked: boolean) => void;
  entityTypeMetadata: EntityTypeMetadata[];
  availableCompanies: Option[];
  selectedCompanies: Option[];
  loadingCompanies: boolean;
  handleCompanyChange: (newOptions: Option[]) => void;
  showAddCompany: boolean;
  setShowAddCompany: React.Dispatch<React.SetStateAction<boolean>>;
  newCompanyName: string;
  setNewCompanyName: React.Dispatch<React.SetStateAction<string>>;
  creatingCompany: boolean;
  handleCreateCompany: () => Promise<void>;
  availablePeople: Option[];
  selectedEmployees: Option[];
  loadingPeople: boolean;
  handleEmployeeChange: (newOptions: Option[]) => void;
  showAddEmployee: boolean;
  setShowAddEmployee: React.Dispatch<React.SetStateAction<boolean>>;
  newEmployeeFirstName: string;
  setNewEmployeeFirstName: React.Dispatch<React.SetStateAction<string>>;
  newEmployeeLastName: string;
  setNewEmployeeLastName: React.Dispatch<React.SetStateAction<string>>;
  creatingEmployee: boolean;
  handleCreateEmployee: () => Promise<void>;
}

function BasicInfoCard({
  contact,
  formData,
  hasChanges,
  saving,
  handleInputChange,
  handleAutoSave,
  handleSave,
  handleTeamContactToggle,
  entityTypeMetadata,
  availableCompanies,
  selectedCompanies,
  loadingCompanies,
  handleCompanyChange,
  showAddCompany,
  setShowAddCompany,
  newCompanyName,
  setNewCompanyName,
  creatingCompany,
  handleCreateCompany,
  availablePeople,
  selectedEmployees,
  loadingPeople,
  handleEmployeeChange,
  showAddEmployee,
  setShowAddEmployee,
  newEmployeeFirstName,
  setNewEmployeeFirstName,
  newEmployeeLastName,
  setNewEmployeeLastName,
  creatingEmployee,
  handleCreateEmployee,
}: BasicInfoCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Basic Information
        </CardTitle>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Spinner className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* Person and Sole Trader show first/middle/last name fields */}
          {hasFirstLastName(formData.entity_type) ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" value={formData.first_name} onChange={(e) => handleInputChange("first_name", e.target.value)} onBlur={handleAutoSave} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input id="middle_name" value={formData.middle_name} onChange={(e) => handleInputChange("middle_name", e.target.value)} onBlur={handleAutoSave} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" value={formData.last_name} onChange={(e) => handleInputChange("last_name", e.target.value)} onBlur={handleAutoSave} />
              </div>
              {/* Show display_name from database as read-only (SSoT) */}
              <div className="space-y-2">
                <Label htmlFor="display_name_display">Display Name (SSoT)</Label>
                <Input
                  id="display_name_display"
                  value={contact.display_name || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Database value - updated on save from First + Middle + Last name</p>
              </div>
            </>
          ) : (
            /* Company, Trust use company_name_or_trust (SSoT), Price Only shows display_name read-only */
            <>
              <div className="space-y-2">
                <Label htmlFor="company_name_or_trust">
                  {isPriceOnly(formData.entity_type) ? "Display Name" : "Company/Trust Name"}
                </Label>
                <Input
                  id="company_name_or_trust"
                  value={isPriceOnly(formData.entity_type) ? formData.display_name : formData.company_name_or_trust}
                  onChange={(e) => {
                    if (isPriceOnly(formData.entity_type)) {
                      handleInputChange("display_name", e.target.value);
                    } else {
                      handleInputChange("company_name_or_trust", e.target.value);
                    }
                  }}
                  onBlur={handleAutoSave}
                  placeholder={isPriceOnly(formData.entity_type) ? "e.g. INTERNAL STAIRS" : "e.g. ABC Pty Ltd"}
                />
                {isPriceOnly(formData.entity_type) && (
                  <p className="text-xs text-muted-foreground">Will be saved in CAPITALS automatically</p>
                )}
              </div>
              {/* Show display_name from database as read-only (SSoT) for Company/Trust */}
              {!isPriceOnly(formData.entity_type) && (
                <div className="space-y-2">
                  <Label htmlFor="display_name_display">Display Name (SSoT)</Label>
                  <Input
                    id="display_name_display"
                    value={contact.display_name || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Database value - updated on save from Company/Trust Name</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="entity_type">Entity Type</Label>
          <select id="entity_type" value={formData.entity_type} onChange={(e) => handleInputChange("entity_type", e.target.value)} onBlur={handleAutoSave} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {entityTypeMetadata.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Company multi-select - show for person entity type */}
        {canHaveEmployer(formData.entity_type) && (
          <CompanyMultiSelector
            formData={formData}
            availableCompanies={availableCompanies}
            selectedCompanies={selectedCompanies}
            loadingCompanies={loadingCompanies}
            handleCompanyChange={handleCompanyChange}
            showAddCompany={showAddCompany}
            setShowAddCompany={setShowAddCompany}
            newCompanyName={newCompanyName}
            setNewCompanyName={setNewCompanyName}
            creatingCompany={creatingCompany}
            handleCreateCompany={handleCreateCompany}
          />
        )}

        {/* Employee multi-select - show for company/trust entity types */}
        {canHaveEmployees(formData.entity_type) && (
          <EmployeeMultiSelector
            formData={formData}
            availablePeople={availablePeople}
            selectedEmployees={selectedEmployees}
            loadingPeople={loadingPeople}
            handleEmployeeChange={handleEmployeeChange}
            showAddEmployee={showAddEmployee}
            setShowAddEmployee={setShowAddEmployee}
            newEmployeeFirstName={newEmployeeFirstName}
            setNewEmployeeFirstName={setNewEmployeeFirstName}
            newEmployeeLastName={newEmployeeLastName}
            setNewEmployeeLastName={setNewEmployeeLastName}
            creatingEmployee={creatingEmployee}
            handleCreateEmployee={handleCreateEmployee}
          />
        )}

        {/* Primary Company display */}
        {isPerson(formData.entity_type) && contact.primary_company && (
          <div className="space-y-2">
            <Label>Primary Company (Auto-synced)</Label>
            <div className="p-3 rounded-md border bg-muted/30">
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100 px-3 py-1.5 text-sm font-medium inline-flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                {contact.primary_company.name}
                <Link href={`/contacts/${contact.primary_company.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 ml-1 hover:text-green-700 dark:hover:text-green-300" />
                </Link>
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                <CheckCircle className="inline h-3 w-3 mr-1" />
                Automatically synced from employee relationships
              </p>
            </div>
          </div>
        )}

        {/* Switches */}
        <div className="flex items-center justify-between py-2">
          <div><Label>Active</Label><p className="text-xs text-muted-foreground">Is this contact active?</p></div>
          <Switch checked={formData.is_active} onCheckedChange={(c) => { handleInputChange("is_active", c); handleAutoSave(); }} />
        </div>
        {isPerson(formData.entity_type) && (
          <div className="flex items-center justify-between py-2">
            <div><Label>Family Member</Label></div>
            <Switch checked={formData.is_family_member} onCheckedChange={(c) => { handleInputChange("is_family_member", c); handleAutoSave(); }} />
          </div>
        )}
        {isPerson(formData.entity_type) && (
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className={!contact.primary_company && selectedCompanies.length === 0 ? "text-muted-foreground" : ""}>Team Contact</Label>
              <p className="text-xs text-muted-foreground">
                {!contact.primary_company && selectedCompanies.length === 0
                  ? "Add a company first to enable this option"
                  : "Append company name to avoid duplicates (e.g., \"Accounts Team - Buildcraft\")"}
              </p>
            </div>
            <Switch
              checked={formData.is_team_contact}
              onCheckedChange={handleTeamContactToggle}
              disabled={saving || (!contact.primary_company && selectedCompanies.length === 0)}
            />
          </div>
        )}

        {/* Xero Link Status */}
        {contact.xero_id && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Linked to Xero</span>
              </div>
              {contact.xero_invoice_count && (
                <Badge variant="secondary">{contact.xero_invoice_count} invoices</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Xero ID: {contact.xero_id}
              {contact.xero_contact_number && ` • Contact #${contact.xero_contact_number}`}
            </p>
          </div>
        )}

        {/* Raw Data Section - Collapsible */}
        <details className="mt-4 pt-4 border-t">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw Data (Debug)
          </summary>
          <div className="mt-3 p-3 bg-muted rounded-md overflow-auto max-h-96">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(contact, null, 2)}
            </pre>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

// ================================
// Company Multi-Selector
// ================================

interface CompanyMultiSelectorProps {
  formData: ContactFormData;
  availableCompanies: Option[];
  selectedCompanies: Option[];
  loadingCompanies: boolean;
  handleCompanyChange: (newOptions: Option[]) => void;
  showAddCompany: boolean;
  setShowAddCompany: React.Dispatch<React.SetStateAction<boolean>>;
  newCompanyName: string;
  setNewCompanyName: React.Dispatch<React.SetStateAction<string>>;
  creatingCompany: boolean;
  handleCreateCompany: () => Promise<void>;
}

function CompanyMultiSelector({
  formData,
  availableCompanies,
  selectedCompanies,
  loadingCompanies,
  handleCompanyChange,
  showAddCompany,
  setShowAddCompany,
  newCompanyName,
  setNewCompanyName,
  creatingCompany,
  handleCreateCompany,
}: CompanyMultiSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Companies</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddCompany(!showAddCompany)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Company
          </Button>
        </div>

        {/* Add Company inline form */}
        {showAddCompany && (
          <div className="p-3 border rounded-md bg-muted/30 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-company-name">Company Name</Label>
              <Input
                id="new-company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Enter company name..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCompanyName.trim()) {
                    handleCreateCompany();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreateCompany}
                disabled={creatingCompany || !newCompanyName.trim()}
              >
                {creatingCompany ? (
                  <Spinner className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                Create & Link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddCompany(false);
                  setNewCompanyName("");
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a new company and adds {formData.first_name || "this person"} as an employee.
            </p>
          </div>
        )}

        {/* Companies multi-selector */}
        <MultipleSelector
          value={selectedCompanies}
          onChange={(newOptions) => {
            handleCompanyChange(newOptions);
          }}
          placeholder="🔍 Search and add companies..."
          options={availableCompanies}
          emptyIndicator={
            <p className="text-center text-sm text-muted-foreground">
              {loadingCompanies ? "Loading companies..." : "No companies found"}
            </p>
          }
          disabled={loadingCompanies}
          hidePlaceholderWhenSelected={false}
          className="w-full bg-white dark:bg-gray-950"
        />

        <p className="text-xs text-muted-foreground">
          Search above to add companies. Selected companies shown in blue boxes. View and edit roles in the Overview tab.
        </p>
      </div>
    </div>
  );
}

// ================================
// Employee Multi-Selector
// ================================

interface EmployeeMultiSelectorProps {
  formData: ContactFormData;
  availablePeople: Option[];
  selectedEmployees: Option[];
  loadingPeople: boolean;
  handleEmployeeChange: (newOptions: Option[]) => void;
  showAddEmployee: boolean;
  setShowAddEmployee: React.Dispatch<React.SetStateAction<boolean>>;
  newEmployeeFirstName: string;
  setNewEmployeeFirstName: React.Dispatch<React.SetStateAction<string>>;
  newEmployeeLastName: string;
  setNewEmployeeLastName: React.Dispatch<React.SetStateAction<string>>;
  creatingEmployee: boolean;
  handleCreateEmployee: () => Promise<void>;
}

function EmployeeMultiSelector({
  formData,
  availablePeople,
  selectedEmployees,
  loadingPeople,
  handleEmployeeChange,
  showAddEmployee,
  setShowAddEmployee,
  newEmployeeFirstName,
  setNewEmployeeFirstName,
  newEmployeeLastName,
  setNewEmployeeLastName,
  creatingEmployee,
  handleCreateEmployee,
}: EmployeeMultiSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Employees</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddEmployee(!showAddEmployee)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Employee
          </Button>
        </div>

        {/* Add Employee inline form */}
        {showAddEmployee && (
          <div className="p-3 border rounded-md bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-employee-first">First Name</Label>
                <Input
                  id="new-employee-first"
                  value={newEmployeeFirstName}
                  onChange={(e) => setNewEmployeeFirstName(e.target.value)}
                  placeholder="First name..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-employee-last">Last Name</Label>
                <Input
                  id="new-employee-last"
                  value={newEmployeeLastName}
                  onChange={(e) => setNewEmployeeLastName(e.target.value)}
                  placeholder="Last name..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newEmployeeFirstName.trim()) {
                      handleCreateEmployee();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreateEmployee}
                disabled={creatingEmployee || !newEmployeeFirstName.trim()}
              >
                {creatingEmployee ? (
                  <Spinner className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                Create & Link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddEmployee(false);
                  setNewEmployeeFirstName("");
                  setNewEmployeeLastName("");
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a new person and adds them as an employee of {formData.company_name_or_trust || "this company"}.
            </p>
          </div>
        )}

        <MultipleSelector
          value={selectedEmployees}
          onChange={handleEmployeeChange}
          placeholder="Click to search employees..."
          options={availablePeople}
          emptyIndicator={
            <p className="text-center text-sm text-muted-foreground">
              {loadingPeople ? "Loading people..." : "No people found"}
            </p>
          }
          disabled={loadingPeople}
          className="w-full"
          hidePlaceholderWhenSelected
        />
        <p className="text-xs text-muted-foreground">Add people who work for this {isTrust(formData.entity_type) ? 'trust' : 'company'}. View and edit roles in the Overview tab.</p>
      </div>
    </div>
  );
}

// ================================
// Contact Details Card (Part 1 - will continue in next write)
// ================================

interface ContactDetailsCardProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  formData: ContactFormData;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleAutoSave: () => void;
}

function ContactDetailsCard({
  contact,
  setContact,
  formData,
  setHasChanges,
  fieldErrors,
  setFieldErrors,
  handleInputChange,
  handleAutoSave,
}: ContactDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Contact Details
          {canHaveEmployer(formData.entity_type) && contact.primary_company && (
            <Badge variant="outline" className="ml-2">
              <Building2 className="h-3 w-3 mr-1" />
              Company Details
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Direct/Personal Contact Details Section Header */}
        {canHaveEmployer(formData.entity_type) && contact.primary_company && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            Direct Contact (Personal)
          </div>
        )}

        {/* Emails Section */}
        <EmailsSection
          contact={contact}
          setContact={setContact}
          formData={formData}
          setHasChanges={setHasChanges}
          handleAutoSave={handleAutoSave}
        />

        {/* Phones Section */}
        <PhonesSection
          contact={contact}
          setContact={setContact}
          formData={formData}
          setHasChanges={setHasChanges}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          handleAutoSave={handleAutoSave}
        />

        {/* Website and Address - only show if NOT part of a company */}
        {!(canHaveEmployer(formData.entity_type) && contact.primary_company) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={formData.website} onChange={(e) => handleInputChange("website", e.target.value)} onBlur={handleAutoSave} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} onBlur={handleAutoSave} placeholder="Full address" rows={2} />
            </div>
          </>
        )}

        {/* Company Contact Details - Show when person/sole_trader has a primary company */}
        {canHaveEmployer(formData.entity_type) && contact.primary_company && (
          <CompanyContactInfo contact={contact} />
        )}
      </CardContent>
    </Card>
  );
}

// ================================
// Emails Section
// ================================

interface EmailsSectionProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  formData: ContactFormData;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  handleAutoSave: () => void;
}

function EmailsSection({
  contact,
  setContact,
  formData,
  setHasChanges,
  handleAutoSave,
}: EmailsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{canHaveEmployer(formData.entity_type) && contact.primary_company ? 'Direct Email Addresses' : 'Emails'}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const newEmail: ContactEmail = {
              email: '',
              is_primary: (contact.contact_emails?.length || 0) === 0,
              label: null,
              position: (contact.contact_emails?.length || 0)
            };
            const updated = [...(contact.contact_emails || []), newEmail];
            setContact({ ...contact, contact_emails: updated });
            setHasChanges(true);
          }}
        >
          <Mail className="h-3 w-3 mr-1" />
          Add Email
        </Button>
      </div>
      <div className="space-y-2">
        {(contact.contact_emails || [])
          .map((email, originalIndex) => ({ email, originalIndex }))
          .filter(({ email }) => !email._destroy)
          .sort((a, b) => {
            if (a.email.is_primary && !b.email.is_primary) return -1;
            if (!a.email.is_primary && b.email.is_primary) return 1;
            return a.email.position - b.email.position;
          })
          .map(({ email, originalIndex }) => (
          <div key={email.id || `new-${originalIndex}`} className="flex items-center gap-2">
            <Input
              type="email"
              value={email.email}
              onChange={(e) => {
                const updated = [...(contact.contact_emails || [])];
                updated[originalIndex] = { ...updated[originalIndex], email: e.target.value };
                setContact({ ...contact, contact_emails: updated });
                setHasChanges(true);
              }}
              onBlur={handleAutoSave}
              placeholder="email@example.com"
              className={email.is_primary ? 'border-primary' : ''}
            />
            <Button
              type="button"
              variant={email.is_primary ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const updated = (contact.contact_emails || []).map((e, i) => ({
                  ...e,
                  is_primary: i === originalIndex
                }));
                setContact({ ...contact, contact_emails: updated });
                setHasChanges(true);
                handleAutoSave();
              }}
              title="Set as primary"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const updated = [...(contact.contact_emails || [])];
                if (email.id) {
                  updated[originalIndex] = { ...updated[originalIndex], _destroy: true };
                } else {
                  updated.splice(originalIndex, 1);
                }
                setContact({ ...contact, contact_emails: updated });
                setHasChanges(true);
                handleAutoSave();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================
// Phones Section
// ================================

interface PhonesSectionProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  formData: ContactFormData;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAutoSave: () => void;
}

function PhonesSection({
  contact,
  setContact,
  formData,
  setHasChanges,
  fieldErrors,
  setFieldErrors,
  handleAutoSave,
}: PhonesSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label>{canHaveEmployer(formData.entity_type) && contact.primary_company ? 'Direct Phone Numbers' : 'Phones'}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newPhone: ContactPhone = {
                phone_number: '',
                phone_type: 'mobile',
                is_primary: (contact.contact_phones?.length || 0) === 0,
                label: null,
                position: (contact.contact_phones?.length || 0)
              };
              const updated = [...(contact.contact_phones || []), newPhone];
              setContact({ ...contact, contact_phones: updated });
              setHasChanges(true);
            }}
          >
            <Phone className="h-3 w-3 mr-1" />
            Add Phone
          </Button>
        </div>
        {canHaveEmployer(formData.entity_type) && contact.primary_company && (
          <p className="text-xs text-muted-foreground">Personal/direct line, mobile, or extension</p>
        )}
      </div>
      <div className="space-y-2">
        {(contact.contact_phones || [])
          .map((phone, originalIndex) => ({ phone, originalIndex }))
          .filter(({ phone }) => !phone._destroy)
          .sort((a, b) => {
            if (a.phone.is_primary && !b.phone.is_primary) return -1;
            if (!a.phone.is_primary && b.phone.is_primary) return 1;
            return a.phone.position - b.phone.position;
          })
          .map(({ phone, originalIndex }) => (
          <div key={phone.id || `new-${originalIndex}`} className="flex items-center gap-2">
            <select
              value={phone.phone_type}
              onChange={(e) => {
                const updated = [...(contact.contact_phones || [])];
                updated[originalIndex] = { ...updated[originalIndex], phone_type: e.target.value as ContactPhone['phone_type'] };
                setContact({ ...contact, contact_phones: updated });
                setHasChanges(true);
              }}
              onBlur={handleAutoSave}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="mobile">Mobile</option>
              <option value="office">Office</option>
              <option value="fax">Fax</option>
              <option value="home">Home</option>
            </select>
            <Input
              type="tel"
              value={phone.phone_number}
              onChange={(e) => {
                const updated = [...(contact.contact_phones || [])];
                updated[originalIndex] = { ...updated[originalIndex], phone_number: e.target.value };
                setContact({ ...contact, contact_phones: updated });
                setHasChanges(true);
                setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: '' }));
              }}
              onBlur={() => {
                const validation = validatePhoneNumber(phone.phone_number);
                if (!validation.isValid) {
                  setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: validation.error || 'Invalid phone' }));
                } else {
                  const formatted = formatPhoneNumber(phone.phone_number);
                  if (formatted !== phone.phone_number) {
                    const updated = [...(contact.contact_phones || [])];
                    updated[originalIndex] = { ...updated[originalIndex], phone_number: formatted };
                    setContact({ ...contact, contact_phones: updated });
                  }
                  setFieldErrors(prev => ({ ...prev, [`phone_${originalIndex}`]: '' }));
                }
                handleAutoSave();
              }}
              placeholder="0400 000 000"
              className={cn(
                phone.is_primary ? 'border-primary' : '',
                fieldErrors[`phone_${originalIndex}`] && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {fieldErrors[`phone_${originalIndex}`] && (
              <p className="text-xs text-red-500">{fieldErrors[`phone_${originalIndex}`]}</p>
            )}
            <Button
              type="button"
              variant={phone.is_primary ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const updated = (contact.contact_phones || []).map((p, i) => ({
                  ...p,
                  is_primary: i === originalIndex
                }));
                setContact({ ...contact, contact_phones: updated });
                setHasChanges(true);
                handleAutoSave();
              }}
              title="Set as primary"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const updated = [...(contact.contact_phones || [])];
                if (phone.id) {
                  updated[originalIndex] = { ...updated[originalIndex], _destroy: true };
                } else {
                  updated.splice(originalIndex, 1);
                }
                setContact({ ...contact, contact_phones: updated });
                setHasChanges(true);
                handleAutoSave();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================
// Company Contact Info
// ================================

function CompanyContactInfo({ contact }: { contact: Contact }) {
  if (!contact.primary_company) return null;

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/30 mt-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Building2 className="h-4 w-4" />
        {contact.primary_company.name} Contact Info
      </div>

      {/* Company ABN/ACN */}
      {(contact.primary_company.abn || contact.primary_company.acn) && (
        <div className="flex flex-wrap gap-3">
          {contact.primary_company.abn && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground font-medium">ABN:</span>
              <span className="font-mono">{formatABN(contact.primary_company.abn)}</span>
            </div>
          )}
          {contact.primary_company.acn && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground font-medium">ACN:</span>
              <span className="font-mono">{formatACN(contact.primary_company.acn)}</span>
            </div>
          )}
        </div>
      )}

      {/* Company Emails */}
      {contact.primary_company.contact_emails && contact.primary_company.contact_emails.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Emails</Label>
          {contact.primary_company.contact_emails
            .sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return a.position - b.position;
            })
            .map((email, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span>{email.email}</span>
                {email.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
              </div>
            ))}
        </div>
      )}

      {/* Company Phones */}
      {contact.primary_company.contact_phones && contact.primary_company.contact_phones.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Phones</Label>
          {contact.primary_company.contact_phones
            .sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return a.position - b.position;
            })
            .map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">{phone.phone_type}</Badge>
                <span>{phone.phone_number}</span>
                {phone.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
              </div>
            ))}
        </div>
      )}

      {/* Company Website */}
      {contact.primary_company.website && (
        <div className="flex items-center gap-2 text-sm">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <a href={contact.primary_company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {contact.primary_company.website}
          </a>
        </div>
      )}

      {/* Company Address */}
      {contact.primary_company.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
          <span className="whitespace-pre-line">{contact.primary_company.address}</span>
        </div>
      )}
    </div>
  );
}

// ================================
// Address Card
// ================================

interface Suburb {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
}

interface AddressCardProps {
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  handleAutoSave: () => void;
}

function AddressCard({
  contact,
  setContact,
  setHasChanges,
  handleAutoSave,
}: AddressCardProps) {
  const [suburbSearch, setSuburbSearch] = React.useState("");
  const [suburbResults, setSuburbResults] = React.useState<Suburb[]>([]);
  const [searchingSuburb, setSearchingSuburb] = React.useState(false);
  const [showSuburbDropdown, setShowSuburbDropdown] = React.useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Get the primary STREET address or create a new one
  const getStreetAddress = (): ContactAddress => {
    const existing = contact.contact_addresses?.find(
      (a) => a.address_type === "STREET" && !a._destroy
    );
    return (
      existing || {
        address_type: "STREET",
        line1: "",
        line2: null,
        line3: null,
        line4: null,
        city: "",
        region: "",
        postal_code: "",
        country: "Australia",
        attention_to: null,
        is_primary: true,
      }
    );
  };

  const streetAddress = getStreetAddress();

  // Update address field
  const updateAddressField = (field: keyof ContactAddress, value: string) => {
    const addresses = contact.contact_addresses || [];
    const existingIndex = addresses.findIndex(
      (a) => a.address_type === "STREET" && !a._destroy
    );

    let updatedAddresses: ContactAddress[];
    if (existingIndex >= 0) {
      updatedAddresses = addresses.map((addr, idx) =>
        idx === existingIndex ? { ...addr, [field]: value } : addr
      );
    } else {
      // Create new address
      const newAddress: ContactAddress = {
        ...getStreetAddress(),
        [field]: value,
      };
      updatedAddresses = [...addresses, newAddress];
    }

    setContact({ ...contact, contact_addresses: updatedAddresses });
    setHasChanges(true);
  };

  // Search suburbs
  const searchSuburbs = async (query: string) => {
    if (query.length < 2) {
      setSuburbResults([]);
      return;
    }

    setSearchingSuburb(true);
    try {
      const response = await api.get<{ suburbs: Suburb[] }>(
        `/api/v1/suburbs/search?q=${encodeURIComponent(query)}`
      );
      setSuburbResults(response.suburbs || []);
    } catch (error) {
      console.error("Failed to search suburbs:", error);
      setSuburbResults([]);
    } finally {
      setSearchingSuburb(false);
    }
  };

  // Debounced suburb search
  const handleSuburbSearchChange = (value: string) => {
    setSuburbSearch(value);
    updateAddressField("city", value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSuburbs(value);
    }, 300);
  };

  // Select suburb
  const handleSelectSuburb = (suburb: Suburb) => {
    const addresses = contact.contact_addresses || [];
    const existingIndex = addresses.findIndex(
      (a) => a.address_type === "STREET" && !a._destroy
    );

    const updatedAddress: ContactAddress = {
      ...getStreetAddress(),
      city: suburb.name,
      region: suburb.state,
      postal_code: suburb.postcode,
    };

    let updatedAddresses: ContactAddress[];
    if (existingIndex >= 0) {
      updatedAddresses = addresses.map((addr, idx) =>
        idx === existingIndex ? { ...addr, ...updatedAddress } : addr
      );
    } else {
      updatedAddresses = [...addresses, updatedAddress];
    }

    setContact({ ...contact, contact_addresses: updatedAddresses });
    setSuburbSearch(suburb.name);
    setHasChanges(true);
    setShowSuburbDropdown(false);
    setSuburbResults([]);
    handleAutoSave();
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuburbDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Home className="h-5 w-5" />
          Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Street Address */}
        <div className="space-y-2">
          <Label htmlFor="street_address">Street Address</Label>
          <Input
            id="street_address"
            value={streetAddress.line1}
            onChange={(e) => updateAddressField("line1", e.target.value)}
            onBlur={handleAutoSave}
            placeholder="e.g. 123 Main Street"
          />
        </div>

        {/* Address Line 2 */}
        <div className="space-y-2">
          <Label htmlFor="address_line2">Address Line 2 (Optional)</Label>
          <Input
            id="address_line2"
            value={streetAddress.line2 || ""}
            onChange={(e) => updateAddressField("line2", e.target.value)}
            onBlur={handleAutoSave}
            placeholder="e.g. Unit 5, Level 2"
          />
        </div>

        {/* Suburb with auto-complete */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 relative" ref={dropdownRef}>
            <Label htmlFor="suburb">Suburb</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="suburb"
                value={suburbSearch || streetAddress.city}
                onChange={(e) => handleSuburbSearchChange(e.target.value)}
                onFocus={() => {
                  setShowSuburbDropdown(true);
                  if (streetAddress.city) {
                    setSuburbSearch(streetAddress.city);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => {
                    handleAutoSave();
                  }, 200);
                }}
                placeholder="Search suburb..."
                className="pl-9"
              />
              {searchingSuburb && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Suburb dropdown */}
            {showSuburbDropdown && suburbResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-background border rounded-md shadow-lg">
                {suburbResults.map((suburb) => (
                  <button
                    key={suburb.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center"
                    onClick={() => handleSelectSuburb(suburb)}
                  >
                    <span className="font-medium">{suburb.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {suburb.postcode} {suburb.state}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={streetAddress.region}
              onValueChange={(value) => {
                updateAddressField("region", value);
                handleAutoSave();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QLD">QLD</SelectItem>
                <SelectItem value="NSW">NSW</SelectItem>
                <SelectItem value="VIC">VIC</SelectItem>
                <SelectItem value="SA">SA</SelectItem>
                <SelectItem value="WA">WA</SelectItem>
                <SelectItem value="TAS">TAS</SelectItem>
                <SelectItem value="NT">NT</SelectItem>
                <SelectItem value="ACT">ACT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Postcode */}
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={streetAddress.postal_code}
              onChange={(e) => updateAddressField("postal_code", e.target.value)}
              onBlur={handleAutoSave}
              placeholder="4000"
              maxLength={4}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Start typing a suburb name to auto-fill postcode and state. This address syncs with Xero.
        </p>
      </CardContent>
    </Card>
  );
}

// ================================
// Sortable Employee Item (for DnD)
// ================================

interface SortableEmployeeItemProps {
  employee: NonNullable<Contact['employees']>[number];
  index: number;
  employeeRoles: Record<string, string[]>;
  onRolesChange: (employeeId: number, roleTypes: string[]) => void;
  onRemove: (employeeId: number) => void;
  onPositionChange: (employeeId: number, newPosition: number) => void;
  isPrimary: boolean;
  availableRoleTypes: { value: string; label: string }[];
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 bg-accent",
        isPrimary && "bg-primary/5 border-primary/20"
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${employee.id}`} className="text-sm font-medium hover:underline truncate">
            {employee.display_name}
          </Link>
          {isPrimary && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              Primary
            </Badge>
          )}
        </div>
        {employee.email && (
          <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <MultipleSelector
          value={(employeeRoles[employee.id.toString()] || []).map(v => ({ value: v, label: availableRoleTypes.find(r => r.value === v)?.label || v }))}
          onChange={(options) => onRolesChange(employee.id, options.map(o => o.value))}
          placeholder="Select roles..."
          options={availableRoleTypes}
          className="w-40"
          hidePlaceholderWhenSelected
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(employee.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ================================
// Associated People Card
// ================================

interface AssociatedPeopleCardProps {
  contact: Contact;
  formData: ContactFormData;
  employeeRoles: Record<string, string[]>;
  handleEmployeeRolesChange: (employeeId: number, roleTypes: string[]) => void;
  handleRemoveEmployee: (employeeId: number) => void;
  handleEmployeeDragEnd: (event: any) => void;
  handleEmployeePositionChange: (employeeId: number, newPosition: number) => void;
  relationshipTypeMetadata: RelationshipTypeMetadata[];
  getValidRelationshipTypes: (metadata: RelationshipTypeMetadata[], sourceType: string, targetType: string | null) => { value: string; label: string }[];
  sensors: ReturnType<typeof useSensors>;
}

function AssociatedPeopleCard({
  contact,
  formData,
  employeeRoles,
  handleEmployeeRolesChange,
  handleRemoveEmployee,
  handleEmployeeDragEnd,
  handleEmployeePositionChange,
  relationshipTypeMetadata,
  getValidRelationshipTypes,
  sensors,
}: AssociatedPeopleCardProps) {
  if (!contact.employees || contact.employees.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          People
          <Badge variant="secondary" className="ml-2">{contact.employees.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleEmployeeDragEnd}
        >
          <SortableContext
            items={contact.employees.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {contact.employees.map((employee, index) => (
                <SortableEmployeeItem
                  key={employee.id}
                  employee={employee}
                  index={index}
                  employeeRoles={employeeRoles}
                  onRolesChange={handleEmployeeRolesChange}
                  onRemove={handleRemoveEmployee}
                  onPositionChange={handleEmployeePositionChange}
                  isPrimary={index === 0}
                  availableRoleTypes={getValidRelationshipTypes(
                    relationshipTypeMetadata,
                    'person',
                    formData.entity_type
                  )}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

// ================================
// Sortable Company Item (for DnD)
// ================================

interface SortableCompanyItemProps {
  company: Option;
  index: number;
  companyRoles: Record<string, string[]>;
  onRolesChange: (companyId: string, roleTypes: string[]) => void;
  onRemove: () => void;
  onPositionChange: (companyId: string, newPosition: number) => void;
  isPrimary: boolean;
  availableRoleTypes: { value: string; label: string }[];
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 bg-accent",
        isPrimary && "bg-primary/5 border-primary/20"
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${company.value}`} className="text-sm font-medium hover:underline truncate">
            {company.label}
          </Link>
          {isPrimary && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              Primary
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <MultipleSelector
          value={(companyRoles[company.value] || []).map(v => ({ value: v, label: availableRoleTypes.find(r => r.value === v)?.label || v }))}
          onChange={(options) => onRolesChange(company.value, options.map(o => o.value))}
          placeholder="Select roles..."
          options={availableRoleTypes}
          className="w-40"
          hidePlaceholderWhenSelected
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ================================
// Associated Companies Card
// ================================

interface AssociatedCompaniesCardProps {
  formData: ContactFormData;
  selectedCompanies: Option[];
  companyRoles: Record<string, string[]>;
  handleCompanyChange: (newOptions: Option[]) => void;
  handleCompanyDragEnd: (event: any) => void;
  handleCompanyRolesChange: (companyId: string, roleTypes: string[]) => void;
  handleCompanyPositionChange: (companyId: string, newPosition: number) => void;
  relationshipTypeMetadata: RelationshipTypeMetadata[];
  getValidRelationshipTypes: (metadata: RelationshipTypeMetadata[], sourceType: string, targetType: string | null) => { value: string; label: string }[];
  sensors: ReturnType<typeof useSensors>;
}

function AssociatedCompaniesCard({
  formData,
  selectedCompanies,
  companyRoles,
  handleCompanyChange,
  handleCompanyDragEnd,
  handleCompanyRolesChange,
  handleCompanyPositionChange,
  relationshipTypeMetadata,
  getValidRelationshipTypes,
  sensors,
}: AssociatedCompaniesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Companies
          <Badge variant="secondary" className="ml-2">{selectedCompanies.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCompanyDragEnd}
        >
          <SortableContext
            items={selectedCompanies.map(c => c.value)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {selectedCompanies.map((company, index) => (
                <SortableCompanyItem
                  key={company.value}
                  company={company}
                  index={index}
                  companyRoles={companyRoles}
                  onRolesChange={handleCompanyRolesChange}
                  onRemove={() => {
                    const newSelected = selectedCompanies.filter(c => c.value !== company.value);
                    handleCompanyChange(newSelected);
                  }}
                  onPositionChange={handleCompanyPositionChange}
                  isPrimary={index === 0}
                  availableRoleTypes={getValidRelationshipTypes(
                    relationshipTypeMetadata,
                    formData.entity_type,
                    'company'
                  )}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

// ================================
// Related Entities Card
// ================================

interface RelatedEntitiesCardProps {
  formData: ContactFormData;
  relatedEntities: ContactRelationship[];
  loadingRelatedEntities: boolean;
  showAddRelatedEntity: boolean;
  setShowAddRelatedEntity: React.Dispatch<React.SetStateAction<boolean>>;
  availableContacts: Option[];
  relationshipTypeMetadata: RelationshipTypeMetadata[];
  newRelatedEntityContactId: string;
  setNewRelatedEntityContactId: React.Dispatch<React.SetStateAction<string>>;
  newRelatedEntityType: string;
  setNewRelatedEntityType: React.Dispatch<React.SetStateAction<string>>;
  addingRelatedEntity: boolean;
  handleAddRelatedEntity: () => Promise<void>;
  handleRemoveRelatedEntity: (relationshipId: number, sourceContactId: number) => void;
  getValidRelationshipTypes: (metadata: RelationshipTypeMetadata[], sourceType: string, targetType: string | null) => { value: string; label: string }[];
}

function RelatedEntitiesCard({
  formData,
  relatedEntities,
  loadingRelatedEntities,
  showAddRelatedEntity,
  setShowAddRelatedEntity,
  availableContacts,
  relationshipTypeMetadata,
  newRelatedEntityContactId,
  setNewRelatedEntityContactId,
  newRelatedEntityType,
  setNewRelatedEntityType,
  addingRelatedEntity,
  handleAddRelatedEntity,
  handleRemoveRelatedEntity,
  getValidRelationshipTypes,
}: RelatedEntitiesCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Related Entities
            {relatedEntities.length > 0 && (
              <Badge variant="secondary" className="ml-2">{relatedEntities.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddRelatedEntity(!showAddRelatedEntity)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Relationship
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Relationship Form */}
        {showAddRelatedEntity && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Related Contact</Label>
                <Select
                  value={newRelatedEntityContactId}
                  onValueChange={setNewRelatedEntityContactId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContacts.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Relationship Type</Label>
                <Select
                  value={newRelatedEntityType}
                  onValueChange={setNewRelatedEntityType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getValidRelationshipTypes(relationshipTypeMetadata, formData.entity_type, null).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddRelatedEntity}
                disabled={!newRelatedEntityContactId || !newRelatedEntityType || addingRelatedEntity}
              >
                {addingRelatedEntity ? "Adding..." : "Add"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddRelatedEntity(false);
                  setNewRelatedEntityContactId("");
                  setNewRelatedEntityType("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Related Entities List */}
        {loadingRelatedEntities ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading relationships...
          </div>
        ) : relatedEntities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No related entities</p>
            <p className="text-xs mt-1">
              Add relationships like parent companies, subsidiaries, family members, or business partners
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relatedEntities.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                {/* Entity Icon */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {rel.other_contact?.entity_type === 'person' ? (
                    <User className="h-5 w-5 text-primary" />
                  ) : rel.other_contact?.entity_type === 'trust' ? (
                    <Scale className="h-5 w-5 text-primary" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* Entity Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/contacts/${rel.other_contact?.id}`} className="text-sm font-medium hover:underline">
                      {rel.other_contact?.name || 'Unknown'}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {rel.other_contact?.entity_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {rel.direction === 'outgoing' ? '→' : '←'} {rel.relationship_type_label || rel.relationship_type.replace(/_/g, ' ')}
                    </Badge>
                    {rel.ownership_percentage && (
                      <span className="text-xs text-muted-foreground">
                        {rel.ownership_percentage}%
                      </span>
                    )}
                  </div>
                  {rel.other_contact?.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Mail className="h-3 w-3" />
                      {rel.other_contact.email}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRelatedEntity(rel.id, rel.source_contact_id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link href={`/contacts/${rel.other_contact?.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================
// Business & Tax Card
// ================================

interface BusinessTaxCardProps {
  contact: Contact;
  formData: ContactFormData;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleAutoSave: () => void;
}

function BusinessTaxCard({
  contact,
  formData,
  fieldErrors,
  setFieldErrors,
  handleInputChange,
  handleAutoSave,
}: BusinessTaxCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business & Tax
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tax_number">
            {isPerson(formData.entity_type) ? 'ABN (Sole Trader)' : 'ABN / Tax Number'}
          </Label>
          <Input
            id="tax_number"
            value={formData.tax_number}
            onChange={(e) => {
              handleInputChange("tax_number", e.target.value);
              setFieldErrors(prev => ({ ...prev, tax_number: '' }));
            }}
            onBlur={() => {
              const validation = validateABN(formData.tax_number);
              if (!validation.isValid) {
                setFieldErrors(prev => ({ ...prev, tax_number: validation.error || 'Invalid ABN' }));
              } else {
                const formatted = formatABN(formData.tax_number);
                if (formatted !== formData.tax_number) {
                  handleInputChange("tax_number", formatted);
                }
                setFieldErrors(prev => ({ ...prev, tax_number: '' }));
              }
              handleAutoSave();
            }}
            placeholder="XX XXX XXX XXX"
            className={cn(fieldErrors.tax_number && 'border-red-500 focus-visible:ring-red-500')}
          />
          {fieldErrors.tax_number && (
            <p className="text-xs text-red-500">{fieldErrors.tax_number}</p>
          )}
          {isPerson(formData.entity_type) && !fieldErrors.tax_number && (
            <p className="text-xs text-muted-foreground">For sole traders/contractors only. ACN is company-only.</p>
          )}
        </div>
        <div className="flex items-center justify-between py-2">
          <div><Label>Sync with Xero</Label><p className="text-xs text-muted-foreground">Keep synced with Xero</p></div>
          <Switch checked={formData.sync_with_xero} onCheckedChange={(c) => { handleInputChange("sync_with_xero", c); handleAutoSave(); }} />
        </div>
        {contact.linked_company && (
          <Link href={`/corporate/companies/${contact.linked_company.id}`}>
            <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-4 w-4 mr-2" />View Corporate Record</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ================================
// Notes Card
// ================================

interface NotesCardProps {
  formData: ContactFormData;
  handleInputChange: (field: string, value: string | boolean) => void;
  handleAutoSave: () => void;
}

function NotesCard({
  formData,
  handleInputChange,
  handleAutoSave,
}: NotesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} onBlur={handleAutoSave} placeholder="Internal notes..." rows={4} />
      </CardContent>
    </Card>
  );
}

// ================================
// Contact Persons Card
// ================================

interface ContactPersonsCardProps {
  contact: Contact;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function ContactPersonsCard({ contact, setEditModalOpen }: ContactPersonsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contact Persons
          <Badge variant="secondary" className="ml-2">{contact.contact_persons.length}</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />Edit
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contact.contact_persons.map((person) => (
            <div key={person.id} className={cn("flex items-center justify-between p-3 rounded-lg border", person.is_primary && "bg-primary/5 border-primary/20")}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium">{person.first_name} {person.last_name}{person.is_primary && <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{person.email} {person.mobile && `| ${person.mobile}`}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ================================
// Groups Card
// ================================

function GroupsCard({ contact }: { contact: Contact }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Groups</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {contact.contact_groups.map((group) => (<Badge key={group.id} variant="secondary">{group.name}</Badge>))}
        </div>
      </CardContent>
    </Card>
  );
}

// ================================
// LGAs Card
// ================================

function LGAsCard({ contact }: { contact: Contact }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Service Areas (LGAs)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {contact.lgas.map((lga, idx) => (<Badge key={idx} variant="outline">{lga}</Badge>))}
        </div>
      </CardContent>
    </Card>
  );
}

// ================================
// Quick Stats Card
// ================================

function QuickStatsCard({ contact }: { contact: Contact }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Quick Stats</CardTitle></CardHeader>
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
  );
}

// ================================
// System Info Card
// ================================

function SystemInfoCard({ contact }: { contact: Contact }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">System Info</CardTitle></CardHeader>
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
            <span className="font-mono text-xs truncate max-w-[120px]">{contact.xero_contact_id.slice(0, 8)}...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
