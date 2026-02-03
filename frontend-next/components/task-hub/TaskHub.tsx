'use client';

import { useState } from 'react';
import { useTaskHub, ViewType } from '@/contexts/TaskHubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  LayoutGrid,
  List,
  User,
  Users,
  UserX,
  Plus,
  RefreshCw,
  AlertTriangle,
  X,
  ChevronDown,
  Eye,
  GanttChart,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { BoardView } from './views/BoardView';
import { ListView } from './views/ListView';
import { GanttView } from './views/GanttView';
import { CreateTaskDialog } from './CreateTaskDialog';
import { TaskColorSettingsDialog } from './TaskColorSettings';

export function TaskHub() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [colorSettingsKey, setColorSettingsKey] = useState(0);
  const {
    activeView,
    setActiveView,
    filters,
    setFilters,
    meta,
    loading,
    error,
    refresh,
    selectedTaskIds,
    deselectAll,
    bulkUpdateStatus,
    userCounts,
    unassignedCount,
    totalActiveCount,
  } = useTaskHub();

  const handleColorSettingsChange = () => {
    setColorSettingsKey((k) => k + 1);
  };

  // Get selected user for "All" dropdown display
  const getSelectedUserName = () => {
    if (filters.selectedUserId === 'unassigned') return 'Unassigned';
    if (filters.selectedUserId) {
      const user = userCounts.find(u => u.id === filters.selectedUserId);
      return user?.name || 'Unknown';
    }
    return 'All';
  };

  // Handle switching to "Mine" filter
  const handleMineClick = () => {
    setFilters({ showMyTasksOnly: true, selectedUserId: null });
  };

  // Handle switching to "All" filter
  const handleAllClick = () => {
    setFilters({ showMyTasksOnly: false, selectedUserId: null });
  };

  // Handle user selection from dropdown
  const handleUserSelect = (userId: number | 'unassigned' | null) => {
    setFilters({ showMyTasksOnly: false, selectedUserId: userId });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  // Render the active view
  const renderView = () => {
    switch (activeView) {
      case 'board':
        return <BoardView key={`board-${colorSettingsKey}`} />;
      case 'gantt':
        return <GanttView key={`gantt-${colorSettingsKey}`} />;
      case 'list':
      default:
        return <ListView key={`list-${colorSettingsKey}`} />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3" data-tour="tasks-list">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold font-serif">Tasks</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="font-mono font-medium text-foreground">{meta.totalCount}</span> total</span>
            <span><span className="font-mono font-medium text-blue-600 dark:text-blue-400">{meta.inProgressCount}</span> active</span>
            {meta.overdueCount > 0 && (
              <span className="text-red-600 dark:text-red-400"><span className="font-mono font-medium">{meta.overdueCount}</span> overdue</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="pl-7 h-8 text-sm"
            />
          </div>
          <TaskColorSettingsDialog onSettingsChange={handleColorSettingsChange} />
          <Button variant="ghost" size="sm" onClick={refresh} className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="h-8" data-tour="tasks-add">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs shrink-0">
          <span className="font-medium">{selectedTaskIds.size} selected</span>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="h-6 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => bulkUpdateStatus(Array.from(selectedTaskIds), 'started')}>
            Start
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => bulkUpdateStatus(Array.from(selectedTaskIds), 'completed')}>
            Complete
          </Button>
        </div>
      )}

      {/* Filter & View Mode Controls */}
      <div className="flex items-center gap-4 shrink-0" data-tour="tasks-filters">
        {/* Filter: Mine / All */}
        <div className="flex items-center bg-muted rounded-md p-0.5">
          <button
            onClick={handleMineClick}
            className={cn(
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-all h-7',
              filters.showMyTasksOnly
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="h-3 w-3" />
            Mine
          </button>

          {/* Include Following checkbox - only show when "Mine" is selected */}
          {filters.showMyTasksOnly && (
            <div className="flex items-center gap-1.5 px-2 border-l border-border/50">
              <Checkbox
                id="include-following"
                checked={filters.includeFollowing}
                onCheckedChange={(checked) => setFilters({ includeFollowing: !!checked })}
                className="h-3.5 w-3.5"
              />
              <label
                htmlFor="include-following"
                className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
              >
                <Eye className="h-3 w-3" />
                Following
              </label>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-all h-7',
                  !filters.showMyTasksOnly
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  if (filters.showMyTasksOnly) {
                    handleAllClick();
                  }
                }}
              >
                <Users className="h-3 w-3" />
                {filters.showMyTasksOnly ? 'All' : getSelectedUserName()}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => handleUserSelect(null)}>
                <Users className="h-4 w-4 mr-2" />
                All Tasks
                <span className="ml-auto text-xs text-muted-foreground">{totalActiveCount}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleUserSelect('unassigned')}>
                <UserX className="h-4 w-4 mr-2" />
                Unassigned
                <span className="ml-auto text-xs text-muted-foreground">{unassignedCount}</span>
              </DropdownMenuItem>
              {userCounts.length > 0 && <DropdownMenuSeparator />}
              {userCounts.map((user) => (
                <DropdownMenuItem key={user.id} onClick={() => handleUserSelect(user.id)}>
                  <User className="h-4 w-4 mr-2" />
                  {user.name}
                  <span className="ml-auto text-xs text-muted-foreground">{user.count}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* View Mode: List / Board / Gantt */}
        <div className="flex items-center bg-muted rounded-md p-0.5" data-tour="tasks-views">
          <button
            onClick={() => setActiveView('list')}
            className={cn(
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-all h-7',
              activeView === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-3 w-3" />
            List
          </button>
          <button
            onClick={() => setActiveView('board')}
            className={cn(
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-all h-7',
              activeView === 'board'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3 w-3" />
            Board
          </button>
          <button
            onClick={() => setActiveView('gantt')}
            className={cn(
              'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-all h-7',
              activeView === 'gantt'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <GanttChart className="h-3 w-3" />
            Gantt
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {renderView()}
      </div>

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
