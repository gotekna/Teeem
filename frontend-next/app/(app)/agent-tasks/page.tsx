"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import {
  PlayIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

// Types
interface Agent {
  agent_id: string;
  name: string;
  focus: string;
  status_emoji: string;
  total_runs: number;
  success_rate: number;
}

interface Task {
  id: number;
  description: string;
  completed: boolean;
}

interface AgentTasks {
  [agentId: string]: Task[];
}

interface ExportStatus {
  type: "loading" | "success" | "error";
  message: string;
}

// Default instructions for each agent
const defaultInstructions: Record<string, string[]> = {
  "backend-developer": [
    "Create new API endpoint for user preferences",
    "Add migration for new table column",
    "Fix N+1 query in jobs controller",
    "Add validation to Purchase Order model",
    "Create service object for complex business logic",
  ],
  "frontend-developer": [
    "Create new modal component for settings",
    "Add dark mode support to new components",
    "Fix responsive layout on mobile",
    "Add loading state to data table",
    "Create new page for reporting",
  ],
  "production-bug-hunter": [
    "Investigate slow API response times",
    "Debug 500 error on job creation",
    "Check for memory leaks in frontend",
    "Analyze Heroku logs for errors",
    "Fix broken authentication flow",
  ],
  "deploy-manager": [
    "Deploy latest changes to staging",
    "Run database migrations on staging",
    "Check deployment health after push",
    "Verify environment variables are set",
    "Test API endpoints after deployment",
  ],
  "planning-collaborator": [
    "Plan new feature: Advanced reporting",
    "Design database schema for new module",
    "Create architecture diagram for API",
    "Plan refactoring of legacy code",
    "Design UX flow for onboarding",
  ],
  "gantt-bug-hunter": [
    "Run all 12 Gantt visual tests",
    "Verify RULE #9.1 (Timezone compliance)",
    "Check RULE #9.3 (Company Settings)",
    "Test cascade behavior on drag",
    "Verify working days enforcement",
  ],
};

