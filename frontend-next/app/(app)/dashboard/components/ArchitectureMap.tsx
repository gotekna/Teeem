"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Database,
  Server,
  Monitor,
  ArrowRight,
  ArrowDown,
  Layers,
  FolderTree,
  GitBranch,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Code2,
  Table2,
  Atom,
  FileCode,
  Shield,
  Zap,
  BookOpen,
  Search,
  GraduationCap,
  Terminal,
  Lightbulb,
  Rocket,
  Target,
  Wrench,
  HardDrive,
  Folder,
  FileBox,
  Link2,
  Mail,
  Briefcase,
  Building,
  Building2,
  ClipboardList,
  Archive,
  Hash,
  RefreshCw,
  Eye,
  Download,
  Copy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tooltip wrapper for technical terms
function TechTerm({ term, definition, children }: { term: string; definition: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted decoration-muted-foreground/50 cursor-help">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold">{term}</p>
          <p className="text-xs text-muted-foreground">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Architecture box component for diagrams
function ArchBox({
  title,
  description,
  icon: Icon,
  color,
  className,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  color: "blue" | "green" | "purple" | "orange" | "gray";
  className?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    green: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    purple: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
    orange: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
    gray: "bg-muted border-border text-muted-foreground",
  };

  return (
    <div className={cn("p-4 rounded-lg border-2 text-center", colorClasses[color], className)}>
      <Icon className="h-6 w-6 mx-auto mb-2" />
      <p className="font-semibold text-sm">{title}</p>
      {description && <p className="text-xs mt-1 opacity-80">{description}</p>}
    </div>
  );
}

// Arrow component for flow diagrams
function FlowArrow({ direction = "right", label }: { direction?: "right" | "down"; label?: string }) {
  if (direction === "down") {
    return (
      <div className="flex flex-col items-center py-2 text-muted-foreground">
        <ArrowDown className="h-5 w-5" />
        {label && <span className="text-xs">{label}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center px-2 text-muted-foreground">
      <ArrowRight className="h-5 w-5" />
      {label && <span className="text-xs ml-1">{label}</span>}
    </div>
  );
}

// SSoT Reference Table Row
function SSoTRow({
  category,
  location,
  notHere,
}: {
  category: string;
  location: string;
  notHere?: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium text-sm">{category}</td>
      <td className="py-2 pr-4">
        <code className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
          {location}
        </code>
      </td>
      <td className="py-2">
        {notHere && (
          <code className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-0.5 rounded line-through">
            {notHere}
          </code>
        )}
      </td>
    </tr>
  );
}

// Health Check Item
function HealthCheckItem({
  question,
  tip,
  checked,
  onToggle,
}: {
  question: string;
  tip: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        checked
          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
          : "bg-muted/50 border-border hover:bg-muted"
      )}
      onClick={onToggle}
    >
      <div className="mt-0.5">
        {checked ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>
      <div className="flex-1">
        <p className={cn("text-sm font-medium", checked && "text-green-700 dark:text-green-300")}>
          {question}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{tip}</p>
      </div>
    </div>
  );
}

export default function ArchitectureMap() {
  const [activeView, setActiveView] = useState("beginner");
  const [healthChecks, setHealthChecks] = useState<Record<string, boolean>>({});

  const toggleHealthCheck = (id: string) => {
    setHealthChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center py-6 border-b">
        <h2 className="text-3xl font-bold tracking-tight font-serif">TEEEM Architecture</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          A comprehensive guide to understanding the TEEEM codebase structure, patterns, and conventions.
          Whether you&apos;re a beginner or an experienced developer, this guide will help you navigate the system.
        </p>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="beginner" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Beginner</span>
          </TabsTrigger>
          <TabsTrigger value="teaching" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Teaching</span>
          </TabsTrigger>
          <TabsTrigger value="architect" className="gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Architect</span>
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Warehouse</span>
          </TabsTrigger>
          <TabsTrigger value="ssot" className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SSoT Reference</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Health Check</span>
          </TabsTrigger>
          <TabsTrigger value="tenancy" className="gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Tenancy</span>
          </TabsTrigger>
        </TabsList>

        {/* Beginner View */}
        <TabsContent value="beginner" className="space-y-6 mt-6">
          {/* What is TEEEM */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                What is TEEEM?
              </CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert prose-sm max-w-none">
              <p>
                TEEEM is a comprehensive business management platform built for the construction industry.
                It handles jobs, contacts, purchase orders, documents, scheduling, and more. The name
                represents our values: <strong>T</strong>rust, <strong>E</strong>mpower, <strong>E</strong>volve,{" "}
                <strong>E</strong>njoy, <strong>M</strong>easure.
              </p>
            </CardContent>
          </Card>

          {/* Simple Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>The Big Picture</CardTitle>
              <CardDescription>
                TEEEM has three main parts that work together
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-2">
                <ArchBox
                  title="Frontend"
                  description="What users see"
                  icon={Monitor}
                  color="blue"
                  className="w-full lg:w-48"
                />
                <FlowArrow label="API calls" />
                <ArchBox
                  title="Backend"
                  description="Business logic"
                  icon={Server}
                  color="green"
                  className="w-full lg:w-48"
                />
                <FlowArrow label="Queries" />
                <ArchBox
                  title="Database"
                  description="Where data lives"
                  icon={Database}
                  color="purple"
                  className="w-full lg:w-48"
                />
              </div>

              <div className="mt-8 grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Frontend (Next.js)</h4>
                  <ul className="space-y-1 text-blue-600 dark:text-blue-400">
                    <li>- React components</li>
                    <li>- User interface</li>
                    <li>- Forms & tables</li>
                    <li>- Port 3000</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">Backend (Rails)</h4>
                  <ul className="space-y-1 text-green-600 dark:text-green-400">
                    <li>- API endpoints</li>
                    <li>- Business rules</li>
                    <li>- Authentication</li>
                    <li>- Port 3001</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Database (PostgreSQL)</h4>
                  <ul className="space-y-1 text-purple-600 dark:text-purple-400">
                    <li>- Jobs, Contacts, etc.</li>
                    <li>- Foundation tables</li>
                    <li>- User data</li>
                    <li>- Port 5432</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Folder Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Folder Structure
              </CardTitle>
              <CardDescription>Where to find things in the codebase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                <pre className="text-foreground">{`teeem/
├── frontend-next/           # Frontend (Next.js)
│   ├── app/                 # Pages & routes
│   │   └── (app)/           # Authenticated pages
│   │       ├── dashboard/
│   │       ├── jobs/
│   │       └── contacts/
│   ├── components/          # Reusable UI
│   │   ├── ui/              # Base components (Button, Card, etc.)
│   │   └── table/           # TeeemTableView (THE ONE table)
│   └── lib/                 # Utilities & constants
│       ├── constants/       # SSoT for all constants
│       └── api.ts           # API client
│
└── backend/                 # Backend (Rails)
    ├── app/
    │   ├── controllers/     # API endpoints
    │   ├── models/          # Database models
    │   └── services/        # Business logic
    └── db/
        └── schema.rb        # Database structure`}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Key Concept: Foundation */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-primary" />
                Key Concept: The Foundation Pattern
              </CardTitle>
              <CardDescription>
                This is the most important pattern to understand
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                A <TechTerm term="Foundation" definition="A configuration that describes a database table's structure, columns, and how to display them in the UI">
                  Foundation
                </TechTerm> is like a blueprint for displaying data. Instead of hardcoding table columns everywhere,
                we define them once and reuse them.
              </p>

              <div className="bg-background p-4 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-2">Example: Jobs Foundation</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">job_number</Badge>
                  <Badge variant="secondary">client_name</Badge>
                  <Badge variant="secondary">status</Badge>
                  <Badge variant="secondary">start_date</Badge>
                  <Badge variant="secondary">...</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  This Foundation defines ALL columns for the Jobs table. Every page showing jobs uses this same definition.
                </p>
              </div>

              <div className="text-sm">
                <p className="font-semibold mb-2">Why this matters:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Change column names in ONE place, updates everywhere</li>
                  <li>Consistent data display across the app</li>
                  <li>No duplicate column definitions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teaching View - Step-by-step coding guide for beginners */}
        <TabsContent value="teaching" className="space-y-6 mt-6">
          {/* Welcome */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                Learn to Code in TEEEM
              </CardTitle>
              <CardDescription>
                A step-by-step guide to writing your first feature - no AI required!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This guide walks you through the exact steps to add a feature to TEEEM.
                Follow along, and by the end you&apos;ll understand how all the pieces connect.
              </p>
            </CardContent>
          </Card>

          {/* Lesson 1: Understanding the Stack */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  1
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 1: The Tech Stack</CardTitle>
                  <CardDescription>What technologies are we using?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300">Frontend</h4>
                  </div>
                  <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
                    <li><strong>Next.js 14</strong> - React framework</li>
                    <li><strong>TypeScript</strong> - JavaScript with types</li>
                    <li><strong>Tailwind CSS</strong> - Styling</li>
                    <li><strong>Jotai</strong> - State management</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h4 className="font-semibold text-green-700 dark:text-green-300">Backend</h4>
                  </div>
                  <ul className="text-sm space-y-1 text-green-600 dark:text-green-400">
                    <li><strong>Ruby on Rails 7</strong> - API framework</li>
                    <li><strong>PostgreSQL</strong> - Database</li>
                    <li><strong>REST API</strong> - JSON responses</li>
                    <li><strong>Foundation Pattern</strong> - Data structure</li>
                  </ul>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Key insight:</strong> Frontend and Backend are separate apps that talk via API calls.
                    Frontend runs on port 3000, Backend on port 3001.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 2: Your First Task */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  2
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 2: Adding a Simple Page</CardTitle>
                  <CardDescription>Create your first page in TEEEM</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Let&apos;s say you want to add a new page at <code className="bg-muted px-1 rounded">/my-page</code>
              </p>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">a</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Create the folder and file</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                      frontend-next/app/(app)/my-page/page.tsx
                    </code>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">b</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Add basic page structure</p>
                    <div className="mt-2 font-mono text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                      <pre>{`"use client";

export default function MyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Page</h1>
      <p>Hello world!</p>
    </div>
  );
}`}</pre>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">c</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Visit <code className="bg-muted px-1 rounded">localhost:3000/my-page</code></p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>That&apos;s it!</strong> Next.js uses file-based routing. The folder name = the URL path.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 3: Using Components */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  3
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 3: Using UI Components</CardTitle>
                  <CardDescription>Import and use existing components</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                TEEEM has pre-built components. Here&apos;s how to use them:
              </p>

              <div className="font-mono text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                <pre>{`"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a card component</p>
          <Badge className="mt-2">Status</Badge>
          <Button className="mt-4">Click me</Button>
        </CardContent>
      </Card>
    </div>
  );
}`}</pre>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-muted rounded text-center">
                  <p className="font-semibold">Button</p>
                  <code className="text-muted-foreground">ui/button</code>
                </div>
                <div className="p-2 bg-muted rounded text-center">
                  <p className="font-semibold">Card</p>
                  <code className="text-muted-foreground">ui/card</code>
                </div>
                <div className="p-2 bg-muted rounded text-center">
                  <p className="font-semibold">Badge</p>
                  <code className="text-muted-foreground">ui/badge</code>
                </div>
                <div className="p-2 bg-muted rounded text-center">
                  <p className="font-semibold">Dialog</p>
                  <code className="text-muted-foreground">ui/dialog</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 4: Fetching Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  4
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 4: Fetching Data from API</CardTitle>
                  <CardDescription>Get data from the backend</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use the <code className="bg-muted px-1 rounded">api</code> helper to fetch data:
              </p>

              <div className="font-mono text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                <pre>{`"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function MyPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      const response = await api.get("/api/v1/jobs");
      if (response?.success) {
        setJobs(response.jobs);
      }
      setLoading(false);
    }
    loadJobs();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Jobs ({jobs.length})</h1>
      {jobs.map(job => (
        <p key={job.id}>{job.job_number}</p>
      ))}
    </div>
  );
}`}</pre>
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Pattern:</strong> useEffect for loading data, useState for storing it.
                    Always check <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">response?.success</code> before using data.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 5: TeeemTableView */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  5
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 5: Display Data in a Table</CardTitle>
                  <CardDescription>Use TeeemTableView - THE ONE table component</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For tables, always use <code className="bg-muted px-1 rounded">TeeemTableView</code>. It handles everything automatically:
              </p>

              <div className="font-mono text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                <pre>{`"use client";

import TeeemTableView from "@/components/table/TeeemTableView";

export default function JobsPage() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="jobs"
        autoFetchRecords={true}
      />
    </div>
  );
}`}</pre>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">TeeemTableView gives you:</span>
                  </div>
                  <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
                    <li>- Automatic column detection</li>
                    <li>- Sorting & filtering</li>
                    <li>- Pagination</li>
                    <li>- Edit/Add/Delete modals</li>
                    <li>- Export to CSV</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">Don&apos;t do this:</span>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                    <li>- Build custom tables from scratch</li>
                    <li>- Pass hardcoded columns</li>
                    <li>- Manually fetch records</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 6: Backend Basics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 font-bold text-sm">
                  6
                </div>
                <div>
                  <CardTitle className="text-lg">Lesson 6: Backend Basics (Rails)</CardTitle>
                  <CardDescription>Understanding the API side</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The backend follows Rails conventions. Here&apos;s where things live:
              </p>

              <div className="font-mono text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                <pre>{`backend/
