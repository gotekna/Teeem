"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  UserCircleIcon,
  BuildingOfficeIcon,
  KeyIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Spinner } from "@/components/ui/spinner";

interface PortalUser {
  contact_name?: string;
  email?: string;
  portal_type?: string;
  company_name?: string;
  kudos_score?: number;
  account_tier?: string;
  last_login_at?: string;
}

interface AccountingIntegration {
  id: number;
  system_type: string;
  organization_name?: string;
  is_active: boolean;
}

export default function PortalSettings() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("profile");
  const [accountingIntegrations, setAccountingIntegrations] = useState<
    AccountingIntegration[]
  >([]);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Load user from localStorage
      const userStr = localStorage.getItem("portal_user");
      const user = userStr ? JSON.parse(userStr) : null;
      setPortalUser(user);

      // Load accounting integrations
      const response = await axios.get("/api/v1/portal/accounting_integrations");

      if (response?.data.success) {
        setAccountingIntegrations(response.data.data.all_integrations || []);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccounting = async (systemType: string) => {
    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.get(
        "/api/v1/portal/accounting_integrations/oauth_url",
        {
          params: { system_type: systemType },
        }
      );

      if (response?.data.success) {
        // Redirect to OAuth URL
        window.location.href = response.data.data.oauth_url;
      }
    } catch (error: any) {
      console.error("Failed to get OAuth URL:", error);
      toast({
        title: "Error",
        description: "Failed to connect: " + (error.response?.data?.error || error.message),
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (integrationId: number) => {
    if (
      !(await confirm("Are you sure you want to disconnect this accounting integration?"))
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("portal_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const response = await axios.delete(
        `/api/v1/portal/accounting_integrations/${integrationId}`
      );

      if (response?.data.success) {
        loadSettings(); // Reload
      }
    } catch (error: any) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect: " + (error.response?.data?.error || error.message),
        variant: "destructive",
      });
    }
  };

  const sections = [
    { key: "profile", name: "Profile", icon: UserCircleIcon },
    { key: "company", name: "Company", icon: BuildingOfficeIcon },
    { key: "security", name: "Security", icon: KeyIcon },
    { key: "accounting", name: "Accounting", icon: BanknotesIcon },
  ];

  const accountingSystems = [
    {
      key: "xero",
      name: "Xero",
      description: "Connect to Xero for automatic invoice syncing",
      logo: "🔵",
    },
    {
      key: "myob",
      name: "MYOB",
      description: "Connect to MYOB AccountRight",
      logo: "🟢",
    },
    {
      key: "quickbooks",
      name: "QuickBooks",
      description: "Connect to QuickBooks Online",
      logo: "🟡",
    },
    {
      key: "reckon",
      name: "Reckon",
      description: "Connect to Reckon Accounts",
      logo: "🔴",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-5">
        {/* Sidebar */}
        <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:py-0 lg:px-0">
          <nav className="space-y-1">
            {sections.map((section) => {
              const isActive = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`
                    ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-700 dark:text-indigo-400"
                        : "border-transparent text-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-muted hover:text-foreground dark:hover:text-white"
                    }
                    group border-l-4 px-3 py-2 flex items-center text-sm font-medium w-full
                  `}
                >
                  <section.icon
                    className={`
                      ${
                        isActive
                          ? "text-indigo-500 dark:text-indigo-400"
                          : "text-muted-foreground dark:text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground"
                      }
                      flex-shrink-0 -ml-1 mr-3 h-6 w-6
                    `}
                  />
                  <span className="truncate">{section.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="bg-card shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-foreground dark:text-white mb-4">
                  Profile Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Name
                    </label>
                    <div className="mt-1 text-sm text-foreground dark:text-white">
                      {portalUser?.contact_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Email
                    </label>
                    <div className="mt-1 text-sm text-foreground dark:text-white">
                      {portalUser?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Portal Type
                    </label>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 capitalize">
                        {portalUser?.portal_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Company Section */}
          {activeSection === "company" && (
            <div className="bg-card shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-foreground dark:text-white mb-4">
                  Company Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Company Name
                    </label>
                    <div className="mt-1 text-sm text-foreground dark:text-white">
                      {portalUser?.company_name || "Not set"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Kudos Score
                    </label>
                    <div className="mt-1">
                      <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {portalUser?.kudos_score?.toFixed(0) || 0}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground dark:text-muted-foreground">/ 1000</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">
                      Account Tier
                    </label>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 uppercase">
                        {portalUser?.account_tier || "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <div className="bg-card shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-foreground dark:text-white mb-4">
                  Security Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-border dark:border-border shadow-sm text-sm font-medium rounded-md text-foreground dark:text-muted-foreground bg-white dark:bg-muted hover:bg-muted dark:hover:bg-accent"
                    >
                      Change Password
                    </button>
                  </div>
                  <div className="border-t border-border dark:border-border pt-4">
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-2">
                      Last Login
                    </label>
                    <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                      {portalUser?.last_login_at
                        ? new Date(portalUser.last_login_at).toLocaleString("en-AU")
                        : "Never"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accounting Section */}
          {activeSection === "accounting" && (
            <div className="space-y-6">
              <div className="bg-card shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium leading-6 text-foreground dark:text-white mb-4">
                    Accounting Integrations
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-6">
                    Connect your accounting software to automatically sync invoices
                    and track payments.
                  </p>

                  {/* Current Integrations */}
                  {accountingIntegrations.length > 0 && (
                    <div className="mb-6 space-y-3">
                      {accountingIntegrations.map((integration) => (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between p-4 border border-border dark:border-border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-muted dark:bg-muted rounded-lg flex items-center justify-center text-2xl">
                              {accountingSystems.find(
                                (s) => s.key === integration.system_type
                              )?.logo || "📊"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground dark:text-white capitalize">
                                {integration.system_type}
                              </p>
                              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                                {integration.organization_name || "Connected"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {integration.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">
                                <XCircleIcon className="h-4 w-4 mr-1" />
                                Inactive
                              </span>
                            )}
                            <button
                              onClick={() => handleDisconnect(integration.id)}
                              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Available Systems */}
                  <div className="space-y-3">
                    {accountingSystems.map((system) => {
                      const isConnected = accountingIntegrations.some(
                        (i) => i.system_type === system.key && i.is_active
                      );

                      return (
                        <div
                          key={system.key}
                          className="flex items-center justify-between p-4 border border-border dark:border-border rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-muted dark:bg-muted rounded-lg flex items-center justify-center text-2xl">
                              {system.logo}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground dark:text-white">
                                {system.name}
                              </p>
                              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                                {system.description}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              !isConnected && handleConnectAccounting(system.key)
                            }
                            disabled={isConnected}
                            className={`
                              inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium
                              ${
                                isConnected
                                  ? "border-border dark:border-border text-muted-foreground dark:text-muted-foreground cursor-not-allowed"
                                  : "border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                              }
                            `}
                          >
                            {isConnected ? (
                              <>
                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                Connected
                              </>
                            ) : (
                              "Connect"
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ArrowPathIcon className="h-5 w-5 text-blue-400 dark:text-blue-300" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Automatic Invoice Syncing
                    </h3>
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                      <p>
                        Once connected, all invoices you create will automatically
                        sync to your accounting software. Payment status will be
                        checked hourly and updated in your portal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
