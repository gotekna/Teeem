'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

// Types
// Task attachment types
export interface TaskAttachmentEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name?: string;
  received_at: string;
  has_attachments: boolean;
  conversation_id?: string;
  thread_count?: number;
  body_preview?: string;
}

export interface TaskAttachmentDocument {
  id: number;
  file_name: string;
  display_name: string;
  document_type?: string;
  sharepoint_url?: string;
  created_at: string;
}

export interface TaskAttachment {
  id: number;
  attachment_type: string;
  notes?: string;
  added_by?: string;
  created_at: string;
  email?: TaskAttachmentEmail;
  document?: TaskAttachmentDocument;
}

export interface TaskActionItem {
  id: number;
  text: string;
  checked: boolean;
  position: number;
  checked_by_id?: number;
  checked_by_name?: string;
  checked_at?: string;
}

export interface TaskFollower {
  id: number;
  user_id: number;
  user_name: string;
  followed_at: string;
}

export interface SmTask {
  id: number;
  task_number: number;
  name: string;
  description?: string;
  status: 'not_started' | 'started' | 'completed';
  start_date: string;
  end_date: string;
  duration_days: number;
  progress_percentage: number;
  trade?: string;
  stage?: string;
  sequence_order?: number;

  // Job relationship
  construction_id: number;
  job_name?: string;

  // Assignment
  assigned_user_id?: number;
  assigned_user_name?: string;
  assigned_role?: string;
  supplier_id?: number;
  supplier_name?: string;

  // Lock status
  locked: boolean;
  lock_type?: 'supplier_confirm' | 'confirm' | 'started' | 'completed' | 'hold';

  // Hold status
  is_hold_task: boolean;
  hold_reason?: string;
  hold?: boolean;
  hold_date?: string;

  // Confirmation status (for PO tasks)
  confirm?: boolean;
  supplier_confirm?: boolean;
  confirm_date?: string;
  supplier_confirm_date?: string;
  started_at?: string;
  completed_at?: string;

  // PO relationship
  purchase_order_id?: number;
  purchase_order_number?: string;
  po_required?: boolean;

  // Computed fields
  is_overdue: boolean;
  days_until_due: number;
  predecessor_count?: number;
  successor_count?: number;

  // Attachments
  attachments_count?: number;
  attachments?: TaskAttachment[];

  // Privacy
  is_private?: boolean;
  created_by_id?: number;
  is_following?: boolean;

  // Action Items (checkable items within task)
  action_items?: TaskActionItem[];

  // Email keywords for auto-matching
  email_keywords?: string;
}

export interface TaskFilters {
  jobIds: number[];
  statuses: ('not_started' | 'started' | 'completed')[];
  assignedUserIds: number[];
  trades: string[];
  stages: string[];
  dateRange: { start: Date; end: Date } | null;
  search: string;
  showMyTasksOnly: boolean;
  showOverdueOnly: boolean;
}

export type ViewType = 'board' | 'list' | 'my-tasks' | 'all' | 'workflow';

export interface TaskHubState {
  tasks: SmTask[];
  filters: TaskFilters;
  activeView: ViewType;
  selectedTaskIds: Set<number>;
  expandedTaskId: number | null;
  loading: boolean;
  error: string | null;
}

export interface TaskHubContextType extends TaskHubState {
  // Filtered data
  filteredTasks: SmTask[];
  myTasks: SmTask[];
  overdueTasks: SmTask[];
  todayTasks: SmTask[];
  thisWeekTasks: SmTask[];

  // Meta
  meta: {
    totalCount: number;
    overdueCount: number;
    dueTodayCount: number;
    inProgressCount: number;
  };

  // Actions
  updateTask: (taskId: number, updates: Partial<SmTask>) => Promise<void>;
  createTask: (task: Partial<SmTask>) => Promise<SmTask>;
  deleteTask: (taskId: number) => Promise<void>;

  // Bulk actions
  bulkUpdateStatus: (taskIds: number[], status: SmTask['status']) => Promise<void>;
  bulkAssign: (taskIds: number[], userId: number) => Promise<void>;

  // View & filter actions
  setActiveView: (view: ViewType) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearFilters: () => void;

  // Selection
  selectTask: (taskId: number) => void;
  deselectTask: (taskId: number) => void;
  toggleTaskSelection: (taskId: number) => void;
  selectAll: () => void;
  deselectAll: () => void;

