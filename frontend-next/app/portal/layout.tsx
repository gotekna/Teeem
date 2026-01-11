 
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
} from "@heroicons/react/24/outline";

interface PortalUser {
  contact_name?: string;
  company_name?: string;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load portal user from localStorage
    const userStr = localStorage.getItem("portal_user");
    const user = userStr ? JSON.parse(userStr) : null;
    setPortalUser(user);
    setIsLoading(false);

    // Redirect to login if not authenticated and not already on login page
    if (!user && pathname !== "/portal/login") {
      router.push("/portal/login");
    }
  }, [pathname, router]);

  const navigation = [
    { name: "Dashboard", href: "/portal/dashboard", icon: HomeIcon },
    { name: "Quotes", href: "/portal/quotes", icon: DocumentTextIcon },
    { name: "Jobs", href: "/portal/jobs", icon: BriefcaseIcon },
    { name: "Schedule", href: "/portal/schedule", icon: CalendarDaysIcon },
    { name: "Invoices", href: "/portal/invoices", icon: DocumentDuplicateIcon },
    { name: "Kudos", href: "/portal/kudos", icon: TrophyIcon },
    { name: "Settings", href: "/portal/settings", icon: Cog6ToothIcon },
  ];

  const handleLogout = () => {
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_user");
    router.push("/portal/login");
  };

  // Don't render layout for login page
  if (pathname === "/portal/login") {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading || !portalUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border dark:border-border px-4 py-3 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
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
      <div className="lg:pl-64">
        <main className="py-6 lg:py-10 px-4 sm:px-6 lg:px-8 pt-20 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
