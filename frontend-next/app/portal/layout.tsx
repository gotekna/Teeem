
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  DocumentDuplicateIcon,
  TrophyIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { ROUTES } from "@/lib/constants/route-paths";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmationProvider } from "@/contexts/ConfirmationContext";

interface PortalUser {
  contact_name?: string;
  company_name?: string;
  portal_type?: string;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load portal user from localStorage
    const user = getStorageItem<PortalUser | null>(STORAGE_KEYS.PORTAL_USER, null);
    setPortalUser(user);
    setIsLoading(false);

    // Redirect to login if not authenticated and not already on login page
    if (!user && pathname !== ROUTES.PORTAL.LOGIN) {
      router.push(ROUTES.PORTAL.LOGIN);
    }
  }, [pathname, router]);

  const isPropertyPortal = portalUser?.portal_type === "tenant" || portalUser?.portal_type === "owner";
  const isOwner = portalUser?.portal_type === "owner";

  const supplierNavigation = [
    { name: "Dashboard", href: ROUTES.PORTAL.DASHBOARD, icon: HomeIcon },
    { name: "Quotes", href: ROUTES.PORTAL.QUOTES, icon: DocumentTextIcon },
    { name: "Jobs", href: ROUTES.PORTAL.JOBS, icon: BriefcaseIcon },
    { name: "Schedule", href: ROUTES.PORTAL.SCHEDULE, icon: CalendarDaysIcon },
    { name: "Invoices", href: ROUTES.PORTAL.INVOICES, icon: DocumentDuplicateIcon },
    { name: "Kudos", href: ROUTES.PORTAL.KUDOS, icon: TrophyIcon },
    { name: "Settings", href: "/portal/settings", icon: Cog6ToothIcon },
  ];

  const propertyNavigation = [
    { name: "Dashboard", href: ROUTES.PORTAL.PROPERTY_DASHBOARD, icon: HomeIcon },
    { name: "Inspections", href: ROUTES.PORTAL.PROPERTY_INSPECTIONS, icon: ClipboardDocumentCheckIcon },
    { name: "Maintenance", href: ROUTES.PORTAL.PROPERTY_MAINTENANCE, icon: WrenchScrewdriverIcon },
    { name: "Documents", href: ROUTES.PORTAL.PROPERTY_DOCUMENTS, icon: DocumentTextIcon },
    ...(isOwner ? [
      { name: "Valuations", href: ROUTES.PORTAL.PROPERTY_VALUATIONS, icon: ChartBarIcon },
    ] : []),
  ];

  const navigation = isPropertyPortal ? propertyNavigation : supplierNavigation;

  const handleLogout = () => {
    removeStorageItem(STORAGE_KEYS.PORTAL_TOKEN);
    removeStorageItem(STORAGE_KEYS.PORTAL_USER);
    router.push(ROUTES.PORTAL.LOGIN);
  };

  // Don't render layout for login page
  if (pathname === ROUTES.PORTAL.LOGIN) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading || !portalUser) {
    return null;
  }

  return (
    <ConfirmationProvider>
    <div className="min-h-screen bg-muted dark:bg-background">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border dark:border-border px-4 py-3 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
            <h1 className="text-lg font-semibold text-foreground dark:text-white">TEEEM Portal</h1>
          </div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
            {portalUser?.contact_name}
          </div>
        </div>
      </div>

      {/* Sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border dark:border-border bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">TEEEM Portal</h1>
          </div>

          {/* User info */}
          <div className="border-b border-border dark:border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                {portalUser?.contact_name?.charAt(0) || "S"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground dark:text-white truncate">
                  {portalUser?.contact_name}
                </p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                  {portalUser?.company_name}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6
                            ${
                              isActive
                                ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                                : "text-foreground dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted dark:hover:bg-muted"
                            }
                          `}
                        >
                          <item.icon
                            className={`h-6 w-6 shrink-0 ${
                              isActive
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-muted-foreground dark:text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                            }`}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>

              {/* Logout button */}
              <li className="mt-auto">
                <button
                  onClick={handleLogout}
                  className="group -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <ArrowRightOnRectangleIcon
                    className="h-6 w-6 shrink-0 text-muted-foreground dark:text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                    aria-hidden="true"
                  />
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/80"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-64 bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4 pt-20">
              {/* User info */}
              <div className="border-b border-border dark:border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                    {portalUser?.contact_name?.charAt(0) || "S"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground dark:text-white truncate">
                      {portalUser?.contact_name}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                      {portalUser?.company_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6
                            ${
                              isActive
                                ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                                : "text-foreground dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted dark:hover:bg-muted"
                            }
                          `}
                        >
                          <item.icon
                            className={`h-6 w-6 shrink-0 ${
                              isActive
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-muted-foreground dark:text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                            }`}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="group mt-8 -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <ArrowRightOnRectangleIcon
                    className="h-6 w-6 shrink-0 text-muted-foreground dark:text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                    aria-hidden="true"
                  />
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64 h-screen overflow-y-auto">
        <main className="py-6 lg:py-10 px-4 sm:px-6 lg:px-8 pt-20 lg:pt-10">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
    </ConfirmationProvider>
  );
}
