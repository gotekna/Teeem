import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estimates | TEEEM",
  description: "Create and manage project estimates and quotes",
};

export default function EstimatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
