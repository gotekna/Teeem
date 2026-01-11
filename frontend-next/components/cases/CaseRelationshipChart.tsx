"use client";

import React, { useMemo, useCallback, useEffect } from "react";
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
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  User,
  Building2,
  Briefcase,
  Scale,
  Calculator,
  Users,
  AlertTriangle,
  Shield,
  FileText,
  Landmark,
  BadgeDollarSign,
  UserCog,
  FolderTree,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for relationship data
interface EmployeeData {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  relationship_type?: string;
  formatted_relationship_type?: string;
  alignment?: string;
  is_primary?: boolean;
}

interface RelationshipNode {
  id: string;
  type: "contact" | "company" | "case" | "job" | "parent_case" | "child_case" | "company_group";
  position: { x: number; y: number };
  data: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    relationship_type?: string;
    alignment?: string;
    is_primary?: boolean;
    contact_id?: number;
    case_id?: number;
    job_id?: number;
    company_id?: number;
    company_name?: string;
    employees?: EmployeeData[];
    employee_count?: number;
  };
}

interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: {
    relationship_type?: string;
  };
}

interface RelationshipGraphData {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  case_info?: {
    id: number;
    case_number: string;
    title: string;
    case_type: string;
  };
}

interface CaseRelationshipChartProps {
  caseId: number;
  data?: RelationshipGraphData;
  onContactClick?: (contactId: number) => void;
  onCompanyClick?: (companyId: number) => void;
  onJobClick?: (jobId: number) => void;
  onCaseClick?: (caseId: number) => void;
  onPositionChange?: (contactId: number, position: { x: number; y: number }) => void;
}

// Relationship type styling
const RELATIONSHIP_STYLES: Record<string, { color: string; bgColor: string; icon: typeof User }> = {
  client: { color: "#3b82f6", bgColor: "bg-blue-500", icon: User },
  accountant: { color: "#22c55e", bgColor: "bg-green-500", icon: Calculator },
  lawyer: { color: "#a855f7", bgColor: "bg-purple-500", icon: Scale },
  previous_accountant: { color: "#6b7280", bgColor: "bg-muted0", icon: Calculator },
  advisor: { color: "#14b8a6", bgColor: "bg-teal-500", icon: Users },
  opposing_party: { color: "#f97316", bgColor: "bg-orange-500", icon: AlertTriangle },
  witness: { color: "#eab308", bgColor: "bg-yellow-500", icon: User },
  ato_officer: { color: "#ef4444", bgColor: "bg-red-500", icon: Landmark },
  director: { color: "#6366f1", bgColor: "bg-indigo-500", icon: Briefcase },
  shareholder: { color: "#ec4899", bgColor: "bg-pink-500", icon: Users },
  bank_manager: { color: "#06b6d4", bgColor: "bg-cyan-500", icon: Building2 },
  insurer: { color: "#10b981", bgColor: "bg-emerald-500", icon: Shield },
  broker: { color: "#8b5cf6", bgColor: "bg-violet-500", icon: BadgeDollarSign },
  related_party: { color: "#78716c", bgColor: "bg-stone-500", icon: UserCog },
};

const DEFAULT_STYLE = { color: "#6b7280", bgColor: "bg-muted0", icon: User };

// Alignment styles - which side the contact is on
const ALIGNMENT_STYLES: Record<string, { color: string; borderColor: string; label: string }> = {
  friendly: { color: "#22c55e", borderColor: "border-green-500", label: "Friendly" },
  neutral: { color: "#6b7280", borderColor: "border-border", label: "Neutral" },
  opposing: { color: "#ef4444", borderColor: "border-red-500", label: "Opposing" },
};

const DEFAULT_ALIGNMENT = { color: "#6b7280", borderColor: "border-border", label: "Neutral" };

