"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  Search,
  BookOpen,
  FileText,
  ExternalLink,
  ChevronRight,
  Home,
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Settings,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ManualSection {
  id: number;
  title: string;
  slug: string;
  icon: string;
  content: string;
  order: number;
  subsections?: ManualSection[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  briefcase: Briefcase,
  calendar: Calendar,
  dollar: DollarSign,
  settings: Settings,
  help: HelpCircle,
  file: FileText,
};

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 1,
    title: "Getting Started",
    slug: "getting-started",
    icon: "home",
    content: "Welcome to TEEEM! This section covers the basics of setting up your account and navigating the system.",
    order: 1,
    subsections: [
      { id: 11, title: "Creating Your Account", slug: "creating-account", icon: "file", content: "Step-by-step guide to setting up your TEEEM account.", order: 1 },
      { id: 12, title: "Dashboard Overview", slug: "dashboard", icon: "file", content: "Understanding your dashboard and key metrics.", order: 2 },
      { id: 13, title: "Navigation Guide", slug: "navigation", icon: "file", content: "How to navigate through the TEEEM interface.", order: 3 },
    ],
  },
  {
    id: 2,
    title: "Jobs & Projects",
    slug: "jobs",
    icon: "briefcase",
    content: "Learn how to create, manage, and track construction jobs and projects.",
    order: 2,
    subsections: [
      { id: 21, title: "Creating a New Job", slug: "creating-job", icon: "file", content: "How to create and set up new construction jobs.", order: 1 },
      { id: 22, title: "Job Stages", slug: "job-stages", icon: "file", content: "Understanding job stages from quote to completion.", order: 2 },
      { id: 23, title: "Schedule Master", slug: "schedule-master", icon: "file", content: "Using Schedule Master to plan and track tasks.", order: 3 },
      { id: 24, title: "Job Documents", slug: "job-documents", icon: "file", content: "Managing documents and files for each job.", order: 4 },
    ],
  },
  {
    id: 3,
    title: "Contacts & Suppliers",
    slug: "contacts",
    icon: "users",
    content: "Managing your contacts, customers, and supplier relationships.",
    order: 3,
    subsections: [
      { id: 31, title: "Customer Management", slug: "customers", icon: "file", content: "Adding and managing customer contacts.", order: 1 },
      { id: 32, title: "Supplier Directory", slug: "suppliers", icon: "file", content: "Setting up and managing your supplier network.", order: 2 },
      { id: 33, title: "Contact Roles", slug: "contact-roles", icon: "file", content: "Assigning roles to contacts for each job.", order: 3 },
    ],
  },
  {
    id: 4,
    title: "Financial Management",
    slug: "financial",
    icon: "dollar",
    content: "Track income, expenses, and generate financial reports.",
    order: 4,
    subsections: [
      { id: 41, title: "Recording Transactions", slug: "transactions", icon: "file", content: "How to record income and expenses.", order: 1 },
      { id: 42, title: "Purchase Orders", slug: "purchase-orders", icon: "file", content: "Creating and managing purchase orders.", order: 2 },
      { id: 43, title: "Invoicing", slug: "invoicing", icon: "file", content: "Generating and sending invoices.", order: 3 },
      { id: 44, title: "Financial Reports", slug: "reports", icon: "file", content: "Running profit/loss and other financial reports.", order: 4 },
    ],
  },
  {
    id: 5,
    title: "Scheduling",
    slug: "scheduling",
    icon: "calendar",
    content: "Plan, schedule, and track all your construction tasks.",
    order: 5,
    subsections: [
      { id: 51, title: "Calendar View", slug: "calendar", icon: "file", content: "Using the calendar to view scheduled tasks.", order: 1 },
      { id: 52, title: "Gantt Charts", slug: "gantt", icon: "file", content: "Visualizing project timelines with Gantt charts.", order: 2 },
      { id: 53, title: "Task Dependencies", slug: "dependencies", icon: "file", content: "Setting up task dependencies and critical path.", order: 3 },
    ],
  },
  {
    id: 6,
    title: "System Settings",
    slug: "settings",
    icon: "settings",
    content: "Configure system preferences and company settings.",
    order: 6,
    subsections: [
      { id: 61, title: "Company Settings", slug: "company-settings", icon: "file", content: "Setting up your company profile.", order: 1 },
      { id: 62, title: "User Management", slug: "user-management", icon: "file", content: "Adding users and setting permissions.", order: 2 },
      { id: 63, title: "Integrations", slug: "integrations", icon: "file", content: "Connecting to Xero, OneDrive, and other services.", order: 3 },
    ],
  },
];

