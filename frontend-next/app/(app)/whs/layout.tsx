import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WHS | TEEEM",
  description: "Workplace health and safety management",
};

export default function WHSLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
