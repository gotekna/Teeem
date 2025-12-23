"use client";

import dynamic from 'next/dynamic';
import { Spinner } from "@/components/ui/spinner";

// Dynamic import to avoid SSR issues with the old React component
const ScheduleTemplateEditor = dynamic(
  () => import('@/components/schedule-master/ScheduleTemplateEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    ),
  }
);

export default function ScheduleTemplateEditorPage() {
  return (
    <div className="h-full">
      <ScheduleTemplateEditor />
    </div>
  );
}
