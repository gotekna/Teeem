import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase Orders | TEEEM",
  description: "Manage purchase orders and supplier invoices",
};

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
