import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email | TEEEM",
  description: "Manage your project emails and communications",
};

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
