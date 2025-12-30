"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  TrendingUp,
  Briefcase,
  Plus,
  MoreHorizontal,
  ArrowRight,
  LayoutTemplate,
  Star,
  ListTodo,
  Copy,
  Edit,
  Trash,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Job {
  id: number;
  name: string;
  client_name: string;
  status: string;
  progress: number;
  start_date: string;
  end_date: string;
  tasks_total: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_blocked: number;
  days_remaining: number;
  is_on_track: boolean;
  assigned_resources: Resource[];
}

interface Resource {
  id: number;
  name: string;
  type: "person" | "equipment" | "material";
  avatar_url: string | null;
  utilization: number;
  allocated_hours: number;
  available_hours: number;
}

interface Task {
  id: number;
  name: string;
  job_id: number;
  job_name: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "on_hold";
  start_date: string;
  end_date: string;
  duration_days: number;
  progress: number;
  assigned_to: string | null;
  trade: string;
  is_critical_path: boolean;
  dependencies: number[];
  blockers: string[];
}

interface DashboardStats {
  total_jobs: number;
  active_tasks: number;
  blocked_tasks: number;
  resources_allocated: number;
  avg_utilization: number;
  tasks_due_this_week: number;
}

interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  total_tasks: number;
  estimated_duration_days: number;
  job_type: string;
  used_count: number;
  stages: { id: number; name: string; tasks_count: number }[];
}

const taskStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
};

