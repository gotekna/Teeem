"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  ChevronLeft,
  Video,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash,
  Users,
  BarChart3,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { api } from "@/lib/api";

interface TrainingModule {
  id: number;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  lessons_count: number;
  is_required: boolean;
  is_active: boolean;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  // Admin stats
  enrolled_count?: number;
  completion_rate?: number;
}

interface TrainingStats {
  total_modules: number;
  active_modules: number;
  total_enrollments: number;
  avg_completion_rate: number;
  categories_count: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function AdminTrainingPage() {
  const router = useRouter();

  // SSoT: URL state for search (enables shareable URLs)
  const [urlState, setUrlState] = useUrlState({
    search: null as string | null,
  });

  const [modules, setModules] = React.useState<TrainingModule[]>([]);
  const [stats, setStats] = React.useState<TrainingStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Derive searchQuery from URL
  const searchQuery = urlState.search || "";

  // Update URL when search changes
  const setSearchQuery = React.useCallback((query: string) => {
    setUrlState({ search: query || null });
  }, [setUrlState]);

  React.useEffect(() => {
    const fetchTraining = async () => {
      try {
        const data = await api.get<{ modules: TrainingModule[]; stats: TrainingStats }>(
          "/api/v1/admin/training"
        );
        setModules(data.modules || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error("Failed to fetch training:", error);
        // Mock data for development
        setModules([
          {
            id: 1,
            title: "Getting Started with Teeem",
            description: "Learn the basics of the platform and key features",
            category: "Onboarding",
            duration_minutes: 30,
            lessons_count: 5,
            is_required: true,
            is_active: true,
            enrolled_count: 12,
            completion_rate: 85,
            created_at: "2024-01-15T00:00:00Z",
            updated_at: "2024-11-01T00:00:00Z",
          },
          {
            id: 2,
            title: "Schedule Master Fundamentals",
            description: "Master the Gantt chart and task management",
            category: "Features",
            duration_minutes: 45,
            lessons_count: 8,
            is_required: false,
            is_active: true,
            enrolled_count: 8,
            completion_rate: 62,
            created_at: "2024-02-10T00:00:00Z",
            updated_at: "2024-10-15T00:00:00Z",
          },
          {
            id: 3,
            title: "WHS Compliance",
            description: "Understanding workplace health and safety requirements",
            category: "Compliance",
            duration_minutes: 60,
            lessons_count: 10,
            is_required: true,
            is_active: true,
            enrolled_count: 12,
            completion_rate: 45,
            created_at: "2024-03-01T00:00:00Z",
            updated_at: "2024-09-20T00:00:00Z",
          },
          {
            id: 4,
            title: "Advanced Reporting",
            description: "Deep dive into analytics and custom reports",
            category: "Features",
            duration_minutes: 40,
            lessons_count: 6,
            is_required: false,
            is_active: false,
            enrolled_count: 3,
            completion_rate: 33,
            created_at: "2024-04-15T00:00:00Z",
            updated_at: "2024-08-10T00:00:00Z",
          },
        ]);
        setStats({
          total_modules: 12,
          active_modules: 10,
          total_enrollments: 35,
          avg_completion_rate: 56,
          categories_count: 4,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTraining();
  }, []);

  const filteredModules = modules.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Training Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage training modules for your team
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Module
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Modules</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total_modules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.active_modules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Enrollments</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total_enrollments || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Avg Completion</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.avg_completion_rate || 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Categories</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.categories_count || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Modules Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Lessons</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModules.map((module) => (
              <TableRow key={module.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{module.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {module.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{module.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDuration(module.duration_minutes)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    {module.lessons_count}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {module.enrolled_count || 0}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={module.completion_rate || 0} className="h-2 w-16" />
                    <span className="text-xs text-muted-foreground">
                      {module.completion_rate || 0}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {module.is_active ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {module.is_required && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-2" />
                        View Enrollments
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredModules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">No training modules found</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />
                    Create your first module
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
