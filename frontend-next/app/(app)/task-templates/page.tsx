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
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Clock,
  ListTodo,
  MoreHorizontal,
  Edit,
  Trash,
  Copy,
  Flag,
  Camera,
  Layers,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

interface TaskTemplate {
  id: number;
  name: string;
  task_type: string;
  category: string;
  default_duration_days: number;
  sequence_order: number | null;
  predecessor_template_codes: string[];
  description: string | null;
  is_milestone: boolean;
  requires_photo: boolean;
  is_standard: boolean;
}

// Task type colors - using construction-relevant task types
const taskTypeColors: Record<string, string> = {
  "DO": "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  "ORDER": "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  "GET": "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  "CREATE": "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-400",
  "CLAIM": "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  "CHECK": "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  "CERTIFICATE": "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400",
  "PHOTO": "bg-pink-100 text-pink-700 dark:bg-pink-400/10 dark:text-pink-400",
  "FIT": "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-400",
};

// Category colors
const categoryColors: Record<string, string> = {
  "ADMIN": "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  "MATERIALS": "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  "CARPENTER": "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  "ELECTRICAL": "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  "PLUMBER": "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  "CONCRETE": "bg-stone-100 text-stone-700 dark:bg-stone-400/10 dark:text-stone-400",
  "SURVEYOR": "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  "PAINTER": "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  "ROOFING": "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  "EQUIPMENT": "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-400",
};

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTaskType, setSelectedTaskType] = useState<string>("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ task_templates: TaskTemplate[] }>("/api/v1/task_templates");
        setTemplates(response.task_templates || []);
      } catch (error) {
        console.error("Failed to load task templates:", error);
        setTemplates(getMockTemplates());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))].sort();
  const taskTypes = [...new Set(templates.map((t) => t.task_type).filter(Boolean))].sort();

  const stats = {
    total: templates.length,
    milestones: templates.filter((t) => t.is_milestone).length,
    standard: templates.filter((t) => t.is_standard).length,
    avgDuration: templates.length > 0
      ? Math.round(templates.reduce((sum, t) => sum + (t.default_duration_days || 0), 0) / templates.length)
      : 0,
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;
    const matchesTaskType = selectedTaskType === "all" || template.task_type === selectedTaskType;
    return matchesSearch && matchesCategory && matchesTaskType;
  });

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
          <h1 className="text-2xl font-bold tracking-tight font-serif">Task Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} reusable task definitions for construction schedules
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
              <ListTodo className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Templates</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Milestones</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.milestones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Standard Tasks</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.standard}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Avg Duration</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.avgDuration} days</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Task Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Task Types</SelectItem>
            {taskTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Seq</TableHead>
              <TableHead>Task Name</TableHead>
              <TableHead>Task Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Predecessors</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-mono text-muted-foreground">
                  {template.sequence_order || "-"}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {template.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={taskTypeColors[template.task_type] || "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400"}>
                    {template.task_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={categoryColors[template.category] || ""}>
                    {template.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {template.default_duration_days} days
                  </div>
                </TableCell>
                <TableCell>
                  {template.predecessor_template_codes && template.predecessor_template_codes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {template.predecessor_template_codes.slice(0, 2).map((code, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                      {template.predecessor_template_codes.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.predecessor_template_codes.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {template.is_milestone && (
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500 text-xs py-0">
                        <Flag className="h-3 w-3 mr-1" />
                        Milestone
                      </Badge>
                    )}
                    {template.requires_photo && (
                      <Badge variant="outline" className="text-xs py-0">
                        <Camera className="h-3 w-3 mr-1" />
                        Photo
                      </Badge>
                    )}
                    {template.is_standard && (
                      <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-300">
                        Standard
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
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
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
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function getMockTemplates(): TaskTemplate[] {
  return [
    {
      id: 1,
      name: "CREATE - Contract",
      task_type: "CREATE",
      category: "ADMIN",
      default_duration_days: 1,
      sequence_order: 1,
      predecessor_template_codes: [],
      description: "Create and finalize construction contract",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 2,
      name: "DO - Load Invoices into XERO",
      task_type: "DO",
      category: "ADMIN",
      default_duration_days: 1,
      sequence_order: 2,
      predecessor_template_codes: [],
      description: "Upload all invoices to Xero accounting system",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 3,
      name: "GET - Finance Approval",
      task_type: "GET",
      category: "ADMIN",
      default_duration_days: 3,
      sequence_order: 3,
      predecessor_template_codes: ["CREATE"],
      description: "Obtain finance approval from client",
      is_milestone: true,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 4,
      name: "CLAIM - DEPOSIT",
      task_type: "CLAIM",
      category: "ADMIN",
      default_duration_days: 1,
      sequence_order: 4,
      predecessor_template_codes: ["GET"],
      description: "Process and claim deposit payment",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 5,
      name: "ORDER - Soil Test and Wind Rating & Slab Design",
      task_type: "ORDER",
      category: "ADMIN",
      default_duration_days: 5,
      sequence_order: 5,
      predecessor_template_codes: ["CLAIM"],
      description: "Order soil testing, wind rating assessment, and slab design",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 6,
      name: "ORDER - Contour Survey Plan",
      task_type: "ORDER",
      category: "SURVEYOR",
      default_duration_days: 3,
      sequence_order: 6,
      predecessor_template_codes: [],
      description: "Order contour survey for site",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 7,
      name: "DO - Working Drawings",
      task_type: "DO",
      category: "ADMIN",
      default_duration_days: 5,
      sequence_order: 7,
      predecessor_template_codes: ["ORDER"],
      description: "Complete working drawings",
      is_milestone: false,
      requires_photo: false,
      is_standard: true,
    },
    {
      id: 8,
      name: "PHOTO - Slab Pour Complete",
      task_type: "PHOTO",
      category: "CONCRETE",
      default_duration_days: 1,
      sequence_order: 15,
      predecessor_template_codes: [],
      description: "Take photos of completed slab pour",
      is_milestone: true,
      requires_photo: true,
      is_standard: true,
    },
    {
      id: 9,
      name: "CHECK - Frame Inspection",
      task_type: "CHECK",
      category: "CARPENTER",
      default_duration_days: 1,
      sequence_order: 25,
      predecessor_template_codes: [],
      description: "Inspect framing before close-in",
      is_milestone: true,
      requires_photo: true,
      is_standard: true,
    },
    {
      id: 10,
      name: "CERTIFICATE - Occupancy",
      task_type: "CERTIFICATE",
      category: "ADMIN",
      default_duration_days: 3,
      sequence_order: 100,
      predecessor_template_codes: [],
      description: "Obtain occupancy certificate",
      is_milestone: true,
      requires_photo: false,
      is_standard: true,
    },
  ];
}
