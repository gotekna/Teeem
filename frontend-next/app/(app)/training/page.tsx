"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { TabbedPage } from "@/components/ui/page-wrappers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Play,
  CheckCircle2,
  Clock,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";

interface TrainingModule {
  id: number;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  lessons_count: number;
  completed_lessons: number;
  is_required: boolean;
  thumbnail_url?: string;
}

interface TrainingStats {
  total_modules: number;
  completed_modules: number;
  in_progress: number;
  total_hours: number;
  certificates_earned: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function TrainingPage() {
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab: /training/all, /training/required, /training/completed
  const activeTab = React.useMemo(() => {
    const parts = (pathname ?? "").replace("/training", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  // Redirect to default tab if none specified
  React.useEffect(() => {
    if (activeTab === null) {
      router.replace("/training/all", { scroll: false });
    }
  }, [activeTab, router]);

  const setActiveTab = React.useCallback((tab: string) => {
    router.push(`/training/${tab}`, { scroll: false });
  }, [router]);
  const [modules, setModules] = React.useState<TrainingModule[]>([]);
  const [stats, setStats] = React.useState<TrainingStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTraining = async () => {
      try {
        const data = await api.get<{ modules: TrainingModule[]; stats: TrainingStats }>(
          "/api/v1/training"
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
            completed_lessons: 5,
            is_required: true,
          },
          {
            id: 2,
            title: "Schedule Master Fundamentals",
            description: "Master the Gantt chart and task management",
            category: "Features",
            duration_minutes: 45,
            lessons_count: 8,
            completed_lessons: 3,
            is_required: false,
          },
          {
            id: 3,
            title: "WHS Compliance",
            description: "Understanding workplace health and safety requirements",
            category: "Compliance",
            duration_minutes: 60,
            lessons_count: 10,
            completed_lessons: 0,
            is_required: true,
          },
        ]);
        setStats({
          total_modules: 12,
          completed_modules: 4,
          in_progress: 2,
          total_hours: 8,
          certificates_earned: 2,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTraining();
  }, []);

  const getModuleStatus = (module: TrainingModule) => {
    if (module.completed_lessons === module.lessons_count) return "completed";
    if (module.completed_lessons > 0) return "in-progress";
    return "not-started";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <TabbedPage
      title="Training Center"
      description="Courses and resources to help you get the most out of Teeem"
    >
      {/* Progress Overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {stats?.completed_modules || 0} of {stats?.total_modules || 0} modules completed
            </span>
          </div>
          <Progress
            value={
              stats ? (stats.completed_modules / stats.total_modules) * 100 : 0
            }
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Modules */}
      <Tabs value={activeTab || "all"} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Modules</TabsTrigger>
          <TabsTrigger value="required">Required</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => {
              const status = getModuleStatus(module);
              const progress = (module.completed_lessons / module.lessons_count) * 100;

              return (
                <Card
                  key={module.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline">{module.category}</Badge>
                      {module.is_required && (
                        <Badge variant="secondary">Required</Badge>
                      )}
                    </div>

                    <h3 className="text-sm font-medium mb-1">{module.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {module.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Video className="h-4 w-4" />
                        {module.lessons_count} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(module.duration_minutes)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>
                          {module.completed_lessons}/{module.lessons_count} lessons
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    <Button
                      className="w-full mt-4"
                      variant={status === "completed" ? "outline" : "default"}
                    >
                      {status === "completed" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Review
                        </>
                      ) : status === "in-progress" ? (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Continue
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="required" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules
              .filter((m) => m.is_required)
              .map((module) => (
                <Card key={module.id} className="cursor-pointer hover:bg-accent/50">
                  <CardContent className="pt-6">
                    <Badge variant="secondary" className="mb-3">Required</Badge>
                    <h3 className="text-sm font-medium mb-1">{module.title}</h3>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="in-progress" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Modules you've started will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Completed modules will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabbedPage>
  );
}
