import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started | TEEEM",
  description: "Create your TEEEM account and start managing your construction projects",
};

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