// Custom node component for case (central node)
function CaseNode({ data }: { data: CaseNodeData }) {
  const { label, caseNumber, caseType, onClick } = data;

  return (
    <div
      className="min-w-[300px] max-w-[400px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base bg-muted border-border dark:bg-slate-900 dark:border-border"
      onClick={onClick}
    >
      <Handle type="source" position={Position.Top} className="!bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      <Handle type="source" position={Position.Left} className="!bg-slate-400" />

      <div className="px-5 py-4 rounded-t-md flex items-center gap-3 bg-muted dark:bg-slate-800">
        <FileText className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
        <div>
          <span className="font-bold text-lg">{label}</span>
          {caseNumber && (
            <div className="text-sm text-muted-foreground">#{caseNumber}</div>
          )}
        </div>
      </div>

      <div className="px-5 py-3">
        {caseType && (
          <div className="text-sm text-muted-foreground">
            Type: {caseType.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </div>
  );
}

interface CaseNodeData {
  label: string;
  caseNumber?: string;
  caseType?: string;
  onClick?: () => void;
}

// Custom node component for contacts
function ContactNode({ data }: { data: ContactNodeData }) {
  const { label, email, phone, company, relationshipType, alignment, isPrimary, onClick } = data;
  const style = RELATIONSHIP_STYLES[relationshipType || ""] || DEFAULT_STYLE;
  const alignmentStyle = ALIGNMENT_STYLES[alignment || ""] || DEFAULT_ALIGNMENT;
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "min-w-[260px] max-w-[320px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base",
        isPrimary
          ? "ring-2 ring-blue-500 ring-offset-2"
          : ""
      )}
      style={{ borderColor: alignmentStyle.color }}
      onClick={onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
      <Handle type="source" position={Position.Right} className="!bg-border" />

      <div
        className="px-4 py-3 rounded-t-md flex items-center gap-3"
        style={{ backgroundColor: `${style.color}20` }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: style.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{label}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {relationshipType?.replace(/_/g, " ") || "Contact"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isPrimary && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              Primary
            </span>
          )}
          {alignment && alignment !== 'neutral' && (
            <span
              className="px-2 py-0.5 text-xs rounded-full text-white"
              style={{ backgroundColor: alignmentStyle.color }}
            >
              {alignmentStyle.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-1 bg-white dark:bg-background">
        {email && (
          <div className="text-sm text-muted-foreground truncate">{email}</div>
        )}
        {phone && (
          <div className="text-sm text-muted-foreground">{phone}</div>
        )}
        {company && (
          <div className="text-sm font-medium truncate">{company}</div>
        )}
      </div>
    </div>
  );
}

interface ContactNodeData {
  label: string;
  email?: string;
  phone?: string;
  company?: string;
  relationshipType?: string;
  alignment?: string;
  isPrimary?: boolean;
  onClick?: () => void;
}

// Custom node component for companies
function CompanyNode({ data }: { data: CompanyNodeData }) {
  const { label, role, onClick } = data;

  return (
    <div
      className="min-w-[220px] max-w-[280px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base bg-indigo-50 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700"
      onClick={onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400" />

      <div className="px-4 py-3 rounded-t-md flex items-center gap-3 bg-indigo-100 dark:bg-indigo-900/50">
        <Building2 className="h-5 w-5 text-indigo-600" />
        <span className="font-semibold">{label}</span>
      </div>

      {role && (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          Role: {role}
        </div>
      )}
    </div>
  );
}

interface CompanyNodeData {
  label: string;
  role?: string;
  onClick?: () => void;
}

// Custom node component for company groups (contacts from same company)
function CompanyGroupNode({ data }: { data: CompanyGroupNodeData }) {
  const { companyName, employees, alignment, onEmployeeClick } = data;
  const alignmentStyle = ALIGNMENT_STYLES[alignment || ""] || DEFAULT_ALIGNMENT;

  return (
    <div
      className="min-w-[280px] max-w-[360px] rounded-lg border-2 shadow-lg text-base bg-white dark:bg-background"
      style={{ borderColor: alignmentStyle.color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400" />

      {/* Company header */}
      <div className="px-4 py-3 rounded-t-md flex items-center gap-3 bg-indigo-100 dark:bg-indigo-900/50">
        <Building2 className="h-5 w-5 text-indigo-600" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{companyName}</div>
          <div className="text-xs text-muted-foreground">
            {employees?.length || 0} contacts
          </div>
        </div>
        {alignment && alignment !== 'neutral' && (
          <span
            className="px-2 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: alignmentStyle.color }}
          >
            {alignmentStyle.label}
          </span>
        )}
      </div>

      {/* Employee list */}
      <div className="divide-y divide-border dark:divide-border">
        {employees?.map((employee) => {
          const empStyle = RELATIONSHIP_STYLES[employee.relationship_type || ""] || DEFAULT_STYLE;
          const Icon = empStyle.icon;

          return (
            <div
              key={employee.id}
              className="px-4 py-2 hover:bg-muted dark:hover:bg-muted cursor-pointer flex items-center gap-3"
              onClick={(e) => {
                e.stopPropagation();
                onEmployeeClick?.(employee.id);
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: empStyle.color }}
              >
                <Icon className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {employee.name}
                  {employee.is_primary && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {employee.formatted_relationship_type || employee.relationship_type?.replace(/_/g, " ") || "Contact"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CompanyGroupNodeData {
  companyName: string;
  employees?: EmployeeData[];
  alignment?: string;
  onEmployeeClick?: (contactId: number) => void;
}

// Custom node component for jobs
function JobNode({ data }: { data: JobNodeData }) {
  const { label, jobId, address, onClick } = data;

  return (
    <div
      className="min-w-[220px] max-w-[280px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700"
      onClick={onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />

      <div className="px-4 py-3 rounded-t-md flex items-center gap-3 bg-amber-100 dark:bg-amber-900/50">
        <Briefcase className="h-5 w-5 text-amber-600" />
        <div>
          <span className="font-semibold">{label}</span>
          {jobId && (
            <div className="text-xs text-muted-foreground">Job #{jobId}</div>
          )}
        </div>
      </div>

      {address && (
        <div className="px-4 py-2 text-sm text-muted-foreground truncate">
          {address}
        </div>
      )}
    </div>
  );
}

interface JobNodeData {
  label: string;
  jobId?: number;
  address?: string;
  onClick?: () => void;
}

// Custom node component for parent case (above current case)
function ParentCaseNode({ data }: { data: ParentCaseNodeData }) {
  const { label, caseNumber, status, childCasesCount, openChildCasesCount, onClick } = data;

  return (
    <div
      className="min-w-[280px] max-w-[360px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base bg-blue-50 border-blue-400 dark:bg-blue-950/30 dark:border-blue-600"
      onClick={onClick}
    >
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />

      <div className="px-4 py-3 rounded-t-md flex items-center gap-3 bg-blue-100 dark:bg-blue-900/50">
        <ChevronUp className="h-5 w-5 text-blue-600" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{label}</div>
          <div className="text-xs text-muted-foreground">#{caseNumber} &middot; Parent Case</div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between text-sm">
        <span className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          status === "open" ? "bg-blue-100 text-blue-700" :
          status === "in_progress" ? "bg-amber-100 text-amber-700" :
          status === "closed" ? "bg-green-100 text-green-700" :
          "bg-muted text-foreground"
        )}>
          {status?.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-muted-foreground">
          {openChildCasesCount || 0}/{childCasesCount || 0} open sub-cases
        </span>
      </div>
    </div>
  );
}

interface ParentCaseNodeData {
  label: string;
  caseNumber?: string;
  status?: string;
  childCasesCount?: number;
  openChildCasesCount?: number;
  onClick?: () => void;
}

// Custom node component for child cases (below current case)
function ChildCaseNode({ data }: { data: ChildCaseNodeData }) {
  const { label, caseNumber, status, priority, overdue, hasChildren, onClick } = data;

  const getStatusIcon = () => {
    switch (status) {
      case "closed": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "in_progress": return <Clock className="h-3 w-3 text-amber-500" />;
      case "open": return <Clock className="h-3 w-3 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <div
      className={cn(
        "min-w-[240px] max-w-[320px] rounded-lg border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow text-base",
        overdue ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-border bg-white dark:bg-slate-900"
      )}
      onClick={onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      {hasChildren && (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      )}

      <div className={cn(
        "px-4 py-3 rounded-t-md flex items-center gap-3",
        overdue ? "bg-red-100 dark:bg-red-900/50" : "bg-muted dark:bg-slate-800"
      )}>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate text-sm">{label}</div>
          <div className="text-xs text-muted-foreground">#{caseNumber}</div>
        </div>
        {overdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
      </div>

      <div className="px-4 py-2 flex items-center gap-2 text-xs">
        <span className={cn(
          "px-2 py-0.5 rounded font-medium flex items-center gap-1",
          status === "open" ? "bg-blue-100 text-blue-700" :
          status === "in_progress" ? "bg-amber-100 text-amber-700" :
          status === "review" ? "bg-purple-100 text-purple-700" :
          status === "closed" ? "bg-green-100 text-green-700" :
          "bg-muted text-foreground"
        )}>
          {getStatusIcon()}
          {status?.replace(/_/g, " ")}
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded font-medium",
          priority === "urgent" ? "bg-red-100 text-red-700" :
          priority === "high" ? "bg-orange-100 text-orange-700" :
          "bg-muted text-foreground"
        )}>
          {priority}
        </span>
        {hasChildren && (
          <span className="text-muted-foreground flex items-center gap-1">
            <FolderTree className="h-3 w-3" /> Sub-cases
          </span>
        )}
      </div>
    </div>
  );
}

interface ChildCaseNodeData {
  label: string;
  caseNumber?: string;
  status?: string;
  priority?: string;
  overdue?: boolean;
  hasChildren?: boolean;
  onClick?: () => void;
}

// Node types registration
const nodeTypes = {
  case: CaseNode,
  contact: ContactNode,
  company: CompanyNode,
  company_group: CompanyGroupNode,
  job: JobNode,
  parent_case: ParentCaseNode,
  child_case: ChildCaseNode,
};

export default function CaseRelationshipChart({
  caseId,
  data,
  onContactClick,
  onCompanyClick,
  onJobClick,
  onCaseClick,
  onPositionChange,
}: CaseRelationshipChartProps) {
  // Build nodes and edges from relationship data
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) {
      return { initialNodes: [], initialEdges: [] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Add case node at center if we have case info
    // 4-quadrant layout: Client (top-left), Advisors (top-right), Neutral (bottom-left), Opposing (bottom-right)
    // Case is in center at (300, 300)
    if (data.case_info) {
      nodes.push({
        id: `case-${data.case_info.id}`,
        type: "case",
        position: { x: 300, y: 300 }, // Center of 4-quadrant layout
        data: {
          label: data.case_info.title,
          caseNumber: data.case_info.case_number,
          caseType: data.case_info.case_type,
        },
      });
    }

    // Process nodes from API
    data.nodes.forEach((node) => {
      // Skip case nodes from API - we already created one from case_info above
      if (node.type === "case") {
        return;
      }

      const nodeData: Record<string, unknown> = { ...node.data };
      const apiData = node.data as Record<string, unknown>;

      // Add click handlers based on node type
      if (node.type === "contact" && onContactClick && node.data.contact_id) {
        nodeData.onClick = () => onContactClick(node.data.contact_id!);
        nodeData.label = node.data.name;
        nodeData.relationshipType = node.data.relationship_type;
        nodeData.alignment = node.data.alignment;
        nodeData.isPrimary = node.data.is_primary;
      } else if (node.type === "company_group") {
        // Company group node with employees inside
        nodeData.companyName = apiData.company_name;
        nodeData.employees = apiData.employees as EmployeeData[];
        nodeData.alignment = apiData.alignment;
        // Allow clicking on individual employees
        if (onContactClick) {
          nodeData.onEmployeeClick = (contactId: number) => onContactClick(contactId);
        }
      } else if (node.type === "company" && onCompanyClick && node.data.company_id) {
        nodeData.onClick = () => onCompanyClick(node.data.company_id!);
        nodeData.label = node.data.name;
      } else if (node.type === "job" && onJobClick && node.data.job_id) {
        nodeData.onClick = () => onJobClick(node.data.job_id!);
        nodeData.label = node.data.name;
        nodeData.jobId = node.data.job_id;
      } else if ((node.type === "parent_case" || node.type === "child_case") && onCaseClick) {
        const caseIdFromNode = apiData.id as number;
        nodeData.onClick = () => onCaseClick(caseIdFromNode);
        nodeData.label = apiData.title;
        nodeData.caseNumber = apiData.case_number;
        nodeData.status = apiData.status;
        nodeData.priority = apiData.priority;
        nodeData.overdue = apiData.overdue;
        nodeData.hasChildren = apiData.has_children;
        nodeData.childCasesCount = apiData.child_cases_count;
        nodeData.openChildCasesCount = apiData.open_child_cases_count;
      } else {
        nodeData.label = node.data.name;
      }

      nodes.push({
        id: node.id,
        type: node.type,
        position: node.position,
        data: nodeData,
      });
    });

    // Process edges from API
    data.edges.forEach((edge) => {
      const relationshipType = edge.data?.relationship_type || "";
      const style = RELATIONSHIP_STYLES[relationshipType] || DEFAULT_STYLE;

      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        label: edge.label,
        labelStyle: {
          fill: style.color,
          fontWeight: 500,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.9,
        },
        labelBgPadding: [4, 4] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: style.color,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: style.color,
        },
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, onContactClick, onCompanyClick, onJobClick, onCaseClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node drag end to save positions
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Check for position changes to save
    changes.forEach((change) => {
      if (change.type === "position" && change.dragging === false && change.position) {
        const nodeId = change.id;
        // Extract contact ID from node ID if it's a contact node
        if (nodeId.startsWith("contact-") && onPositionChange) {
          const contactId = parseInt(nodeId.replace("contact-", ""));
          if (!isNaN(contactId)) {
            onPositionChange(contactId, change.position);
          }
        }
      }
    });
  }, [onNodesChange, onPositionChange]);

  // Calculate chart height based on number of nodes
  const chartHeight = Math.max(600, Math.min(1200, nodes.length * 100 + 200));

  if (!data || nodes.length === 0) {
    return (
      <div className="w-full h-[400px] border rounded-lg bg-muted dark:bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No relationship data available</p>
          <p className="text-sm">Add contacts to the case to see relationships</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full border rounded-lg bg-muted dark:bg-background"
      style={{ height: `${chartHeight}px` }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "case") return "#64748b";
            if (node.type === "parent_case") return "#3b82f6"; // blue
            if (node.type === "child_case") return "#94a3b8"; // slate
            if (node.type === "company") return "#818cf8";
            if (node.type === "company_group") return "#6366f1"; // indigo for company groups
            if (node.type === "job") return "#fbbf24";

            // For contacts, use relationship type color
            const nodeData = node.data as unknown as ContactNodeData;
            const relType = nodeData?.relationshipType;
            const style = RELATIONSHIP_STYLES[relType || ""] || DEFAULT_STYLE;
            return style.color;
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Legend - showing quadrant layout */}
      <div className="absolute bottom-4 left-4 bg-card rounded-lg shadow-lg p-3 text-xs">
        <div className="font-medium mb-2">Layout Quadrants</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Client (top-left)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Advisors (top-right)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-muted0" />
            <span className="text-muted-foreground">Neutral (bottom-left)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Opposing (bottom-right)</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground border-t pt-2">
          Click on contacts to edit their relationship type
        </div>
      </div>
    </div>
  );
}
