"use client";

import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

export default function PropertyDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useSetLayoutMode("full-height");
  return <>{children}</>;
}
