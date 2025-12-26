"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
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
    color: "text-blue-500",
  },
  {
    key: "newsletters",
    label: "Newsletters",
    icon: Newspaper,
    shortcut: "3",
    color: "text-purple-500",
  },
  {
    key: "other",
    label: "Other",
    icon: Inbox,
    shortcut: "4",
    color: "text-gray-500",
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
  const response = await api.get<SplitInboxResponse>("/api/v1/email_warehouse?split_inbox=true&my_emails=true&latest_only=true");
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
  const response = await api.get<CategoryEmailsResponse>(
    `/api/v1/email_warehouse?split_inbox=true&my_emails=true&latest_only=true&category=${category}&page=${page}&per_page=${perPage}`
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

// Hook for split inbox data
export function useSplitInbox() {
  const [data, setData] = useState<SplitInboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SplitInboxCategory>("vip");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSplitInbox();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch split inbox:", err);
      setError("Failed to load split inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategory = useCallback(async (category: SplitInboxCategory, page: number = 1) => {
    setLoading(true);
    try {
      const result = await fetchCategoryEmails(category, page);
      return result;
    } catch (err) {
      console.error("Failed to fetch category emails:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts: Record<SplitInboxCategory, number> = {
    vip: data?.categories.vip.count || 0,
    team: data?.categories.team.count || 0,
    newsletters: data?.categories.newsletters.count || 0,
    other: data?.categories.other.count || 0,
  };

  const unreadCounts: Record<SplitInboxCategory, number> = {
    vip: data?.categories.vip.unread_count || 0,
    team: data?.categories.team.unread_count || 0,
    newsletters: data?.categories.newsletters.unread_count || 0,
    other: data?.categories.other.unread_count || 0,
  };

  return {
    data,
    loading,
    error,
    refresh,
    loadCategory,
    selectedCategory,
    setSelectedCategory,
    counts,
    unreadCounts,
    currentEmails: data?.categories[selectedCategory]?.emails || [],
    teamDomains: data?.team_domains || [],
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
        category === "other" && "border-gray-500/30 text-gray-600 dark:text-gray-400",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {cat.label}
    </Badge>
  );
}

export default SplitInboxTabs;
