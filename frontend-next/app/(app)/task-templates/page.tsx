"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Task Templates - Redirects to Schedule Templates
 *
 * The task_templates Foundation was removed (SSoT: SmTemplateRow is THE ONE).
 * Schedule Templates at /schedule-templates is the correct destination.
 */
export default function TaskTemplatesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/schedule-templates");
  }, [router]);

  return null;
}
