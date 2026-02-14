import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricebook | TEEEM",
  description: "Manage your pricing catalog and supplier items",
};

export default function PricebookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