export default function ScheduleMasterPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/schedule-master", "").split("/").filter(Boolean);
    return parts[0] || "overview";
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/schedule-master/")) {
      router.replace("/schedule-master/overview", { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/schedule-master/${tabId}`, { scroll: false });
  }, [router]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<string>("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [jobsRes, tasksRes, resourcesRes] = await Promise.all([
          api.get<{ jobs: Job[] }>("/api/v1/jobs"),
          api.get<{ tasks: Task[] }>("/api/v1/sm_tasks"),
          api.get<{ resources: Resource[] }>("/api/v1/sm_resources"),
        ]);
        setJobs(jobsRes.jobs || []);
        setTasks(tasksRes.tasks || []);
        setResources(resourcesRes.resources || []);
      } catch (error) {
        console.error("Failed to load schedule data:", error);
        setJobs(getMockJobs());
        setTasks(getMockTasks());
        setResources(getMockResources());
        setTemplates(getMockTemplates());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const stats: DashboardStats = {
    total_jobs: jobs.length,
    active_tasks: tasks.filter((t) => t.status === "in_progress").length,
    blocked_tasks: tasks.filter((t) => t.status === "blocked").length,
    resources_allocated: resources.filter((r) => r.utilization > 0).length,
    avg_utilization: Math.round(
      resources.reduce((sum, r) => sum + r.utilization, 0) / resources.length || 0
    ),
    tasks_due_this_week: tasks.filter((t) => {
      const dueDate = new Date(t.end_date);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return dueDate <= nextWeek && t.status !== "completed";
    }).length,
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.job_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJob = selectedJob === "all" || task.job_id.toString() === selectedJob;
    return matchesSearch && matchesJob;
  });

  const criticalTasks = tasks.filter((t) => t.is_critical_path && t.status !== "completed");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Master</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advanced scheduling with resource allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">All Tasks</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="critical">
              Critical Path
              {criticalTasks.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {criticalTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates">
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id.toString()}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
        </div>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Job Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Job Progress</CardTitle>
                <CardDescription>Active jobs and their completion status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobs.slice(0, 4).map((job) => (
                  <div key={job.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium hover:underline flex items-center gap-2"
                      >
                        {job.name}
                        {!job.is_on_track && (
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        )}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {job.tasks_completed}/{job.tasks_total} tasks
                      </span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{job.client_name}</span>
                      <span>{job.days_remaining} days remaining</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Blocked Tasks */}
            <Card className={blockedTasks.length > 0 ? "border-red-200" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Blocked Tasks
                </CardTitle>
                <CardDescription>Tasks that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No blocked tasks</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedTasks.slice(0, 4).map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{task.name}</span>
                          <Badge className={taskStatusColors.blocked}>Blocked</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {task.job_name}
                        </div>
                        {task.blockers.length > 0 && (
                          <div className="mt-2 text-xs text-red-600">
                            {task.blockers[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>Team allocation this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resources.slice(0, 5).map((resource) => (
                  <div key={resource.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {resource.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{resource.name}</span>
                        <span
                          className={cn(
                            "text-sm font-mono",
                            resource.utilization > 100
                              ? "text-red-600"
                              : resource.utilization > 80
                              ? "text-yellow-600"
                              : "text-green-600"
                          )}
                        >
                          {resource.utilization}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(resource.utilization, 100)}
                        className={cn(
                          "h-1.5 mt-1",
                          resource.utilization > 100 && "[&>div]:bg-red-500"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Tasks</CardTitle>
                <CardDescription>Tasks due in the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks
                    .filter((t) => {
                      const dueDate = new Date(t.end_date);
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      return dueDate <= nextWeek && t.status !== "completed";
                    })
                    .slice(0, 5)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={taskStatusColors[task.status]} variant="outline">
                            {task.status.replace("_", " ")}
                          </Badge>
                          <span className="font-medium">{task.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(task.end_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={taskStatusColors[task.status]}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {task.name}
                          {task.is_critical_path && (
                            <Badge variant="destructive" className="text-xs">
                              Critical
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {task.job_name} • {task.trade}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm">
                          {new Date(task.start_date).toLocaleDateString()} →{" "}
                          {new Date(task.end_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {task.duration_days} days
                        </div>
                      </div>
                      {task.assigned_to && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {task.assigned_to
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <Progress value={task.progress} className="w-20 h-2" />
                      <span className="text-sm font-mono w-10">{task.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {resources.map((resource) => (
              <Card key={resource.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {resource.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{resource.name}</div>
                      <Badge variant="outline" className="capitalize">
                        {resource.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          resource.utilization > 100
                            ? "text-red-600"
                            : resource.utilization > 80
                            ? "text-yellow-600"
                            : "text-green-600"
                        )}
                      >
                        {resource.utilization}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(resource.utilization, 100)}
                      className={cn(
                        "h-2",
                        resource.utilization > 100 && "[&>div]:bg-red-500"
                      )}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                      <span>{resource.allocated_hours}h allocated</span>
                      <span>{resource.available_hours}h available</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="critical" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Critical Path Tasks</CardTitle>
              <CardDescription>
                Tasks that directly impact project completion date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalTasks.map((task, index) => (
                  <div key={task.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{task.name}</span>
                        <Badge className={taskStatusColors[task.status]}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.job_name} • {task.duration_days} days
                      </div>
                    </div>
                    {index < criticalTasks.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Schedule Templates</h3>
                <p className="text-sm text-muted-foreground">Pre-built schedules for quick job setup</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.name}
                          {template.is_default && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <ListTodo className="h-4 w-4" />
                        {template.total_tasks} tasks
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {template.estimated_duration_days} days
                      </div>
                    </div>

                    <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400">
                      {template.job_type}
                    </Badge>

                    <div className="mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground mb-2">Stages</div>
                      <div className="space-y-1">
                        {template.stages.slice(0, 3).map((stage) => (
                          <div key={stage.id} className="flex items-center justify-between text-sm">
                            <span>{stage.name}</span>
                            <span className="text-muted-foreground">{stage.tasks_count} tasks</span>
                          </div>
                        ))}
                        {template.stages.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{template.stages.length - 3} more stages
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                      Used {template.used_count} times
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getMockJobs(): Job[] {
  return [
    {
      id: 1,
      name: "Harrison Residence",
      client_name: "John & Sarah Harrison",
      status: "In Progress",
      progress: 45,
      start_date: "2024-08-01",
      end_date: "2025-02-28",
      tasks_total: 156,
      tasks_completed: 70,
      tasks_in_progress: 12,
      tasks_blocked: 2,
      days_remaining: 89,
      is_on_track: true,
      assigned_resources: [],
    },
    {
      id: 2,
      name: "Coastal Views Duplex",
      client_name: "Investment Corp",
      status: "In Progress",
      progress: 28,
      start_date: "2024-09-15",
      end_date: "2025-05-30",
      tasks_total: 198,
      tasks_completed: 55,
      tasks_in_progress: 8,
      tasks_blocked: 1,
      days_remaining: 180,
      is_on_track: false,
      assigned_resources: [],
    },
    {
      id: 3,
      name: "Thompson Family Home",
      client_name: "Michael & Emma Thompson",
      status: "In Progress",
      progress: 72,
      start_date: "2024-05-01",
      end_date: "2024-12-20",
      tasks_total: 142,
      tasks_completed: 102,
      tasks_in_progress: 6,
      tasks_blocked: 0,
      days_remaining: 19,
      is_on_track: true,
      assigned_resources: [],
    },
  ];
}

function getMockTasks(): Task[] {
  return [
    {
      id: 1,
      name: "Pour Second Floor Slab",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "in_progress",
      start_date: "2024-11-25",
      end_date: "2024-12-02",
      duration_days: 5,
      progress: 60,
      assigned_to: "Dave Brown",
      trade: "Concrete",
      is_critical_path: true,
      dependencies: [],
      blockers: [],
    },
    {
      id: 2,
      name: "Install Roof Trusses",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "pending",
      start_date: "2024-12-03",
      end_date: "2024-12-10",
      duration_days: 5,
      progress: 0,
      assigned_to: "Tom Wilson",
      trade: "Carpentry",
      is_critical_path: true,
      dependencies: [1],
      blockers: [],
    },
    {
      id: 3,
      name: "Electrical Rough-In",
      job_id: 2,
      job_name: "Coastal Views Duplex",
      status: "blocked",
      start_date: "2024-11-20",
      end_date: "2024-11-28",
      duration_days: 6,
      progress: 30,
      assigned_to: "L&H Electrical",
      trade: "Electrical",
      is_critical_path: false,
      dependencies: [],
      blockers: ["Waiting for wall frames to be completed"],
    },
    {
      id: 4,
      name: "Plumbing Rough-In",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "completed",
      start_date: "2024-11-15",
      end_date: "2024-11-22",
      duration_days: 5,
      progress: 100,
      assigned_to: "Reece Plumbing",
      trade: "Plumbing",
      is_critical_path: false,
      dependencies: [],
      blockers: [],
    },
    {
      id: 5,
      name: "Internal Plastering",
      job_id: 3,
      job_name: "Thompson Family Home",
      status: "in_progress",
      start_date: "2024-11-28",
      end_date: "2024-12-06",
      duration_days: 6,
      progress: 40,
      assigned_to: "Quality Plastering",
      trade: "Plastering",
      is_critical_path: true,
      dependencies: [],
      blockers: [],
    },
  ];
}

function getMockResources(): Resource[] {
  return [
    {
      id: 1,
      name: "Tom Wilson",
      type: "person",
      avatar_url: null,
      utilization: 95,
      allocated_hours: 38,
      available_hours: 40,
    },
    {
      id: 2,
      name: "Dave Brown",
      type: "person",
      avatar_url: null,
      utilization: 110,
      allocated_hours: 44,
      available_hours: 40,
    },
    {
      id: 3,
      name: "Sarah Chen",
      type: "person",
      avatar_url: null,
      utilization: 75,
      allocated_hours: 30,
      available_hours: 40,
    },
    {
      id: 4,
      name: "Excavator #1",
      type: "equipment",
      avatar_url: null,
      utilization: 60,
      allocated_hours: 24,
      available_hours: 40,
    },
    {
      id: 5,
      name: "Crane (Mobile)",
      type: "equipment",
      avatar_url: null,
      utilization: 40,
      allocated_hours: 16,
      available_hours: 40,
    },
  ];
}

function getMockTemplates(): ScheduleTemplate[] {
  return [
    {
      id: 1,
      name: "Standard Residential Build",
      description: "Complete schedule for a typical single-story residential home",
      is_default: true,
      total_tasks: 156,
      estimated_duration_days: 180,
      job_type: "Residential - New Build",
      used_count: 45,
      stages: [
        { id: 1, name: "Site Preparation", tasks_count: 12 },
        { id: 2, name: "Foundation", tasks_count: 18 },
        { id: 3, name: "Frame & Roof", tasks_count: 24 },
        { id: 4, name: "Lock Up", tasks_count: 20 },
        { id: 5, name: "Fixing & Fit Off", tasks_count: 45 },
        { id: 6, name: "Completion", tasks_count: 37 },
      ],
    },
    {
      id: 2,
      name: "Duplex Build",
      description: "Schedule for side-by-side or over-under duplex construction",
      is_default: false,
      total_tasks: 198,
      estimated_duration_days: 240,
      job_type: "Residential - Duplex",
      used_count: 12,
      stages: [
        { id: 7, name: "Site Preparation", tasks_count: 15 },
        { id: 8, name: "Foundation", tasks_count: 24 },
        { id: 9, name: "Structure", tasks_count: 36 },
        { id: 10, name: "Services", tasks_count: 48 },
        { id: 11, name: "Finishing", tasks_count: 75 },
      ],
    },
    {
      id: 3,
      name: "Kitchen Renovation",
      description: "Complete kitchen renovation with structural changes",
      is_default: false,
      total_tasks: 48,
      estimated_duration_days: 35,
      job_type: "Renovation",
      used_count: 28,
      stages: [
        { id: 12, name: "Demolition", tasks_count: 8 },
        { id: 13, name: "Rough-In", tasks_count: 12 },
        { id: 14, name: "Installation", tasks_count: 18 },
        { id: 15, name: "Finishing", tasks_count: 10 },
      ],
    },
  ];
}
