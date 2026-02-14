import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflows | TEEEM",
  description: "Manage business process workflows and automation",
};

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
