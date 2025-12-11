"use client";

import React, { useCallback, useState, useRef, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import { NodePalette } from "./panels/NodePalette";
import { ToolPalette, ToolMode } from "./panels/ToolPalette";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { TriggersPanel } from "./panels/TriggersPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Save,
  Play,
  Settings,
  Zap,
  CheckCircle,
  Upload,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import {
  getLayoutedElements,
  alignNodesHorizontally,
  alignNodesVertically,
} from "./utils/layoutNodes";
import { importBpmnFile } from "./utils/bpmnParser";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { BpmnProcess, BpmnNodeData, BpmnNodeType } from "./types";

interface BpmnDesignerProps {
  process?: Partial<BpmnProcess>;
  onSave: (process: Partial<BpmnProcess>) => Promise<void>;
  onPublish?: (processId: number) => Promise<void>;
}

function getDefaultNodeName(nodeType: BpmnNodeType): string {
  const names: Record<BpmnNodeType, string> = {
    start_event: "Start",
    end_event: "End",
    user_task: "User Task",
    service_task: "Service Task",
    exclusive_gateway: "Decision",
    parallel_gateway: "Parallel",
    timer_event: "Timer",
    data_store_reference: "Data Store",
    intermediate_event: "Intermediate Event",
    sub_process: "Sub-Process",
    annotation: "Note",
    pool: "Pool",
    lane: "Lane",
  };
  return names[nodeType] || "Node";
}

function getDefaultNodeConfig(nodeType: BpmnNodeType): Record<string, unknown> {
  const configs: Record<BpmnNodeType, Record<string, unknown>> = {
    start_event: {},
    end_event: {},
    user_task: { assignee_type: "role", assignee_value: "" },
    service_task: { task_type: "" },
    exclusive_gateway: {},
    parallel_gateway: {},
    timer_event: { duration: "PT1H" },
    data_store_reference: {},
    intermediate_event: { eventType: "message", isThrowing: false },
    sub_process: { isExpanded: false },
    annotation: {},
    pool: {},
    lane: {},
  };
  return configs[nodeType] || {};
}

function BpmnDesignerInner({ process, onSave, onPublish }: BpmnDesignerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();

  // Convert process data to React Flow format
  const initialNodes: Node<BpmnNodeData>[] = (process?.nodes || []).map((n) => ({
    id: n.nodeKey || n.id,
    type: n.nodeType,
    position: n.position || { x: 0, y: 0 },
    data: {
      nodeKey: n.nodeKey || n.id,
      nodeType: n.nodeType,
      name: n.name,
      description: n.description,
      config: n.config || {},
    },
  }));

  const initialEdges: Edge[] = (process?.edges || []).map((e) => ({
    id: e.edgeKey || e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: !!e.conditionExpression,
    label: e.name,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: e.conditionExpression ? "#3b82f6" : "#64748b",
    },
    style: {
      strokeWidth: 2,
      stroke: e.conditionExpression ? "#3b82f6" : "#64748b",
    },
    data: {
      edgeKey: e.edgeKey || e.id,
      name: e.name,
      conditionExpression: e.conditionExpression,
      isDefault: e.isDefault,
    },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [processName, setProcessName] = useState(process?.name || "New Process");
  const [selectedNode, setSelectedNode] = useState<Node<BpmnNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [activePanel, setActivePanel] = useState<"properties" | "triggers">("properties");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("select");

  // Track selected nodes for alignment tools
  const selectedNodeIds = useMemo(
    () => nodes.filter((n) => n.selected).map((n) => n.id),
    [nodes]
  );

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const imported = await importBpmnFile(file);

      // Convert to React Flow nodes
      const newNodes: Node<BpmnNodeData>[] = imported.nodes.map((n) => ({
        id: n.nodeKey,
        type: n.nodeType,
        position: n.position,
        data: {
          nodeKey: n.nodeKey,
          nodeType: n.nodeType,
          name: n.name,
          description: n.description,
          config: n.config || {},
        },
      }));

      // Convert to React Flow edges
      const newEdges: Edge[] = imported.edges.map((e) => ({
        id: e.edgeKey,
        source: e.source,
        target: e.target,
        type: e.conditionExpression ? "smoothstep" : "default",
        animated: !!e.conditionExpression,
        label: e.name,
        data: {
          edgeKey: e.edgeKey,
          name: e.name,
          conditionExpression: e.conditionExpression,
          isDefault: e.isDefault,
        },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setProcessName(imported.name);

      toast({ title: "Success", description: `Imported ${newNodes.length} nodes and ${newEdges.length} edges` });
    } catch (error) {
      console.error("Import failed:", error);
      toast({ title: "Error", description: "Failed to import BPMN file", variant: "destructive" });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: "#64748b",
        },
        style: {
          strokeWidth: 2,
          stroke: "#64748b",
        },
        data: {
          edgeKey: `edge_${Date.now()}`,
          isDefault: false,
        },
      } as Edge;
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData("application/bpmn-node") as BpmnNodeType;
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeKey = `${nodeType}_${Date.now()}`;
      const newNode: Node<BpmnNodeData> = {
        id: nodeKey,
        type: nodeType,
        position,
        data: {
          nodeKey,
          nodeType,
          name: getDefaultNodeName(nodeType),
          config: getDefaultNodeConfig(nodeType),
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  const handleNodeSelect = useCallback(
    (_: React.MouseEvent, node: Node<BpmnNodeData>) => {
      setSelectedNode(node);
      setSelectedEdge(null);
    },
    []
  );

  const handleEdgeSelect = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<BpmnNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      // Update selected node reference
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      );
    },
    [setNodes]
  );

  const handleEdgeUpdate = useCallback(
    (edgeId: string, data: Record<string, unknown>) => {
      const hasCondition = !!data.conditionExpression;
      const edgeColor = hasCondition ? "#3b82f6" : "#64748b";
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: { ...edge.data, ...data },
                label: data.name as string,
                animated: hasCondition,
                style: {
                  strokeWidth: 2,
                  stroke: edgeColor,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                  color: edgeColor,
                },
              }
            : edge
        )
      );
    },
    [setEdges]
  );

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = getLayoutedElements(nodes, edges, {
      direction: "LR",
      nodeSpacing: 120,
      rankSpacing: 180,
    });
    setNodes(layoutedNodes);
    toast({
      title: "Layout applied",
      description: "Nodes have been automatically arranged",
    });
  }, [nodes, edges, setNodes]);

  const handleAlignHorizontal = useCallback(() => {
    if (selectedNodeIds.length < 2) return;
    const aligned = alignNodesHorizontally(nodes, selectedNodeIds);
    setNodes(aligned);
    toast({
      title: "Aligned",
      description: `${selectedNodeIds.length} nodes aligned horizontally`,
    });
  }, [nodes, selectedNodeIds, setNodes]);

  const handleAlignVertical = useCallback(() => {
    if (selectedNodeIds.length < 2) return;
    const aligned = alignNodesVertically(nodes, selectedNodeIds);
    setNodes(aligned);
    toast({
      title: "Aligned",
      description: `${selectedNodeIds.length} nodes aligned vertically`,
    });
  }, [nodes, selectedNodeIds, setNodes]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  // Keyboard shortcuts for tools and zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "v" || e.key === "V") {
        setToolMode("select");
      } else if (e.key === "h" || e.key === "H") {
        setToolMode("pan");
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleFitView();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleFitView]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const viewport = getViewport();

      const processData: Partial<BpmnProcess> = {
        id: process?.id,
        name: processName,
        canvasData: { viewport },
        nodes: nodes.map((n) => ({
          id: n.id,
          nodeKey: n.data.nodeKey,
          nodeType: n.data.nodeType,
          name: n.data.name,
          description: n.data.description,
          config: n.data.config,
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          edgeKey: (e.data?.edgeKey as string) || e.id,
          source: e.source,
          target: e.target,
          name: e.data?.name as string | undefined,
          conditionExpression: e.data?.conditionExpression as string | undefined,
          isDefault: e.data?.isDefault as boolean | undefined,
        })),
        triggers: process?.triggers || [],
      };

      await onSave(processData);
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, processName, process, getViewport, onSave]);

  const handlePublish = useCallback(async () => {
    if (!onPublish || !process?.id) return;

    setPublishing(true);
    try {
      await onPublish(process.id);
    } finally {
      setPublishing(false);
    }
  }, [onPublish, process?.id]);

  return (
    <div className="flex h-full border-4 border-blue-500 bg-blue-50/20">
      {/* UI DEBUG LABEL */}
      <div className="absolute top-2 left-2 z-50 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded shadow-lg">
        [1] MAIN CONTAINER (BLUE) - flex h-full
      </div>

      {/* Left Panel - Tools & Node Palette */}
      <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-4 border-green-500 bg-green-50/50 p-4 dark:bg-green-900/20">
        <div className="bg-green-600 text-white px-2 py-1 text-xs font-bold mb-2 rounded">
          [2] LEFT PANEL (GREEN) - w-64 flex-shrink-0
        </div>
        <ToolPalette
          toolMode={toolMode}
          onToolModeChange={setToolMode}
          selectedNodeIds={selectedNodeIds}
          onAlignHorizontal={handleAlignHorizontal}
          onAlignVertical={handleAlignVertical}
        />
        <NodePalette />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 border-4 border-purple-500 bg-purple-50/20 relative" ref={reactFlowWrapper}>
        <div className="absolute top-2 left-2 z-50 bg-purple-600 text-white px-3 py-1 text-xs font-bold rounded shadow-lg">
          [3] CANVAS (PURPLE) - flex-1
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeSelect}
          onEdgeClick={handleEdgeSelect}
          onPaneClick={handlePaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          defaultViewport={process?.canvasData?.viewport}
          deleteKeyCode={["Backspace", "Delete"]}
          snapToGrid={true}
          snapGrid={[20, 20]}
          panOnDrag={toolMode === "pan"}
          selectionOnDrag={toolMode === "select"}
          selectionMode={SelectionMode.Partial}
          className="bg-slate-100 dark:bg-slate-950"
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-white dark:!bg-slate-900"
          />

          {/* Top Toolbar */}
          <Panel position="top-center">
            <div className="flex items-center gap-3 rounded-lg border-4 border-yellow-500 bg-yellow-50 p-2 shadow-lg dark:bg-yellow-900/20 relative">
              <div className="absolute -top-8 left-0 bg-yellow-600 text-white px-2 py-1 text-xs font-bold rounded">
                [4] TOP TOOLBAR (YELLOW) - Panel position="top-center"
              </div>
              <Input
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                className="w-64 border-0 bg-transparent text-center font-medium focus-visible:ring-0"
                placeholder="Process name..."
              />

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

              {/* Hidden file input for BPMN import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".bpmn,.xml"
                onChange={handleImport}
                className="hidden"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importing..." : "Import"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoLayout}
                title="Auto-arrange nodes"
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Layout
              </Button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  title="Zoom out (-)"
                  className="h-8 w-8 p-0"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitView}
                  title="Fit to view (0)"
                  className="h-8 w-8 p-0"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  title="Zoom in (+)"
                  className="h-8 w-8 p-0"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>

              {onPublish && process?.id && (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing || process.isPublished}
                  className={cn(
                    process.isPublished &&
                      "bg-green-600 hover:bg-green-600"
                  )}
                >
                  {process.isPublished ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Published
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      {publishing ? "Publishing..." : "Publish"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </Panel>

          {/* Status indicator */}
          {process?.isPublished && (
            <Panel position="top-right">
              <div className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Published
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-80 flex-shrink-0 border-l border-4 border-orange-500 bg-orange-50/50 dark:bg-orange-900/20 relative">
        <div className="bg-orange-600 text-white px-2 py-1 text-xs font-bold rounded m-2">
          [5] RIGHT PANEL (ORANGE) - w-80 flex-shrink-0
        </div>
        <Tabs
          value={activePanel}
          onValueChange={(v) => setActivePanel(v as typeof activePanel)}
        >
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="properties" className="flex-1">
              <Settings className="mr-2 h-4 w-4" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="triggers" className="flex-1">
              <Zap className="mr-2 h-4 w-4" />
              Triggers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="p-4">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onNodeUpdate={handleNodeUpdate}
              onEdgeUpdate={handleEdgeUpdate}
            />
          </TabsContent>

          <TabsContent value="triggers" className="p-4">
            <TriggersPanel processId={process?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function BpmnDesigner(props: BpmnDesignerProps) {
  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <BpmnDesignerInner {...props} />
      </ReactFlowProvider>
    </TooltipProvider>
  );
}
