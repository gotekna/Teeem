"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  GraduationCap,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Database,
  HeartPulse,
  Users,
  Briefcase,
  Package,
  Plus,
  MoreHorizontal,
  FileText,
  FileSpreadsheet,
  Presentation,
  StickyNote,
  Mail,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InspiringBanner } from "./InspiringBanner";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { NotificationBell } from "@/components/ui/notification-bell";
import { CreateTaskDialog } from "@/components/task-hub/CreateTaskDialog";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
// Note: useMicrosoftAutoReconnect removed - now using org-level credentials

// Microsoft 365 icon component
function Microsoft365Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.5 3v8.5H3V3h8.5zm0 18H3v-8.5h8.5V21zm1-18H21v8.5h-8.5V3zm8.5 9.5V21h-8.5v-8.5H21z" />
    </svg>
  );
}

// Xero icon component
function XeroIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 14.59L7.17 13.17l1.41-1.41 2.01 2.01 4.84-4.84 1.41 1.41-6.25 6.25z" />
    </svg>
  );
}

interface HeaderBarProps {
  onMenuClick?: () => void;
}

/// Connection status: 'connected' | 'disconnected' | 'error' | 'degraded' | 'rate_limited'
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'degraded' | 'rate_limited';

export function HeaderBar({ onMenuClick }: HeaderBarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [emailAccounts, setEmailAccounts] = React.useState<Array<{
    id: number;
    name: string;
    email: string;
    type: 'imap' | 'microsoft';
    status: 'connected' | 'error' | 'syncing' | 'disconnected';
    lastSyncedAt: string | null;
    error: string | null;
  }>>([]);
  const [emailOverallStatus, setEmailOverallStatus] = React.useState<ConnectionStatus>('disconnected');
  const [emailTotalCount, setEmailTotalCount] = React.useState(0);
  const [emailConnectedCount, setEmailConnectedCount] = React.useState(0);
  const [xeroStatus, setXeroStatus] = React.useState<ConnectionStatus>('disconnected');
  const [office365Status, setOffice365Status] = React.useState<ConnectionStatus>('disconnected');
  const [xeroTooltip, setXeroTooltip] = React.useState('Xero: Not Connected');
  const [office365Tooltip, setOffice365Tooltip] = React.useState('Office 365: Not Connected');
  const [xeroPendingReview, setXeroPendingReview] = React.useState(0);
  const [showCreateTask, setShowCreateTask] = React.useState(false);

  // Prevent duplicate fetches (React StrictMode double-mount)
  const fetchingRef = React.useRef(false);

  // Note: User-level Microsoft OAuth auto-reconnect removed
  // Now using organization-wide SharePoint credentials from /api/v1/microsoft_app/status

  // Fetch unread message count and integration statuses
  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get<{ unread_count: number }>("/api/v1/chat_messages/unread_count");
        if (response?.unread_count !== undefined) {
          setUnreadCount(response.unread_count);
        }
      } catch (error) {
        console.debug("Failed to fetch unread count:", error);
      }
    };

    const fetchIntegrationStatus = async () => {
      // Check Xero connection - SSoT: show actual status to user
      try {
        const xeroResponse = await api.get<{
          connected?: boolean;
          expired?: boolean;
          tenant_name?: string;
          status?: string; // 'connected' | 'degraded' | 'disconnected'
          data?: { connected?: boolean; expired?: boolean; message?: string; tenant_name?: string; status?: string };
          message?: string
        }>("/api/v1/xero/status");
        const xeroData = xeroResponse?.data || xeroResponse as { connected?: boolean; expired?: boolean; tenant_name?: string; message?: string; status?: string };

        // Check if tokens expired or need re-auth
        const needsReauth = xeroData?.expired === true ||
                           xeroData?.status === 'disconnected' ||
                           xeroData?.message?.toLowerCase().includes('expired') ||
                           xeroData?.message?.toLowerCase().includes('reconnect');

        if (xeroData?.connected === true && !needsReauth && xeroData?.status !== 'degraded' && xeroData?.status !== 'rate_limited') {
          // Fully connected and healthy
          setXeroStatus('connected');
          setXeroTooltip(`Xero: Connected${xeroData.tenant_name ? ` (${xeroData.tenant_name})` : ''}`);
        } else if (xeroData?.status === 'rate_limited') {
          // FRC: Rate limited shows as degraded (orange) with specific message
          setXeroStatus('rate_limited');
          const message = xeroData?.message || 'Rate limit reached - syncing paused';
          setXeroTooltip(`Xero: ${message}`);
        } else if (xeroData?.status === 'degraded' || needsReauth) {
          // Token expired, needs attention, or sync stalled
          setXeroStatus('degraded');
          // Show specific message from backend (e.g., "Sync stalled: pdfs")
          const message = xeroData?.message || (needsReauth ? 'Token expired - click to reconnect' : 'Needs attention');
          setXeroTooltip(`Xero: ${message}`);
          console.info(`[Xero] Issue detected: ${message}`);
        } else {
          // Not connected - show actual disconnected state
          setXeroStatus('disconnected');
          setXeroTooltip('Xero: Not Connected - click to set up');
        }
      } catch (error) {
        console.debug("Failed to fetch Xero status:", error);
        // On API error, show disconnected (honest about status)
        setXeroStatus('disconnected');
        setXeroTooltip('Xero: Not Connected');
      }

      // Fetch Xero pending review count (contacts needing review)
      try {
        const syncStatsResponse = await api.get<{
          success: boolean;
          data: {
            global: {
              pending_reviews: { count: number };
            };
          };
        }>("/api/v1/xero/sync_stats");
        if (syncStatsResponse?.success && syncStatsResponse?.data?.global?.pending_reviews) {
          setXeroPendingReview(syncStatsResponse.data.global.pending_reviews.count || 0);
        }
      } catch (error) {
        console.debug("Failed to fetch Xero pending review count:", error);
      }

      // Check organization-wide Microsoft 365 connection status
      // SSoT: This endpoint returns org SharePoint credentials, matching what the Microsoft page shows
      try {
        const microsoftResponse = await api.get<{
          configured?: boolean;
          status?: string;
          organizations?: Array<{
            id: number;
            name: string;
            status: string;
          }>;
        }>("/api/v1/microsoft_app/status");

        // Count actually connected organizations
        const orgs = microsoftResponse?.organizations || [];
        const totalCount = orgs.length;
        const connectedCount = orgs.filter(o => o.status === "connected").length;
        const errorCount = orgs.filter(o => o.status === "error" || o.status === "dead").length;

        if (totalCount === 0) {
          setOffice365Status('disconnected');
          setOffice365Tooltip('Microsoft 365: Not Configured');
        } else if (connectedCount === totalCount) {
          setOffice365Status('connected');
          setOffice365Tooltip(`Microsoft 365: All ${totalCount} Connected`);
        } else if (errorCount > 0) {
          setOffice365Status('error');
          setOffice365Tooltip(`Microsoft 365: ${errorCount} Error, ${connectedCount}/${totalCount} Connected`);
        } else if (connectedCount > 0) {
          setOffice365Status('degraded');
          setOffice365Tooltip(`Microsoft 365: ${connectedCount}/${totalCount} Connected`);
        } else {
          setOffice365Status('disconnected');
          setOffice365Tooltip(`Microsoft 365: ${connectedCount}/${totalCount} Connected`);
        }
      } catch (error) {
        console.debug("Failed to fetch Microsoft 365 status:", error);
        setOffice365Status('disconnected');
        setOffice365Tooltip('Microsoft 365: Not Connected');
      }

      // Fetch ORG-WIDE email status (all accounts, not just user's accessible ones)
      // FRC (Jan 2026): Header should show health of ALL org email accounts
      try {
        const orgStatusResponse = await api.get<{
          success: boolean;
          data: {
            total: number;
            connected: number;
            errors: number;
            syncing: number;
            overall_status: 'connected' | 'disconnected' | 'error' | 'degraded';
            summary: string;
            ms365_orgs: Array<{ name: string; status: string; is_primary: boolean }>;
            imap: { total: number; connected: number; errors: number; syncing: number };
          };
        }>("/api/v1/imap_credentials/org_status");

        if (orgStatusResponse?.success && orgStatusResponse?.data) {
          const { total, connected, errors, overall_status, ms365_orgs, imap } = orgStatusResponse.data;

          // Update status and counts for display
          setEmailOverallStatus(overall_status as ConnectionStatus);
          setEmailTotalCount(total);
          setEmailConnectedCount(connected);

          // Create entries for each MS365 org and IMAP summary
          const accounts: typeof emailAccounts = [];

          // Add MS365 orgs
          ms365_orgs?.forEach((org, index) => {
            accounts.push({
              id: index,
              name: org.name,
              email: org.is_primary ? 'Primary organization' : 'Microsoft 365',
              type: 'microsoft',
              status: org.status === 'connected' ? 'connected' : 'disconnected',
              lastSyncedAt: null,
              error: null,
            });
          });

          // Add IMAP summary if there are IMAP accounts
          if (imap?.total > 0) {
            accounts.push({
              id: 999,
              name: 'IMAP Accounts',
              email: `${imap.connected}/${imap.total} connected`,
              type: 'imap',
              status: imap.errors > 0 ? 'error' : imap.connected === imap.total ? 'connected' : 'disconnected',
              lastSyncedAt: null,
              error: imap.errors > 0 ? `${imap.errors} account(s) have sync errors` : null,
            });
          }

          setEmailAccounts(accounts);
        } else {
          setEmailOverallStatus('disconnected');
          setEmailTotalCount(0);
          setEmailConnectedCount(0);
          setEmailAccounts([]);
        }
      } catch (error) {
        console.debug("Failed to fetch org email status:", error);
        setEmailOverallStatus('disconnected');
        setEmailTotalCount(0);
        setEmailConnectedCount(0);
        setEmailAccounts([]);
      }
    };

    // Prevent duplicate fetches on React StrictMode double-mount
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetchUnreadCount();
    fetchIntegrationStatus();

    // Poll every 30 seconds for unread count
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => {
      clearInterval(interval);
      fetchingRef.current = false;
    };
  }, []);

  // Note: Auto-reconnect hook was for user-level OAuth, now we use org-level credentials
  // The useMicrosoftAutoReconnect hook can be removed in a future cleanup

  // Helper to get color classes based on connection status
  const getStatusColors = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return "text-green-500 dark:text-green-400 hover:text-green-600 dark:text-green-400";
      case 'degraded':
      case 'rate_limited':  // FRC: rate_limited shows same orange as degraded
        return "text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:text-orange-400";
      case 'error':
        return "text-red-500 dark:text-red-400 hover:text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground";
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="z-40 flex h-12 shrink-0 items-center gap-x-2 border-b border-border bg-white px-3 shadow-sm sm:gap-x-3 sm:px-4 lg:px-6 dark:border-white/10 dark:bg-background dark:shadow-none transition-all duration-300 overflow-hidden">
      {/* Logo - always visible */}
      <Link prefetch={false} href="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
        <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center text-sm">
          t
        </div>
        <span className="font-serif hidden sm:inline">teeem</span>
      </Link>

      {/* Separator */}
      <div
        aria-hidden="true"
        className="h-5 w-px bg-muted dark:bg-white/10"
      />

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenuClick}
        className="-m-1.5 p-1.5 text-foreground hover:text-foreground lg:hidden dark:text-muted-foreground dark:hover:text-white"
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 gap-x-2 self-stretch lg:gap-x-3 min-w-0 overflow-hidden">
        <div className="flex flex-1 items-center gap-x-1 lg:gap-x-2 min-w-0">
          {/* Quick Create Task */}
          <button
            onClick={() => setShowCreateTask(true)}
            className="p-1.5 text-muted-foreground hover:text-indigo-500 dark:hover:text-indigo-400 rounded-md"
            title="Create Task"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Chat Icon */}
          <Link prefetch={false}
            href="/chat"
            className="relative p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md"
          >
            <span className="sr-only">Chat</span>
            <MessageSquare className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Link>

          {/* Training Icon */}
          <Link prefetch={false}
            href="/training"
            className="p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md"
            title="Training Sessions"
          >
            <span className="sr-only">Training Sessions</span>
            <GraduationCap className="h-4 w-4" />
          </Link>

          {/* File Tools Menu (Notes, Excel, Word, PowerPoint, PDF) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 text-muted-foreground hover:text-foreground dark:hover:text-white rounded-md"
                title="Create New..."
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/notebooks" className="flex items-center">
                  <StickyNote className="mr-2 h-4 w-4 text-amber-500" />
                  Notes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/admin/system/teeem-xl" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
                  New Spreadsheet
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/admin/system/teeem-word" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <FileText className="mr-2 h-4 w-4 text-blue-500" />
                  New Document
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/admin/system/teeem-powerpoint" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <Presentation className="mr-2 h-4 w-4 text-orange-500" />
                  New Presentation
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/admin/system/teeem-pdf" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <FileText className="mr-2 h-4 w-4 text-red-500" />
                  New PDF
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <NotificationBell />

          {/* Email Status - shows all email accounts (IMAP + Microsoft) */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "relative p-1.5 rounded-md transition-colors",
                  getStatusColors(emailOverallStatus)
                )}
                title={`Email: ${emailTotalCount} account${emailTotalCount !== 1 ? 's' : ''}`}
              >
                <Mail className="h-4 w-4" />
                {/* Status indicator dot */}
                {emailOverallStatus === 'connected' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 border border-white dark:border-border" />
                )}
                {emailOverallStatus === 'degraded' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 border border-white dark:border-border" />
                )}
                {emailOverallStatus === 'disconnected' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-muted-foreground border border-white dark:border-border" />
                )}
                {emailOverallStatus === 'error' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-border" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b border-border">
                <h4 className="font-medium text-sm">Email Accounts</h4>
                <p className="text-xs text-muted-foreground">
                  {emailTotalCount === 0
                    ? "No email accounts configured"
                    : `${emailConnectedCount}/${emailTotalCount} connected`}
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {emailTotalCount === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No email accounts connected</p>
                    <Link href="/settings/system/email-accounts" className="text-primary hover:underline text-xs">
                      Add email account
                    </Link>
                  </div>
                ) : (
                  emailAccounts.map(account => (
                    <div key={`${account.type}-${account.id}`} className="px-3 py-2 border-b border-border last:border-0 hover:bg-muted/50">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {account.status === 'connected' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {account.status === 'syncing' && <Clock className="h-4 w-4 text-orange-500 animate-pulse" />}
                          {account.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                          {account.status === 'disconnected' && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{account.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {account.lastSyncedAt && (
                              <p className="text-[10px] text-muted-foreground">
                                Last sync: {new Date(account.lastSyncedAt).toLocaleString('en-AU', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            )}
                            {/* Sync status badge */}
                            {(() => {
                              if (account.status === 'syncing') {
                                return (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                                    Syncing
                                  </Badge>
                                );
                              }
                              if (account.status === 'error') {
                                return (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                    Error
                                  </Badge>
                                );
                              }
                              if (account.lastSyncedAt && account.status === 'connected') {
                                const minutesAgo = Math.floor((Date.now() - new Date(account.lastSyncedAt).getTime()) / 60000);
                                if (minutesAgo < 30) {
                                  return (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                      Up-to-date
                                    </Badge>
                                  );
                                } else if (minutesAgo < 120) {
                                  return (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                                      Stale
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                                      Not synced
                                    </Badge>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                          {account.error && (
                            <p className="text-[10px] text-red-500 truncate" title={account.error}>
                              {account.error}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {account.type === 'microsoft' ? 'M365' : 'IMAP'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-border bg-muted/30">
                <Link
                  href="/settings/system/email-accounts"
                  className="block text-center text-xs text-primary hover:underline"
                >
                  Manage Email Accounts
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Office 365 Status */}
          <Link prefetch={false}
            href="/settings/integrations/microsoft"
            className={cn(
              "relative p-1.5 rounded-md transition-colors",
              getStatusColors(office365Status)
            )}
            title={office365Tooltip}
          >
            <span className="sr-only">Office 365</span>
            <Microsoft365Icon className="h-4 w-4" />
            {/* Status indicator dot - shows actual connection status */}
            {office365Status === 'connected' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 border border-white dark:border-border" />
            )}
            {office365Status === 'degraded' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 border border-white dark:border-border" />
            )}
            {office365Status === 'disconnected' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-muted-foreground border border-white dark:border-border" />
            )}
            {office365Status === 'error' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-border" />
            )}
          </Link>

          {/* Xero Status */}
          <Link prefetch={false}
            href="/settings/integrations/xero"
            className={cn(
              "relative p-1.5 rounded-md transition-colors",
              xeroPendingReview > 0 ? "text-amber-500 dark:text-amber-400 hover:text-amber-600" : getStatusColors(xeroStatus)
            )}
            title={xeroPendingReview > 0 ? `${xeroPendingReview} Xero contacts pending review` : xeroTooltip}
          >
            <span className="sr-only">Xero Connections</span>
            <XeroIcon className="h-4 w-4" />
            {/* Pending review badge - takes priority over status dot */}
            {xeroPendingReview > 0 ? (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1.5 h-4 min-w-[16px] flex items-center justify-center p-0 px-1 text-[10px] bg-amber-500 hover:bg-amber-500"
              >
                {xeroPendingReview > 9 ? "9+" : xeroPendingReview}
              </Badge>
            ) : (
              <>
                {/* Status indicator dot - shows actual connection status */}
                {xeroStatus === 'connected' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 border border-white dark:border-border" />
                )}
                {(xeroStatus === 'degraded' || xeroStatus === 'rate_limited') && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 border border-white dark:border-border" />
                )}
                {xeroStatus === 'disconnected' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-muted-foreground border border-white dark:border-border" />
                )}
                {xeroStatus === 'error' && (
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-border" />
                )}
              </>
            )}
          </Link>

          {/* Data Warehouse */}
          <Link prefetch={false}
            href="/data-warehouse"
            className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-600 dark:text-red-400 rounded-md transition-colors"
            title="Data Warehouse"
          >
            <span className="sr-only">Data Warehouse</span>
            <Database className="h-4 w-4" />
          </Link>

          {/* System Health - link to full page */}
          <Link prefetch={false}
            href="/system-health"
            className="p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-white rounded-md transition-colors"
            title="System Health"
          >
            <HeartPulse className="h-4 w-4 text-red-500 dark:text-red-400" />
          </Link>

          {/* Inspiring Banner - centered */}
          <div className="flex-1 flex justify-center px-2">
            <InspiringBanner />
          </div>

          {/* Help Button */}
          <FloatingHelpButton inline={true} />

          {/* Separator */}
          <div
            aria-hidden="true"
            className="hidden xl:block xl:h-5 xl:w-px xl:bg-muted dark:xl:bg-white/10"
          />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 shrink min-w-0">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden 2xl:flex 2xl:items-center min-w-0">
                  <span className="text-sm font-medium text-foreground dark:text-white truncate max-w-[100px]">
                    {user?.name || user?.email || "Guest"}
                  </span>
                  {(() => {
                    const role = user?.role;
                    return typeof role === "string" && role ? (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 shrink-0">
                        {role}
                      </Badge>
                    ) : null;
                  })()}
                  <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground shrink-0" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user && (
                <>
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground dark:text-white">
                      {user.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link prefetch={false} href="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Your profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                }}
                className="flex items-center"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Create Task Dialog - accessible from anywhere */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
      />
    </header>
  );
}
