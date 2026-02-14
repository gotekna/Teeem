import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents | TEEEM",
  description: "Document warehouse and file management",
};

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
