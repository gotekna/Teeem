"use client";

import React, { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Position,
  MarkerType,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, User, Network, Briefcase, Maximize2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Extended data for ownership chain
interface OwnershipNode {
  company_id: number;
  company_name: string;
  percentage: number;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  trust_id?: number;
  trust_entity_type?: string;
  children?: OwnershipNode[];
}

interface DirectorRole {
  company_id: number;
  company_name: string;
  position?: string;
  is_current?: boolean;
}

interface PersonStructureChartProps {
  personName: string;
  personEmail?: string | null;
  ownershipChain: OwnershipNode[];
  directorRoles?: DirectorRole[];
  onCompanyClick?: (companyId: number) => void;
  showFullDetail?: boolean;
  onToggleFullDetail?: () => void;
  fullscreen?: boolean;
}

// Person node component - matches styling from CorporateStructureChart
function PersonNode({ data }: { data: { label: string; email?: string | null; isFullscreen?: boolean } }) {
  const { label, email, isFullscreen } = data;

  return (
    <div className={`rounded-lg border-2 shadow-lg bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 ${
      isFullscreen ? "min-w-[280px] max-w-[350px]" : "min-w-[200px] max-w-[280px]"
    }`}>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />

      {/* Header */}
      <div className={`rounded-t-md flex items-center gap-3 bg-amber-100 dark:bg-amber-900/50 ${
        isFullscreen ? "px-6 py-5" : "px-5 py-4"
      }`}>
        <User className={`${isFullscreen ? "h-7 w-7" : "h-5 w-5"} text-amber-600`} />
        <span className={`font-bold ${isFullscreen ? "text-xl" : "text-lg"}`}>{label}</span>
      </div>

      {/* Body */}
      {email && (
        <div className={`${isFullscreen ? "px-6 py-4 text-base" : "px-5 py-3 text-sm"} text-muted-foreground`}>
          {email}
        </div>
      )}
    </div>
  );
}

// Trust node component
function TrustNode({ data }: { data: { label: string; entityType: string; onClick?: () => void } }) {
  const isSuperFund = data.entityType?.toLowerCase() === "superfund";

  return (
    <div
      className="min-w-[180px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700"
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-rose-500" />

      <div className="px-4 py-3 rounded-md flex items-center gap-2 bg-rose-100 dark:bg-rose-900/50">
        <Network className="h-5 w-5 text-rose-600" />
        <div>
          <div className="font-semibold text-rose-800 dark:text-rose-200 text-sm">{data.label}</div>
          <div className="text-xs text-rose-600 dark:text-rose-400">{isSuperFund ? "Superfund" : "Trust"}</div>
        </div>
      </div>
    </div>
  );
}

// Company node component - matches EntityNode style from CorporateStructureChart
function CompanyNode({ data }: { data: CompanyNodeData }) {
  const { label, isTrustee, trustName, trustEntityType, onClick, isFullscreen, positions, shareholding } = data;

  const isSuperFund = trustEntityType?.toLowerCase() === "superfund";
  const isTrust = trustEntityType?.toLowerCase() === "trust" || isSuperFund;

  // Get background color based on entity type
  const getBackgroundColor = () => {
    if (isTrust && !isTrustee) {
      return "bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700";
    }
    if (isTrustee) {
      return "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700";
    }
    return "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700";
  };

  const getHeaderColor = () => {
    if (isTrust && !isTrustee) {
      return "bg-rose-100 dark:bg-rose-900/50";
    }
    if (isTrustee) {
      return "bg-indigo-100 dark:bg-indigo-900/50";
    }
    return "bg-blue-100 dark:bg-blue-900/50";
  };

  const getIcon = () => {
    const iconSize = isFullscreen ? "h-6 w-6" : "h-4 w-4";
    if (isTrust && !isTrustee) {
      return <Network className={`${iconSize} text-rose-600`} />;
    }
    if (isTrustee) {
      return <Briefcase className={`${iconSize} text-indigo-600`} />;
    }
    return <Building2 className={`${iconSize} text-blue-600`} />;
  };

  return (
    <div
      className={`rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
        isFullscreen ? "min-w-[280px] max-w-[350px]" : "min-w-[200px] max-w-[280px]"
      } ${getBackgroundColor()}`}
      onClick={onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />

      {/* Header */}
      <div className={`rounded-t-md flex items-center gap-2 ${
        isFullscreen ? "px-5 py-4" : "px-3 py-2"
      } ${getHeaderColor()}`}>
        {getIcon()}
        <span className={`font-semibold truncate ${isFullscreen ? "text-lg" : "text-sm"}`}>{label}</span>
      </div>

      {/* Body */}
      <div className={`space-y-1 ${isFullscreen ? "px-5 py-4 text-base" : "px-3 py-2 text-xs"}`}>
        {/* Type badge */}
        <div className="text-muted-foreground">
          {isTrustee ? "Trustee" : isTrust ? (isSuperFund ? "Superfund" : "Trust") : "Company"}
        </div>

        {/* Trust Name (for trustees) */}
        {isTrustee && trustName && (
          <div className={`text-rose-600 truncate ${isFullscreen ? "text-sm" : "text-xs"}`}>
            → {trustName}
          </div>
        )}

        {/* Shareholding */}
        {shareholding !== undefined && (
          <div className="text-amber-600 dark:text-amber-400">
            <span className="font-medium">Shareholding:</span> {shareholding}%
          </div>
        )}

        {/* Positions (Director, Secretary, Officer) */}
        {positions && positions.length > 0 && (
          <div className="space-y-0.5">
            {positions.includes("Director") && (
              <div className="text-purple-600 dark:text-purple-400">
                <span className="font-medium">Director</span>
              </div>
            )}
            {positions.includes("Secretary") && (
              <div className="text-blue-600 dark:text-blue-400">
                <span className="font-medium">Secretary</span>
              </div>
            )}
            {positions.includes("Officer") && (
              <div className="text-green-600 dark:text-green-400">
                <span className="font-medium">Officer</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CompanyNodeData {
  label: string;
  isTrustee?: boolean;
  trustName?: string;
  trustEntityType?: string;
  percentage?: number;
  shareholding?: number;
  positions?: string[];
  onClick?: () => void;
  isFullscreen?: boolean;
}

// Define nodeTypes outside component to prevent recreation warning
const nodeTypes = {
  person: PersonNode,
  company: CompanyNode,
  trust: TrustNode,
} as const;

export default function PersonStructureChart({
  personName,
  personEmail,
  ownershipChain,
  directorRoles = [],
  onCompanyClick,
  showFullDetail,
  onToggleFullDetail,
  fullscreen = false,
}: PersonStructureChartProps) {
  // Use ref for callback to avoid infinite re-renders
  const onCompanyClickRef = React.useRef(onCompanyClick);
  onCompanyClickRef.current = onCompanyClick;

  // Filter state
  const [showDirectors, setShowDirectors] = React.useState(true);
  const [showShareholding, setShowShareholding] = React.useState(true);

  // Apply filters
   
  const filteredOwnershipChain = showShareholding ? ownershipChain : [];
   
  const filteredDirectorRoles = showDirectors ? directorRoles : [];

  const { initialNodes, initialEdges, dimensions } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Larger spacing in fullscreen mode
    const xSpacing = fullscreen ? 350 : 250; // Horizontal spacing between levels
    const ySpacing = fullscreen ? 140 : 100; // Vertical spacing between siblings

    // Track positions for layout
    let maxX = 0;
    let maxY = 0;

    // Add person node at far left
    const personNodeId = "person-center";

    // Recursive function to count all nodes in a subtree
    const countNodes = (node: OwnershipNode): number => {
      let count = 1; // This node
      if (node.trust_id) count++; // Trust node
      if (node.children) {
        node.children.forEach(child => {
          count += countNodes(child);
        });
      }
      return count;
    };

    // Recursive function to add company nodes and edges
    const addOwnershipNode = (
      node: OwnershipNode,
      parentNodeId: string,
      level: number,
      yStart: number
    ): number => {
      const companyNodeId = `company-${node.company_id}`;
      const x = level * xSpacing;
      const currentY = yStart;

      // Add company node
      nodes.push({
        id: companyNodeId,
        type: "company",
        position: { x, y: currentY },
        data: {
          label: node.company_name,
          isTrustee: node.is_trustee,
          trustName: node.trust_name,
          trustEntityType: node.trust_entity_type,
          percentage: node.percentage,
          shareholding: node.percentage,
          isFullscreen: fullscreen,
          onClick: () => onCompanyClickRef.current?.(node.company_id),
        },
      });

      // Track max dimensions
      if (x > maxX) maxX = x;
      if (currentY > maxY) maxY = currentY;

      // Add edge from parent
      edges.push({
        id: `edge-${parentNodeId}-${companyNodeId}`,
        source: parentNodeId,
        target: companyNodeId,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: "#f59e0b",
          strokeWidth: 2,
        },
        label: `${node.percentage}%`,
        labelStyle: {
          fill: "#f59e0b",
          fontWeight: 600,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.9,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#f59e0b",
        },
      });

      let nextY = currentY;

      // Process children
      if (node.children && node.children.length > 0) {
        let childY = currentY + ySpacing;
        node.children.forEach((child) => {
          const usedHeight = addOwnershipNode(child, companyNodeId, level + 1, childY);
          childY = usedHeight + ySpacing;
          if (childY > nextY) nextY = childY;
        });
      }

      return Math.max(currentY, nextY);
    };

    // Calculate total height and position person node in center
    let totalHeight = 0;
    filteredOwnershipChain.forEach(node => {
      totalHeight += countNodes(node) * ySpacing;
    });

    const personY = Math.max(0, (totalHeight - ySpacing) / 2);
    nodes.push({
      id: personNodeId,
      type: "person",
      position: { x: 0, y: personY },
      data: {
        label: personName,
        email: personEmail,
      },
    });

    // Add all ownership nodes
    let currentYOffset = 0;
    filteredOwnershipChain.forEach((node) => {
      const usedHeight = addOwnershipNode(node, personNodeId, 1, currentYOffset);
      currentYOffset = usedHeight + ySpacing;
    });

    // Collect all company IDs that are already in the ownership chain
    const ownershipCompanyIds = new Set<number>();
    const collectOwnershipIds = (node: OwnershipNode) => {
      ownershipCompanyIds.add(node.company_id);
      if (node.trust_id) ownershipCompanyIds.add(node.trust_id);
      node.children?.forEach(collectOwnershipIds);
    };
    filteredOwnershipChain.forEach(collectOwnershipIds);

    // Add position-only companies (where person has a position but is not a shareholder)
    // Group by company to avoid duplicates
    const positionOnlyRoles = filteredDirectorRoles.filter(
      role => !ownershipCompanyIds.has(role.company_id)
    );

    // Group roles by company_id
    const companyPositionsMap = new Map<number, { company_name: string; positions: string[] }>();
    positionOnlyRoles.forEach(role => {
      if (!companyPositionsMap.has(role.company_id)) {
        companyPositionsMap.set(role.company_id, { company_name: role.company_name, positions: [] });
      }
      const posLabel = role.position?.toLowerCase() || "";
      let displayLabel = "Director";
      if (posLabel.includes("secretary")) displayLabel = "Secretary";
      else if (posLabel.includes("officer")) displayLabel = "Officer";

      const existing = companyPositionsMap.get(role.company_id)!;
      if (!existing.positions.includes(displayLabel)) {
        existing.positions.push(displayLabel);
      }
    });

    if (companyPositionsMap.size > 0) {
      // Position-only companies below the ownership chain
      const positionStartY = currentYOffset + ySpacing;

      let index = 0;
      companyPositionsMap.forEach((companyData, companyId) => {
        const companyNodeId = `position-company-${companyId}`;
        const x = xSpacing;
        const y = positionStartY + (index * ySpacing);

        // Use purple if Director is present, otherwise blue for Secretary, green for Officer
        let edgeColor = "#9333ea"; // Default purple
        if (!companyData.positions.includes("Director")) {
          if (companyData.positions.includes("Secretary")) edgeColor = "#2563eb";
          else if (companyData.positions.includes("Officer")) edgeColor = "#16a34a";
        }

        nodes.push({
          id: companyNodeId,
          type: "company",
          position: { x, y },
          data: {
            label: companyData.company_name,
            isTrustee: false,
            positions: companyData.positions,
            isFullscreen: fullscreen,
            onClick: () => onCompanyClickRef.current?.(companyId),
          },
        });

        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

        // Add dashed edge for position relationship (no label - positions shown inside box)
        edges.push({
          id: `edge-position-${personNodeId}-${companyNodeId}`,
          source: personNodeId,
          target: companyNodeId,
          type: "smoothstep",
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
            strokeDasharray: "5,5",
          },
        });

        index++;
      });
    }

    return {
      initialNodes: nodes,
      initialEdges: edges,
      dimensions: { width: maxX + xSpacing, height: Math.max(maxY + ySpacing, fullscreen ? 500 : 350) }
    };
  }, [personName, personEmail, filteredOwnershipChain, filteredDirectorRoles, fullscreen]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const chartHeight = fullscreen ? "100%" : Math.max(400, dimensions.height);

  if (ownershipChain.length === 0 && directorRoles.length === 0) {
    return (
      <div className={`w-full ${fullscreen ? "h-full" : "h-[200px]"} border rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-muted-foreground`}>
        No ownership or director data available
      </div>
    );
  }

  return (
    <div className={`w-full ${fullscreen ? "h-full" : ""} ${fullscreen ? "" : "border rounded-lg"} bg-gray-50 dark:bg-gray-900 overflow-hidden`}>
      <ReactFlowProvider>
        <ChartWithControls
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          chartHeight={chartHeight}
          showDirectors={showDirectors}
          setShowDirectors={setShowDirectors}
          showShareholding={showShareholding}
          setShowShareholding={setShowShareholding}
          showFullDetail={showFullDetail}
          onToggleFullDetail={onToggleFullDetail}
          hasDirectorRoles={directorRoles.length > 0}
          hasShareholding={ownershipChain.length > 0}
          fullscreen={fullscreen}
        />
      </ReactFlowProvider>
    </div>
  );
}

// Inner component that can use useReactFlow
function ChartWithControls({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  chartHeight,
  showDirectors,
  setShowDirectors,
  showShareholding,
  setShowShareholding,
  showFullDetail,
  onToggleFullDetail,
  hasDirectorRoles,
  hasShareholding,
  fullscreen = false,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  chartHeight: number | string;
  showDirectors: boolean;
  setShowDirectors: (value: boolean) => void;
  showShareholding: boolean;
  setShowShareholding: (value: boolean) => void;
  showFullDetail?: boolean;
  onToggleFullDetail?: () => void;
  hasDirectorRoles: boolean;
  hasShareholding: boolean;
  fullscreen?: boolean;
}) {
  const { fitView } = useReactFlow();

  // Re-fit view when nodes change (e.g., filter toggle)
  const prevNodesLength = React.useRef(nodes.length);
  React.useEffect(() => {
    // Only re-fit if nodes length changed (filter toggle)
    if (prevNodesLength.current !== nodes.length) {
      prevNodesLength.current = nodes.length;
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const handleFitView = useCallback(() => {
    fitView({
      padding: 0.15,
      duration: 300,
    });
  }, [fitView]);

  const showFilters = hasDirectorRoles || hasShareholding;

  return (
    <div style={{ height: fullscreen ? "100%" : `${chartHeight}px` }} className="relative">
      {/* Controls bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
        {/* Left side - Filter checkboxes */}
        {showFilters ? (
          <div className="flex items-center gap-4 bg-white/90 dark:bg-gray-800/90 rounded-md px-3 py-1.5 shadow-sm">
            {hasDirectorRoles && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-positions"
                  checked={showDirectors}
                  onCheckedChange={(checked) => setShowDirectors(checked === true)}
                />
                <Label htmlFor="show-positions" className="text-sm font-medium cursor-pointer">
                  Positions
                </Label>
              </div>
            )}
            {hasShareholding && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-shareholding"
                  checked={showShareholding}
                  onCheckedChange={(checked) => setShowShareholding(checked === true)}
                />
                <Label htmlFor="show-shareholding" className="text-sm font-medium cursor-pointer">
                  Shareholding
                </Label>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right side - Buttons */}
        <div className="flex items-center gap-2">
          {onToggleFullDetail && (
            <Button
              variant={showFullDetail ? "default" : "outline"}
              size="sm"
              onClick={onToggleFullDetail}
              className={showFullDetail ? "shadow-sm" : "bg-white/90 hover:bg-white shadow-sm"}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Full Detail
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleFitView}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Maximize2 className="h-4 w-4 mr-1" />
            Fit to Screen
          </Button>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        panOnScroll
        zoomOnScroll={false}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
