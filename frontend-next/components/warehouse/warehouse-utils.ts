/**
 * Pure utility functions for the Warehouse tree system.
 *
 * SSoT: Icon mapping and path resolution used by both
 * the main /warehouse page and entity-scoped warehouse tabs.
 */

import {
  Briefcase,
  Building2,
  Users,
  User,
  Contact,
  Mail,
  Paperclip,
  ClipboardList,
  FileText,
  Receipt,
  Package,
  MessageCircle,
  HardDrive,
  FileSpreadsheet,
  PenTool,
  FolderOpen,
  Folder,
  Warehouse,
  Image as ImageIcon,
  File,
} from "lucide-react";
import React from "react";

// Icon mapping for all storage scopes - matches WarehouseProvider.SCOPE_FOLDERS
export const SCOPE_ICONS: Record<string, React.ReactNode> = {
  job: React.createElement(Briefcase, { className: "h-4 w-4" }),
  jobs: React.createElement(Briefcase, { className: "h-4 w-4" }),
  corporate: React.createElement(Building2, { className: "h-4 w-4" }),
  company: React.createElement(Building2, { className: "h-4 w-4" }),
  people: React.createElement(Users, { className: "h-4 w-4" }),
  users: React.createElement(User, { className: "h-4 w-4" }),
  user_photos: React.createElement(ImageIcon, { className: "h-4 w-4" }),
  user_contracts: React.createElement(FileText, { className: "h-4 w-4" }),
  my_docs: React.createElement(FolderOpen, { className: "h-4 w-4" }),
  contact: React.createElement(Contact, { className: "h-4 w-4" }),
  contacts: React.createElement(Contact, { className: "h-4 w-4" }),
  email: React.createElement(Mail, { className: "h-4 w-4" }),
  emails: React.createElement(Mail, { className: "h-4 w-4" }),
  email_attachments: React.createElement(Paperclip, { className: "h-4 w-4" }),
  warehouse: React.createElement(Warehouse, { className: "h-4 w-4" }),
  warehousing: React.createElement(Warehouse, { className: "h-4 w-4" }),
  task: React.createElement(ClipboardList, { className: "h-4 w-4" }),
  tasks: React.createElement(ClipboardList, { className: "h-4 w-4" }),
  billinbox: React.createElement(Receipt, { className: "h-4 w-4" }),
  bill_inbox: React.createElement(Receipt, { className: "h-4 w-4" }),
  pricebook: React.createElement(Package, { className: "h-4 w-4" }),
  pricebook_photos: React.createElement(Package, { className: "h-4 w-4" }),
  chat: React.createElement(MessageCircle, { className: "h-4 w-4" }),
  active_storage: React.createElement(HardDrive, { className: "h-4 w-4" }),
  attachments: React.createElement(Paperclip, { className: "h-4 w-4" }),
  templates: React.createElement(FileText, { className: "h-4 w-4" }),
  bank_statements: React.createElement(FileSpreadsheet, { className: "h-4 w-4" }),
  contracts: React.createElement(PenTool, { className: "h-4 w-4" }),
};

/**
 * Map icon names from database to React components.
 * Falls back to folder name matching if no exact icon name match.
 */
export function getIconComponent(iconName: string | null, folderName: string): React.ReactNode {
  // First try the icon name from the database
  if (iconName && SCOPE_ICONS[iconName]) {
    return SCOPE_ICONS[iconName];
  }
  // Fall back to folder name matching
  const normalizedName = folderName.toLowerCase().replace(/[^a-z]/g, "");
  if (normalizedName === "jobs" || normalizedName === "job") return SCOPE_ICONS.job;
  if (normalizedName === "corporate") return SCOPE_ICONS.corporate;
  if (normalizedName === "people") return SCOPE_ICONS.people;
  if (normalizedName === "contacts" || normalizedName === "contact") return SCOPE_ICONS.contact;
  if (normalizedName === "emails" || normalizedName === "email") return SCOPE_ICONS.email;
  if (normalizedName === "attachments") return SCOPE_ICONS.attachments;
  if (normalizedName === "tasks" || normalizedName === "task") return SCOPE_ICONS.task;
  if (normalizedName === "templates") return SCOPE_ICONS.templates;
  if (normalizedName === "users" || normalizedName === "user") return SCOPE_ICONS.users;
  if (normalizedName === "warehousing" || normalizedName === "warehouse") return SCOPE_ICONS.warehouse;
  if (normalizedName === "billinbox" || normalizedName === "bill") return SCOPE_ICONS.billinbox;
  if (normalizedName === "chat") return SCOPE_ICONS.chat;
  return React.createElement(Folder, { className: "h-4 w-4" });
}

/**
 * Resolve {{Token}} placeholders in a path using a record's tokenValues.
 * Cleans up double slashes and trailing slashes from empty token values.
 */
export function resolvePathTokens(
  path: string | null | undefined,
  tokens?: Record<string, string | null>
): string | null {
  if (!path || !tokens) return path || null;
  let resolved = path;
  for (const [token, value] of Object.entries(tokens)) {
    resolved = resolved.replaceAll(`{{${token}}}`, value || "");
  }
  // Clean up: collapse double+ slashes, trim trailing slashes per segment
  resolved = resolved.replace(/\/\/+/g, "/").replace(/^\/|\/$/g, "");
  return resolved;
}

/**
 * Get the appropriate file icon for a mime type.
 * Used by both the main warehouse page and scoped views.
 */
export function getFileIcon(mimeType: string): typeof File {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.includes("pdf")) return FileText;
  return File;
}
