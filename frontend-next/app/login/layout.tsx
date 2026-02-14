import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | TEEEM",
  description: "Sign in to your TEEEM account",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
