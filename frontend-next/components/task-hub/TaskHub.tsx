'use client';

import { useState } from 'react';
import { useTaskHub, ViewType } from '@/contexts/TaskHubContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/loader';
import {
  Search,
  LayoutGrid,
  List,
  User,
  Plus,
  Filter,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { BoardView } from './views/BoardView';
import { ListView } from './views/ListView';
import { MyTasksView } from './views/MyTasksView';
import { CreateTaskDialog } from './CreateTaskDialog';

export function TaskHub() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  } = useTaskHub();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all your tasks across jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-mono font-medium">{meta.totalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">In Progress:</span>
          <span className="font-mono font-medium text-blue-600">{meta.inProgressCount}</span>
        </div>
        {meta.overdueCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Overdue:</span>
            <Badge variant="destructive">{meta.overdueCount}</Badge>
          </div>
        )}
        {meta.dueTodayCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Due Today:</span>
            <Badge className="bg-yellow-500">{meta.dueTodayCount}</Badge>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">{selectedTaskIds.size} tasks selected</span>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Clear
          </Button>
          <Button variant="outline" size="sm">Mark Started</Button>
          <Button variant="outline" size="sm">Mark Completed</Button>
        </div>
      )}

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ViewType)}>
        <TabsList>
          <TabsTrigger value="my-tasks" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Tasks
          </TabsTrigger>
          <TabsTrigger value="board" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks" className="mt-6">
          <MyTasksView />
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <BoardView />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView />
        </TabsContent>
      </Tabs>

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