export default function AgentTasksPage() {
  const { confirm } = useConfirm();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTasks>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await api.get<{ data: { success: boolean; data: Agent[] } }>(
        "/agent_definitions"
      );
      if (response?.data?.success) {
        const agentsData = response.data.data;
        setAgents(agentsData);

        // Check localStorage first for saved tasks
        const savedTasks = getStorageItem<AgentTasks | null>(STORAGE_KEYS.AGENT_TASKS, null);

        if (savedTasks) {
          setAgentTasks(savedTasks);
        } else {
          // Initialize with default instructions
          const initialTasks: AgentTasks = {};
          agentsData.forEach((agent) => {
            const instructions = defaultInstructions[agent.agent_id] || [];
            initialTasks[agent.agent_id] = instructions.map((desc, idx) => ({
              id: Date.now() + idx,
              description: desc,
              completed: false,
            }));
          });
          setAgentTasks(initialTasks);
          setStorageItem(STORAGE_KEYS.AGENT_TASKS, initialTasks);
        }
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = (agentId: string) => {
    const newTasks = {
      ...agentTasks,
      [agentId]: [
        ...(agentTasks[agentId] || []),
        {
          id: Date.now(),
          description: "",
          completed: false,
        },
      ],
    };
    setAgentTasks(newTasks);
    setStorageItem(STORAGE_KEYS.AGENT_TASKS, newTasks);
  };

  const updateTask = (agentId: string, taskId: number, description: string) => {
    const newTasks = {
      ...agentTasks,
      [agentId]: agentTasks[agentId].map((task) =>
        task.id === taskId ? { ...task, description } : task
      ),
    };
    setAgentTasks(newTasks);
    setStorageItem(STORAGE_KEYS.AGENT_TASKS, newTasks);
  };

  const toggleTask = (agentId: string, taskId: number) => {
    const newTasks = {
      ...agentTasks,
      [agentId]: agentTasks[agentId].map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    };
    setAgentTasks(newTasks);
    setStorageItem(STORAGE_KEYS.AGENT_TASKS, newTasks);
  };

  const deleteTask = (agentId: string, taskId: number) => {
    const newTasks = {
      ...agentTasks,
      [agentId]: agentTasks[agentId].filter((task) => task.id !== taskId),
    };
    setAgentTasks(newTasks);
    setStorageItem(STORAGE_KEYS.AGENT_TASKS, newTasks);
  };

  const resetToDefaults = async () => {
    if (!(await confirm("Reset all shortcuts to default values? This will delete your custom shortcuts."))) {
      return;
    }

    const initialTasks: AgentTasks = {};
    agents.forEach((agent) => {
      const instructions = defaultInstructions[agent.agent_id] || [];
      initialTasks[agent.agent_id] = instructions.map((desc, idx) => ({
        id: Date.now() + idx,
        description: desc,
        completed: false,
      }));
    });
    setAgentTasks(initialTasks);
    setStorageItem(STORAGE_KEYS.AGENT_TASKS, initialTasks);
  };

  const runAgent = async (agentId: string) => {
    setRunningAgents((prev) => new Set(prev).add(agentId));

    try {
      const tasks = agentTasks[agentId] || [];
      const taskList = tasks.map((t) => `- ${t.description}`).join("\n");

      await api.post(`/agent_definitions/${agentId}/record_run`, {
        status: "success",
        message: `Executed tasks:\n${taskList}`,
        details: {
          task_count: tasks.length,
          completed_count: tasks.filter((t) => t.completed).length,
        },
      });

      // Mark all tasks as completed
      setAgentTasks((prev) => ({
        ...prev,
        [agentId]: prev[agentId].map((task) => ({ ...task, completed: true })),
      }));

      loadAgents();
    } catch (error) {
      console.error(`Failed to run agent ${agentId}:`, error);
      await api.post(`/agent_definitions/${agentId}/record_run`, {
        status: "failure",
        message: String(error),
        details: { error: String(error) },
      });
    } finally {
      setRunningAgents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

  const runAllAgents = async () => {
    const agentIds = agents.map((a) => a.agent_id);
    await Promise.all(agentIds.map((id) => runAgent(id)));
  };

  const saveAndExportToLexicon = async () => {
    setSaving(true);
    setExportStatus({ type: "loading", message: "Saving tasks and updating Lexicon..." });

    try {
      for (const agent of agents) {
        const tasks = agentTasks[agent.agent_id] || [];
        const completedTasks = tasks.filter((t) => t.completed);

        if (completedTasks.length > 0) {
          await api.post("/api/v1/trinity", {
            trinity: {
              category: "lexicon",
              chapter_number: 20,
              chapter_name: "Agent System & Automation",
              title: `Tasks completed by ${agent.name}`,
              entry_type: "dev_note",
              description: `Completed ${completedTasks.length} tasks:\n${completedTasks.map((t) => `- ${t.description}`).join("\n")}`,
            },
          });
        }
      }

      const exportResponse = await api.post<{ data: { success: boolean; total_entries: number } }>(
        "/api/v1/trinity/export_lexicon"
      );

      if (exportResponse?.data?.success) {
        setExportStatus({
          type: "success",
          message: `Lexicon updated! ${exportResponse.data.total_entries} entries exported.`,
        });
      } else {
        setExportStatus({
          type: "error",
          message: "Failed to export Lexicon",
        });
      }

      // Clear completed tasks
      const clearedTasks: AgentTasks = {};
      agents.forEach((agent) => {
        clearedTasks[agent.agent_id] = agentTasks[agent.agent_id].filter((t) => !t.completed);
      });
      setAgentTasks(clearedTasks);
    } catch (error) {
      console.error("Failed to save and export:", error);
      setExportStatus({
        type: "error",
        message: `Error: ${String(error)}`,
      });
    } finally {
      setSaving(false);
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agent Shortcuts</h1>
        <p className="mt-2 text-muted-foreground">
          Edit shortcut instructions for each agent. All changes are saved automatically to your browser.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tip: Type <code className="rounded bg-muted px-2 py-1">/gantt</code>,{" "}
          <code className="rounded bg-muted px-2 py-1">/deploy</code>, etc. in Claude Code
        </p>
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex flex-wrap gap-4">
        <Button onClick={runAllAgents} disabled={runningAgents.size > 0}>
          <PlayIcon className="mr-2 h-5 w-5" />
          Run All Agents
        </Button>

        <Button
          onClick={saveAndExportToLexicon}
          disabled={saving || runningAgents.size > 0}
          variant="secondary"
        >
          {saving ? (
            <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <DocumentTextIcon className="mr-2 h-5 w-5" />
          )}
          Save & Update Lexicon
        </Button>

        <Button onClick={resetToDefaults} variant="outline">
          <ArrowPathIcon className="mr-2 h-5 w-5" />
          Reset to Defaults
        </Button>
      </div>

      {/* Export Status */}
      {exportStatus && (
        <div
          className={`mb-6 rounded-lg p-4 ${
            exportStatus.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
              : exportStatus.type === "error"
              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
          }`}
        >
          {exportStatus.message}
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {agents.map((agent) => {
          const tasks = agentTasks[agent.agent_id] || [];
          const isRunning = runningAgents.has(agent.agent_id);
          const completedCount = tasks.filter((t) => t.completed).length;

          return (
            <Card key={agent.agent_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span>{agent.status_emoji}</span> {agent.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{agent.focus}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addTask(agent.agent_id)}>
                      <PlusIcon className="mr-1 h-4 w-4" />
                      Add
                    </Button>

                    <Button size="sm" onClick={() => runAgent(agent.agent_id)} disabled={isRunning}>
                      {isRunning ? (
                        <ArrowPathIcon className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayIcon className="mr-1 h-4 w-4" />
                      )}
                      Run
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                  <span>Total runs: {agent.total_runs}</span>
                  <span className="text-green-600">Success rate: {Math.round(agent.success_rate)}%</span>
                  <span className="text-blue-600">
                    Tasks: {completedCount}/{tasks.length}
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"
                    >
                      <button onClick={() => toggleTask(agent.agent_id, task.id)} className="flex-shrink-0">
                        {task.completed ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </button>

                      <Input
                        value={task.description}
                        onChange={(e) => updateTask(agent.agent_id, task.id, e.target.value)}
                        placeholder="Enter task description..."
                        className={`flex-1 border-none bg-transparent ${task.completed ? "line-through opacity-50" : ""}`}
                      />

                      <button
                        onClick={() => deleteTask(agent.agent_id, task.id)}
                        className="flex-shrink-0 text-destructive hover:text-destructive/80"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
