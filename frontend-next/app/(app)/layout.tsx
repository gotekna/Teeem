"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FloatingHelpButton } from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { Loader } from "@/components/ui/loader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Main content area with header */}
      <div className="md:pl-[70px] flex flex-col min-h-screen">
        {/* Header Bar */}
        <HeaderBar onMenuClick={() => setSidebarOpen(true)} />
        {/* Main content */}
        <main className="flex-1 overflow-x-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
      {/* Floating Help Button (for pages without header visible on mobile) */}
      <div className="hidden">
        <FloatingHelpButton />
      </div>
    </div>
  );
}
