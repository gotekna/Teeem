"use client";

import * as React from "react";

/**
 * Financial Layout
 *
 * Simple pass-through layout. The main page.tsx handles its own
 * header, tab navigation, and company selector.
 *
 * Sub-pages like /financial/transactions and /financial/tas
 * have their own layouts.
 */
export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
