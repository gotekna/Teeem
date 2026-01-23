"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Terminal,
  Sparkles,
  RefreshCw,
  Play,
  Copy,
  Check,
} from "lucide-react";
import { copyToClipboard } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentDefinition {
  id: number;
  agent_id: string;
  name: string;
  purpose: string | null;
  agent_type: string;
  focus: string;
  model: string;
  category: string;
  command: string;
  active: boolean;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run_at: string | null;
  last_status: string | null;
  updated_at: string;
  created_at: string;
  status_emoji: string;
  success_rate: number;
  health_status: "healthy" | "warning" | "broken" | "deprecated";
  days_since_last_run: number | null;
}

interface Stats {
  total: number;
  agents: number;
  commands: number;
  skills: number;
}

export function AgentsTab() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category", categoryFilter);

      const response = await api.get<{
        success: boolean;
        data: AgentDefinition[];
        stats: Stats;
      }>(`/api/v1/agent_definitions?${params.toString()}`);

      if (response?.success) {
        setAgents(response.data);
        setStats(response.stats);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const syncAgents = async () => {
    try {
      setSyncing(true);
      const response = await api.post<{
        success: boolean;
        message: string;
        stats: { agents: number; commands: number; skills: number };
      }>("/api/v1/agent_definitions/sync");

      if (response?.success) {
        toast({
          title: "Sync Complete",
          description: response.message,
        });
        loadData();
      }
    } catch (err) {
      console.error("Failed to sync agents:", err);
      toast({
        title: "Sync Failed",
        description: "Failed to sync agents from files",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const copyCommand = (command: string) => {
    copyToClipboard(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCategoryBadge = (category: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "outline"; className?: string; icon: React.ReactNode }
    > = {
      agent: {
        variant: "default",
        className: "bg-blue-500 hover:bg-blue-600",
        icon: <Bot className="h-3 w-3 mr-1" />,
      },
      command: {
        variant: "secondary",
        className: "bg-purple-500 hover:bg-purple-600 text-white",
        icon: <Terminal className="h-3 w-3 mr-1" />,
      },
      skill: {
        variant: "outline",
        className: "bg-green-500 hover:bg-green-600 text-white border-green-500",
        icon: <Sparkles className="h-3 w-3 mr-1" />,
      },
    };
    const { variant, className, icon } = config[category] || {
      variant: "outline" as const,
      icon: null,
    };
    return (
      <Badge variant={variant} className={className}>
        {icon}
        {category}
      </Badge>
    );
  };

  const getHealthBadge = (health: AgentDefinition["health_status"]) => {
    const config: Record<
      AgentDefinition["health_status"],
      { variant: "default" | "secondary" | "outline" | "destructive"; className?: string; label: string }
    > = {
      healthy: {
        variant: "outline",
        className: "border-green-500 text-green-600 dark:text-green-400",
        label: "Healthy",
      },
      warning: {
        variant: "outline",
        className: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
        label: "Stale",
      },
      broken: {
        variant: "destructive",
        className: "",
        label: "Broken",
      },
      deprecated: {
        variant: "secondary",
        className: "opacity-50",
        label: "Deprecated",
      },
    };
    const { variant, className, label } = config[health] || config.warning;
    return (
      <Badge variant={variant} className={className}>
        {label}
      </Badge>
    );
  };

  const formatRelativeDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-AU");
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadData} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Claude Code Agents</h2>
          <p className="text-muted-foreground text-sm">
            Manage Claude Code agents, commands, and skills
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={syncAgents} size="sm" disabled={syncing}>
            <Play className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Files"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.agents}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.commands}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-500 dark:text-green-400" />
                Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.skills}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="command">Commands</SelectItem>
            <SelectItem value="skill">Skills</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents ({agents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Last Ran</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="max-w-xs">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No agents found. Click "Sync from Files" to import agents.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <span className="mr-1">{agent.status_emoji}</span>
                      {agent.name}
                    </TableCell>
                    <TableCell>{getHealthBadge(agent.health_status)}</TableCell>
                    <TableCell>{getCategoryBadge(agent.category)}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-mono text-xs h-7 px-2"
                              onClick={() => copyCommand(agent.command)}
                            >
                              {agent.command}
                              {copiedCommand === agent.command ? (
                                <Check className="h-3 w-3 ml-1 text-green-500 dark:text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3 ml-1 opacity-50" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Click to copy</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeDate(agent.updated_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeDate(agent.last_run_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.total_runs > 0 ? (
                        <span>
                          {agent.total_runs}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({agent.success_rate}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span
                        className="truncate block"
                        title={agent.purpose || ""}
                      >
                        {agent.purpose || (
                          <span className="text-muted-foreground italic">
                            No description
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
