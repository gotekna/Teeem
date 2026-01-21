"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useOfflineEmails } from "@/hooks/useOfflineEmails";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { API_TIMEOUT_EMAIL_OFFLINE } from "@/lib/constants/timeout-constants";
import { PAGE_SIZE_LIST } from "@/lib/constants/pagination-constants";
import {
  Star,
  Users,
  Newspaper,
  Inbox,
  Layers,
  FolderOpen,
} from "lucide-react";

// Types
export type SplitInboxCategory = "vip" | "team" | "newsletters" | "other";

export interface CategoryData {
  count: number;
  unread_count: number;
  emails: Email[];
}

export interface SplitInboxData {
  categories: {
    vip: CategoryData;
    team: CategoryData;
    newsletters: CategoryData;
    other: CategoryData;
  };
  team_domains: string[];
}

export interface Email {
  id: number;
  subject: string;
  from_email: string;
  from_name: string;
  received_at: string;
  has_attachments: boolean;
  snippet: string;
  is_read: boolean;
  job_id?: number;
  conversation_id?: string;
  // Threading fields
  thread_count?: number;
  is_latest_in_thread?: boolean;
}

// Category configuration
const CATEGORIES: {
  key: SplitInboxCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  color: string;
}[] = [
  {
    key: "vip",
    label: "VIP",
    icon: Star,
    shortcut: "1",
    color: "text-amber-500",
  },
  {
    key: "team",
    label: "Team",
    icon: Users,
    shortcut: "2",
    color: "text-blue-500 dark:text-blue-400",
  },
  {
    key: "newsletters",
    label: "Newsletters",
    icon: Newspaper,
    shortcut: "3",
    color: "text-purple-500 dark:text-purple-400",
  },
  {
    key: "other",
    label: "Other",
    icon: Inbox,
    shortcut: "4",
    color: "text-muted-foreground",
  },
];

// API Response Types
interface SplitInboxResponse {
  success: boolean;
  data: SplitInboxData;
}

interface CategoryEmailsResponse {
  success: boolean;
  data: {
    category: string;
    emails: Email[];
    pagination: {
      page: number;
      per_page: number;
      total: number;
      total_pages: number;
    };
  };
}

// API Functions
async function fetchSplitInbox(): Promise<SplitInboxData> {
  // Use shorter timeout for split inbox - it should be fast
  // If network is slow, we'll show cached/empty state rather than waiting 30s
  // SSoT: Uses API_TIMEOUT_EMAIL_OFFLINE from timeout-constants.ts
  const response = await api.get<SplitInboxResponse>(
    "/api/v1/synced_emails?split_inbox=true&my_emails=true&latest_only=true",
    { timeout: API_TIMEOUT_EMAIL_OFFLINE }
  );
  return (response as SplitInboxResponse).data;
}

