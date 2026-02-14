// SSoT: Centralized type definitions for all domain entities
// NEVER define these interfaces locally in components/pages - import from here

export type { Contact, ContactEmail, ContactPhone, ContactAddress, ContactPerson, ContactGroup } from "@/app/(app)/contacts/[id]/types";
export type { PurchaseOrder } from "@/lib/constants/purchase-order-constants";

export * from "./job";
export * from "./user";
export * from "./company";
export * from "./pricebook";
export * from "./role";
