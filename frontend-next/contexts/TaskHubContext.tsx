'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';
import { TASK_STATUS, type CoreTaskStatus } from '@/lib/constants/task-status';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';

// Types
// Task attachment types
export interface TaskAttachmentEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name?: string;
  to_emails?: string[];
  received_at: string;
  has_attachments: boolean;
  document_attachments_count?: number; // Count of real documents (excludes signature images)
  conversation_id?: string;
  thread_count?: number;
  body_preview?: string;
  attachment_content_hashes?: string[]; // Content hashes of email file attachments for linking to documents
  download_eml_url?: string; // SSoT: API endpoint to download email as .eml file
}

export interface TaskAttachmentDocument {
  id: number;
  file_name: string;
  display_name: string;
  document_type?: string;
  storage_url?: string; // SSoT: Provider-agnostic download URL from StorableDocument
  file_url?: string; // For ActiveStorage files (when not in external storage)
  created_at: string;
  content_hash?: string; // For matching with email attachment hashes
}

export type AttachmentCategory = 'info' | 'response';

export interface TaskAttachment {
  id: number;
  attachment_type: string;
  category?: AttachmentCategory;
  notes?: string;
  display_name?: string; // Custom display name (overrides document/email name)
  added_by?: string;
  created_at: string;
  email?: TaskAttachmentEmail;
  document?: TaskAttachmentDocument;
  sharepoint_url?: string; // For response files uploaded to SharePoint
  action_item_id?: number; // Links attachment to a specific question as response
}

export type ActionItemType = 'action' | 'question' | 'header';

export interface TaskActionItem {
  id: number;
  text: string;
  item_type: ActionItemType;
  checked: boolean;
  position: number;
  checked_by_id?: number;
  checked_by_name?: string;
  checked_at?: string;
  response?: string;
  responded_by_id?: number;
  responded_by_name?: string;
  responded_at?: string;
  include_in_response?: boolean;
  // Header/sub-question hierarchy
  parent_item_id?: number | null;
  child_count?: number;
  // Delegation fields
  delegated?: boolean;
  delegated_task_id?: number;
  delegated_task?: {
    id: number;
    name: string;
    status: string;
    assigned_user_id?: number;
    assigned_user_name?: string;
    // Counts for delete confirmation dialog
    action_items_count?: number;
    attachments_count?: number;
    children?: Array<{
      id: number;
      name: string;
      status: string;
      assigned_user_id?: number;
      assigned_user_name?: string;
    }>;
  };
  // Response attachments linked to this question
  attachments?: TaskAttachment[];
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
  status: CoreTaskStatus;
  start_date: string;
  end_date: string;
  duration_days: number;
  progress_percentage: number;
  trade?: string;
  stage?: string;
  sequence_order?: number;

  // Job relationship
  construction_id: number;
  job_id?: number; // API write field (backend permits job_id, not construction_id)
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

  // Required by date (independent due date for overdue tracking)
  required_by?: string;

  // Computed fields
  is_overdue: boolean;
  days_until_due: number;
  days_overdue?: number;  // Positive number when overdue (days past required_by/end_date)
  predecessor_count?: number;
  successor_count?: number;

  // Dependencies - predecessor_ids jsonb column
  // Format: [{id: task_number_or_id, lag: 0, type: "FS"}, ...]
  predecessor_ids?: Array<{ id: number; lag?: number; type?: string } | number>;

  // Attachments
  attachments_count?: number;
  attachments?: TaskAttachment[];

  // Privacy
  is_private?: boolean;
  created_by_id?: number;
  created_by_name?: string;
  // Last assigner (who assigned this task to current assignee)
  last_assigner_id?: number;
  last_assigner_name?: string;
  is_following?: boolean;

  // Action Items (checkable items within task)
  action_items?: TaskActionItem[];

  // Email keywords for auto-matching
  email_keywords?: string;