├── app/
│   ├── controllers/api/v1/   # API endpoints
│   │   └── jobs_controller.rb
│   ├── models/               # Database models
│   │   └── job.rb
│   └── services/             # Business logic
│       └── job_service.rb
└── db/
    ├── schema.rb             # Database structure
    └── migrate/              # Database changes`}</pre>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Controller (handles API requests)</p>
                  <code className="text-xs">backend/app/controllers/api/v1/jobs_controller.rb</code>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Model (database table)</p>
                  <code className="text-xs">backend/app/models/job.rb</code>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Service (complex logic)</p>
                  <code className="text-xs">backend/app/services/job_service.rb</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson 7: The Golden Rules */}
          <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 font-bold text-sm">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg text-yellow-800 dark:text-yellow-200">The Golden Rules</CardTitle>
                  <CardDescription className="text-yellow-700 dark:text-yellow-400">Remember these and you&apos;ll be fine!</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { rule: "Search before creating", tip: "Something similar probably exists already" },
                  { rule: "Use TeeemTableView for tables", tip: "It handles 90% of table needs" },
                  { rule: "Use existing components", tip: "Check @/components/ui/ first" },
                  { rule: "Foundation API for data", tip: "Use autoFetchRecords={true}" },
                  { rule: "Dark mode always", tip: "Use Tailwind dark: classes" },
                  { rule: "TypeScript types", tip: "Define interfaces for your data" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded bg-yellow-100 dark:bg-yellow-900/30">
                    <CheckCircle2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">{item.rule}</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border hover:border-primary/50 transition-colors">
                  <h4 className="font-semibold text-sm mb-1">Explore existing pages</h4>
                  <p className="text-xs text-muted-foreground">Look at /jobs, /contacts to see real examples</p>
                </div>
                <div className="p-3 rounded-lg border hover:border-primary/50 transition-colors">
                  <h4 className="font-semibold text-sm mb-1">Read the SSoT tab</h4>
                  <p className="text-xs text-muted-foreground">Learn where everything lives</p>
                </div>
                <div className="p-3 rounded-lg border hover:border-primary/50 transition-colors">
                  <h4 className="font-semibold text-sm mb-1">Try the Health Check</h4>
                  <p className="text-xs text-muted-foreground">Validate your code before committing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Architect View */}
        <TabsContent value="architect" className="space-y-6 mt-6">
          {/* Data Flow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Data Flow: Request Lifecycle
              </CardTitle>
              <CardDescription>
                How data travels from user click to screen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Flow diagram */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-center">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
                    <p className="font-mono text-xs">User clicks</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground hidden md:block" />
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
                    <p className="font-mono text-xs">React component</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground hidden md:block" />
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
                    <p className="font-mono text-xs">API call</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-center">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                    <p className="font-mono text-xs">Rails controller</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground hidden md:block" />
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                    <p className="font-mono text-xs">Service/Model</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground hidden md:block" />
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700">
                    <p className="font-mono text-xs">Database query</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-center max-w-md mx-auto">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700">
                    <p className="font-mono text-xs">JSON response</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground hidden md:block" />
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
                    <p className="font-mono text-xs">UI renders</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Foundation API Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Foundation API (SSoT for Queries)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-xs bg-muted p-4 rounded-lg">
                <p className="text-green-600 dark:text-green-400"># THE ONE endpoint for all record queries</p>
                <p className="mt-2">GET /api/v1/foundations/{"{slug}"}/records</p>
                <p className="text-muted-foreground mt-2"># Features included automatically:</p>
                <p className="text-muted-foreground">- Lookup expansion (foreign key display values)</p>
                <p className="text-muted-foreground">- Eager loading (no N+1 queries)</p>
                <p className="text-muted-foreground">- Pagination</p>
                <p className="text-muted-foreground">- Filtering</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">DO use</p>
                  <code className="text-xs">autoFetchRecords={"{true}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">in TeeemTableView</p>
                </div>
                <div className="p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">DON&apos;T use</p>
                  <code className="text-xs">Custom *_json methods</code>
                  <p className="text-xs text-muted-foreground mt-1">or manual lookup expansion</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* State Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Atom className="h-5 w-5" />
                State Management (Jotai Atoms)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                TEEEM uses <TechTerm term="Jotai" definition="A primitive and flexible state management library for React">
                  Jotai
                </TechTerm> for global state. Atoms are defined in <code className="text-xs bg-muted px-1 py-0.5 rounded">lib/table-atoms.ts</code>.
              </p>

              <div className="font-mono text-xs bg-muted p-4 rounded-lg">
                <p className="text-muted-foreground"># Key atoms (SSoT)</p>
                <p className="text-blue-600 dark:text-blue-400 mt-2">activeTableModalAtom</p>
                <p className="text-muted-foreground text-xs">- Which modal is open</p>
                <p className="text-blue-600 dark:text-blue-400 mt-2">filterUIModeAtom</p>
                <p className="text-muted-foreground text-xs">- Filter panel visibility</p>
                <p className="text-blue-600 dark:text-blue-400 mt-2">columnConfigAtom</p>
                <p className="text-muted-foreground text-xs">- Column visibility/order</p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Before adding <code>useState</code> for modals or filters, check if an atom already exists!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Component Architecture */}
          <Card>
            <CardHeader>
              <CardTitle>Component Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">Page</Badge>
                  <span className="text-muted-foreground">app/(app)/jobs/page.tsx</span>
                </div>
                <div className="pl-6 border-l-2 border-muted ml-4 space-y-2 py-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">Table</Badge>
                    <span className="text-muted-foreground">TeeemTableView</span>
                  </div>
                  <div className="pl-6 border-l-2 border-muted ml-4 space-y-2 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Header</Badge>
                      <span className="text-muted-foreground">+ filters, column config</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Body</Badge>
                      <span className="text-muted-foreground">+ rows, cells, pagination</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Modals</Badge>
                      <span className="text-muted-foreground">+ edit, add, delete</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouse Architecture */}
        <TabsContent value="warehouse" className="space-y-6 mt-6">
          {/* Intro */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-6 w-6 text-primary" />
                File Warehouse Architecture
              </CardTitle>
              <CardDescription>
                How TEEEM stores, organizes, and retrieves documents across the entire system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The File Warehouse is a universal document storage system that handles all files in TEEEM -
                from email attachments to job documents to corporate files. It uses content-hash deduplication
                to save storage space and virtual folders for instant reorganization.
              </p>
            </CardContent>
          </Card>

          {/* High-Level Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                High-Level Architecture
              </CardTitle>
              <CardDescription>
                Three-layer system: Metadata → Blobs → Physical Storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visual Diagram */}
              <div className="relative p-6 bg-muted/30 rounded-xl border">
                {/* Layer 1: Document Metadata */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    Layer 1: Document Metadata
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <FileBox className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">WarehouseDocument</span>
                      </div>
                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <li>• display_name (what user sees)</li>
                        <li>• send_name (download filename)</li>
                        <li>• folder (virtual path)</li>
                        <li>• source_type (email, job, etc.)</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">EmailWarehouse</span>
                      </div>
                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <li>• subject, from, to</li>
                        <li>• received_at</li>
                        <li>• mailbox</li>
                        <li>• Links to WarehouseDocument</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">JobDocument</span>
                      </div>
                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <li>• job_id, document_type</li>
                        <li>• uploaded_by</li>
                        <li>• Links to WarehouseDocument</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center py-2">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ArrowDown className="h-5 w-5" />
                    <span className="text-xs">storage_blob_id</span>
                  </div>
                </div>

                {/* Layer 2: Blob Storage */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Layer 2: Content-Addressed Blobs
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/40 border-2 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-green-700 dark:text-green-300">StorageBlob (Deduplication Layer)</span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <p className="font-mono text-xs text-green-800 dark:text-green-200">content_hash</p>
                        <p className="text-xs text-green-600 dark:text-green-400">SHA256 fingerprint</p>
                      </div>
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <p className="font-mono text-xs text-green-800 dark:text-green-200">storage_path</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Blobs/ab/abc123.pdf</p>
                      </div>
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <p className="font-mono text-xs text-green-800 dark:text-green-200">reference_count</p>
                        <p className="text-xs text-green-600 dark:text-green-400">How many docs use this</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center py-2">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ArrowDown className="h-5 w-5" />
                    <span className="text-xs">S3 API / SharePoint</span>
                  </div>
                </div>

                {/* Layer 3: Physical Storage */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    Layer 3: Physical Storage
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-lg bg-purple-200 dark:bg-purple-800 flex items-center justify-center mb-2">
                          <HardDrive className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Wasabi S3</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Primary</p>
                      </div>
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-lg bg-purple-200 dark:bg-purple-800 flex items-center justify-center mb-2">
                          <Folder className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">SharePoint</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Optional</p>
                      </div>
                      <div className="text-center opacity-50">
                        <div className="w-16 h-16 rounded-lg bg-purple-200 dark:bg-purple-800 flex items-center justify-center mb-2">
                          <Server className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Local</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Dev only</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deduplication Explained */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Content-Hash Deduplication
              </CardTitle>
              <CardDescription>
                Same file stored ONCE, referenced by MANY documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Before */}
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span className="font-semibold text-red-700 dark:text-red-300">Without Deduplication</span>
                  </div>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">📄 invoice.pdf (500KB)</div>
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">📄 invoice.pdf (500KB) - copy</div>
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">📄 invoice.pdf (500KB) - copy</div>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-3">= 1.5MB total storage</p>
                </div>

                {/* After */}
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-700 dark:text-green-300">With Deduplication</span>
                  </div>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded flex items-center gap-2">
                      <Hash className="h-3 w-3" />
                      StorageBlob (500KB)
                    </div>
                    <div className="flex gap-2 ml-4">
                      <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded text-xs">Doc 1 →</div>
                      <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded text-xs">Doc 2 →</div>
                      <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded text-xs">Doc 3 →</div>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3">= 500KB total storage (67% savings!)</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>How it works:</strong> When a file is uploaded, we compute its SHA256 hash.
                    If a blob with that hash already exists, we just create a new pointer to it instead of
                    storing the file again.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Virtual vs Physical Folders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Virtual vs Physical Folders
              </CardTitle>
              <CardDescription>
                Virtual folders enable instant reorganization without moving files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Physical */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold">Physical Storage</span>
                  </div>
                  <div className="font-mono text-xs bg-muted p-3 rounded">
                    <p className="text-muted-foreground"># Blobs are stored by hash</p>
                    <p className="text-purple-600 dark:text-purple-400">/Blobs/</p>
                    <p className="text-purple-600 dark:text-purple-400 ml-2">/ab/abc123def456.pdf</p>
                    <p className="text-purple-600 dark:text-purple-400 ml-2">/cd/cde789ghi012.docx</p>
                    <p className="text-muted-foreground mt-2"># Files NEVER move!</p>
                  </div>
                </div>

                {/* Virtual */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderTree className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold">Virtual Folders (Database)</span>
                  </div>
                  <div className="font-mono text-xs bg-muted p-3 rounded">
                    <p className="text-muted-foreground"># User sees organized structure</p>
                    <p className="text-blue-600 dark:text-blue-400">/Jobs/JOB-001/Plans/</p>
                    <p className="text-blue-600 dark:text-blue-400 ml-2">→ site-plan.pdf</p>
                    <p className="text-blue-600 dark:text-blue-400">/Jobs/JOB-001/Invoices/</p>
                    <p className="text-blue-600 dark:text-blue-400 ml-2">→ invoice.pdf</p>
                    <p className="text-muted-foreground mt-2"># Reorganize = DB update!</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                  Why Virtual Folders?
                </p>
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Zap className="h-4 w-4 shrink-0" />
                    <span>Instant moves (just update DB)</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    <span>Bulk reorganization</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Archive className="h-4 w-4 shrink-0" />
                    <span>No S3 copy operations</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warehouse Scopes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Warehouse Scopes
              </CardTitle>
              <CardDescription>
                Documents are organized into scopes based on their source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { scope: "job", icon: Briefcase, path: "Jobs/{{JobCode}}", color: "green", desc: "Job documents, plans, photos" },
                  { scope: "contact", icon: Users, path: "Contacts/{{ContactName}}", color: "purple", desc: "Client/supplier docs" },
                  { scope: "corporate_entity", icon: Building2, path: "Corporate/{{CompanyGroup}}", color: "orange", desc: "Company-level docs" },
                  { scope: "task", icon: ClipboardList, path: "Tasks/{{TaskId}}", color: "red", desc: "Task attachments" },
                  { scope: "email", icon: Mail, path: "Emails/{{Mailbox}}", color: "blue", desc: "Synced emails" },
                  { scope: "warehouse", icon: Archive, path: "Warehousing/{{UserName}}", color: "gray", desc: "General storage" },
                ].map((item) => {
                  const Icon = item.icon;
                  const colorClasses = {
                    green: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
                    purple: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
                    orange: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
                    red: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
                    blue: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
                    gray: "bg-muted border-border text-muted-foreground",
                  };
                  return (
                    <div key={item.scope} className={cn("p-3 rounded-lg border-2", colorClasses[item.color as keyof typeof colorClasses])}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold text-sm">{item.scope}</span>
                      </div>
                      <code className="text-xs block bg-background/50 px-2 py-1 rounded mb-2">{item.path}</code>
                      <p className="text-xs opacity-80">{item.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">
                  <strong>SSoT:</strong> Scope paths are configured in{" "}
                  <code className="bg-background px-1 rounded">WarehouseProvider.warehouse_folders</code>.
                  Configure at: Settings → Company → Entity Config → Storage Config
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Two Names Per Document */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Two Names Per Document
              </CardTitle>
              <CardDescription>
                display_name vs send_name - what users see vs what they download
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold">display_name</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    What the user SEES in the UI (file browser, tables, search results)
                  </p>
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-mono">📄 RE: Invoice Question</p>
                    <p className="font-mono">📄 Site Plans - Draft v2</p>
                    <p className="font-mono">📄 Quote from Supplier</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="h-5 w-5 text-green-500" />
                    <span className="font-semibold">send_name</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    The filename when downloaded (generated from template)
                  </p>
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-mono">📄 RE Invoice Question - 2026-01-17.eml</p>
                    <p className="font-mono">📄 JOB-001 Plans 2026-01-17.pdf</p>
                    <p className="font-mono">📄 ACME Quote 2026-01-17.pdf</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs font-semibold mb-2">Download Name Templates</p>
                <div className="grid md:grid-cols-2 gap-2 text-xs font-mono">
                  <div><span className="text-muted-foreground">email →</span> {"{Subject} - {ReceivedDate}.eml"}</div>
                  <div><span className="text-muted-foreground">job →</span> {"{JobCode} {DocTypeName} {Date}"}</div>
                  <div><span className="text-muted-foreground">corporate →</span> {"{CompanyCode} {DocTypeName} {Date}"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Flow Diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Document Upload Flow
              </CardTitle>
              <CardDescription>
                What happens when a document is uploaded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { step: 1, title: "File Upload", desc: "User uploads file via UI or API", icon: Monitor },
                  { step: 2, title: "Hash Computation", desc: "SHA256 hash computed from file content", icon: Hash },
                  { step: 3, title: "Dedup Check", desc: "Check if StorageBlob with this hash exists", icon: Search },
                  { step: 4, title: "Storage Decision", desc: "If new: upload to S3. If exists: reuse blob.", icon: HardDrive },
                  { step: 5, title: "Create Records", desc: "Create WarehouseDocument + source record (JobDocument, etc.)", icon: Database },
                  { step: 6, title: "Index Update", desc: "Update reference counts and search index", icon: RefreshCw },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.step} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {item.step}
                      </div>
                      <div className="flex items-center gap-3 flex-1 p-3 rounded-lg border">
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Key Models Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Key Models & Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pr-4 text-left">Model/Service</th>
                      <th className="py-2 pr-4 text-left">File</th>
                      <th className="py-2 text-left">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-semibold">WarehouseDocument</td>
                      <td className="py-2 pr-4 text-muted-foreground">app/models/warehouse_document.rb</td>
                      <td className="py-2">Universal document metadata table</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-semibold">StorageBlob</td>
                      <td className="py-2 pr-4 text-muted-foreground">app/models/storage_blob.rb</td>
                      <td className="py-2">Deduplicated content storage</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-semibold">WarehouseProvider</td>
                      <td className="py-2 pr-4 text-muted-foreground">app/models/storage_configuration.rb</td>
                      <td className="py-2">Provider config & folder paths</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-semibold">SendNameResolver</td>
                      <td className="py-2 pr-4 text-muted-foreground">app/services/send_name_resolver.rb</td>
                      <td className="py-2">Template expansion for filenames</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-semibold">DisplayValueResolver</td>
                      <td className="py-2 pr-4 text-muted-foreground">app/services/display_value_resolver.rb</td>
                      <td className="py-2">Lookup display values</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Commands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Maintenance Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Full health check</p>
                  <p>rails blob:health</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Fix reference count mismatches</p>
                  <p>rails blob:audit:integrity[fix]</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Clean up orphaned blobs (30-day safety)</p>
                  <p>rails blob:cleanup:orphaned[execute,30]</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Audit warehouse document links</p>
                  <p>rails blob:audit:warehouse</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SSoT Reference */}
        <TabsContent value="ssot" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Single Source of Truth Reference</CardTitle>
              <CardDescription>
                Where to find (and where NOT to put) different types of code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">SSoT Location</th>
                      <th className="py-2">NOT Here</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SSoTRow
                      category="UI Components"
                      location="lib/component-registry.ts"
                      notHere="Random /components folders"
                    />
                    <SSoTRow
                      category="Constants"
                      location="lib/constants/*.ts"
                      notHere="Inline magic strings"
                    />
                    <SSoTRow
                      category="Table State"
                      location="lib/table-atoms.ts"
                      notHere="useState() in pages"
                    />
                    <SSoTRow
                      category="Column Types"
                      location="column_type_definitions table"
                      notHere="Hardcoded arrays"
                    />
                    <SSoTRow
                      category="Validation"
                      location="lib/formatters/validation-formatters.ts"
                      notHere="Inline regex"
                    />
                    <SSoTRow
                      category="Cache Invalidation"
                      location="lib/records-cache.ts"
                      notHere="Manual refetch calls"
                    />
                    <SSoTRow
                      category="Display Values"
                      location="DisplayValueResolver service"
                      notHere="Direct lookup_display_column access"
                    />
                    <SSoTRow
                      category="Storage Paths"
                      location="WarehouseProvider model"
                      notHere="Hardcoded path strings"
                    />
                    <SSoTRow
                      category="API Queries"
                      location="/api/v1/foundations/{slug}/records"
                      notHere="Custom *_json methods"
                    />
                    <SSoTRow
                      category="User Roles"
                      location="User::ASSIGNABLE_ROLES"
                      notHere="Duplicate role arrays"
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Accordion type="multiple" className="space-y-2">
            <AccordionItem value="components" className="border rounded-lg px-4">
              <AccordionTrigger>Standard UI Components</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { name: "Button", from: "@/components/ui/button" },
                    { name: "Card", from: "@/components/ui/card" },
                    { name: "Dialog (Modal)", from: "@/components/ui/dialog" },
                    { name: "Tabs", from: "@/components/ui/tabs" },
                    { name: "BackButton", from: "@/components/ui/back-button" },
                    { name: "Spinner", from: "@/components/ui/spinner" },
                    { name: "ComboboxDropdown", from: "@/components/ui/combobox-dropdown" },
                    { name: "TeeemTableView", from: "@/components/table/TeeemTableView" },
                    { name: "Sheet (Side Panel)", from: "@/components/ui/sheet" },
                  ].map((comp) => (
                    <div key={comp.name} className="p-2 bg-muted rounded text-xs">
                      <p className="font-semibold">{comp.name}</p>
                      <code className="text-muted-foreground">{comp.from}</code>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">Deprecated - DO NOT USE:</p>
                  <p className="text-xs text-red-600 dark:text-red-400">combobox.tsx, loader.tsx, drawer.tsx, data-table.tsx, router.back()</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="column-types" className="border rounded-lg px-4">
              <AccordionTrigger>Column Type Helpers</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Frontend (TypeScript)</p>
                    <code className="text-xs block bg-background p-2 rounded">
                      {`import { isLookupColumn, isChoiceColumn } from '@/lib/constants/column-types';`}
                    </code>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Backend (Ruby)</p>
                    <code className="text-xs block bg-background p-2 rounded">
                      {`column.column_type.in?(Column::LOOKUP_COLUMN_TYPES)`}
                    </code>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">DON&apos;T do this</p>
                    <code className="text-xs block bg-background p-2 rounded line-through">
                      {`column.column_type === 'lookup' // Missing multiple_lookups!`}
                    </code>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="foundations" className="border rounded-lg px-4">
              <AccordionTrigger>Common Foundation Slugs</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    "jobs",
                    "contacts",
                    "purchase_orders",
                    "estimates",
                    "sm_trades",
                    "sm_tasks",
                    "feature_trackers",
                    "documents",
                  ].map((slug) => (
                    <code key={slug} className="text-xs bg-muted px-2 py-1 rounded">
                      {slug}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Always use slugs (not numeric IDs) - they&apos;re consistent across environments.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* Health Check */}
        <TabsContent value="health" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Architecture Health Check
              </CardTitle>
              <CardDescription>
                Run through this checklist before making architectural decisions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Before adding new code, verify:</p>

              <HealthCheckItem
                question="Have I searched for existing similar code?"
                tip="Use grep/Glob to search lib/, components/, and existing pages first"
                checked={healthChecks["search"] || false}
                onToggle={() => toggleHealthCheck("search")}
              />

              <HealthCheckItem
                question="Is there already an SSoT for this?"
                tip="Check lib/constants/, lib/table-atoms.ts, and component-registry.ts"
                checked={healthChecks["ssot"] || false}
                onToggle={() => toggleHealthCheck("ssot")}
              />

              <HealthCheckItem
                question="Am I using THE ONE component for this use case?"
                tip="Tables = TeeemTableView, Modals = Dialog, Navigation = BackButton"
                checked={healthChecks["component"] || false}
                onToggle={() => toggleHealthCheck("component")}
              />

              <HealthCheckItem
                question="Does this support dark mode?"
                tip="Use Tailwind dark: classes, never hardcoded colors"
                checked={healthChecks["darkmode"] || false}
                onToggle={() => toggleHealthCheck("darkmode")}
              />

              <HealthCheckItem
                question="Am I using Foundation API for data queries?"
                tip="Use autoFetchRecords={true} instead of custom API calls"
                checked={healthChecks["foundation"] || false}
                onToggle={() => toggleHealthCheck("foundation")}
              />

              <HealthCheckItem
                question="Will this create duplicate logic?"
                tip="If similar code exists, extend it instead of duplicating"
                checked={healthChecks["duplicate"] || false}
                onToggle={() => toggleHealthCheck("duplicate")}
              />
            </CardContent>
          </Card>

          <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-5 w-5" />
                Anti-Patterns to Avoid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    bad: "Creating a new *_json method in a model",
                    good: "Use Foundation API with autoFetchRecords",
                  },
                  {
                    bad: "useState for modal visibility",
                    good: "Use activeTableModalAtom from table-atoms.ts",
                  },
                  {
                    bad: "Hardcoded column arrays in components",
                    good: "Let TeeemTableView fetch from Foundation",
                  },
                  {
                    bad: "Manual lookup value resolution",
                    good: "Use DisplayValueResolver service",
                  },
                  {
                    bad: "Direct database column type checks like === 'lookup'",
                    good: "Use isLookupColumn() helper",
                  },
                ].map((pattern, i) => (
                  <div key={i} className="flex gap-4 text-sm">
                    <div className="flex-1 p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                      <div className="flex items-center gap-1 text-red-700 dark:text-red-300">
                        <XCircle className="h-3 w-3" />
                        <span className="font-semibold text-xs">Bad</span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pattern.bad}</p>
                    </div>
                    <div className="flex-1 p-2 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                      <div className="flex items-center gap-1 text-green-700 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="font-semibold text-xs">Good</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">{pattern.good}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Quick Reference Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Find where something is defined</p>
                  <p>grep -rn &quot;SEARCH_TERM&quot; frontend-next/lib/</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Check for SSoT violations</p>
                  <p>/duplicate-detector</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Find all uses of a component</p>
                  <p>grep -rn &quot;ComponentName&quot; frontend-next/app/</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground"># Check schema for existing columns</p>
                  <p>grep -n &quot;COLUMN_NAME&quot; backend/db/schema.rb</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenancy View */}
        <TabsContent value="tenancy" className="space-y-6 mt-6">
          {/* Ultra Design Vision */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Ultra Design Vision
              </CardTitle>
              <CardDescription>
                Construction companies have many SPVs (Special Purpose Vehicles).
                User logs in ONCE, sees ALL their companies in ONE dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Tenant Level */}
                <div className="p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40">
                  <div className="text-center mb-4">
                    <Badge variant="outline" className="text-purple-700 dark:text-purple-300">
                      Tenant = Customer Account
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm">
                    <div className="p-3 bg-background rounded border">
                      <p className="font-semibold">TEEEM (id=1)</p>
                      <p className="text-xs text-muted-foreground">Master Tenant</p>
                      <Badge variant="secondary" className="mt-1">is_master_tenant: true</Badge>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="font-semibold">Tekna (id=2)</p>
                      <p className="text-xs text-muted-foreground">Customer Tenant</p>
                      <Badge variant="outline" className="mt-1">4 Organizations</Badge>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="font-semibold">Pilgrim (id=3)</p>
                      <p className="text-xs text-muted-foreground">Customer Tenant</p>
                      <Badge variant="outline" className="mt-1">0 Organizations</Badge>
                    </div>
                  </div>
                </div>

                <FlowArrow direction="down" label="has_many :organizations" />

                {/* Organization Level */}
                <div className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40">
                  <div className="text-center mb-4">
                    <Badge variant="outline" className="text-blue-700 dark:text-blue-300">
                      Organization = Credential Scope (SPVs)
                    </Badge>
                  </div>
                  <p className="text-xs text-center text-muted-foreground mb-4">
                    Each SPV has its OWN Microsoft 365, OWN Xero, OWN bank account
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-background rounded border">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="font-semibold">Tekna</p>
                      <p className="text-muted-foreground">id=1, main</p>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="font-semibold">100xBestLife</p>
                      <p className="text-muted-foreground">id=2, ministry</p>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="font-semibold">Homes of Hope</p>
                      <p className="text-muted-foreground">id=3, ministry</p>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="font-semibold">Love Your World</p>
                      <p className="text-muted-foreground">id=4, ministry</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SSoT Ownership */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-green-500" />
                SSoT: Who Owns What?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Concept</th>
                    <th className="text-left py-2 font-semibold">SSoT Owner</th>
                    <th className="text-left py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Multi-tenancy</td>
                    <td><code className="text-xs bg-green-100 dark:bg-green-900/30 px-1 rounded">Tenant</code></td>
                    <td className="text-muted-foreground">acts_as_tenant scopes all data</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Storage Config</td>
                    <td><code className="text-xs bg-green-100 dark:bg-green-900/30 px-1 rounded">Tenant</code></td>
                    <td className="text-muted-foreground">One S3 bucket per customer</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Users</td>
                    <td><code className="text-xs bg-green-100 dark:bg-green-900/30 px-1 rounded">Tenant</code></td>
                    <td className="text-muted-foreground">User sees ALL orgs in dashboard</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Microsoft Credentials</td>
                    <td><code className="text-xs bg-blue-100 dark:bg-blue-900/30 px-1 rounded">Organization</code></td>
                    <td className="text-muted-foreground">Each SPV has own Microsoft 365</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Xero Credentials</td>
                    <td><code className="text-xs bg-blue-100 dark:bg-blue-900/30 px-1 rounded">Organization</code></td>
                    <td className="text-muted-foreground">Each SPV has own Xero account</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* External Tenant IDs Warning */}
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-5 w-5" />
                Warning: tenant_id Naming Collision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The field name &quot;tenant_id&quot; means DIFFERENT things in different contexts:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded border bg-purple-50 dark:bg-purple-950/30">
                  <p className="font-semibold text-purple-700 dark:text-purple-300">Our Tenant</p>
                  <code className="text-xs">Tenant.id</code>
                  <p className="text-xs text-muted-foreground mt-1">TEEEM platform multi-tenancy</p>
                </div>
                <div className="p-3 rounded border bg-blue-50 dark:bg-blue-950/30">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Xero tenant_id</p>
                  <code className="text-xs">xero_tenant_id</code>
                  <p className="text-xs text-muted-foreground mt-1">Xero&apos;s multi-org identifier</p>
                </div>
                <div className="p-3 rounded border bg-green-50 dark:bg-green-950/30">
                  <p className="font-semibold text-green-700 dark:text-green-300">Azure tenant_id</p>
                  <code className="text-xs">MicrosoftCredential.tenant_id</code>
                  <p className="text-xs text-muted-foreground mt-1">Microsoft Azure AD tenant</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bandaids to Fix */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                Bandaids to Remove (3-Month Fix)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded bg-red-50 dark:bg-red-950/30">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Organization.first in 34 files</p>
                    <p className="text-xs text-muted-foreground">Breaks multi-tenancy - derive from record chain instead</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded bg-red-50 dark:bg-red-950/30">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium">WarehouseProvider at Organization level</p>
                    <p className="text-xs text-muted-foreground">Should be at Tenant level - one bucket per customer</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded bg-red-50 dark:bg-red-950/30">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium">No fail-fast error handling</p>
                    <p className="text-xs text-muted-foreground">Add TenantNotFoundError exception class</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
