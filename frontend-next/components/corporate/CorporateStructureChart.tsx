 
"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, Network, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { isTrust } from "@/lib/entity-types";

// Types for structure data
interface StructureShareholder {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string;
  shares: number;
  percentage: number;
  share_class: string;
  beneficially_held: boolean;
}

interface StructureCompany {
  id: number;
  name: string;
  code: string | null;
  acn: string | null;
  abn: string | null;
  status: string;
  entity_type: string | null;
  is_trustee: boolean;
  trust_name: string | null;
  hierarchy_level: number | null;
  date_incorporated: string | null;
  shareholders: StructureShareholder[];
  investments: unknown[];
  children: StructureCompany[];
  is_trust_of_trustee?: boolean;
}

interface StructurePerson {
  id: number;
  contact_id: number;
  name: string;
  email: string | null;
  membership_type: string;
  is_active: boolean;
  roles: Array<{
    type: string;
    company_id: number;
    company_name: string;
    position?: string;
    is_current?: boolean;
    shares?: number;
    percentage?: number;
  }>;
}

interface StructureData {
  group: { id: number; name: string };
  companies: StructureCompany[];
  people: StructurePerson[];
  stats: {
    total_companies: number;
    top_level_count: number;
    trustees_count: number;
    trusts_count: number;
    people_count: number;
  };
}

interface CorporateStructureChartProps {
  data: StructureData;
  filters: {
    shareholders: boolean;
    directors: boolean;
    secretary: boolean;
    corporateOfficer: boolean;
    ownershipLinks: boolean;
  };
  onEntityClick?: (entityId: number, entityType: "company" | "person") => void;
  fullscreen?: boolean;
}

// Custom node component for person
function PersonNode({ data }: { data: PersonNodeData }) {
  const { label, email, roles, onClick, isFullscreen } = data;

  return (
    <div
      className={cn(
        "rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700",
        isFullscreen ? "min-w-[280px] max-w-[350px]" : "min-w-[150px] max-w-[200px]"
      )}
      onClick={onClick}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Handle type="source" position={Position.Bottom} className="!bg-border" />

      {/* Header */}
      <div className={cn(
        "rounded-t-md flex items-center gap-3 bg-amber-100 dark:bg-amber-900/50",
        isFullscreen ? "px-6 py-5" : "px-5 py-4"
      )}>
        <User className={cn(isFullscreen ? "h-7 w-7" : "h-5 w-5", "text-amber-600")} />
        <span className={cn("font-bold", isFullscreen ? "text-xl" : "text-lg")}>{label}</span>
      </div>

      {/* Body */}
      <div className={cn(
        "space-y-2",
        isFullscreen ? "px-6 py-5 text-lg" : "px-5 py-4 text-base"
      )}>
        {email && (
          <div className={cn(isFullscreen ? "text-base" : "text-sm", "text-muted-foreground")}>{email}</div>
        )}
        <div className={cn(isFullscreen ? "text-base" : "text-sm", "text-amber-700 dark:text-amber-400")}>
          {roles} roles
        </div>
      </div>
    </div>
  );
}

interface PersonNodeData {
  label: string;
  email: string | null;
  roles: number;
  onClick?: () => void;
  isFullscreen?: boolean;
}