  // Completion linked tasks - tasks that can be completed together when this task completes
  completion_linked_task_ids?: number[];

  // Delegation fields - for tasks created from delegated questions/actions
  is_delegated_question?: boolean;
  source_action_item_id?: number;
  parent_task_id?: number;
  parent_task_name?: string;

  // Board priority for Task Hub BoardView drag-and-drop ordering
  // Format: { "status": priority } where priority is a number
  // Empty {} or missing key = use date ordering (default)
  board_priority?: Record<string, number>;

  // Children (subtasks) for expandable SubtaskList display
  children?: Array<{
    id: number;
    name: string;
    status: CoreTaskStatus;
    assigned_user_id?: number;
    assigned_user_name?: string;
  }>;

  // Case relationship - task can be linked to a case for investigation
  case_id?: number;
  case_number?: string;
}

export interface TaskFilters {
  jobIds: number[];
  statuses: CoreTaskStatus[];
  assignedUserIds: number[];
  trades: string[];
  stages: string[];
  dateRange: { start: Date; end: Date } | null;
  search: string;
  showMyTasksOnly: boolean;
  showOverdueOnly: boolean;
  selectedUserId: number | 'unassigned' | null;
  includeFollowing: boolean;
}

export interface UserTaskCount {
  id: number;
  name: string;
  count: number;
}

