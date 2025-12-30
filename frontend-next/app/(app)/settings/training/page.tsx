"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  Video,
  Play,
} from "lucide-react";

interface TrainingModule {
  id: number;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  lessons_count: number;
  completed_lessons: number;
  is_required: boolean;
}

interface TrainingStats {
  total_modules: number;
  completed_modules: number;
  in_progress: number;
  total_hours: number;
  certificates_earned: number;
}

export default function TrainingSettingsPage() {
  const [trainingModules, setTrainingModules] = React.useState<TrainingModule[]>([]);
  const [trainingStats, setTrainingStats] = React.useState<TrainingStats | null>(null);

  React.useEffect(() => {
    // Load mock training data
    setTrainingModules([
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
    setTrainingStats({
      total_modules: 12,
      completed_modules: 4,
      in_progress: 2,
      total_hours: 8,
      certificates_earned: 2,
    });
  }, []);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getModuleStatus = (module: TrainingModule) => {
    if (module.completed_lessons === module.lessons_count) return "completed";
    if (module.completed_lessons > 0) return "in-progress";
    return "not-started";
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Modules</span>
            </div>
            <p className="text-2xl font-bold mt-1">{trainingStats?.total_modules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{trainingStats?.completed_modules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-1">{trainingStats?.in_progress || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Hours Learned</span>
            </div>
            <p className="text-2xl font-bold mt-1">{trainingStats?.total_hours || 0}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Certificates</span>
            </div>
            <p className="text-2xl font-bold mt-1">{trainingStats?.certificates_earned || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {trainingStats?.completed_modules || 0} of {trainingStats?.total_modules || 0} modules
              completed
            </span>
          </div>
          <Progress
            value={
              trainingStats ? (trainingStats.completed_modules / trainingStats.total_modules) * 100 : 0
            }
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trainingModules.map((module) => {
          const status = getModuleStatus(module);
          const progress = (module.completed_lessons / module.lessons_count) * 100;

          return (
            <Card key={module.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline">{module.category}</Badge>
                  {module.is_required && <Badge variant="secondary">Required</Badge>}
                </div>

                <h3 className="font-medium mb-1">{module.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{module.description}</p>

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
    </div>
  );
}
