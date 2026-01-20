"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  ExternalLink,
  Play,
  Box,
  Home,
  Camera,
  Palette,
  Users,
  DollarSign,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";

interface Feature {
  id: string;
  title: string;
  description: string;
  status: "done" | "in-progress" | "planned";
  category: "core" | "visualization" | "client" | "integration";
}

const FEATURES: Feature[] = [
  // Core Features
  {
    id: "mcp-bridge",
    title: "MCP Bridge Plugin",
    description: "TCP socket bridge between Claude and Unreal Engine for AI-controlled scene manipulation",
    status: "done",
    category: "core",
  },
  {
    id: "spawn-actors",
    title: "Spawn Actors",
    description: "Create cubes, planes, spheres, lights, cameras via MCP commands",
    status: "done",
    category: "core",
  },
  {
    id: "transform-actors",
    title: "Transform Actors",
    description: "Set position, rotation, scale of any actor in the scene",
    status: "done",
    category: "core",
  },
  {
    id: "pbr-presets",
    title: "PBR Material Presets",
    description: "Apply realistic materials (marble, wood, chrome, porcelain, glass) via presets",
    status: "done",
    category: "core",
  },
  {
    id: "level-management",
    title: "Level Management",
    description: "Open, save, and manage Unreal levels via MCP",
    status: "done",
    category: "core",
  },

  // Visualization Features
  {
    id: "bathroom-demo",
    title: "Bathroom Demo Room",
    description: "First proof-of-concept room with walls, floor, vanity, toilet, shower",
    status: "done",
    category: "visualization",
  },
  {
    id: "megascans-textures",
    title: "Megascans Textures",
    description: "Import photorealistic textures from Quixel Bridge/Fab.com",
    status: "in-progress",
    category: "visualization",
  },
  {
    id: "real-3d-models",
    title: "Real 3D Models",
    description: "Replace placeholder cubes with actual toilet, vanity, shower models",
    status: "planned",
    category: "visualization",
  },
  {
    id: "lumen-lighting",
    title: "Lumen Global Illumination",
    description: "Enable photorealistic lighting with real-time GI and reflections",
    status: "done",
    category: "visualization",
  },
  {
    id: "construction-sequence",
    title: "Construction Sequence",
    description: "Animated build sequence: land → slab → walls → roof → cladding → finishes",
    status: "planned",
    category: "visualization",
  },

  // Client Features
  {
    id: "first-person-walk",
    title: "First-Person Walkthrough",
    description: "Walk through the space in first-person view with WASD controls",
    status: "done",
    category: "client",
  },
  {
    id: "finish-selection",
    title: "Finish Selection UI",
    description: "Click surfaces to choose from tile, stone, timber options",
    status: "planned",
    category: "client",
  },
  {
    id: "price-display",
    title: "Real-time Price Display",
    description: "Show price impact as client selects different finishes",
    status: "planned",
    category: "client",
  },
  {
    id: "vr-support",
    title: "VR Headset Support",
    description: "Walk through in VR for immersive client experience",
    status: "planned",
    category: "client",
  },

  // Integration Features
  {
    id: "job-pdf-import",
    title: "Import from Job PDF Plans",
    description: "Extract dimensions from architectural PDFs to auto-build rooms",
    status: "planned",
    category: "integration",
  },
  {
    id: "teeem-sync",
    title: "TEEEM Job Sync",
    description: "Load job details, BOQ items, and pricebook data into Unreal",
    status: "planned",
    category: "integration",
  },
  {
    id: "selection-to-boq",
    title: "Selections → BOQ/PO",
    description: "Client finish selections automatically update TEEEM BOQ and trigger POs",
    status: "planned",
    category: "integration",
  },
  {
    id: "web-viewer",
    title: "Web-based Viewer",
    description: "Pixel streaming to allow clients to view in browser (no install)",
    status: "planned",
    category: "integration",
  },
];

const STATUS_CONFIG = {
  done: { label: "Done", icon: CheckCircle2, color: "bg-green-500" },
  "in-progress": { label: "In Progress", icon: Clock, color: "bg-yellow-500" },
  planned: { label: "Planned", icon: Circle, color: "bg-muted-foreground" },
};