// Custom node component for entities
function EntityNode({ data }: { data: EntityNodeData }) {
  const {
    label,
    entityType,
    isTrustee,
    trustName,
    onClick,
    isFullscreen,
    shareholders,
    directors,
    secretary,
    publicOfficer,
  } = data;

  const getBackgroundColor = () => {
    switch (entityType?.toLowerCase()) {
      case "trust":
      case "superfund":
        return "bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700";
      case "company":
        if (isTrustee) {
          return "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700";
        }
        return "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700";
      case "individual":
      case "person":
        return "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700";
      default:
        return "bg-muted border-border dark:bg-background/30 dark:border-border";
    }
  };

  const getIcon = () => {
    const iconSize = isFullscreen ? "h-6 w-6" : "h-4 w-4";
    switch (entityType?.toLowerCase()) {
      case "trust":
      case "superfund":
        return <Network className={cn(iconSize, "text-rose-600")} />;
      case "individual":
      case "person":
        return <User className={cn(iconSize, "text-amber-600")} />;
      default:
        if (isTrustee) {
          return <Briefcase className={cn(iconSize, "text-indigo-600")} />;
        }
        return <Building2 className={cn(iconSize, "text-blue-600 dark:text-blue-400")} />;
    }
  };

  const getHeaderColor = () => {
    switch (entityType?.toLowerCase()) {
      case "trust":
      case "superfund":
        return "bg-rose-100 dark:bg-rose-900/50";
      case "individual":
      case "person":
        return "bg-amber-100 dark:bg-amber-900/50";
      default:
        if (isTrustee) {
          return "bg-indigo-100 dark:bg-indigo-900/50";
        }
        return "bg-blue-100 dark:bg-blue-900/50";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow",
        isFullscreen ? "min-w-[280px] max-w-[350px]" : "min-w-[180px] max-w-[220px]",
        getBackgroundColor()
      )}
      onClick={onClick}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Handle type="source" position={Position.Bottom} className="!bg-border" />

      {/* Header */}
      <div className={cn(
        "rounded-t-md flex items-center gap-2",
        isFullscreen ? "px-5 py-4" : "px-3 py-2",
        getHeaderColor()
      )}>
        {getIcon()}
        <span className={cn(
          "font-semibold truncate",
          isFullscreen ? "text-lg" : "text-sm"
        )}>{label}</span>
      </div>

      {/* Body - Compact view */}
      <div className={cn(
        "space-y-1",
        isFullscreen ? "px-5 py-4 text-base" : "px-3 py-2 text-xs"
      )}>
        {/* Type badge */}
        <div className="text-muted-foreground">
          {isTrustee ? "Trustee" : entityType || "Company"}
        </div>

        {/* Trust Name (for trustees) */}
        {isTrustee && trustName && (
          <div className={cn(
            "text-rose-600 truncate",
            isFullscreen ? "text-sm" : "text-xs"
          )}>{trustName}</div>
        )}

        {/* Shareholders */}
        {shareholders && shareholders.length > 0 && (
          <div className="text-amber-600 dark:text-amber-400">
            <span className="font-medium">Shareholders:</span> {shareholders.map(s => `${s.name} (${s.percentage}%)`).join(", ")}
          </div>
        )}

        {/* Directors */}
        {directors && directors.length > 0 && (
          <div className="text-purple-600 dark:text-purple-400">
            <span className="font-medium">Directors:</span> {directors.join(", ")}
          </div>
        )}

        {/* Secretary */}
        {secretary && (
          <div className="text-blue-600 dark:text-blue-400">
            <span className="font-medium">Secretary:</span> {secretary}
          </div>
        )}

        {/* Public/Corporate Officer */}
        {publicOfficer && (
          <div className="text-green-600 dark:text-green-400">
            <span className="font-medium">Officer:</span> {publicOfficer}
          </div>
        )}
      </div>
    </div>
  );
}

interface EntityNodeData {
  label: string;
  entityType: string | null;
  code: string | null;
  acn: string | null;
  abn: string | null;
  status: string;
  isTrustee: boolean;
  trustName: string | null;
  dateIncorporated: string | null;
  directors?: string[];
  shareholders?: Array<{ name: string; percentage: number }>;
  secretary?: string;
  publicOfficer?: string;
  onClick?: () => void;
  isFullscreen?: boolean;
}

// Node types registration
const nodeTypes = {
  entity: EntityNode,
  person: PersonNode,
};

