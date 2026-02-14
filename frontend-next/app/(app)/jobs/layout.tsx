import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs | TEEEM",
  description: "Manage your construction jobs and projects",
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
