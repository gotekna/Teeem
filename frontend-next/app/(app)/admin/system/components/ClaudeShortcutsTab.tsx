"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Plus,
  Loader2,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Search,
  Zap,
  MessageSquare,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface AgentCommand {
  id: number;
  command: string;
  shortcut: string;
  lastUpdated?: string;
  updatedBy?: string;
}

interface SlangEntry {
  id: number;
  shortcut: string;
  meaning: string;
  lastUpdated?: string;
  updatedBy?: string;
}

const DEFAULT_COMMANDS: AgentCommand[] = [
  { id: 1, command: "Run all agents in parallel", shortcut: "/all-agents, /ag, allagent, all agents" },
  { id: 2, command: "Run Backend Developer agent", shortcut: "/backend, backend dev, backend" },
  { id: 3, command: "Run Frontend Developer agent", shortcut: "/frontend, frontend dev, frontend" },
  { id: 4, command: "Run Production Bug Hunter agent", shortcut: "/bug-hunter, bug hunter, run prod-bug" },
  { id: 5, command: "Run Deploy Manager agent", shortcut: "/deploy, deploy, deployment" },
  { id: 6, command: "Run Planning Collaborator agent", shortcut: "/plan, planning, run planner" },
  { id: 7, command: "Run Gantt Bug Hunter agent", shortcut: "/gantt, gantt, gantt bug hunter" },
  { id: 8, command: "Run Trinity Sync Validator agent", shortcut: "/trinity, trinity, trinity sync" },
  { id: 9, command: "Run UI Compliance Auditor agent", shortcut: "/ui-audit, ui audit, ui compliance" },
  { id: 10, command: "Read Bible chapter and get development rules", shortcut: "/bible" },
  { id: 11, command: "Search Lexicon database for bugs and architecture", shortcut: "/lexicon" },
  { id: 12, command: "Work on feature by chapter number (reads Bible + Lexicon)", shortcut: "/chapter" },
  { id: 13, command: "Fix bug with proper Lexicon documentation", shortcut: "/fix-bug" },
  { id: 14, command: "Run tests with auto-debug on failures", shortcut: "/test" },
  { id: 15, command: "Create git commit with conventional format", shortcut: "/commit" },
  { id: 16, command: "Get comprehensive project status report", shortcut: "/status" },
  { id: 17, command: "Export Lexicon database to markdown file", shortcut: "/export-lexicon" },
  { id: 18, command: "Update Bible (Unified Bible update workflow)", shortcut: "/ub" },
];

const DEFAULT_SLANG: SlangEntry[] = [
  { id: 1, shortcut: "sm", meaning: "Schedule Master" },
  { id: 2, shortcut: "po", meaning: "Purchase Order" },
  { id: 3, shortcut: "est", meaning: "Estimate" },
  { id: 4, shortcut: "inv", meaning: "Invoice" },
  { id: 5, shortcut: "sup", meaning: "Supplier" },
  { id: 6, shortcut: "cont", meaning: "Contact" },
  { id: 7, shortcut: "pb", meaning: "Price Book" },
  { id: 8, shortcut: "wf", meaning: "Workflow" },
  { id: 9, shortcut: "gantt", meaning: "Gantt Chart" },
  { id: 10, shortcut: "sched", meaning: "Schedule" },
];