export default function CorporateStructureChart({
  data,
  filters,
  onEntityClick,
  fullscreen = false,
}: CorporateStructureChartProps) {
  // Use ref for callback to avoid infinite re-renders
  const onEntityClickRef = React.useRef(onEntityClick);
  onEntityClickRef.current = onEntityClick;

  // Build nodes and edges from structure data
  const { initialNodes, initialEdges, maxDepth } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let maxDepth = 1;
    // Adjust sizes based on fullscreen mode
    const nodeWidth = fullscreen ? 300 : 200; // Visual width of a node
    const nodeHeight = fullscreen ? 140 : 100; // Approximate height of a node
    const horizontalGap = fullscreen ? 40 : 20; // Gap between sibling nodes horizontally
    const verticalGap = fullscreen ? 100 : 60; // Gap between levels vertically
    const ySpacing = nodeHeight + verticalGap; // Total vertical spacing

    // Helper to get people roles for a company
    const getPeopleForCompany = (companyId: number, companyShareholders: StructureShareholder[]) => {
      const directors: string[] = [];
      const shareholders: Array<{ name: string; percentage: number }> = [];
      let secretary: string | undefined;
      let publicOfficer: string | undefined;

      // Get directors, secretary, and public officer from people roles
      data.people.forEach((person) => {
        person.roles.forEach((role) => {
          if (role.company_id === companyId) {
            const roleType = role.type?.toLowerCase();
            if (roleType === "director" && filters.directors) {
              directors.push(person.name);
            }
            if (roleType === "secretary" && filters.secretary) {
              secretary = person.name;
            }
            if ((roleType === "public officer" || roleType === "corporate officer" || roleType === "officer") && filters.corporateOfficer) {
              publicOfficer = person.name;
            }
          }
        });
      });

      // Get shareholders from the company's shareholdings data (includes both people and companies)
      if (filters.shareholders && companyShareholders) {
        companyShareholders.forEach((sh) => {
          shareholders.push({
            name: sh.shareholder_name || "Unknown",
            percentage: sh.percentage || 0,
          });
        });
      }

      return { directors, shareholders, secretary, publicOfficer };
    };

    // First pass: calculate subtree widths for proper positioning
    const calculateSubtreeWidth = (company: StructureCompany): number => {
      if (!company.children || company.children.length === 0) {
        return nodeWidth;
      }
      const childrenWidth = company.children.reduce((sum, child) => {
        return sum + calculateSubtreeWidth(child) + horizontalGap;
      }, -horizontalGap); // Remove last gap
      return Math.max(nodeWidth, childrenWidth);
    };

    // Store subtree widths
    const subtreeWidths = new Map<number, number>();
    const calculateAllWidths = (company: StructureCompany) => {
      subtreeWidths.set(company.id, calculateSubtreeWidth(company));
      company.children?.forEach(calculateAllWidths);
    };
    data.companies.forEach(calculateAllWidths);

    // Recursive function to process companies with proper tree layout
    const processCompany = (
      company: StructureCompany,
      parentId: string | null,
      leftBound: number,
      yPos: number,
      depth: number
    ) => {
      // Track max depth for calculating container height
      if (depth > maxDepth) maxDepth = depth;

      const nodeId = `company-${company.id}`;
      const { directors, shareholders, secretary, publicOfficer } = getPeopleForCompany(company.id, company.shareholders);

      // Calculate x position: center within our allocated space
      const myWidth = subtreeWidths.get(company.id) || nodeWidth;
      const xPos = leftBound + (myWidth - nodeWidth) / 2;

      nodes.push({
        id: nodeId,
        type: "entity",
        position: { x: xPos, y: yPos },
        data: {
          label: company.name,
          entityType: company.entity_type,
          code: company.code,
          acn: company.acn,
          abn: company.abn,
          status: company.status,
          isTrustee: company.is_trustee,
          trustName: company.trust_name,
          dateIncorporated: company.date_incorporated,
          directors,
          shareholders,
          secretary,
          publicOfficer,
          onClick: () => onEntityClickRef.current?.(company.id, "company"),
          isFullscreen: fullscreen,
        },
      });

      // Add edge from parent
      if (parentId) {
        edges.push({
          id: `edge-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: "smoothstep",
          style: { stroke: "#6b7280", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#6b7280",
          },
        });
      }

      // Process children with proper spacing
      if (company.children && company.children.length > 0) {
        let childLeftBound = leftBound;
        company.children.forEach((child) => {
          const childWidth = subtreeWidths.get(child.id) || nodeWidth;
          processCompany(
            child,
            nodeId,
            childLeftBound,
            yPos + ySpacing,
            depth + 1
          );
          childLeftBound += childWidth + horizontalGap;
        });
      }
    };

    // Process top-level companies with proper spacing
    // Start from x=50 (left side with small margin)
    let currentX = 50;
    data.companies.forEach((company) => {
      const treeWidth = subtreeWidths.get(company.id) || nodeWidth;
      processCompany(company, null, currentX, 20, 1);
      currentX += treeWidth + horizontalGap * 2; // Extra gap between top-level trees
    });

    // Add ownership/shareholding links if filter is enabled
    if (filters.ownershipLinks) {
      // Collect all company IDs that have nodes
      const nodeCompanyIds = new Set(nodes.map(n => n.id.startsWith('company-') ? parseInt(n.id.replace('company-', '')) : -1));

      // Helper to collect all shareholdings from all companies in the tree
      const collectShareholdings = (company: StructureCompany): Array<{
        ownerType: 'Company' | 'Contact';
        ownerId: number;
        ownerName: string;
        ownedId: number;
        percentage: number;
      }> => {
        const shareholdings: Array<{ ownerType: 'Company' | 'Contact'; ownerId: number; ownerName: string; ownedId: number; percentage: number }> = [];

        // Check all shareholders (both Company and Contact types)
        company.shareholders?.forEach(sh => {
          if (sh.shareholder_type === 'Company' && nodeCompanyIds.has(sh.shareholder_id)) {
            shareholdings.push({
              ownerType: 'Company',
              ownerId: sh.shareholder_id,
              ownerName: sh.shareholder_name,
              ownedId: company.id,
              percentage: sh.percentage || 0,
            });
          } else if (sh.shareholder_type === 'Contact') {
            shareholdings.push({
              ownerType: 'Contact',
              ownerId: sh.shareholder_id,
              ownerName: sh.shareholder_name,
              ownedId: company.id,
              percentage: sh.percentage || 0,
            });
          }
        });

        // Recursively collect from children
        company.children?.forEach(child => {
          shareholdings.push(...collectShareholdings(child));
        });

        return shareholdings;
      };

      // Collect all shareholdings from all companies
      const allShareholdings: Array<{ ownerType: 'Company' | 'Contact'; ownerId: number; ownerName: string; ownedId: number; percentage: number }> = [];
      data.companies.forEach(company => {
        allShareholdings.push(...collectShareholdings(company));
      });

      // Group person shareholdings by contact_id to create person nodes
      const personShareholdings = new Map<number, { name: string; companyIds: Array<{ companyId: number; percentage: number }> }>();
      allShareholdings.filter(sh => sh.ownerType === 'Contact').forEach(sh => {
        if (!personShareholdings.has(sh.ownerId)) {
          personShareholdings.set(sh.ownerId, { name: sh.ownerName, companyIds: [] });
        }
        personShareholdings.get(sh.ownerId)!.companyIds.push({ companyId: sh.ownedId, percentage: sh.percentage });
      });

      // Find the leftmost position and max Y to place people
      let minX = Infinity, maxY = 0;
      nodes.forEach(n => {
        if (n.position.x < minX) minX = n.position.x;
        if (n.position.y > maxY) maxY = n.position.y;
      });

      // Add person nodes to the left of the chart with proper spacing
      const personNodeWidth = 300;
      const personNodeHeight = 120;
      const personSpacing = personNodeHeight + 60; // Height + gap
      let personY = 20;

      personShareholdings.forEach((personData, contactId) => {
        const personNodeId = `person-${contactId}`;
        nodes.push({
          id: personNodeId,
          type: "person",
          position: { x: minX - personNodeWidth - 150, y: personY },
          data: {
            label: personData.name,
            email: null,
            roles: personData.companyIds.length,
            onClick: () => onEntityClickRef.current?.(contactId, "person"),
            isFullscreen: fullscreen,
          },
        });

        // Add edges from person to each company they own shares in
        personData.companyIds.forEach((ownership, idx) => {
          const targetId = `company-${ownership.companyId}`;
          if (nodes.some(n => n.id === targetId)) {
            edges.push({
              id: `person-ownership-${personNodeId}-${targetId}-${idx}`,
              source: personNodeId,
              target: targetId,
              type: "smoothstep",
              animated: true,
              style: {
                stroke: "#f59e0b", // Amber for person ownership
                strokeWidth: 2,
                strokeDasharray: "5,5",
              },
              label: `${ownership.percentage}%`,
              labelStyle: {
                fill: "#f59e0b",
                fontWeight: 600,
                fontSize: 12,
              },
              labelBgStyle: {
                fill: "#ffffff",
                fillOpacity: 0.9,
              },
              labelBgPadding: [4, 4] as [number, number],
              labelBgBorderRadius: 4,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#f59e0b",
              },
            });
          }
        });

        personY += personSpacing;
      });

      // Create company-to-company ownership edges (green dashed lines)
      allShareholdings.filter(sh => sh.ownerType === 'Company').forEach((sh, index) => {
        const sourceId = `company-${sh.ownerId}`;
        const targetId = `company-${sh.ownedId}`;

        // Only add edge if both nodes exist
        if (nodes.some(n => n.id === sourceId) && nodes.some(n => n.id === targetId)) {
          edges.push({
            id: `ownership-${sourceId}-${targetId}-${index}`,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            animated: true,
            style: {
              stroke: "#10b981", // Emerald green
              strokeWidth: 2,
              strokeDasharray: "5,5",
            },
            label: `${sh.percentage}%`,
            labelStyle: {
              fill: "#10b981",
              fontWeight: 600,
              fontSize: 12,
            },
            labelBgStyle: {
              fill: "#ffffff",
              fillOpacity: 0.9,
            },
            labelBgPadding: [4, 4] as [number, number],
            labelBgBorderRadius: 4,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#10b981",
            },
          });
        }
      });
    }

    return { initialNodes: nodes, initialEdges: edges, maxDepth };
  }, [data, filters, fullscreen]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data or filters change
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Calculate dynamic height based on depth (500px per level + 300px buffer)
  // Also consider number of nodes for very wide charts
  const nodeCount = initialNodes.length;
  const chartHeight = fullscreen ? "100%" : `${Math.max(900, maxDepth * 500 + 300, nodeCount * 80)}px`;

  return (
    <div
      className={cn(
        "w-full bg-muted dark:bg-background",
        fullscreen ? "h-full" : "border rounded-lg"
      )}
      style={{ height: chartHeight }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.1,
          includeHiddenNodes: true,
          minZoom: 0.05,
          maxZoom: 1,
        }}
        minZoom={0.05}
        maxZoom={1.5}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as unknown as EntityNodeData;
            const entityType = data?.entityType?.toLowerCase();
            if (isTrust(entityType) || entityType === "superfund") return "#fda4af";
            if (data?.isTrustee) return "#a5b4fc";
            return "#93c5fd";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
