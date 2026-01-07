// Contact Tab Components - Extracted from page.tsx for maintainability
// SSoT: All contact-related tab components are exported from this file

export { ContactOverviewTab } from "./ContactOverviewTab";
export { ContactCorporateTab } from "./ContactCorporateTab";
export { ContactFinancialTab } from "./ContactFinancialTab";
export { ContactDirectorshipsTab } from "./ContactDirectorshipsTab";
export { ContactCasesTab } from "./ContactCasesTab";
export { ContactEmailsTab } from "./ContactEmailsTab";
export { ContactActivityTab } from "./ContactActivityTab";

// Re-export types for convenience
export type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactPerson,
  ContactGroup,
  Directorship,
  Shareholding,
  TrustRole,
  TrustRolesData,
  CompanyGroupMembership,
  OwnershipNode,
  CaseRelationship,
  EmailMessage,
  EmailsPagination,
  ContactRelationship,
  RelationshipTypeMetadata,
  LinkedCompany,
  LinkedCompanyDirector,
  LinkedCompanyShareholder,
  LinkedCompanyBankAccount,
} from "../types";

// Re-export helper functions
export {
  formatABN,
  formatACN,
  validateABN,
  formatPhoneNumber,
  validatePhoneNumber,
} from "../types";