export function ClaudeShortcutsTab() {
  const { toast } = useToast();
  const [commands, setCommands] = React.useState<AgentCommand[]>([]);
  const [slang, setSlang] = React.useState<SlangEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isEditingCommands, setIsEditingCommands] = React.useState(false);
  const [isEditingSlang, setIsEditingSlang] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [searchCommands, setSearchCommands] = React.useState("");
  const [searchSlang, setSearchSlang] = React.useState("");

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Try to load from API
      const response = await api.get<{ data: AgentCommand[] }>("/api/v1/agents/shortcuts");
      setCommands(response.data || DEFAULT_COMMANDS);
    } catch (error) {
      // Fallback to localStorage or defaults
      const savedCommands = localStorage.getItem("claudeCommands");
      const savedSlang = localStorage.getItem("claudeSlang");

      setCommands(savedCommands ? JSON.parse(savedCommands) : DEFAULT_COMMANDS);
      setSlang(savedSlang ? JSON.parse(savedSlang) : DEFAULT_SLANG);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUser = () => {
    try {
      const user = localStorage.getItem("user");
      if (user) {
        const userData = JSON.parse(user);
        return userData.email || userData.name || "User";
      }
    } catch {
      return "User";
    }
    return "User";
  };

  const updateCommand = (id: number, field: "command" | "shortcut", value: string) => {
    const updated = commands.map((c) =>
      c.id === id
        ? { ...c, [field]: value, lastUpdated: new Date().toISOString(), updatedBy: getCurrentUser() }
        : c
    );
    setCommands(updated);
    localStorage.setItem("claudeCommands", JSON.stringify(updated));
  };

  const addCommand = () => {
    const newCommand: AgentCommand = {
      id: Date.now(),
      command: "",
      shortcut: "",
      lastUpdated: new Date().toISOString(),
      updatedBy: getCurrentUser(),
    };
    const updated = [...commands, newCommand];
    setCommands(updated);
    localStorage.setItem("claudeCommands", JSON.stringify(updated));
  };

  const deleteCommand = (id: number) => {
    const updated = commands.filter((c) => c.id !== id);
    setCommands(updated);
    localStorage.setItem("claudeCommands", JSON.stringify(updated));
  };

  const updateSlang = (id: number, field: "shortcut" | "meaning", value: string) => {
    const updated = slang.map((s) =>
      s.id === id
        ? { ...s, [field]: value, lastUpdated: new Date().toISOString(), updatedBy: getCurrentUser() }
        : s
    );
    setSlang(updated);
    localStorage.setItem("claudeSlang", JSON.stringify(updated));
  };

  const addSlang = () => {
    const newSlang: SlangEntry = {
      id: Date.now(),
      shortcut: "",
      meaning: "",
      lastUpdated: new Date().toISOString(),
      updatedBy: getCurrentUser(),
    };
    const updated = [...slang, newSlang];
    setSlang(updated);
    localStorage.setItem("claudeSlang", JSON.stringify(updated));
  };

  const deleteSlang = (id: number) => {
    const updated = slang.filter((s) => s.id !== id);
    setSlang(updated);
    localStorage.setItem("claudeSlang", JSON.stringify(updated));
  };

  const resetCommands = () => {
    if (!confirm("Reset all commands to default values? This cannot be undone.")) return;
    setCommands(DEFAULT_COMMANDS);
    localStorage.setItem("claudeCommands", JSON.stringify(DEFAULT_COMMANDS));
    toast({ title: "Success", description: "Commands reset to defaults" });
  };

  const resetSlang = () => {
    if (!confirm("Reset all slang to default values? This cannot be undone.")) return;
    setSlang(DEFAULT_SLANG);
    localStorage.setItem("claudeSlang", JSON.stringify(DEFAULT_SLANG));
    toast({ title: "Success", description: "Slang reset to defaults" });
  };

  const exportCommands = () => {
    const blob = new Blob([JSON.stringify(commands, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "claude-commands.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSlang = () => {
    const blob = new Blob([JSON.stringify(slang, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "claude-slang.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(searchCommands.toLowerCase()) ||
      cmd.shortcut.toLowerCase().includes(searchCommands.toLowerCase())
  );

  const filteredSlang = slang.filter(
    (s) =>
      s.shortcut.toLowerCase().includes(searchSlang.toLowerCase()) ||
      s.meaning.toLowerCase().includes(searchSlang.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Claude Code Shortcuts</h2>
        <p className="text-sm text-muted-foreground">
          Manage commands (what Claude executes) and slang (quick shortcuts like "sm" for Schedule Master)
        </p>
      </div>

      {/* Agent Info Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <Zap className="h-5 w-5" />
            What Each Agent Does
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-purple-500">
              <h4 className="font-semibold text-purple-700 dark:text-purple-400">Backend Developer</h4>
              <p className="text-muted-foreground">Rails API, database, models, controllers</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">Frontend Developer</h4>
              <p className="text-muted-foreground">React/Next.js, components, styling</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-red-500">
              <h4 className="font-semibold text-red-700 dark:text-red-400">Bug Hunter</h4>
              <p className="text-muted-foreground">Production errors, Sentry, debugging</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-green-500">
              <h4 className="font-semibold text-green-700 dark:text-green-400">Deploy Manager</h4>
              <p className="text-muted-foreground">Heroku, Vercel, git subtree deploys</p>
            </div>
          </div>

          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-4 flex items-start gap-2">
              <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Pro Tip:</strong> You can customize these shortcuts in the tables below! Add new agents, change trigger words, or create your own workflow automations.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Commands Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Agent Shortcuts
            <span className="text-sm font-normal text-muted-foreground">
              (Commands to trigger agents)
            </span>
          </h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={searchCommands}
              onChange={(e) => setSearchCommands(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {!isEditingCommands ? (
              <Button onClick={() => setIsEditingCommands(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Edit Commands
              </Button>
            ) : (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    setIsEditingCommands(false);
                    toast({ title: "Success", description: "Commands saved" });
                  }}
                >
                  Save
                </Button>
                <Button variant="outline" onClick={() => setIsEditingCommands(false)}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={addCommand}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
                <Button variant="outline" onClick={resetCommands}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" onClick={exportCommands}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Command (What user types)</TableHead>
                    <TableHead>Action (What Claude executes)</TableHead>
                    <TableHead>Last Updated</TableHead>
                    {isEditingCommands && <TableHead className="w-16">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommands.map((cmd) => (
                    <TableRow key={cmd.id}>
                      <TableCell>
                        {isEditingCommands ? (
                          <Input
                            value={cmd.shortcut}
                            onChange={(e) => updateCommand(cmd.id, "shortcut", e.target.value)}
                            placeholder="e.g., /deploy, gantt, backend dev"
                            className="font-mono"
                          />
                        ) : (
                          <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                            {cmd.shortcut || <span className="text-muted-foreground italic">No command</span>}
                          </code>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditingCommands ? (
                          <Input
                            value={cmd.command}
                            onChange={(e) => updateCommand(cmd.id, "command", e.target.value)}
                            placeholder="What Claude executes..."
                          />
                        ) : (
                          cmd.command || <span className="text-muted-foreground italic">No action</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(cmd.lastUpdated)}
                        {cmd.updatedBy && (
                          <>
                            <br />
                            by {cmd.updatedBy}
                          </>
                        )}
                      </TableCell>
                      {isEditingCommands && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteCommand(cmd.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          Showing {filteredCommands.length} of {commands.length} commands
          {searchCommands && " (filtered)"}
        </p>
      </div>

      {/* Slang Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            Slang
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (Quick shortcuts like "sm" for Schedule Master)
            </span>
          </h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search slang..."
              value={searchSlang}
              onChange={(e) => setSearchSlang(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {!isEditingSlang ? (
              <Button onClick={() => setIsEditingSlang(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Edit Slang
              </Button>
            ) : (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    setIsEditingSlang(false);
                    toast({ title: "Success", description: "Slang saved" });
                  }}
                >
                  Save
                </Button>
                <Button variant="outline" onClick={() => setIsEditingSlang(false)}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={addSlang}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
                <Button variant="outline" onClick={resetSlang}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" onClick={exportSlang}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shortcut (What user types)</TableHead>
                    <TableHead>Meaning</TableHead>
                    <TableHead>Last Updated</TableHead>
                    {isEditingSlang && <TableHead className="w-16">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSlang.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {isEditingSlang ? (
                          <Input
                            value={s.shortcut}
                            onChange={(e) => updateSlang(s.id, "shortcut", e.target.value)}
                            placeholder="Shortcut (e.g., sm)..."
                          />
                        ) : (
                          s.shortcut || <span className="text-muted-foreground italic">No shortcut</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditingSlang ? (
                          <Input
                            value={s.meaning}
                            onChange={(e) => updateSlang(s.id, "meaning", e.target.value)}
                            placeholder="What it means..."
                          />
                        ) : (
                          s.meaning || <span className="text-muted-foreground italic">No meaning</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.lastUpdated)}
                        {s.updatedBy && (
                          <>
                            <br />
                            by {s.updatedBy}
                          </>
                        )}
                      </TableCell>
                      {isEditingSlang && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteSlang(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          Showing {filteredSlang.length} of {slang.length} slang shortcuts
          {searchSlang && " (filtered)"}
        </p>
      </div>
    </div>
  );
}
