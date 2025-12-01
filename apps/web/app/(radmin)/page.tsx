"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table2,
  Database,
  Paintbrush,
  BookOpen,
  Settings2,
  GitBranch,
  Users,
  Shield,
  Upload,
  Bot,
  AlertTriangle,
} from "lucide-react";

const adminSections = [
  {
    title: "Tables",
    href: "/radmin/tables",
    icon: Table2,
    description: "Gold Standard table viewer - dynamic tables with saved views, filters, and custom columns",
    color: "bg-blue-500",
  },
  {
    title: "Schema Editor",
    href: "/radmin/schema",
    icon: Database,
    description: "Create and modify table schemas, columns, relationships, and computed fields",
    color: "bg-purple-500",
  },
  {
    title: "Designer",
    href: "/radmin/designer",
    icon: Paintbrush,
    description: "Build custom pages, configure menus, and design user experiences",
    color: "bg-pink-500",
  },
  {
    title: "Trinity Docs",
    href: "/radmin/trinity",
    icon: BookOpen,
    description: "Bible, Teacher, and Lexicon - the documentation and knowledge system",
    color: "bg-green-500",
  },
  {
    title: "System Admin",
    href: "/radmin/system",
    icon: Settings2,
    description: "System health, performance monitoring, sync configuration, and diagnostics",
    color: "bg-orange-500",
  },
  {
    title: "Workflows",
    href: "/radmin/workflows",
    icon: GitBranch,
    description: "Build and manage automated workflows, triggers, and actions",
    color: "bg-cyan-500",
  },
  {
    title: "User Management",
    href: "/radmin/users",
    icon: Users,
    description: "Manage users, roles, and team members",
    color: "bg-indigo-500",
  },
  {
    title: "Permissions",
    href: "/radmin/permissions",
    icon: Shield,
    description: "Configure role-based access control and table protection",
    color: "bg-red-500",
  },
  {
    title: "Data Imports",
    href: "/radmin/imports",
    icon: Upload,
    description: "Bulk import data from CSV, Excel, and external systems",
    color: "bg-yellow-500",
  },
  {
    title: "AI Agents",
    href: "/radmin/agents",
    icon: Bot,
    description: "Monitor AI agent tasks, review outputs, and manage automations",
    color: "bg-violet-500",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-orange-500">Internal Tools</h3>
          <p className="text-sm text-muted-foreground">
            These admin tools are for internal use only. Changes made here can affect the entire system.
            Proceed with caution.
          </p>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          System configuration, schema management, and internal tools
        </p>
      </div>

      {/* Grid of Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 ${section.color} text-white flex items-center justify-center`}>
                    <section.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {section.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {section.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