  // Expansion
  expandTask: (taskId: number) => void;
  collapseTask: () => void;
  toggleTaskExpansion: (taskId: number) => void;

  // Task actions
  startTask: (taskId: number) => Promise<void>;
  completeTask: (taskId: number) => Promise<void>;
  setTaskHold: (taskId: number, hold: boolean) => Promise<void>;
  confirmTask: (taskId: number, date: string) => Promise<void>;
  supplierConfirmTask: (taskId: number, date: string) => Promise<void>;

  // Action items
  addActionItem: (taskId: number, text: string) => Promise<TaskActionItem>;
  toggleActionItem: (taskId: number, itemId: number) => Promise<void>;
  updateActionItem: (taskId: number, itemId: number, text: string) => Promise<TaskActionItem>;
  removeActionItem: (taskId: number, itemId: number) => Promise<void>;

  // Privacy
  setTaskPrivacy: (taskId: number, isPrivate: boolean) => Promise<void>;

  // Followers (for sharing private tasks)
  getFollowers: (taskId: number) => Promise<TaskFollower[]>;
  addFollower: (taskId: number, userId: number) => Promise<TaskFollower>;
  removeFollower: (taskId: number, userId: number) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

const defaultFilters: TaskFilters = {
  jobIds: [],
  statuses: [],
  assignedUserIds: [],
  trades: [],
  stages: [],
  dateRange: null,
  search: '',
  showMyTasksOnly: false,
  showOverdueOnly: false,
};

// Mock data for development testing - DISABLED to avoid confusion with real data
const USE_MOCK_DATA = false;

const generateMockTasks = (currentUserId?: number): SmTask[] => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const inTwoWeeks = new Date(today);
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return [
    // GANTT TASKS - Part of job schedules
    {
      id: 1001,
      task_number: 1,
      name: 'Foundation Pour - Stage 1',
      description: 'Pour concrete foundation for main building',
      status: 'completed',
      start_date: formatDate(twoDaysAgo),
      end_date: formatDate(yesterday),
      duration_days: 2,
      progress_percentage: 100,
      trade: 'Concrete',
      stage: 'Foundation',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      locked: true,
      lock_type: 'completed',
      is_hold_task: false,
      is_overdue: false,
      days_until_due: -1,
      predecessor_count: 0,
      successor_count: 2,
    },
    {
      id: 1002,
      task_number: 2,
      name: 'Framing - Ground Floor',
      description: 'Frame ground floor walls and ceiling',
      status: 'started',
      start_date: formatDate(yesterday),
      end_date: formatDate(tomorrow),
      duration_days: 3,
      progress_percentage: 60,
      trade: 'Carpentry',
      stage: 'Framing',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      supplier_id: 201,
      supplier_name: 'ABC Carpentry',
      locked: true,
      lock_type: 'started',
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 1,
      predecessor_count: 1,
      successor_count: 3,
    },
    {
      id: 1003,
      task_number: 3,
      name: 'Electrical Rough-In',
      description: 'Run electrical wiring before drywall',
      status: 'not_started',
      start_date: formatDate(tomorrow),
      end_date: formatDate(nextWeek),
      duration_days: 5,
      progress_percentage: 0,
      trade: 'Electrical',
      stage: 'Rough-In',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: 2,
      assigned_user_name: 'Mike Electrician',
      supplier_id: 202,
      supplier_name: 'Spark Electric Co',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 7,
      predecessor_count: 1,
      successor_count: 1,
    },
    {
      id: 1004,
      task_number: 4,
      name: 'Plumbing Rough-In',
      description: 'Install water and drain lines',
      status: 'not_started',
      start_date: formatDate(tomorrow),
      end_date: formatDate(nextWeek),
      duration_days: 4,
      progress_percentage: 0,
      trade: 'Plumbing',
      stage: 'Rough-In',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: 3,
      assigned_user_name: 'Pete Plumber',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 7,
      predecessor_count: 1,
      successor_count: 1,
    },

    // OVERDUE TASK
    {
      id: 1005,
      task_number: 5,
      name: 'Site Inspection - Council',
      description: 'Council building inspector visit',
      status: 'not_started',
      start_date: formatDate(twoDaysAgo),
      end_date: formatDate(yesterday),
      duration_days: 1,
      progress_percentage: 0,
      trade: 'Admin',
      stage: 'Inspection',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      locked: false,
      is_hold_task: false,
      is_overdue: true,
      days_until_due: -1,
      predecessor_count: 0,
      successor_count: 0,
    },

    // HOLD TASK
    {
      id: 1006,
      task_number: 6,
      name: 'HVAC Installation',
      description: 'Install heating and cooling system',
      status: 'not_started',
      start_date: formatDate(nextWeek),
      end_date: formatDate(inTwoWeeks),
      duration_days: 5,
      progress_percentage: 0,
      trade: 'HVAC',
      stage: 'Fit-Off',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      assigned_user_id: 4,
      assigned_user_name: 'Harry HVAC',
      locked: false,
      is_hold_task: true,
      hold_reason: 'Waiting for equipment delivery',
      is_overdue: false,
      days_until_due: 14,
      predecessor_count: 2,
      successor_count: 1,
    },

    // SECOND JOB - Different project
    {
      id: 2001,
      task_number: 1,
      name: 'Demolition',
      description: 'Remove existing structures',
      status: 'completed',
      start_date: formatDate(twoDaysAgo),
      end_date: formatDate(twoDaysAgo),
      duration_days: 1,
      progress_percentage: 100,
      trade: 'Demolition',
      stage: 'Site Prep',
      construction_id: 102,
      job_name: 'Johnson Reno - 15 Pine Ave',
      assigned_user_id: 5,
      assigned_user_name: 'Demo Dave',
      locked: true,
      lock_type: 'completed',
      is_hold_task: false,
      is_overdue: false,
      days_until_due: -2,
      predecessor_count: 0,
      successor_count: 1,
    },
    {
      id: 2002,
      task_number: 2,
      name: 'Kitchen Cabinets Install',
      description: 'Install new kitchen cabinetry',
      status: 'started',
      start_date: formatDate(today),
      end_date: formatDate(tomorrow),
      duration_days: 2,
      progress_percentage: 40,
      trade: 'Carpentry',
      stage: 'Fit-Off',
      construction_id: 102,
      job_name: 'Johnson Reno - 15 Pine Ave',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      supplier_id: 203,
      supplier_name: 'Kitchen Kings',
      locked: true,
      lock_type: 'started',
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 1,
      predecessor_count: 1,
      successor_count: 2,
    },

    // PERSONAL/ADMIN TASKS - Not on Gantt
    {
      id: 3001,
      task_number: 1,
      name: 'Order materials for next week',
      description: 'Place orders for timber, nails, and fixtures',
      status: 'not_started',
      start_date: formatDate(today),
      end_date: formatDate(today),
      duration_days: 1,
      progress_percentage: 0,
      trade: 'Admin',
      construction_id: 0, // No job
      job_name: 'Personal Task',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 0,
      predecessor_count: 0,
      successor_count: 0,
    },
    {
      id: 3002,
      task_number: 2,
      name: 'Submit timesheet',
      description: 'Weekly timesheet submission',
      status: 'not_started',
      start_date: formatDate(today),
      end_date: formatDate(today),
      duration_days: 1,
      progress_percentage: 0,
      trade: 'Admin',
      construction_id: 0,
      job_name: 'Personal Task',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 0,
      predecessor_count: 0,
      successor_count: 0,
    },
    {
      id: 3003,
      task_number: 3,
      name: 'Call supplier about delay',
      description: 'Follow up on late material delivery',
      status: 'started',
      start_date: formatDate(yesterday),
      end_date: formatDate(today),
      duration_days: 2,
      progress_percentage: 50,
      trade: 'Admin',
      construction_id: 0,
      job_name: 'Personal Task',
      assigned_user_id: currentUserId,
      assigned_user_name: 'You',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 0,
      predecessor_count: 0,
      successor_count: 0,
    },

    // UNASSIGNED TASKS
    {
      id: 4001,
      task_number: 7,
      name: 'Paint - Interior Walls',
      description: 'First coat of interior paint',
      status: 'not_started',
      start_date: formatDate(nextWeek),
      end_date: formatDate(inTwoWeeks),
      duration_days: 4,
      progress_percentage: 0,
      trade: 'Painting',
      stage: 'Finishing',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 14,
      predecessor_count: 3,
      successor_count: 1,
    },
    {
      id: 4002,
      task_number: 8,
      name: 'Flooring - Hardwood Install',
      description: 'Install hardwood flooring throughout',
      status: 'not_started',
      start_date: formatDate(inTwoWeeks),
      end_date: formatDate(inTwoWeeks),
      duration_days: 3,
      progress_percentage: 0,
      trade: 'Flooring',
      stage: 'Finishing',
      construction_id: 101,
      job_name: 'Smith Residence - 42 Oak St',
      locked: false,
      is_hold_task: false,
      is_overdue: false,
      days_until_due: 14,
      predecessor_count: 1,
      successor_count: 0,
    },
  ];
};

