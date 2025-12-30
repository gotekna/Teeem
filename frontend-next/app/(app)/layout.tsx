"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { LayoutModeProvider, useLayoutMode } from "@/contexts/LayoutModeContext";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { BreadcrumbTrail } from "@/components/navigation/BreadcrumbTrail";
import { Spinner } from "@/components/ui/spinner";
import { initVitals } from "@/lib/performance/vitals";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { sidebarWidth } = useSidebar();
  const { containerClassName, contentClassName, shouldHideSidebar } = useLayoutMode();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const vitalsInitialized = useRef(false);

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
      {/* Fixed Header Bar - single instance for both desktop and mobile */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <HeaderBar onMenuClick={() => setSidebarOpen(true)} />
      </div>

      {/* Sidebar - below header (hidden in fullscreen mode) */}
      {!shouldHideSidebar && (
        <div className="hidden md:block fixed top-12 left-0 bottom-0 z-40">
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
      <main className={`sidebar-content-area pt-12 h-screen overflow-hidden ${containerClassName} transition-all duration-300 ease-in-out`}>
        <div className={`h-full overflow-auto ${contentClassName}`}>
          {children}
        </div>
      </main>

      {/* Floating Help Button (for pages without header visible on mobile) */}
      <div className="hidden">
        <FloatingHelpButton />
      </div>

      {/* Breadcrumb Trail - floating overlay below header */}
      <BreadcrumbTrail />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ViewModeProvider>
        <LayoutModeProvider>
          <BreadcrumbProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
          </BreadcrumbProvider>
        </LayoutModeProvider>
      </ViewModeProvider>
    </SidebarProvider>
  );
}