export type ViewType = 'board' | 'list' | 'gantt';

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

  // Board priority (for BoardView drag-and-drop ordering)
  reorderBoardTask: (taskId: number, status: string, priority: number | null) => Promise<void>;

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
  navigateToTask: (taskId: number) => void; // Clears filters and expands the task

  // Task actions
  startTask: (taskId: number) => Promise<void>;
  completeTask: (taskId: number, alsoCompleteTaskIds?: number[], delegationResponse?: string) => Promise<{ cascadeCompletedTasks?: SmTask[] }>;
  getCompletableLinkedTasks: (taskId: number) => SmTask[];
  setTaskHold: (taskId: number, hold: boolean) => Promise<void>;
  confirmTask: (taskId: number, date: string) => Promise<void>;
  supplierConfirmTask: (taskId: number, date: string) => Promise<void>;

  // Action items
  addActionItem: (taskId: number, text: string, itemType?: ActionItemType, parentItemId?: number | null) => Promise<TaskActionItem>;
  bulkAddActionItems: (taskId: number, items: { text: string; item_type: ActionItemType; parent_item_id?: number }[], createLinkedActions?: boolean) => Promise<TaskActionItem[]>;
  toggleActionItem: (taskId: number, itemId: number) => Promise<void>;
  answerActionItem: (taskId: number, itemId: number, response: string) => Promise<TaskActionItem>;
  updateActionItem: (taskId: number, itemId: number, text: string) => Promise<TaskActionItem>;
  removeActionItem: (taskId: number, itemId: number) => Promise<void>;
  delegateActionItem: (taskId: number, itemId: number, userId: number, options?: { instructions?: string; dueDate?: string }) => Promise<TaskActionItem>;
  undelegateActionItem: (taskId: number, itemId: number, deleteTask?: boolean) => Promise<TaskActionItem>;
  moveDelegatedTask: (taskId: number, sourceItemId: number, targetItemId: number) => Promise<void>;
  toggleIncludeInResponse: (taskId: number, itemId: number) => Promise<void>;
  reorderActionItems: (taskId: number, items: Array<{ id: number; position: number; parent_item_id: number | null }>) => Promise<void>;

  // Privacy
  setTaskPrivacy: (taskId: number, isPrivate: boolean) => Promise<void>;

  // Followers (for sharing private tasks)
  getFollowers: (taskId: number) => Promise<TaskFollower[]>;
  addFollower: (taskId: number, userId: number) => Promise<TaskFollower>;
  removeFollower: (taskId: number, userId: number) => Promise<void>;

  // User counts for "All" dropdown
  userCounts: UserTaskCount[];
  unassignedCount: number;
  totalActiveCount: number;

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
  selectedUserId: null,
  includeFollowing: false,
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
      status: TASK_STATUS.COMPLETED,
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
      status: TASK_STATUS.STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.COMPLETED,
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
      status: TASK_STATUS.STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
      status: TASK_STATUS.NOT_STARTED,
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
  const searchParams = useSearchParams();

  // Get default task view from user's primary role settings (Jan 2026)
  // SSoT: default_task_view comes from the backend via /api/v1/auth/me
  const roleDefaultTaskView = useMemo(() => {
    const userWithSettings = user as { default_task_view?: 'list' | 'board' | 'gantt' } | null;
    const defaultView = userWithSettings?.default_task_view;
    // Validate the view type
    if (defaultView && ['board', 'list', 'gantt'].includes(defaultView)) {
      return defaultView as ViewType;
    }
    return 'board'; // Fallback default
  }, [user]);

  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [viewInitialized, setViewInitialized] = useState(false);
  const [activeView, setActiveViewState] = useState<ViewType>(() => {
    // Load saved view from localStorage (will be overridden if no saved preference)
    const saved = getStorageItem<ViewType | null>(STORAGE_KEYS.TASK_HUB_VIEW, null);
    if (saved && ['board', 'list', 'gantt'].includes(saved)) {
      return saved;
    }
    // No saved preference - will be set by useEffect based on user role settings
    return 'list'; // Temporary default
  });

  // Set default view based on user's primary role settings (only if no saved preference)
  // SSoT: Uses default_task_view from the API (Jan 2026) instead of hardcoded role check
  useEffect(() => {
    if (viewInitialized || !user) return;

    const saved = getStorageItem<ViewType | null>(STORAGE_KEYS.TASK_HUB_VIEW, null);
    if (!saved) {
      // No saved preference - use role-based default from backend
      setActiveViewState(roleDefaultTaskView);
    }
    setViewInitialized(true);
  }, [user, roleDefaultTaskView, viewInitialized]);

  const [filters, setFiltersState] = useState<TaskFilters>(() => {
    // Load saved filters from localStorage (except showMyTasksOnly which always defaults to true)
    const saved = getStorageItem<Partial<TaskFilters>>(STORAGE_KEYS.TASK_HUB_FILTERS, {});
    const parsedFilters = { ...defaultFilters, ...saved };
    return {
      ...parsedFilters,
      showMyTasksOnly: true, // Always default to "Mine" on page load
      jobIds: initialJobId ? [initialJobId] : parsedFilters.jobIds || [],
    };
  });

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User counts for "All" dropdown filter
  const [userCounts, setUserCounts] = useState<UserTaskCount[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [totalActiveCount, setTotalActiveCount] = useState(0);

  // Load user counts for dropdown
  const loadUserCounts = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        users: UserTaskCount[];
        unassigned: number;
        total: number;
      }>('/api/v1/sm_tasks/user_counts');

      if (response.success) {
        setUserCounts(response.users || []);
        setUnassignedCount(response.unassigned || 0);
        setTotalActiveCount(response.total || 0);
      }
    } catch (err) {
      console.error('Failed to load user counts:', err);
    }
  }, []);

  // Load user counts on mount and when tasks change
  useEffect(() => {
    loadUserCounts();
  }, [loadUserCounts]);

  // Handle URL param for opening specific task (e.g., from notification click)
  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (taskIdParam) {
      const taskId = parseInt(taskIdParam, 10);
      if (!isNaN(taskId)) {
        setExpandedTaskId(taskId);
      }
    }
  }, [searchParams]);

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
      if (filters.showMyTasksOnly) {
        params.append('mine', 'true');
        // Include tasks user is following
        if (filters.includeFollowing) {
          params.append('include_following', 'true');
        }
      }

      // Filter by selected user in "All" dropdown
      // Uses for_user_id to get all tasks user can work on (direct + role-based)
      if (filters.selectedUserId === 'unassigned') {
        params.append('unassigned', 'true');
      } else if (filters.selectedUserId) {
        params.append('for_user_id', filters.selectedUserId.toString());
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
  }, [filters.jobIds, filters.statuses, filters.showMyTasksOnly, filters.selectedUserId, filters.includeFollowing]);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Save preferences to localStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.TASK_HUB_VIEW, activeView);
  }, [activeView]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.TASK_HUB_FILTERS, filters);
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
    // When showMyTasksOnly is true, API already filters by assigned_role matching user's roles
    // So all filteredTasks are "my tasks"
    if (filters.showMyTasksOnly) {
      return filteredTasks;
    }
    // When showing all tasks, filter by assigned_user_id for "my tasks" subset
    if (!user?.id) return [];
    return filteredTasks.filter(task => task.assigned_user_id === user.id);
  }, [filteredTasks, user?.id, filters.showMyTasksOnly]);

  // Computed: overdue tasks
  const overdueTasks = useMemo(() => {
    return filteredTasks.filter(task => task.is_overdue && task.status !== TASK_STATUS.COMPLETED);
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
      return startDate >= today && startDate < tomorrow && task.status !== TASK_STATUS.COMPLETED;
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
      return startDate >= today && startDate < nextWeek && task.status !== TASK_STATUS.COMPLETED;
    });
  }, [filteredTasks]);

  // Meta stats
  const meta = useMemo(() => ({
    totalCount: filteredTasks.length,
    overdueCount: overdueTasks.length,
    dueTodayCount: todayTasks.length,
    inProgressCount: filteredTasks.filter(t => t.status === TASK_STATUS.STARTED).length,
  }), [filteredTasks, overdueTasks, todayTasks]);

  // Actions
  const updateTask = useCallback(async (taskId: number, updates: Partial<SmTask>) => {
    // Optimistic update
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

    try {
      const response = await api.patch<{ success: boolean; sm_task: SmTask }>(`/api/v1/sm_tasks/${taskId}`, { sm_task: updates });
      // Update with full task data from server (includes computed fields like job_name)
      if (response?.success && response?.sm_task) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...response.sm_task } : t));
      }
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

  // Board priority for BoardView drag-and-drop ordering
  const reorderBoardTask = useCallback(async (
    taskId: number,
    status: string,
    priority: number | null
  ) => {
    console.log('[TaskHubContext] reorderBoardTask called:', { taskId, status, priority });

    // Find the current task to get existing board_priority
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) {
      console.log('[TaskHubContext] Task not found:', taskId);
      return;
    }

    // Build new board_priority object
    const currentPriority = currentTask.board_priority || {};
    const newPriority: Record<string, number> = { ...currentPriority };

    if (priority === null) {
      // Remove priority for this status (return to date ordering)
      delete newPriority[status];
    } else {
      // Set priority for this status
      newPriority[status] = priority;
    }

    console.log('[TaskHubContext] Updating board_priority:', { taskId, newPriority });

    // Optimistic update
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, board_priority: newPriority } : t
    ));

    try {
      console.log('[TaskHubContext] Making API call...');
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: { board_priority: newPriority }
      });
      console.log('[TaskHubContext] API call successful');
    } catch (err) {
      console.error('[TaskHubContext] Failed to reorder board task:', err);
      setTasks(originalTasks);
      throw err;
    }
  }, [tasks]);

  // Action Items methods
  const addActionItem = useCallback(async (
    taskId: number,
    text: string,
    itemType: ActionItemType = 'action',
    parentItemId?: number | null
  ): Promise<TaskActionItem> => {
    const response = await api.post<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items`,
      { text, item_type: itemType, parent_item_id: parentItemId }
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

  const bulkAddActionItems = useCallback(async (
    taskId: number,
    items: { text: string; item_type: ActionItemType; parent_item_id?: number }[],
    createLinkedActions?: boolean
  ): Promise<TaskActionItem[]> => {
    // If createLinkedActions is true, expand questions to include paired actions
    let itemsToSend = items;
    if (createLinkedActions) {
      itemsToSend = items.flatMap(item => {
        if (item.item_type === 'question') {
          return [
            { text: item.text, item_type: 'question' as ActionItemType, parent_item_id: item.parent_item_id },
            { text: item.text, item_type: 'action' as ActionItemType }
          ];
        }
        return [item];
      });
    }

    const response = await api.post<{ action_items: TaskActionItem[]; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/bulk`,
      { items: itemsToSend }
    );
    if (response?.success && response?.action_items) {
      // Update local task state
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, action_items: [...(t.action_items || []), ...response.action_items] }
          : t
      ));
      return response.action_items;
    }
    throw new Error('Failed to add action items');
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

  const answerActionItem = useCallback(async (taskId: number, itemId: number, answerText: string): Promise<TaskActionItem> => {
    const response = await api.post<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${itemId}/answer`,
      { response: answerText }
    );
    if (response?.success && response?.action_item) {
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
    throw new Error('Failed to answer question');
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

  const delegateActionItem = useCallback(async (
    taskId: number,
    itemId: number,
    userId: number,
    options?: { instructions?: string; dueDate?: string }
  ): Promise<TaskActionItem> => {
    const response = await api.post<{ action_item: TaskActionItem; delegated_task: SmTask; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${itemId}/delegate`,
      {
        user_id: userId,
        instructions: options?.instructions,
        due_date: options?.dueDate,
      }
    );
    if (response?.success && response?.action_item) {
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
    throw new Error('Failed to delegate question');
  }, []);

  const undelegateActionItem = useCallback(async (taskId: number, itemId: number, deleteTask: boolean = false): Promise<TaskActionItem> => {
    const response = await api.post<{ action_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${itemId}/undelegate`,
      { delete_task: deleteTask }
    );
    if (response?.success && response?.action_item) {
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
    throw new Error('Failed to unlink task');
  }, []);

  const moveDelegatedTask = useCallback(async (taskId: number, sourceItemId: number, targetItemId: number): Promise<void> => {
    const response = await api.post<{ source_item: TaskActionItem; target_item: TaskActionItem; success: boolean }>(
      `/api/v1/sm_tasks/${taskId}/action_items/${sourceItemId}/move_delegated_task`,
      { target_item_id: targetItemId }
    );
    if (response?.success && response?.source_item && response?.target_item) {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              action_items: (t.action_items || []).map(item => {
                if (item.id === sourceItemId) return response.source_item;
                if (item.id === targetItemId) return response.target_item;
                return item;
              })
            }
          : t
      ));
      return;
    }
    throw new Error('Failed to move delegated task');
  }, []);

  const toggleIncludeInResponse = useCallback(async (taskId: number, itemId: number) => {
    // Find current value
    const currentTask = tasks.find(t => t.id === taskId);
    const item = currentTask?.action_items?.find(i => i.id === itemId);
    if (!item) return;

    const newValue = !item.include_in_response;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? {
            ...t,
            action_items: (t.action_items || []).map(i =>
              i.id === itemId ? { ...i, include_in_response: newValue } : i
            )
          }
        : t
    ));

    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}/action_items/${itemId}`, {
        include_in_response: newValue
      });
    } catch (err) {
      console.error('Failed to update include_in_response:', err);
      // Revert optimistic update on error
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              action_items: (t.action_items || []).map(i =>
                i.id === itemId ? { ...i, include_in_response: item.include_in_response } : i
              )
            }
          : t
      ));
      throw err;
    }
  }, [tasks]);

  const reorderActionItems = useCallback(async (
    taskId: number,
    items: Array<{ id: number; position: number; parent_item_id: number | null }>
  ) => {
    // Optimistic update
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const updatedItems = (t.action_items || []).map(item => {
        const update = items.find(i => i.id === item.id);
        if (update) {
          return { ...item, position: update.position, parent_item_id: update.parent_item_id };
        }
        return item;
      }).sort((a, b) => a.position - b.position);
      return { ...t, action_items: updatedItems };
    }));

    try {
      await api.post(`/api/v1/sm_tasks/${taskId}/action_items/reorder`, { items });
    } catch (err) {
      console.error('Failed to reorder action items:', err);
      // Refresh to revert
      throw err;
    }
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

  // Navigate to a specific task (clears filters and expands)
  const navigateToTask = useCallback((taskId: number) => {
    // Clear filters to show all tasks
    setFiltersState(defaultFilters);
    // Switch to list view
    setActiveViewState('list');
    // Expand the target task
    setExpandedTaskId(taskId);
  }, []);

  // Task action handlers
  const startTask = useCallback(async (taskId: number) => {
    const now = new Date().toISOString();
    await updateTask(taskId, { status: TASK_STATUS.STARTED, started_at: now } as Partial<SmTask>);
  }, [updateTask]);

  const completeTask = useCallback(async (taskId: number, alsoCompleteTaskIds?: number[], delegationResponse?: string): Promise<{ cascadeCompletedTasks?: SmTask[] }> => {
    try {
      const response = await api.post<{
        success: boolean;
        cascade_completed_tasks?: SmTask[];
        already_completed?: boolean;
      }>(`/api/v1/sm_tasks/${taskId}/complete`, {
        also_complete_task_ids: alsoCompleteTaskIds || [],
        delegation_response: delegationResponse,
      });

      if (!response?.success) {
        throw new Error('Failed to complete task');
      }

      // Idempotent: if already completed, state is already correct
      if (response.already_completed) {
        return { cascadeCompletedTasks: [] };
      }

      // Update local state with completion
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];
      const completedIds = new Set([taskId, ...(alsoCompleteTaskIds || [])]);

      setTasks(prev => prev.map(t =>
        completedIds.has(t.id)
          ? { ...t, status: TASK_STATUS.COMPLETED, completed_at: now, end_date: today }
          : t
      ));

      return { cascadeCompletedTasks: response.cascade_completed_tasks };
    } catch (err) {
      console.error('Failed to complete task:', err);
      throw err;
    }
  }, []);

  // Get tasks that can be completed together with this task (by completion_linked_task_ids)
  // Filters to only incomplete tasks on the same job
  const getCompletableLinkedTasks = useCallback((taskId: number): SmTask[] => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.completion_linked_task_ids || task.completion_linked_task_ids.length === 0) {
      return [];
    }

    // Find matching tasks on the same job that are not completed
    return tasks.filter(t =>
      task.completion_linked_task_ids!.includes(t.id) &&
      t.construction_id === task.construction_id &&
      t.status !== TASK_STATUS.COMPLETED &&
      !t.hold
    );
  }, [tasks]);

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
    await loadUserCounts();
  }, [loadTasks, loadUserCounts]);

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
    reorderBoardTask,
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
    navigateToTask,
    startTask,
    completeTask,
    getCompletableLinkedTasks,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    // Action items
    addActionItem,
    bulkAddActionItems,
    toggleActionItem,
    answerActionItem,
    updateActionItem,
    removeActionItem,
    delegateActionItem,
    undelegateActionItem,
    moveDelegatedTask,
    toggleIncludeInResponse,
    reorderActionItems,
    // Privacy
    setTaskPrivacy,
    // Followers
    getFollowers,
    addFollower,
    removeFollower,
    // User counts for "All" dropdown
    userCounts,
    unassignedCount,
    totalActiveCount,
    refresh,
  };

  return <TaskHubContext.Provider value={value}>{children}</TaskHubContext.Provider>;
};
