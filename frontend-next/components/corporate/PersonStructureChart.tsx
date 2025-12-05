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
import { cn } from "@/lib/utils";

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
}

// Person node component
function PersonNode({ data }: { data: { label: string; email?: string | null } }) {
  return (
    <div className="min-w-[200px] rounded-lg border-2 shadow-lg bg-amber-50 border-amber-400 dark:bg-amber-950/30 dark:border-amber-600">
      <Handle type="source" position={Position.Right} className="!bg-amber-500" />

      <div className="px-4 py-3 rounded-md flex items-center gap-3 bg-amber-100 dark:bg-amber-900/50">
        <User className="h-5 w-5 text-amber-600" />
        <div>
          <div className="font-bold text-base">{data.label}</div>
          {data.email && <div className="text-xs text-muted-foreground">{data.email}</div>}
        </div>
      </div>
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

// Company node component - shows trustee + trust combined when applicable
function CompanyNode({ data }: { data: CompanyNodeData }) {
  const { label, isTrustee, trustName, trustEntityType, percentage, onClick } = data;

  // Regular company (non-trustee)
  if (!isTrustee || !trustName) {
    return (
      <div
        className="min-w-[200px] max-w-[280px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700"
        onClick={onClick}
      >
        <Handle type="target" position={Position.Left} className="!bg-blue-500" />
        <Handle type="source" position={Position.Right} className="!bg-blue-500" />

        <div className="px-4 py-3 rounded-md bg-blue-100 dark:bg-blue-900/50">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <div className="font-semibold text-sm">{label}</div>
          </div>
        </div>
      </div>
    );
  }

  // Trustee company with trust - combined view
  const isSuperFund = trustEntityType?.toLowerCase() === "superfund";

  return (
    <div
      className="min-w-[220px] max-w-[300px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow border-indigo-300 dark:border-indigo-700 overflow-hidden"
      onClick={onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />

      {/* Trustee company section */}
      <div className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-indigo-600" />
          <div className="font-semibold text-sm text-indigo-800 dark:text-indigo-200">{label}</div>
        </div>
        <div className="text-xs text-indigo-600 dark:text-indigo-400">Trustee</div>
      </div>

      {/* Trust section - different color */}
      <div className="px-4 py-2 bg-rose-100 dark:bg-rose-900/50 border-t border-indigo-200 dark:border-indigo-700">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-rose-600" />
          <div className="font-semibold text-sm text-rose-800 dark:text-rose-200">{trustName}</div>
        </div>
        <div className="text-xs text-rose-600 dark:text-rose-400">{isSuperFund ? "Superfund" : "Trust"}</div>
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
  onClick?: () => void;
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
}: PersonStructureChartProps) {
  // Filter state
  const [showDirectors, setShowDirectors] = React.useState(true);
  const [showShareholding, setShowShareholding] = React.useState(true);

  // Apply filters
  // eslint-disable-next-line react-hooks/exhaustive-deps -- conditional is stable and doesn't affect useMemo below
  const filteredOwnershipChain = showShareholding ? ownershipChain : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- conditional is stable and doesn't affect useMemo below
  const filteredDirectorRoles = showDirectors ? directorRoles : [];

  const { initialNodes, initialEdges, dimensions } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const xSpacing = 320; // Horizontal spacing between levels
    const ySpacing = 120; // Vertical spacing between siblings

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
      let currentY = yStart;

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
          onClick: () => onCompanyClick?.(node.company_id),
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

    // Add director-only companies (where person is director but not shareholder)
    const directorOnlyCompanies = filteredDirectorRoles.filter(
      role => !ownershipCompanyIds.has(role.company_id)
    );

    if (directorOnlyCompanies.length > 0) {
      // Position director-only companies below the ownership chain
      const directorStartY = currentYOffset + ySpacing;

      directorOnlyCompanies.forEach((role, index) => {
        const companyNodeId = `director-company-${role.company_id}`;
        const x = xSpacing;
        const y = directorStartY + (index * ySpacing);

        nodes.push({
          id: companyNodeId,
          type: "company",
          position: { x, y },
          data: {
            label: role.company_name,
            isTrustee: false,
            onClick: () => onCompanyClick?.(role.company_id),
          },
        });

        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

        // Add dashed gray edge for director relationship
        edges.push({
          id: `edge-director-${personNodeId}-${companyNodeId}`,
          source: personNodeId,
          target: companyNodeId,
          type: "smoothstep",
          style: {
            stroke: "#9333ea", // Purple for director
            strokeWidth: 2,
            strokeDasharray: "5,5",
          },
          label: "Director",
          labelStyle: {
            fill: "#9333ea",
            fontWeight: 600,
            fontSize: 10,
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.9,
          },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        });
      });
    }

    return {
      initialNodes: nodes,
      initialEdges: edges,
      dimensions: { width: maxX + 350, height: Math.max(maxY + 150, 400) }
    };
  }, [personName, personEmail, filteredOwnershipChain, filteredDirectorRoles, onCompanyClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const chartHeight = Math.max(500, dimensions.height);

  if (ownershipChain.length === 0 && directorRoles.length === 0) {
    return (
      <div className="w-full h-[200px] border rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-muted-foreground">
        No ownership or director data available
      </div>
    );
  }

  return (
    <div className="w-full border rounded-lg bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  chartHeight: number;
  showDirectors: boolean;
  setShowDirectors: (value: boolean) => void;
  showShareholding: boolean;
  setShowShareholding: (value: boolean) => void;
  showFullDetail?: boolean;
  onToggleFullDetail?: () => void;
  hasDirectorRoles: boolean;
  hasShareholding: boolean;
}) {
  const { fitView, getNodes } = useReactFlow();

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
    <div style={{ height: `${chartHeight}px` }} className="relative">
      {/* Controls bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
        {/* Left side - Filter checkboxes */}
        {showFilters ? (
          <div className="flex items-center gap-4 bg-white/90 dark:bg-gray-800/90 rounded-md px-3 py-1.5 shadow-sm">
            {hasDirectorRoles && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-directors"
                  checked={showDirectors}
                  onCheckedChange={(checked) => setShowDirectors(checked === true)}
                />
                <Label htmlFor="show-directors" className="text-sm font-medium cursor-pointer">
                  Director
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
        fitViewOptions={{ padding: 0.15 }}
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
