"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
  ConnectionMode,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "@/lib/api";

import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

interface Contact {
  id: number;
  display_name: string;
  entity_type: string | null;
  email: string | null;
  mobile_phone: string | null;
}

interface ContactRelationship {
  id: number;
  source_contact_id: number;
  related_contact_id: number;
  relationship_type: string;
  relationship_type_label: string;
  is_active: boolean;
  ownership_percentage: number | null;
  other_contact: {
    id: number;
    name: string;
    entity_type: string;
  };
}

interface ContactsRelationalViewProps {
  contacts: Contact[];
}

// Node colors based on entity type
const getNodeColor = (entityType: string | null) => {
  switch (entityType) {
    case "person":
      return "#3b82f6"; // blue
    case "company":
      return "#10b981"; // green
    case "trust":
      return "#8b5cf6"; // purple
    case "sole_trader":
      return "#f59e0b"; // amber
    default:
      return "#6b7280"; // gray
  }
};

// Edge colors based on relationship type
const getEdgeColor = (relationshipType: string) => {
  if (relationshipType.includes("employee") || relationshipType.includes("contractor")) {
    return "#3b82f6"; // blue - employment
  } else if (relationshipType.includes("director") || relationshipType.includes("shareholder")) {
    return "#10b981"; // green - company roles
  } else if (relationshipType.includes("trustee") || relationshipType.includes("beneficiary")) {
    return "#8b5cf6"; // purple - trust roles
  } else if (relationshipType.includes("family")) {
    return "#ec4899"; // pink - personal
  }
  return "#6b7280"; // gray - other
};

export default function ContactsRelationalView({ contacts }: ContactsRelationalViewProps) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([
    "person",
    "company",
    "trust",
    "sole_trader",
  ]);

  // Fetch all relationships for all contacts
  const fetchRelationships = useCallback(async () => {
    setLoading(true);
    try {
      // Get relationships for contacts (limit to first 100 to avoid overwhelming the graph)
      const contactsToProcess = contacts.slice(0, 100);

      const relationshipsPromises = contactsToProcess.map((contact) =>
        api
          .get<{ relationships: { outgoing: ContactRelationship[]; incoming: ContactRelationship[] } }>(
            `/api/v1/contacts/${contact.id}/relationships`
          )
          .then((data) => ({
            contactId: contact.id,
            relationships: data.relationships.outgoing || [],
          }))
          .catch(() => ({
            contactId: contact.id,
            relationships: [],
          }))
      );

      const allRelationships = await Promise.all(relationshipsPromises);

      // Build a map of contact ID -> relationships
      const relationshipMap = new Map<number, ContactRelationship[]>();
      allRelationships.forEach(({ contactId, relationships }) => {
        relationshipMap.set(contactId, relationships);
      });

      // Filter contacts that have relationships
      const contactsWithRelationships = contactsToProcess.filter(
        (contact) => (relationshipMap.get(contact.id) || []).length > 0
      );

      // Create nodes
      const flowNodes: Node[] = contactsWithRelationships.map((contact, index) => {
        const angle = (index / contactsWithRelationships.length) * 2 * Math.PI;
        const radius = 300;
        const x = Math.cos(angle) * radius + 400;
        const y = Math.sin(angle) * radius + 300;

        return {
          id: contact.id.toString(),
          type: "default",
          data: {
            label: (
              <div className="text-xs">
                <div className="font-semibold">{contact.display_name}</div>
                <div className="text-[10px] text-muted-foreground">{contact.entity_type}</div>
              </div>
            ),
          },
          position: { x, y },
          style: {
            background: getNodeColor(contact.entity_type),
            color: "white",
            border: "2px solid white",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
            minWidth: "120px",
            textAlign: "center",
          },
        };
      });

      // Create edges
      const flowEdges: Edge[] = [];
      const addedEdges = new Set<string>();

      allRelationships.forEach(({ contactId, relationships }) => {
        relationships.forEach((rel) => {
          // Only show active relationships
          if (!rel.is_active) return;

          // Create a unique edge key (bidirectional, so sort IDs)
          const edgeKey = [contactId, rel.related_contact_id].sort().join("-");

          // Skip if we already added this edge
          if (addedEdges.has(edgeKey)) return;
          addedEdges.add(edgeKey);

          const label = rel.ownership_percentage
            ? `${rel.relationship_type_label} (${rel.ownership_percentage}%)`
            : rel.relationship_type_label;

          flowEdges.push({
            id: `${contactId}-${rel.related_contact_id}`,
            source: contactId.toString(),
            target: rel.related_contact_id.toString(),
            label,
            type: "default",
            animated: false,
            style: {
              stroke: getEdgeColor(rel.relationship_type),
              strokeWidth: 2,
            },
            labelStyle: {
              fontSize: 10,
              fill: "#666",
            },
            labelBgStyle: {
              fill: "white",
              fillOpacity: 0.9,
            },
          });
        });
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error("Failed to fetch relationships:", error);
    } finally {
      setLoading(false);
    }
  }, [contacts, setNodes, setEdges]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // Handle node click - navigate to contact detail
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      router.push(`/contacts/${node.id}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] border rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">No relationships found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add relationships to contacts to see them visualized here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg" style={{ height: "600px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const contact = contacts.find((c) => c.id.toString() === node.id);
            return getNodeColor(contact?.entity_type || null);
          }}
          zoomable
          pannable
        />
        <Panel position="top-right" className="bg-white p-3 rounded-lg shadow-md text-xs">
          <div className="font-semibold mb-2">Legend</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#3b82f6" }} />
              <span>Person</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#10b981" }} />
              <span>Company</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#8b5cf6" }} />
              <span>Trust</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#f59e0b" }} />
              <span>Sole Trader</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="font-semibold mb-2">Relationships</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ background: "#3b82f6" }} />
                <span>Employment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ background: "#10b981" }} />
                <span>Company Roles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ background: "#8b5cf6" }} />
                <span>Trust Roles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ background: "#ec4899" }} />
                <span>Family</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
