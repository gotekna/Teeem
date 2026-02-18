"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FlaskConical,
  Palette,
  Gauge,
  Database,
  LayoutList,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ItemStatus = "pending" | "passed" | "failed" | "in_progress";

interface QaItem {
  id: string;
  text: string;
  status: ItemStatus;
}

interface QaUserStory {
  id: string;
  code: string;
  title: string;
  agent: string;
  icon: React.ReactNode;
  description: string;
  items: QaItem[];
}

function getStatusIcon(status: ItemStatus) {
  switch (status) {
    case "passed":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
    case "failed":
      return <Circle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
    case "in_progress":
      return <Circle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 animate-pulse" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

function getStatusBadge(status: ItemStatus) {
  switch (status) {
    case "passed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Passed</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Failed</Badge>;
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">In Progress</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  }
}

// All user stories and acceptance criteria from the QA PRD
const QA_USER_STORIES: QaUserStory[] = [
  {
    id: "us-001",
    code: "US-001",
    title: "Element Inventory Build",
    agent: "Phase 0",
    icon: <LayoutList className="h-4 w-4" />,
    description: "Catalogue every UI element in TEEEM so that no element gets skipped during testing.",
    items: [
      { id: "us001-1", text: "Every page, tab, and sub-tab is discovered and logged", status: "pending" },
      { id: "us001-2", text: "Every button, modal, dropdown, tooltip, badge, form, table, toggle, date picker, link, toast, and alert is catalogued", status: "pending" },
      { id: "us001-3", text: "Elements behind modals, inside nested tabs, and within dynamically loaded content are included", status: "pending" },
      { id: "us001-4", text: "Each element records: type, page location, parent container, access path, and unique ID", status: "pending" },
      { id: "us001-5", text: "Inventory stored as the master checklist for all agents", status: "pending" },
      { id: "us001-6", text: "Inventory count matches a manual spot-check of at least 3 pages", status: "pending" },
    ],
  },
  {
    id: "us-002",
    code: "US-002",
    title: "QA Agent — Functional Testing",
    agent: "Agent 1",
    icon: <ClipboardCheck className="h-4 w-4" />,
    description: "Every interactive element verified as functional so that end users never encounter broken features.",
    items: [
      { id: "us002-1", text: "Every page loads to the correct destination", status: "pending" },
      { id: "us002-2", text: "Every button responds to click", status: "pending" },
      { id: "us002-3", text: "Every modal opens and closes correctly", status: "pending" },
      { id: "us002-4", text: "Every dropdown populates and selects correctly", status: "pending" },
      { id: "us002-5", text: "Every form submits with valid data and shows correct success state", status: "pending" },
      { id: "us002-6", text: "Every form triggers correct validation errors for invalid input", status: "pending" },
      { id: "us002-7", text: "Every table supports create, edit, and delete of a test record (prefixed qa-test-)", status: "pending" },
      { id: "us002-8", text: "No orphaned data remains after test record deletion", status: "pending" },
      { id: "us002-9", text: "Every navigation path works with no dead links", status: "pending" },
      { id: "us002-10", text: "Elements behind modals and nested tabs are tested, not just top-level elements", status: "pending" },
    ],
  },
  {
    id: "us-003",
    code: "US-003",
    title: "UX Agent — User Experience Validation",
    agent: "Agent 2",
    icon: <FlaskConical className="h-4 w-4" />,
    description: "User experience reviewed so that technically functional but confusing or awkward UI is caught before shipping.",
    items: [
      { id: "us003-1", text: "Layout hierarchy is logical on every page — related elements grouped, clear information flow", status: "pending" },
      { id: "us003-2", text: "Spacing and alignment is consistent — no awkward whitespace or cramped sections", status: "pending" },
      { id: "us003-3", text: "Multi-step workflows flow naturally with clear next-step indicators", status: "pending" },
      { id: "us003-4", text: "Error states are helpful and descriptive, not generic", status: "pending" },
      { id: "us003-5", text: "Labels and placeholder text are descriptive enough for a first-time user", status: "pending" },
      { id: "us003-6", text: "Truncated values have tooltips or expansion", status: "pending" },
      { id: "us003-7", text: "Modals are appropriately sized with scrollable content when needed", status: "pending" },
      { id: "us003-8", text: "Confirmation dialogs are appropriate and not excessive", status: "pending" },
      { id: "us003-9", text: "Each finding includes a specific description and the page/element it relates to", status: "pending" },
    ],
  },
  {
    id: "us-004",
    code: "US-004",
    title: "Design System Agent — Brand Compliance",
    agent: "Agent 3",
    icon: <Palette className="h-4 w-4" />,
    description: "Every component checked against the brand guidelines so that the app has complete visual uniformity.",
    items: [
      { id: "us004-1", text: "Brand guidelines loaded from /settings/developer/brand-guidelines as single source of truth", status: "pending" },
      { id: "us004-2", text: "Every select/combobox uses the canonical component", status: "pending" },
      { id: "us004-3", text: "Every date picker uses the canonical component", status: "pending" },
      { id: "us004-4", text: "Every button follows the defined style variants", status: "pending" },
      { id: "us004-5", text: "Every modal uses the defined pattern", status: "pending" },
      { id: "us004-6", text: "Every table uses the defined structure", status: "pending" },
      { id: "us004-7", text: "Colours, typography, icons, and spacing match the brand guidelines", status: "pending" },
      { id: "us004-8", text: "Each inconsistency logged with: element, current component, expected component per guidelines", status: "pending" },
      { id: "us004-9", text: "If guidelines don't cover a specific case, flagged as 'needs-guideline-decision' rather than guessed", status: "pending" },
    ],
  },
  {
    id: "us-005",
    code: "US-005",
    title: "Performance Agent — Load Times & Responsiveness",
    agent: "Agent 4",
    icon: <Gauge className="h-4 w-4" />,
    description: "Actual performance benchmarks for every page and interaction so that slow areas are identified before users hit them.",
    items: [
      { id: "us005-1", text: "Every page measured: time to first paint, time to interactive, total load time", status: "pending" },
      { id: "us005-2", text: "Any page exceeding 3 seconds flagged", status: "pending" },
      { id: "us005-3", text: "Every button click, form submission, modal open, and table load measured for response time", status: "pending" },
      { id: "us005-4", text: "Any interaction exceeding 1 second flagged", status: "pending" },
      { id: "us005-5", text: "Scroll performance measured on data-heavy pages — frame rate jank flagged", status: "pending" },
      { id: "us005-6", text: "Lazy-loaded content measured for load delay", status: "pending" },
      { id: "us005-7", text: "Measurements taken with realistic data, not empty states", status: "pending" },
      { id: "us005-8", text: "Results stored with page reference and actual timing values", status: "pending" },
    ],
  },
  {
    id: "us-006",
    code: "US-006",
    title: "Data Integrity Agent — Records & Calculations",
    agent: "Agent 5",
    icon: <Database className="h-4 w-4" />,
    description: "Every calculated value and data relationship verified so that users never see incorrect numbers.",
    items: [
      { id: "us006-1", text: "Every calculated field verified as dynamically computed, not hardcoded", status: "pending" },
      { id: "us006-2", text: "Input values altered and outputs confirmed to update accordingly", status: "pending" },
      { id: "us006-3", text: "All totals, subtotals, percentages, and derived values validated", status: "pending" },
      { id: "us006-4", text: "Related records reference each other correctly", status: "pending" },
      { id: "us006-5", text: "Deleting a parent record handles child records appropriately", status: "pending" },
      { id: "us006-6", text: "Filters produce correct results", status: "pending" },
      { id: "us006-7", text: "Sorting works correctly on all table columns", status: "pending" },
      { id: "us006-8", text: "Search returns accurate matches", status: "pending" },
      { id: "us006-9", text: "Empty states display correctly", status: "pending" },
      { id: "us006-10", text: "Zero values display correctly (not blank or null)", status: "pending" },
      { id: "us006-11", text: "Maximum length inputs handled without breaking display", status: "pending" },
      { id: "us006-12", text: "Special characters in data don't break display", status: "pending" },
    ],
  },
  {
    id: "us-007",
    code: "US-007",
    title: "State Persistence & Resume",
    agent: "Infrastructure",
    icon: <Save className="h-4 w-4" />,
    description: "The Ralph loop persists state so that timeouts never lose progress and the system picks up where it left off.",
    items: [
      { id: "us007-1", text: "State stored: run ID, timestamp, current agent, element inventory, per-agent progress, per-agent findings, ship-ready status", status: "pending" },
      { id: "us007-2", text: "Each iteration reads state on startup and writes updated state on completion", status: "pending" },
      { id: "us007-3", text: "After a timeout, the next invocation resumes from exactly where it stopped", status: "pending" },
      { id: "us007-4", text: "No duplicate testing of already-checked elements after resume", status: "pending" },
      { id: "us007-5", text: "Final state includes complete report of all findings across all agents", status: "pending" },
    ],
  },
];

export function QaPrdTab() {
  const [expandedStories, setExpandedStories] = React.useState<Set<string>>(
    new Set(QA_USER_STORIES.map((s) => s.id))
  );

  const toggleStory = (id: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calculate summary stats
  const totalItems = QA_USER_STORIES.reduce((sum, s) => sum + s.items.length, 0);
  const passedItems = QA_USER_STORIES.reduce(
    (sum, s) => sum + s.items.filter((i) => i.status === "passed").length,
    0
  );
  const failedItems = QA_USER_STORIES.reduce(
    (sum, s) => sum + s.items.filter((i) => i.status === "failed").length,
    0
  );
  const inProgressItems = QA_USER_STORIES.reduce(
    (sum, s) => sum + s.items.filter((i) => i.status === "in_progress").length,
    0
  );
  const pendingItems = totalItems - passedItems - failedItems - inProgressItems;
  const completionPercent = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Checks</p>
            <p className="text-2xl font-bold font-mono">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Passed</p>
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{passedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{failedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold font-mono text-yellow-600 dark:text-yellow-400">{inProgressItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold font-mono text-muted-foreground">{pendingItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">QA Completion</p>
            <p className="text-sm text-muted-foreground font-mono">{completionPercent}%</p>
          </div>
          <Progress value={completionPercent} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {passedItems} of {totalItems} acceptance criteria passed across {QA_USER_STORIES.length} user stories
          </p>
        </CardContent>
      </Card>

      {/* User Stories */}
      <div className="space-y-3">
        {QA_USER_STORIES.map((story) => {
          const storyPassed = story.items.filter((i) => i.status === "passed").length;
          const storyFailed = story.items.filter((i) => i.status === "failed").length;
          const storyTotal = story.items.length;
          const storyPercent = storyTotal > 0 ? Math.round((storyPassed / storyTotal) * 100) : 0;
          const isExpanded = expandedStories.has(story.id);

          return (
            <Card key={story.id}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleStory(story.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="p-1.5 rounded-md bg-muted shrink-0">
                  {story.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">{story.code}</Badge>
                    <p className="font-medium text-sm truncate">{story.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{story.agent} — {story.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-mono">
                      <span className="text-green-600 dark:text-green-400">{storyPassed}</span>
                      {storyFailed > 0 && (
                        <span className="text-red-600 dark:text-red-400"> / {storyFailed} fail</span>
                      )}
                      <span className="text-muted-foreground"> / {storyTotal}</span>
                    </p>
                  </div>
                  <div className="w-16">
                    <Progress value={storyPercent} className="h-1.5" />
                  </div>
                  {storyPassed === storyTotal && storyTotal > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : storyFailed > 0 ? (
                    <Circle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/30" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t">
                  <table className="w-full">
                    <tbody>
                      {story.items.map((item) => (
                        <tr
                          key={item.id}
                          className={cn(
                            "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                            item.status === "failed" && "bg-red-50/50 dark:bg-red-950/10"
                          )}
                        >
                          <td className="px-4 py-2.5 w-8">
                            {getStatusIcon(item.status)}
                          </td>
                          <td className="px-2 py-2.5">
                            <p className={cn(
                              "text-sm",
                              item.status === "passed" && "text-muted-foreground line-through",
                              item.status === "pending" && "text-foreground"
                            )}>
                              {item.text}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {getStatusBadge(item.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
