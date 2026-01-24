'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * SSoT Redirect: /sm_tasks → /tasks
 *
 * The task LIST lives at /tasks (TaskHubProvider).
 * The task DETAIL lives at /sm_tasks/[id] (individual task view).
 *
 * When user navigates to /sm_tasks (no ID), redirect them to /tasks
 * where the actual task list is displayed.
 *
 * This handles the case when browser back button lands here.
 */
export default function SmTasksRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks');
  }, [router]);

  return null;
}
