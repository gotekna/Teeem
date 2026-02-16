import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | TEEEM",
  description: "Your project management dashboard",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
