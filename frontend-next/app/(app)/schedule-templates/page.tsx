"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import {
  Plus,
  Search,
  Calendar,
  Clock,
  Copy,
  Star,
  MoreHorizontal,
  Edit,
  Trash,
  Eye,
  CheckCircle,
  ListTodo,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  total_tasks: number;
  estimated_duration_days: number;
  job_type: string;
  created_at: string;
  updated_at: string;
  used_count: number;
  stages: TemplateStage[];
}

interface TemplateStage {
  id: number;
  name: string;
  order: number;
  tasks_count: number;
  duration_days: number;
}

export default function ScheduleTemplatesPage() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ templates: ScheduleTemplate[] }>("/api/v1/schedule_templates");
        setTemplates(response.templates || []);
      } catch (error) {
        console.error("Failed to load templates:", error);
        setTemplates(getMockTemplates());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built schedules to quickly set up new jobs
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Templates</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Default</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {templates.find((t) => t.is_default)?.name || "None"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Total Tasks</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {templates.reduce((sum, t) => sum + t.total_tasks, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Times Used</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {templates.reduce((sum, t) => sum + t.used_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate?.id === template.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedTemplate(template)}
          >
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
                    <div
                      key={stage.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{stage.name}</span>
                      <span className="text-muted-foreground">
                        {stage.tasks_count} tasks
                      </span>
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
  );
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
      created_at: "2023-06-15",
      updated_at: "2024-11-20",
      used_count: 45,
      stages: [
        { id: 1, name: "Site Preparation", order: 1, tasks_count: 12, duration_days: 14 },
        { id: 2, name: "Foundation", order: 2, tasks_count: 18, duration_days: 21 },
        { id: 3, name: "Frame & Roof", order: 3, tasks_count: 24, duration_days: 28 },
        { id: 4, name: "Lock Up", order: 4, tasks_count: 20, duration_days: 21 },
        { id: 5, name: "Fixing & Fit Off", order: 5, tasks_count: 45, duration_days: 56 },
        { id: 6, name: "Completion", order: 6, tasks_count: 37, duration_days: 40 },
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
      created_at: "2023-08-20",
      updated_at: "2024-10-15",
      used_count: 12,
      stages: [
        { id: 7, name: "Site Preparation", order: 1, tasks_count: 15, duration_days: 18 },
        { id: 8, name: "Foundation", order: 2, tasks_count: 24, duration_days: 28 },
        { id: 9, name: "Structure", order: 3, tasks_count: 36, duration_days: 42 },
        { id: 10, name: "Services", order: 4, tasks_count: 48, duration_days: 56 },
        { id: 11, name: "Finishing", order: 5, tasks_count: 75, duration_days: 96 },
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
      created_at: "2024-01-10",
      updated_at: "2024-11-01",
      used_count: 28,
      stages: [
        { id: 12, name: "Demolition", order: 1, tasks_count: 8, duration_days: 5 },
        { id: 13, name: "Rough-In", order: 2, tasks_count: 12, duration_days: 10 },
        { id: 14, name: "Installation", order: 3, tasks_count: 18, duration_days: 14 },
        { id: 15, name: "Finishing", order: 4, tasks_count: 10, duration_days: 6 },
      ],
    },
    {
      id: 4,
      name: "Two-Story Home",
      description: "Full schedule for two-story residential construction",
      is_default: false,
      total_tasks: 212,
      estimated_duration_days: 270,
      job_type: "Residential - New Build",
      created_at: "2023-04-01",
      updated_at: "2024-09-20",
      used_count: 18,
      stages: [
        { id: 16, name: "Site Prep & Excavation", order: 1, tasks_count: 16, duration_days: 21 },
        { id: 17, name: "Foundation & Slab", order: 2, tasks_count: 22, duration_days: 28 },
        { id: 18, name: "Ground Floor Frame", order: 3, tasks_count: 28, duration_days: 35 },
        { id: 19, name: "First Floor & Roof", order: 4, tasks_count: 32, duration_days: 42 },
        { id: 20, name: "External", order: 5, tasks_count: 24, duration_days: 35 },
        { id: 21, name: "Internal Fit Out", order: 6, tasks_count: 56, duration_days: 70 },
        { id: 22, name: "Completion", order: 7, tasks_count: 34, duration_days: 39 },
      ],
    },
  ];
}
