"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { Spinner } from "@/components/ui/spinner";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { sidebarWidth } = useSidebar();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

      {/* Sidebar - below header */}
      <div className="hidden md:block fixed top-12 left-0 bottom-0 z-40">
        <Sidebar />
      </div>

      {/* CSS for sidebar width on desktop */}
      <style>{`
        @media (min-width: 768px) {
          .sidebar-content-area {
            padding-left: ${sidebarWidth}px !important;
          }
        }
      `}</style>

      {/* Main Content - below header, beside sidebar */}
      {/* DEBUG: red=main, blue=inner div */}
      <main className="sidebar-content-area pt-12 h-full overflow-auto transition-all duration-300 ease-in-out border-4 border-red-500">
        <div className="h-full pt-6 pb-0 px-4 flex flex-col border-4 border-blue-500">
          {children}
        </div>
      </main>

      {/* Floating Help Button (for pages without header visible on mobile) */}
      <div className="hidden">
        <FloatingHelpButton />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ViewModeProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </ViewModeProvider>
    </SidebarProvider>
  );
}