async function fetchCategoryEmails(
  category: SplitInboxCategory,
  page: number = 1,
  perPage: number = 50
): Promise<{
  emails: Email[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}> {
  // Use shorter timeout for category emails
  // SSoT: Uses API_TIMEOUT_EMAIL_OFFLINE from timeout-constants.ts
  const response = await api.get<CategoryEmailsResponse>(
    `/api/v1/synced_emails?split_inbox=true&my_emails=true&latest_only=true&category=${category}&page=${page}&per_page=${perPage}`,
    { timeout: API_TIMEOUT_EMAIL_OFFLINE }
  );
  return (response as CategoryEmailsResponse).data;
}

// Split Inbox Tabs Component
interface SplitInboxTabsProps {
  selectedCategory: SplitInboxCategory;
  onCategoryChange: (category: SplitInboxCategory) => void;
  counts: Record<SplitInboxCategory, number>;
  unreadCounts?: Record<SplitInboxCategory, number>;
  loading?: boolean;
  className?: string;
}

export function SplitInboxTabs({
  selectedCategory,
  onCategoryChange,
  counts,
  unreadCounts,
  loading = false,
  className,
}: SplitInboxTabsProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check for number keys 1-4
      const key = e.key;
      if (key >= "1" && key <= "4") {
        const index = parseInt(key) - 1;
        if (CATEGORIES[index]) {
          onCategoryChange(CATEGORIES[index].key);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCategoryChange]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tabs
        value={selectedCategory}
        onValueChange={(v) => onCategoryChange(v as SplitInboxCategory)}
        className="w-full"
      >
        <TabsList className="w-full justify-start bg-muted/50 h-10">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = counts[cat.key] || 0;
            const unread = unreadCounts?.[cat.key] || 0;

            return (
              <TooltipProvider key={cat.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={cat.key}
                      className="flex items-center gap-1.5 px-3 data-[state=active]:bg-background"
                      disabled={loading}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          selectedCategory === cat.key && cat.color
                        )}
                      />
                      <span className="hidden sm:inline">{cat.label}</span>
                      {count > 0 && (
                        <Badge
                          variant={unread > 0 ? "default" : "secondary"}
                          className={cn(
                            "ml-1 h-5 min-w-[20px] px-1.5 text-xs",
                            unread > 0 && "bg-primary"
                          )}
                        >
                          {unread > 0 ? unread : count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {cat.label} ({count} emails{unread > 0 ? `, ${unread} unread` : ""})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Press {cat.shortcut} to switch
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </TabsList>
      </Tabs>
      {loading && <Spinner className="h-4 w-4" />}
    </div>
  );
}

// View Mode Toggle Component
interface ViewModeToggleProps {
  mode: "split" | "folders";
  onModeChange: (mode: "split" | "folders") => void;
  className?: string;
}

export function ViewModeToggle({
  mode,
  onModeChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div className={cn("flex items-center gap-1 p-1 bg-muted rounded-md", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "split" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onModeChange("split")}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Split Inbox View</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "folders" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onModeChange("folders")}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Folder View</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// Hook for split inbox data - now with offline-first support
export function useSplitInbox(options?: { accountId?: string; enabled?: boolean }) {
  const offlineEmails = useOfflineEmails({
    enabled: options?.enabled ?? true,  // Skip API calls when not in split mode
    fetchOnMount: options?.enabled ?? true,
    fetchOnFocus: options?.enabled ?? true,
    accountId: options?.accountId, // Filter by selected account
  });

  // Map offline emails hook to the existing useSplitInbox API
  // This maintains backwards compatibility with the email page

  // Show loading when:
  // 1. Initial cache load is in progress, OR
  // 2. Cache is empty and we're fetching from API
  const showLoading = offlineEmails.isLoading ||
    (offlineEmails.emails.length === 0 && offlineEmails.isFetching);

  return {
    // Legacy API (for backwards compatibility)
    data: offlineEmails.emails.length > 0 ? {
      categories: {
        vip: { count: offlineEmails.counts.vip, unread_count: offlineEmails.unreadCounts.vip, emails: [] },
        team: { count: offlineEmails.counts.team, unread_count: offlineEmails.unreadCounts.team, emails: [] },
        newsletters: { count: offlineEmails.counts.newsletters, unread_count: offlineEmails.unreadCounts.newsletters, emails: [] },
        other: { count: offlineEmails.counts.other, unread_count: offlineEmails.unreadCounts.other, emails: [] },
      },
      team_domains: offlineEmails.teamDomains,
    } : null,
    loading: showLoading,
    error: offlineEmails.error?.message || null,
    refresh: offlineEmails.refresh,
    // SSoT: Uses PAGE_SIZE_LIST from pagination-constants.ts
    loadCategory: async () => ({ emails: [], pagination: { page: 1, per_page: PAGE_SIZE_LIST, total: 0, total_pages: 0 } }),
    selectedCategory: offlineEmails.selectedCategory,
    setSelectedCategory: offlineEmails.setSelectedCategory,
    counts: offlineEmails.counts,
    unreadCounts: offlineEmails.unreadCounts,
    currentEmails: offlineEmails.emails,
    teamDomains: offlineEmails.teamDomains,

    // New offline-first properties
    isStale: offlineEmails.isStale,
    isFetching: offlineEmails.isFetching,
    isOffline: offlineEmails.isOffline,
    lastFetched: offlineEmails.lastFetched,
    isCacheAvailable: offlineEmails.isCacheAvailable,

    // Update single email (for mark read, star, etc.)
    updateEmail: offlineEmails.updateEmail,
  };
}

// Category Badge Component (for email list items)
interface CategoryBadgeProps {
  category: SplitInboxCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const cat = CATEGORIES.find((c) => c.key === category);
  if (!cat) return null;

  const Icon = cat.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-xs",
        category === "vip" && "border-amber-500/30 text-amber-600 dark:text-amber-400",
        category === "team" && "border-blue-500/30 text-blue-600 dark:text-blue-400",
        category === "newsletters" && "border-purple-500/30 text-purple-600 dark:text-purple-400",
        category === "other" && "border-border/30 text-muted-foreground dark:text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {cat.label}
    </Badge>
  );
}

export default SplitInboxTabs;
