import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tasks | TEEEM",
  description: "Manage project tasks and to-do items",
};

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
