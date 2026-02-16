import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacts | TEEEM",
  description: "Manage your business contacts and relationships",
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