const CATEGORY_CONFIG = {
  core: { label: "Core MCP", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-200" },
  visualization: { label: "Visualization", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-200" },
  client: { label: "Client Experience", color: "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-200" },
  integration: { label: "TEEEM Integration", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
};

export function UnrealEngineTab() {
  const [serverStatus, setServerStatus] = React.useState<"unknown" | "running" | "stopped">("unknown");
  const [checkingStatus, setCheckingStatus] = React.useState(false);

  const projectPath = "/Users/robertharder/UnrealProjects/unreal-mcp/MCPGameProject 5.7/MCPGameProject.uproject";
  const mcpServerPath = "/Users/robertharder/UnrealProjects/unreal-mcp/Python";

  const checkServerStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch("http://localhost:8765/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ping", params: {} }),
      });
      if (response.ok) {
        setServerStatus("running");
      } else {
        setServerStatus("stopped");
      }
    } catch {
      setServerStatus("stopped");
    } finally {
      setCheckingStatus(false);
    }
  };

  React.useEffect(() => {
    checkServerStatus();
  }, []);

  const doneCount = FEATURES.filter((f) => f.status === "done").length;
  const inProgressCount = FEATURES.filter((f) => f.status === "in-progress").length;
  const plannedCount = FEATURES.filter((f) => f.status === "planned").length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Unreal Engine Integration
          </CardTitle>
          <CardDescription>
            Photorealistic 3D walkthroughs for client finish selection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                // This creates a URL that macOS can open
                window.open(`file://${projectPath}`, "_blank");
              }}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Open Unreal Project
            </Button>

            <Button variant="outline" onClick={checkServerStatus} disabled={checkingStatus}>
              {checkingStatus ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <div className={`h-2 w-2 rounded-full mr-2 ${
                  serverStatus === "running" ? "bg-green-500" :
                  serverStatus === "stopped" ? "bg-red-500" : "bg-muted-foreground"
                }`} />
              )}
              MCP Server: {serverStatus === "running" ? "Connected" : serverStatus === "stopped" ? "Disconnected" : "Unknown"}
            </Button>
          </div>

          {/* Paths */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md font-mono">
            <div><span className="text-muted-foreground/70">Project:</span> {projectPath}</div>
            <div><span className="text-muted-foreground/70">MCP Server:</span> {mcpServerPath}</div>
            <div><span className="text-muted-foreground/70">MCP Port:</span> localhost:8765 → UE:55557</div>
          </div>

          {/* Progress Summary */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{doneCount} Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span>{inProgressCount} In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="h-4 w-4 text-muted-foreground" />
              <span>{plannedCount} Planned</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Roadmap</CardTitle>
          <CardDescription>
            Track progress on Unreal Engine integration features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {(["core", "visualization", "client", "integration"] as const).map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary" className={CATEGORY_CONFIG[category].color}>
                    {CATEGORY_CONFIG[category].label}
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {FEATURES.filter((f) => f.category === category).map((feature) => {
                    const StatusIcon = STATUS_CONFIG[feature.status].icon;
                    return (
                      <div
                        key={feature.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <StatusIcon
                          className={`h-5 w-5 mt-0.5 ${
                            feature.status === "done"
                              ? "text-green-500"
                              : feature.status === "in-progress"
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{feature.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {feature.description}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${
                            feature.status === "done"
                              ? "border-green-500 text-green-600"
                              : feature.status === "in-progress"
                              ? "border-yellow-500 text-yellow-600"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {STATUS_CONFIG[feature.status].label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Commands Reference</CardTitle>
          <CardDescription>Available commands for Claude to control Unreal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm font-mono">
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>get_actors_in_level</span>
              <span className="text-muted-foreground">List all actors</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>spawn_actor</span>
              <span className="text-muted-foreground">Create new actor</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>set_actor_transform</span>
              <span className="text-muted-foreground">Move/rotate/scale</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>set_actor_material</span>
              <span className="text-muted-foreground">Apply material preset</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>set_actor_property</span>
              <span className="text-muted-foreground">Change actor properties</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>open_level / save_level</span>
              <span className="text-muted-foreground">Level management</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span>take_screenshot</span>
              <span className="text-muted-foreground">Capture viewport</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
