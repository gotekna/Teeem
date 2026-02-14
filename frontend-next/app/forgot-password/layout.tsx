import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | TEEEM",
  description: "Reset your TEEEM account password",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
