import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance | TEEEM",
  description: "Manage invoices, estimates, and financial records",
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
