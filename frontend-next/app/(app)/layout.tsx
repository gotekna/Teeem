"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { LayoutModeProvider, useLayoutMode } from "@/contexts/LayoutModeContext";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { BreadcrumbTrail, BREADCRUMB_BAR_HEIGHT } from "@/components/navigation/BreadcrumbTrail";
import { Spinner } from "@/components/ui/spinner";
import { initVitals } from "@/lib/performance/vitals";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TenantSwitcher } from "@/components/admin/TenantSwitcher";
import { useTenantOptional } from "@/contexts/TenantContext";

// Height of tenant switcher banner when visible
const TENANT_SWITCHER_HEIGHT = 40;

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { sidebarWidth } = useSidebar();
  const { containerClassName, contentClassName, shouldHideSidebar } = useLayoutMode();
  const tenantContext = useTenantOptional();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const vitalsInitialized = useRef(false);

  // Check if tenant switcher banner should be shown (TEEEM staff only)
  const showTenantSwitcher = tenantContext?.isTeeemStaff ?? false;
  const headerOffset = showTenantSwitcher ? 48 + TENANT_SWITCHER_HEIGHT : 48;

  // Note: Breadcrumb trail is rendered by BreadcrumbTrail component
  // Padding is always reserved (48 + BREADCRUMB_BAR_HEIGHT) to prevent CLS

  // Initialize Performance Observatory Web Vitals collection
  useEffect(() => {
    if (!vitalsInitialized.current) {
      initVitals();
      vitalsInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Tenant Switcher Banner - only visible to TEEEM staff */}
      {showTenantSwitcher && (
        <div className="fixed top-0 left-0 right-0 z-[60]">
          <TenantSwitcher />
        </div>
      )}

      {/* Fixed Header Bar - single instance for both desktop and mobile */}
      <div
        className="fixed left-0 right-0 z-50"
        style={{ top: showTenantSwitcher ? TENANT_SWITCHER_HEIGHT : 0 }}
      >
        <HeaderBar onMenuClick={() => setSidebarOpen(true)} />
      </div>

      {/* Sidebar - below header (hidden in fullscreen mode) */}
      {!shouldHideSidebar && (
        <div
          className="hidden md:block fixed left-0 bottom-0 z-40"
          style={{ top: headerOffset }}
        >
          <Sidebar />
        </div>
      )}

      {/* CSS for sidebar width on desktop (not in fullscreen mode) */}
      <style>{`
        @media (min-width: 768px) {
          .sidebar-content-area {
            padding-left: ${shouldHideSidebar ? 0 : sidebarWidth}px !important;
          }
        }
      `}</style>

      {/* Main Content - below header, beside sidebar */}
      {/* headerOffset = 48px for header + tenant switcher if visible */}
      {/* CLS FIX: Always reserve breadcrumb space even when trail is empty
       * Trail is populated via useEffect which runs after first render
       * Without consistent padding, there's a 36px layout shift (CLS 0.28) */}
      {/* CLS FIX: Use transition-[padding-left] instead of transition-all
       * transition-all caused non-composited border-color animations triggering CLS
       * Only padding-left needs to animate (for sidebar resize) */}
      <main
        className={`sidebar-content-area h-screen overflow-hidden ${containerClassName} transition-[padding-left] duration-300 ease-in-out pb-16 md:pb-0`}
        style={{ paddingTop: shouldHideSidebar ? headerOffset : headerOffset + BREADCRUMB_BAR_HEIGHT }}
      >
        <div className={`h-full overflow-auto ${contentClassName}`}>
          {children}
        </div>
      </main>

      {/* Floating Help Button (for pages without header visible on mobile) */}
      <div className="hidden">
        <FloatingHelpButton />
      </div>

      {/* Breadcrumb Trail - floating overlay below header (hidden in fullscreen) */}
      {!shouldHideSidebar && <BreadcrumbTrail topOffset={headerOffset} />}

      {/* Mobile Bottom Navigation - only renders on mobile */}
      <MobileBottomNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ViewModeProvider>
        <LayoutModeProvider>
          <Suspense fallback={null}>
            <BreadcrumbProvider>
              <AppLayoutContent>{children}</AppLayoutContent>
            </BreadcrumbProvider>
          </Suspense>
        </LayoutModeProvider>
      </ViewModeProvider>
    </SidebarProvider>
  );
}
