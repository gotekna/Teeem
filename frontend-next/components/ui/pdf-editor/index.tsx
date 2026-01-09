"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

import { Spinner } from "@/components/ui/spinner";

import type { PDFEditorProps } from "./types";
export type { PDFEditorProps, AnnotationTool, PDFPage } from "./types";

// Loading component
function PDFEditorLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Spinner size={32} className="mb-2" />
      <p className="text-sm text-muted-foreground">Loading PDF editor...</p>
    </div>
  );
}

// Dynamically import the editor implementation to avoid SSR issues
const PDFEditorImpl = dynamic(
  () => import("./pdf-editor-impl").then((mod) => mod.PDFEditorImpl),
  {
    ssr: false,
    loading: () => <PDFEditorLoading />,
  }
);

export function PDFEditor(props: PDFEditorProps) {
  return <PDFEditorImpl {...props} />;
}
