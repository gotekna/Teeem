"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, User, Users, Package, FileText, Key } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonRole {
  type: string;
  company_id: number;
  company_name: string;
  position?: string;
  is_current?: boolean;
  shares?: number;
  percentage?: number;
}

interface PersonStructureChartProps {
  personName: string;
  personEmail?: string | null;
  roles: PersonRole[];
  onCompanyClick?: (companyId: number) => void;
}

// Person node component (center)
function PersonNode({ data }: { data: { label: string; email?: string | null } }) {
  return (
    <div className="min-w-[250px] rounded-lg border-2 shadow-lg bg-amber-50 border-amber-400 dark:bg-amber-950/30 dark:border-amber-600">
      <Handle type="source" position={Position.Right} className="!bg-amber-500" />

      <div className="px-5 py-4 rounded-t-md flex items-center gap-3 bg-amber-100 dark:bg-amber-900/50">
        <User className="h-6 w-6 text-amber-600" />
        <span className="font-bold text-lg">{data.label}</span>
      </div>

      {data.email && (
        <div className="px-5 py-3 text-sm text-muted-foreground">
          {data.email}
        </div>
      )}
    </div>
  );
}

// Company node component (right side)
function CompanyNode({ data }: { data: CompanyNodeData }) {
  const { label, roles, onClick } = data;

  const hasDirector = roles.some(r => r.type === "director");
  const hasShareholder = roles.some(r => r.type === "shareholder");
  const hasSecretary = roles.some(r => r.type === "secretary");
  const hasOfficer = roles.some(r => ["public_officer", "corporate_officer", "officer"].includes(r.type || ""));
  const shareholderRole = roles.find(r => r.type === "shareholder");

  return (
    <div
      className="min-w-[280px] max-w-[350px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700"
      onClick={onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />

      <div className="px-4 py-3 rounded-t-md flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50">
        <Building2 className="h-5 w-5 text-blue-600" />
        <span className="font-semibold">{label}</span>
      </div>

      <div className="px-4 py-3 space-y-2">
        {hasDirector && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-purple-700 dark:text-purple-400">Director</span>
          </div>
        )}
        {hasShareholder && shareholderRole && (
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-amber-600" />
            <span className="text-amber-700 dark:text-amber-400">
              Shareholder ({shareholderRole.percentage || 0}%)
            </span>
          </div>
        )}
        {hasSecretary && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-blue-700 dark:text-blue-400">Secretary</span>
          </div>
        )}
        {hasOfficer && (
          <div className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4 text-green-600" />
            <span className="text-green-700 dark:text-green-400">Public Officer</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface CompanyNodeData {
  label: string;
  roles: PersonRole[];
  onClick?: () => void;
}

const nodeTypes = {
  person: PersonNode,
  company: CompanyNode,
};

export default function PersonStructureChart({
  personName,
  personEmail,
  roles,
  onCompanyClick,
}: PersonStructureChartProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Group roles by company
    const companiesMap = new Map<number, { id: number; name: string; roles: PersonRole[] }>();
    roles.forEach(role => {
      if (!companiesMap.has(role.company_id)) {
        companiesMap.set(role.company_id, {
          id: role.company_id,
          name: role.company_name,
          roles: [],
        });
      }
      companiesMap.get(role.company_id)!.roles.push(role);
    });

    const companies = Array.from(companiesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Add person node (left/center)
    const personNodeId = "person-center";
    const companyCount = companies.length;
    const ySpacing = 180;
    const totalHeight = (companyCount - 1) * ySpacing;
    const personY = totalHeight / 2;

    nodes.push({
      id: personNodeId,
      type: "person",
      position: { x: 50, y: personY },
      data: {
        label: personName,
        email: personEmail,
      },
    });

    // Add company nodes (right side)
    companies.forEach((company, index) => {
      const companyNodeId = `company-${company.id}`;
      const hasShareholder = company.roles.some(r => r.type === "shareholder");
      const shareholderRole = company.roles.find(r => r.type === "shareholder");

      nodes.push({
        id: companyNodeId,
        type: "company",
        position: { x: 500, y: index * ySpacing },
        data: {
          label: company.name,
          roles: company.roles,
          onClick: () => onCompanyClick?.(company.id),
        },
      });

      // Add edge from person to company
      // Use amber color for shareholding, gray for other relationships
      const edgeColor = hasShareholder ? "#f59e0b" : "#6b7280";
      const edgeLabel = hasShareholder && shareholderRole
        ? `${shareholderRole.percentage || 0}%`
        : undefined;

      edges.push({
        id: `edge-${personNodeId}-${companyNodeId}`,
        source: personNodeId,
        target: companyNodeId,
        type: "smoothstep",
        animated: hasShareholder,
        style: {
          stroke: edgeColor,
          strokeWidth: hasShareholder ? 3 : 2,
          strokeDasharray: hasShareholder ? undefined : "5,5",
        },
        label: edgeLabel,
        labelStyle: {
          fill: edgeColor,
          fontWeight: 700,
          fontSize: 14,
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.9,
        },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [personName, personEmail, roles, onCompanyClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Calculate height based on number of companies
  const chartHeight = Math.max(400, roles.length > 0
    ? (new Set(roles.map(r => r.company_id)).size) * 180 + 100
    : 400
  );

  return (
    <div
      className="w-full border rounded-lg bg-gray-50 dark:bg-gray-900"
      style={{ height: `${chartHeight}px` }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
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
