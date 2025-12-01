"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { Loader } from "@/components/ui/loader";

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
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <Sidebar />
      {/* CSS for sidebar width on desktop */}
      <style>{`
        @media (min-width: 768px) {
          .sidebar-content-area {
            padding-left: ${sidebarWidth}px !important;
          }
        }
      `}</style>

      {/* Fixed Header Bar */}
      <div className="sidebar-content-area flex-shrink-0 transition-all duration-300 ease-in-out pt-16 md:pt-0">
        <HeaderBar onMenuClick={() => setSidebarOpen(true)} />
      </div>

      {/* Main Content - children handle their own scrolling */}
      <main className="sidebar-content-area flex-1 min-h-0 overflow-hidden transition-all duration-300 ease-in-out">
        <div className="h-full p-6 flex flex-col">{children}</div>
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
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  );
}