const TaskHubContext = createContext<TaskHubContextType | null>(null);

export const useTaskHub = (): TaskHubContextType => {
  const context = useContext(TaskHubContext);
  if (!context) {
    throw new Error('useTaskHub must be used within a TaskHubProvider');
  }
  return context;
};

// Optional version that returns null when outside provider (safe for components used globally)
export const useOptionalTaskHub = (): TaskHubContextType | null => {
  return useContext(TaskHubContext);
};

interface TaskHubProviderProps {
  children: ReactNode;
  initialJobId?: number;
}

export const TaskHubProvider = ({ children, initialJobId }: TaskHubProviderProps) => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [filters, setFiltersState] = useState<TaskFilters>(() => {
    // Load saved filters from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskHub_filters');
      if (saved) {
        try {
          return { ...defaultFilters, ...JSON.parse(saved) };
        } catch {
          // Ignore invalid JSON
        }
      }
    }
    return {
      ...defaultFilters,
      jobIds: initialJobId ? [initialJobId] : [],
    };
  });

  const [activeView, setActiveViewState] = useState<ViewType>(() => {
    // Load saved view from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskHub_activeView') as ViewType;
      if (saved && ['board', 'list', 'my-tasks', 'all', 'workflow'].includes(saved)) {
        return saved;
      }
    }
    return 'my-tasks';
  });

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tasks from API
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.jobIds.length > 0) {
        filters.jobIds.forEach(id => params.append('job_ids[]', id.toString()));
      }
      if (filters.statuses.length > 0) {
        filters.statuses.forEach(s => params.append('statuses[]', s));
      }
      // Filter by assigned_role matching user's roles (backend handles this)
      if (filters.showMyTasksOnly || activeView === 'my-tasks') {
        params.append('mine', 'true');
      }

      const response = await api.get<{ tasks: SmTask[]; success: boolean }>(`/api/v1/sm_tasks?${params.toString()}`);

      if (response.success && response.tasks && response.tasks.length > 0) {
        setTasks(response.tasks);
      } else if (USE_MOCK_DATA) {
        // Use mock data in development when no real tasks exist
        console.log('[TaskHub] Using mock data for development');
        setTasks(generateMockTasks(user?.id));
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      if (USE_MOCK_DATA) {
        // Fall back to mock data on error in development
        console.log('[TaskHub] API error, using mock data for development');
        setTasks(generateMockTasks(user?.id));
        setError(null); // Clear error since we have mock data
      } else {
        setError('Failed to load tasks');
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filters.jobIds, filters.statuses, filters.showMyTasksOnly, activeView]);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskHub_activeView', activeView);
    }
  }, [activeView]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskHub_filters', JSON.stringify(filters));
    }
  }, [filters]);

  // Computed: filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Helper to get display value from lookup or string
      const getDisplayValue = (value: unknown): string | null => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && value !== null && 'display' in value) {
          return String((value as { display: unknown }).display);
        }
        return String(value);
      };

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const tradeDisplay = getDisplayValue(task.trade);
        const matchesSearch =
          task.name.toLowerCase().includes(searchLower) ||
          task.job_name?.toLowerCase().includes(searchLower) ||
          tradeDisplay?.toLowerCase().includes(searchLower) ||
          task.assigned_user_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Trade filter
      const tradeValue = getDisplayValue(task.trade);
      if (filters.trades.length > 0 && tradeValue && !filters.trades.includes(tradeValue)) {
        return false;
      }

      // Stage filter
      const stageValue = getDisplayValue(task.stage);
      if (filters.stages.length > 0 && stageValue && !filters.stages.includes(stageValue)) {
        return false;
      }

      // Assignee filter
      if (filters.assignedUserIds.length > 0 && task.assigned_user_id && !filters.assignedUserIds.includes(task.assigned_user_id)) {
        return false;
      }

      // Overdue only
      if (filters.showOverdueOnly && !task.is_overdue) {
        return false;
      }

      // Date range
      if (filters.dateRange) {
        const taskStart = new Date(task.start_date);
        const taskEnd = new Date(task.end_date);
        if (taskEnd < filters.dateRange.start || taskStart > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filters]);

  // Computed: my tasks (assigned to user's roles - already filtered by API when activeView is 'my-tasks')
  const myTasks = useMemo(() => {
    // When on my-tasks view, API already filters by assigned_role matching user's roles
    // So all filteredTasks are "my tasks"
    if (activeView === 'my-tasks') {
      return filteredTasks;
    }
    // On other views, filter by assigned_user_id (for backwards compatibility)
    if (!user?.id) return [];
    return filteredTasks.filter(task => task.assigned_user_id === user.id);
  }, [filteredTasks, user?.id, activeView]);

  // Computed: overdue tasks
  const overdueTasks = useMemo(() => {
    return filteredTasks.filter(task => task.is_overdue && task.status !== 'completed');
  }, [filteredTasks]);

  // Computed: today's tasks
  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return filteredTasks.filter(task => {
      const startDate = new Date(task.start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate >= today && startDate < tomorrow && task.status !== 'completed';
    });
  }, [filteredTasks]);

  // Computed: this week's tasks
  const thisWeekTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return filteredTasks.filter(task => {
      const startDate = new Date(task.start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate >= today && startDate < nextWeek && task.status !== 'completed';
    });
  }, [filteredTasks]);

  // Meta stats
  const meta = useMemo(() => ({
    totalCount: filteredTasks.length,
    overdueCount: overdueTasks.length,
    dueTodayCount: todayTasks.length,
    inProgressCount: filteredTasks.filter(t => t.status === 'started').length,
  }), [filteredTasks, overdueTasks, todayTasks]);

  // Actions
  const updateTask = useCallback(async (taskId: number, updates: Partial<SmTask>) => {
    // Optimistic update
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}`, { sm_task: updates });
    } catch (err) {
      // Rollback on failure
      console.error('Failed to update task:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  const createTask = useCallback(async (task: Partial<SmTask>): Promise<SmTask> => {
    const response = await api.post<{ task: SmTask; success: boolean }>('/api/v1/sm_tasks', { sm_task: task });
    if (response?.success && response?.task) {
      setTasks(prev => [...prev, response.task]);
      return response.task;
    }
    throw new Error('Failed to create task');
  }, []);

  const deleteTask = useCallback(async (taskId: number) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      await api.delete(`/api/v1/sm_tasks/${taskId}`);
    } catch (err) {
      console.error('Failed to delete task:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  const bulkUpdateStatus = useCallback(async (taskIds: number[], status: SmTask['status']) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status } : t));

    try {
      await api.post('/api/v1/sm_tasks/bulk_update', {
        task_ids: taskIds,
        updates: { status }
      });
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error('Failed to bulk update:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  const bulkAssign = useCallback(async (taskIds: number[], userId: number) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, assigned_user_id: userId } : t));

    try {
      await api.post('/api/v1/sm_tasks/bulk_update', {
        task_ids: taskIds,
        updates: { assigned_user_id: userId }
      });
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error('Failed to bulk assign:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  // Action Items methods
  const addActionItem = useCallback(async (taskId: number, text: string): Promise<TaskActionItem> => {
    const response = await api.post<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items`,
      { text }
    );
    if (response?.success && response?.action_item) {
      // Update local task state
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, action_items: [...(t.action_items || []), response.action_item] }
          : t
      ));
      return response.action_item;
    }
    throw new Error('Failed to add action item');
  }, []);

  const toggleActionItem = useCallback(async (taskId: number, itemId: number) => {
    const response = await api.post<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${itemId}/toggle`
    );
    if (response?.success && response?.action_item) {
      // Update local task state
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              action_items: (t.action_items || []).map(item =>
                item.id === itemId ? response.action_item : item
              )
            }
          : t
      ));
    }
  }, []);

  const updateActionItem = useCallback(async (taskId: number, itemId: number, text: string): Promise<TaskActionItem> => {
    const response = await api.patch<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${itemId}`,
      { text }
    );
    if (response?.action_item) {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              action_items: (t.action_items || []).map(item =>
                item.id === itemId ? response.action_item : item
              )
            }
          : t
      ));
      return response.action_item;
    }
    throw new Error('Failed to update action item');
  }, []);

  const removeActionItem = useCallback(async (taskId: number, itemId: number) => {
    await api.delete(`/api/v1/sm_tasks/${taskId}/action_items/${itemId}`);
    // Update local task state
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, action_items: (t.action_items || []).filter(item => item.id !== itemId) }
        : t
    ));
  }, []);

  const setTaskPrivacy = useCallback(async (taskId: number, isPrivate: boolean) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_private: isPrivate } : t));

    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}/privacy`, { is_private: isPrivate });
    } catch (err) {
      console.error('Failed to update task privacy:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  // Follower methods for sharing private tasks
  const getFollowers = useCallback(async (taskId: number): Promise<TaskFollower[]> => {
    const response = await api.get<{ followers: TaskFollower[]; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/followers`
    );
    return response?.followers || [];
  }, []);

  const addFollower = useCallback(async (taskId: number, userId: number): Promise<TaskFollower> => {
    const response = await api.post<{ follower: TaskFollower; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/followers`,
      { user_id: userId }
    );
    if (!response?.success || !response.follower) {
      throw new Error('Failed to add follower');
    }
    return response.follower;
  }, []);

  const removeFollower = useCallback(async (taskId: number, userId: number): Promise<void> => {
    await api.delete(`/api/v1/sm_tasks/${taskId}/followers/${userId}`);
  }, []);

  const setActiveView = useCallback((view: ViewType) => {
    setActiveViewState(view);
  }, []);

  const setFilters = useCallback((newFilters: Partial<TaskFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const selectTask = useCallback((taskId: number) => {
    setSelectedTaskIds(prev => new Set(prev).add(taskId));
  }, []);

  const deselectTask = useCallback((taskId: number) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  const toggleTaskSelection = useCallback((taskId: number) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
  }, [filteredTasks]);

  const deselectAll = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  // Expansion handlers
  const expandTask = useCallback((taskId: number) => {
    setExpandedTaskId(taskId);
  }, []);

  const collapseTask = useCallback(() => {
    setExpandedTaskId(null);
  }, []);

  const toggleTaskExpansion = useCallback((taskId: number) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  }, []);

  // Task action handlers
  const startTask = useCallback(async (taskId: number) => {
    const now = new Date().toISOString();
    await updateTask(taskId, { status: 'started', started_at: now } as Partial<SmTask>);
  }, [updateTask]);

  const completeTask = useCallback(async (taskId: number) => {
    try {
      await api.post(`/api/v1/sm_tasks/${taskId}/complete`, {});
      // Update local state with completion
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'completed' as const, completed_at: now, end_date: today }
          : t
      ));
    } catch (err) {
      console.error('Failed to complete task:', err);
      throw err;
    }
  }, []);

  const setTaskHold = useCallback(async (taskId: number, hold: boolean) => {
    await updateTask(taskId, { hold } as Partial<SmTask>);
  }, [updateTask]);

  const confirmTask = useCallback(async (taskId: number, date: string) => {
    await updateTask(taskId, { confirm: true, hold_date: date } as Partial<SmTask>);
  }, [updateTask]);

  const supplierConfirmTask = useCallback(async (taskId: number, date: string) => {
    await updateTask(taskId, { supplier_confirm: true, hold_date: date } as Partial<SmTask>);
  }, [updateTask]);

  const refresh = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  const value: TaskHubContextType = {
    // State
    tasks,
    filters,
    activeView,
    selectedTaskIds,
    expandedTaskId,
    loading,
    error,

    // Computed
    filteredTasks,
    myTasks,
    overdueTasks,
    todayTasks,
    thisWeekTasks,
    meta,

    // Actions
    updateTask,
    createTask,
    deleteTask,
    bulkUpdateStatus,
    bulkAssign,
    setActiveView,
    setFilters,
    clearFilters,
    selectTask,
    deselectTask,
    toggleTaskSelection,
    selectAll,
    deselectAll,
    expandTask,
    collapseTask,
    toggleTaskExpansion,
    startTask,
    completeTask,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    // Action items
    addActionItem,
    toggleActionItem,
    updateActionItem,
    removeActionItem,
    // Privacy
    setTaskPrivacy,
    // Followers
    getFollowers,
    addFollower,
    removeFollower,
    refresh,
  };

  return <TaskHubContext.Provider value={value}>{children}</TaskHubContext.Provider>;
};
