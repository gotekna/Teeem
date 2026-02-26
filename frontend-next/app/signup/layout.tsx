import { AuthProviderWrapper } from "@/components/providers/auth-provider-wrapper";

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <AuthProviderWrapper>{children}</AuthProviderWrapper>;
}
