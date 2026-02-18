import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenClaw API Documentation | TEEEM",
  description:
    "API documentation for integrating with TEEEM's construction management platform via the OpenClaw API.",
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
