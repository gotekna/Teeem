import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule Master | TEEEM",
  description: "Manage project schedules and timelines",
};

export default function ScheduleMasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
