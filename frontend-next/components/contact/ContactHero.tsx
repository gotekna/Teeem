"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Building2, User, Briefcase, DollarSign } from "lucide-react";

export interface ContactHeroProps {
  /** Contact display name */
  displayName: string;
  /** Entity type (Person, Company, Trust, etc.) */
  entityType: string | null;
  /** Is the contact active */
  isActive: boolean;
  /** Number of jobs associated */
  jobsCount?: number;
  /** Number of purchase orders */
  purchaseOrdersCount?: number;
  /** Number of quotes */
  quotesCount?: number;
  /** Is this contact a customer in Xero */
  isXeroCustomer?: boolean;
  /** Is this contact a supplier in Xero */
  isXeroSupplier?: boolean;
  /** Custom class */
  className?: string;
}

/**
 * Get initials from a display name
 */
function getInitials(name: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Get icon for entity type
 */
function getEntityIcon(entityType: string | null) {
  switch (entityType?.toLowerCase()) {
    case "company":
      return Building2;
    case "trust":
      return Briefcase;
    case "sole trader":
      return Briefcase;
    case "price only":
      return DollarSign;
    default:
      return User;
  }
}

/**
 * Get background color for avatar based on entity type
 */
function getAvatarColor(entityType: string | null): string {
  switch (entityType?.toLowerCase()) {
    case "company":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
    case "trust":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300";
    case "sole trader":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
    case "price only":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
  }
}

/**
 * ContactHero - Avatar + display name + badges + quick stats
 */
export function ContactHero({
  displayName,
  entityType,
  isActive,
  jobsCount = 0,
  purchaseOrdersCount = 0,
  quotesCount = 0,
  isXeroCustomer,
  isXeroSupplier,
  className,
}: ContactHeroProps) {
  const Icon = getEntityIcon(entityType);
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(entityType);

  return (
    <div className={cn("flex items-start gap-4", className)}>
      {/* Avatar */}
      <div
        className={cn(
          "h-16 w-16 rounded-xl flex items-center justify-center shrink-0",
          avatarColor
        )}
      >
        <span className="text-xl font-semibold">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name */}
        <h1 className="text-2xl font-semibold truncate">{displayName}</h1>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity Type */}
          <Badge variant="secondary" className="gap-1">
            <Icon className="h-3 w-3" />
            {entityType || "Person"}
          </Badge>

          {/* Active Status */}
          {isActive ? (
            <Badge
              variant="outline"
              className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800"
            >
              Active
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
            >
              Inactive
            </Badge>
          )}

          {/* Xero badges */}
          {isXeroCustomer && (
            <Badge
              variant="outline"
              className="text-teal-600 border-teal-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-800"
            >
              Xero Customer
            </Badge>
          )}
          {isXeroSupplier && (
            <Badge
              variant="outline"
              className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800"
            >
              Xero Supplier
            </Badge>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Jobs: <span className="font-medium text-foreground">{jobsCount}</span>
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>
            POs: <span className="font-medium text-foreground">{purchaseOrdersCount}</span>
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>
            Quotes: <span className="font-medium text-foreground">{quotesCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default ContactHero;
