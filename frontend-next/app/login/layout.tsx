import type { Metadata } from "next";
import { AuthProviderWrapper } from "@/components/providers/auth-provider-wrapper";

export const metadata: Metadata = {
  title: "Login | TEEEM",
  description: "Sign in to your TEEEM account",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProviderWrapper>{children}</AuthProviderWrapper>;
}
