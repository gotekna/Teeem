import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Corporate | TEEEM",
  description: "Manage corporate documents and company information",
};

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