export function UserManualTab() {
  const { toast } = useToast();
  const [sections, setSections] = React.useState<ManualSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSection, setSelectedSection] = React.useState<ManualSection | null>(null);

  React.useEffect(() => {
    loadManual();
  }, []);

  const loadManual = async () => {
    try {
      const data = await api.get<ManualSection[]>("/api/v1/user_manual/sections");
      setSections(data);
    } catch (error) {
      console.error("Failed to load manual:", error);
      setSections(MANUAL_SECTIONS);
    } finally {
      setLoading(false);
    }
  };

  const filteredSections = React.useMemo(() => {
    if (!searchQuery) return sections;

    const query = searchQuery.toLowerCase();
    return sections.filter((section) => {
      const matchesSection =
        section.title.toLowerCase().includes(query) ||
        section.content.toLowerCase().includes(query);
      const matchesSubsection = section.subsections?.some(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          sub.content.toLowerCase().includes(query)
      );
      return matchesSection || matchesSubsection;
    });
  }, [sections, searchQuery]);

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || FileText;
    return Icon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">User Manual</h2>
          <p className="text-sm text-muted-foreground">
            Browse and search the TEEEM user documentation.
          </p>
        </div>
        <Link href="/docs" target="_blank">
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Public Docs
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sections List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                Sections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {filteredSections.map((section) => {
                  const Icon = getIcon(section.icon);
                  return (
                    <AccordionItem key={section.id} value={String(section.id)}>
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{section.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="border-l ml-6 pl-4 space-y-1 pb-3">
                          <button
                            className={cn(
                              "w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors",
                              selectedSection?.id === section.id && "bg-muted font-medium"
                            )}
                            onClick={() => setSelectedSection(section)}
                          >
                            Overview
                          </button>
                          {section.subsections?.map((sub) => (
                            <button
                              key={sub.id}
                              className={cn(
                                "w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors",
                                selectedSection?.id === sub.id && "bg-muted font-medium"
                              )}
                              onClick={() => setSelectedSection(sub)}
                            >
                              {sub.title}
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2">
          {selectedSection ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Link href="#" className="hover:text-foreground">
                    User Manual
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <span>{selectedSection.title}</span>
                </div>
                <CardTitle>{selectedSection.title}</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>{selectedSection.content}</p>

                {/* Placeholder for rich content */}
                <div className="bg-muted/50 rounded-lg p-6 text-center text-muted-foreground mt-6">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    Full documentation content will be loaded from the database.
                  </p>
                  <p className="text-xs mt-2">
                    Edit this section in the Documentation admin panel.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BookOpen className="h-16 w-16 mb-6 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Welcome to the User Manual</h3>
                <p className="text-center max-w-md mb-6">
                  Select a section from the menu to view documentation, or use the search bar to find specific topics.
                </p>

                {/* Quick Links */}
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                  {sections.slice(0, 4).map((section) => {
                    const Icon = getIcon(section.icon);
                    return (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section)}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{section.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {section.subsections?.length || 0} topics
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Help Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="flex items-start gap-4 pt-6">
          <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
              Need more help?
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              Can&apos;t find what you&apos;re looking for? Contact our support team or check the FAQ.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="mailto:support@teeem.com.au">Contact Support</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/faq">View FAQ</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
