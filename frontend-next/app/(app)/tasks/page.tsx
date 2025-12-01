'use client';

import { TaskHubProvider } from '@/contexts/TaskHubContext';
import { TaskHub } from '@/components/task-hub';

export default function TasksPage() {
  return (
    <TaskHubProvider>
      <TaskHub />
    </TaskHubProvider>
  );
}
