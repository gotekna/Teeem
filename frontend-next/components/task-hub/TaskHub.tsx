'use client';

import { useState } from 'react';
import { useTaskHub, ViewType } from '@/contexts/TaskHubContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Workflow,
  ChevronDown,
} from 'lucide-react';
import { BoardView } from './views/BoardView';
import { ListView } from './views/ListView';
import { MyTasksView } from './views/MyTasksView';
import { WorkflowTasksView } from './views/WorkflowTasksView';
import { CreateTaskDialog } from './CreateTaskDialog';
import { TaskColorSettingsDialog } from './TaskColorSettings';

export function TaskHub() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [colorSettingsKey, setColorSettingsKey] = useState(0); // Force re-render when colors change
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

  // Called when color settings change to trigger re-render
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

  // Handle user selection from dropdown
  const handleUserSelect = (userId: number | 'unassigned' | null) => {
    setFilters({ selectedUserId: userId });
    if (activeView !== 'all') {
      setActiveView('all');
    }
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

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold font-serif">Tasks</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="font-mono font-medium text-foreground">{meta.totalCount}</span> total</span>
            <span><span className="font-mono font-medium text-blue-600">{meta.inProgressCount}</span> active</span>
            {meta.overdueCount > 0 && (
              <span className="text-red-600"><span className="font-mono font-medium">{meta.overdueCount}</span> overdue</span>
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
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar - Compact */}
      {selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs">
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

      {/* Compact View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => {
        setActiveView(v as ViewType);
        // Clear user filter when switching to "Mine" - user expects to see only their tasks
        if (v === 'my-tasks') {
          setFilters({ selectedUserId: null });
        }
      }}>
        <TabsList className="h-8">
          <TabsTrigger value="my-tasks" className="text-xs h-7 px-3">
            <User className="h-3 w-3 mr-1" />
            Mine
          </TabsTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-3 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-7 ${
                  activeView === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (activeView !== 'all') {
                    setActiveView('all');
                  }
                }}
              >
                <Users className="h-3 w-3" />
                {getSelectedUserName()}
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
          <TabsTrigger value="workflow" className="text-xs h-7 px-3">
            <Workflow className="h-3 w-3 mr-1" />
            Workflow
          </TabsTrigger>
          <TabsTrigger value="board" className="text-xs h-7 px-3">
            <LayoutGrid className="h-3 w-3 mr-1" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs h-7 px-3">
            <List className="h-3 w-3 mr-1" />
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks" className="mt-3">
          <MyTasksView key={`my-${colorSettingsKey}`} />
        </TabsContent>

        <TabsContent value="all" className="mt-3">
          <ListView key={`all-${colorSettingsKey}`} />
        </TabsContent>

        <TabsContent value="workflow" className="mt-3">
          <WorkflowTasksView />
        </TabsContent>

        <TabsContent value="board" className="mt-3">
          <BoardView key={`board-${colorSettingsKey}`} />
        </TabsContent>

        <TabsContent value="list" className="mt-3">
          <ListView key={`list-${colorSettingsKey}`} />
        </TabsContent>
      </Tabs>

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
