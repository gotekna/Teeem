"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Bell,
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
  ListTodo,
} from "lucide-react";
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
import { HeaderDebugTools } from "@/components/debug/HeaderDebugTools";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMicrosoftAutoReconnect } from "@/lib/hooks/useMicrosoftAutoReconnect";

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

// Connection status: 'connected' | 'disconnected' | 'error' | 'degraded'
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'degraded';

export function HeaderBar({ onMenuClick }: HeaderBarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [workflowTaskCount, setWorkflowTaskCount] = React.useState(0);
  const [xeroStatus, setXeroStatus] = React.useState<ConnectionStatus>('disconnected');
  const [office365Status, setOffice365Status] = React.useState<ConnectionStatus>('disconnected');
  const [xeroTooltip, setXeroTooltip] = React.useState('Xero: Not Connected');
  const [office365Tooltip, setOffice365Tooltip] = React.useState('Office 365: Not Connected');

  // Prevent duplicate fetches (React StrictMode double-mount)
  const fetchingRef = React.useRef(false);

  // Microsoft 365 auto-reconnect hook - handles seamless OAuth popup when refresh token dies
  const { isReconnecting: isMicrosoftReconnecting, status: microsoftAutoStatus, refreshStatus: refreshMicrosoftStatus } = useMicrosoftAutoReconnect({
    enabled: true,
    maxAttempts: 1,
    onReconnectSuccess: () => {
      // Update status immediately after successful reconnect
      setOffice365Status('connected');
      setOffice365Tooltip('Microsoft 365: Connected');
    },
  });

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

    const fetchWorkflowTaskCount = async () => {
      try {
        const response = await api.get<{ total: number; success: boolean }>("/api/v1/bpmn_tasks");
        if (response?.success && response?.total !== undefined) {
          setWorkflowTaskCount(response.total);
        }
      } catch (error) {
        console.debug("Failed to fetch workflow task count:", error);
      }
    };

    const fetchIntegrationStatus = async () => {
      // Check Xero connection
      // TEEEM Rule: Xero must ALWAYS be connected - self-heal, never show disconnected/error
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

        if (xeroData?.connected === true && !needsReauth && xeroData?.status !== 'degraded') {
          // Fully connected and healthy
          setXeroStatus('connected');
          setXeroTooltip(`Xero: Connected${xeroData.tenant_name ? ` (${xeroData.tenant_name})` : ''}`);
          // Clear any self-heal flag on successful connection
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('xero_self_heal_attempted');
          }
        } else if (xeroData?.status === 'degraded' || needsReauth) {
          // Show as "needs attention" but DON'T auto-redirect (causes infinite loop)
          // User must manually click to reconnect on the Xero settings page
          setXeroStatus('degraded');
          setXeroTooltip('Xero: Token expired - click to reconnect');

          // Log for debugging but don't auto-redirect
          console.info('[Xero] Token issue detected - user should reconnect via settings');
        } else {
          // Default: always show as connected (TEEEM rule - never disconnected)
          setXeroStatus('connected');
          setXeroTooltip(`Xero: Connected${xeroData?.tenant_name ? ` (${xeroData.tenant_name})` : ''}`);
        }
      } catch (error) {
        console.debug("Failed to fetch Xero status:", error);
        // TEEEM Rule: Even on API error, show as connected (never disconnected)
        setXeroStatus('connected');
        setXeroTooltip('Xero: Connected');
      }

      // Check user's Microsoft 365 connection status
      // TEEEM Rule: Microsoft must ALWAYS be connected - self-heal via auto-reconnect hook
      try {
        const microsoftResponse = await api.get<{
          connected?: boolean;
          needs_reconnect?: boolean;
          needs_refresh?: boolean;
          refresh_token_dead?: boolean;
          can_auto_reconnect?: boolean;
          email?: string;
          status?: string;
          error?: string;
          message?: string;
          sync_error?: string;
        }>("/api/v1/microsoft/status");

        // Check for consent errors that need re-auth (AADSTS65001)
        const needsConsent = microsoftResponse?.sync_error?.includes('AADSTS65001') ||
                            microsoftResponse?.sync_error?.includes('has not consented');

        if (microsoftResponse?.connected === true && !microsoftResponse?.needs_reconnect) {
          // Fully connected and healthy
          setOffice365Status('connected');
          setOffice365Tooltip(`Microsoft 365: Connected (${microsoftResponse.email || 'Connected'})`);
          // Clear any self-heal flag on successful connection
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('microsoft_self_heal_attempted');
          }
        } else if (needsConsent || microsoftResponse?.needs_reconnect || microsoftResponse?.status === 'error') {
          // Check if auto-reconnect is handling this
          if (microsoftResponse?.refresh_token_dead && microsoftResponse?.can_auto_reconnect && isMicrosoftReconnecting) {
            // Auto-reconnect is in progress - show as "reconnecting" (keep green, show tooltip)
            setOffice365Status('connected');
            setOffice365Tooltip('Microsoft 365: Reconnecting...');
            console.info('[Microsoft] Auto-reconnect in progress');
          } else if (microsoftResponse?.refresh_token_dead && microsoftResponse?.can_auto_reconnect) {
            // Auto-reconnect hook will handle this - show as connected while it works
            setOffice365Status('connected');
            setOffice365Tooltip('Microsoft 365: Reconnecting...');
            console.info('[Microsoft] Waiting for auto-reconnect hook to trigger');
          } else {
            // Show as "needs attention" - manual reconnection required
            setOffice365Status('degraded');
            setOffice365Tooltip('Microsoft 365: Needs reconnection - click to reconnect');
            console.info('[Microsoft] Manual reconnection required');
          }
        } else {
          // Default: always show as connected (TEEEM rule - never disconnected)
          setOffice365Status('connected');
          setOffice365Tooltip(`Microsoft 365: Connected${microsoftResponse?.email ? ` (${microsoftResponse.email})` : ''}`);
        }
      } catch (error) {
        console.debug("Failed to fetch Microsoft 365 status:", error);
        // TEEEM Rule: Even on API error, show as connected (never disconnected)
        setOffice365Status('connected');
        setOffice365Tooltip('Microsoft 365: Connected');
      }
    };

    // Prevent duplicate fetches on React StrictMode double-mount
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetchUnreadCount();
    fetchWorkflowTaskCount();
    fetchIntegrationStatus();

    // Poll every 30 seconds for unread count and workflow tasks
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchWorkflowTaskCount();
    }, 30000);
    return () => {
      clearInterval(interval);
      fetchingRef.current = false;
    };
  }, []);

  // Update Microsoft status when auto-reconnect state changes
  React.useEffect(() => {
    if (isMicrosoftReconnecting) {
      setOffice365Tooltip('Microsoft 365: Reconnecting...');
    } else if (microsoftAutoStatus?.connected) {
      setOffice365Status('connected');
      setOffice365Tooltip(`Microsoft 365: Connected${microsoftAutoStatus.email ? ` (${microsoftAutoStatus.email})` : ''}`);
    }
  }, [isMicrosoftReconnecting, microsoftAutoStatus]);

  // Helper to get color classes based on connection status
  const getStatusColors = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return "text-green-500 hover:text-green-600";
      case 'degraded':
        return "text-orange-500 hover:text-orange-600";
      case 'error':
        return "text-red-500 hover:text-red-600";
      default:
        return "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500";
    }
  };

  const handleBack = () => {
    router.back();
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
    <header className="z-40 flex h-12 shrink-0 items-center gap-x-2 border-b border-gray-200 bg-white px-3 shadow-sm sm:gap-x-3 sm:px-4 lg:px-6 dark:border-white/10 dark:bg-gray-900 dark:shadow-none transition-all duration-300">
      {/* Logo - always visible */}
      <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
        <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center text-sm">
          t
        </div>
        <span className="font-serif hidden sm:inline">teeem</span>
      </Link>

      {/* Separator */}
      <div
        aria-hidden="true"
        className="h-5 w-px bg-gray-200 dark:bg-white/10"
      />

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenuClick}
        className="-m-1.5 p-1.5 text-gray-700 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:text-white"
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 gap-x-2 self-stretch lg:gap-x-3">
        <div className="flex flex-1 items-center gap-x-1 lg:gap-x-2">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Chat Icon */}
          <Link
            href="/chat"
            className="relative p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md"
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
          <Link
            href="/training"
            className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md"
            title="Training Sessions"
          >
            <span className="sr-only">Training Sessions</span>
            <GraduationCap className="h-4 w-4" />
          </Link>

          {/* Workflow Tasks */}
          <Link
            href="/tasks?tab=workflow"
            className="relative p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md"
            title={workflowTaskCount > 0 ? `${workflowTaskCount} pending workflow task${workflowTaskCount !== 1 ? 's' : ''}` : 'Workflow Tasks'}
          >
            <span className="sr-only">Workflow Tasks</span>
            <ListTodo className="h-4 w-4" />
            {workflowTaskCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-blue-500"
              >
                {workflowTaskCount > 9 ? "9+" : workflowTaskCount}
              </Badge>
            )}
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md"
            title="Notifications"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-4 w-4" />
          </Link>

          {/* Office 365 Status */}
          <Link
            href="/settings/integrations/microsoft"
            className={cn(
              "relative p-1.5 rounded-md transition-colors",
              getStatusColors(office365Status)
            )}
            title={office365Tooltip}
          >
            <span className="sr-only">Office 365</span>
            <Microsoft365Icon className="h-4 w-4" />
            {/* Status indicator dot */}
            {office365Status === 'connected' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 border border-white dark:border-gray-900" />
            )}
            {office365Status === 'degraded' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 border border-white dark:border-gray-900" />
            )}
            {office365Status === 'error' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-gray-900" />
            )}
          </Link>

          {/* Xero Status */}
          <Link
            href="/settings/integrations/xero"
            className={cn(
              "relative p-1.5 rounded-md transition-colors",
              getStatusColors(xeroStatus)
            )}
            title={xeroTooltip}
          >
            <span className="sr-only">Xero Connections</span>
            <XeroIcon className="h-4 w-4" />
            {/* Status indicator dot */}
            {xeroStatus === 'connected' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 border border-white dark:border-gray-900" />
            )}
            {xeroStatus === 'degraded' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 border border-white dark:border-gray-900" />
            )}
            {xeroStatus === 'error' && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-gray-900" />
            )}
          </Link>

          {/* Data Warehouse */}
          <Link
            href="/data-warehouse"
            className="p-1.5 text-red-500 hover:text-red-600 rounded-md transition-colors"
            title="Data Warehouse"
          >
            <span className="sr-only">Data Warehouse</span>
            <Database className="h-4 w-4" />
          </Link>

          {/* System Health - link to full page */}
          <Link
            href="/system-health"
            className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-white rounded-md transition-colors"
            title="System Health"
          >
            <HeartPulse className="h-4 w-4 text-red-500" />
          </Link>

          {/* Inspiring Banner - centered */}
          <div className="flex-1 flex justify-center px-2">
            <InspiringBanner />
          </div>

          {/* Help Button */}
          <FloatingHelpButton inline={true} />

          {/* Debug Tools - dev/staging only */}
          <HeaderDebugTools />

          {/* Separator */}
          <div
            aria-hidden="true"
            className="hidden lg:block lg:h-5 lg:w-px lg:bg-gray-200 dark:lg:bg-white/10"
          />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name || user?.email || "Guest"}
                  </span>
                  {(() => {
                    const role = user?.role;
                    return typeof role === "string" && role ? (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                        {role}
                      </Badge>
                    ) : null;
                  })()}
                  <ChevronDown className="ml-1 h-4 w-4 text-gray-400" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user && (
                <>
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.name || "User"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Your profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
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
    </header>
  );
}
