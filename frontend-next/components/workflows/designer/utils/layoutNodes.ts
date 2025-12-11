import dagre from "dagre";
import { Node, Edge } from "@xyflow/react";

// Node dimensions for layout calculation (horizontal flow)
// IMPORTANT: These must match the actual component widths in the node files
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  start_event: { width: 100, height: 40 },
  end_event: { width: 80, height: 40 },
  timer_event: { width: 140, height: 50 },
  intermediate_event: { width: 180, height: 50 },
  user_task: { width: 180, height: 60 },
  service_task: { width: 180, height: 60 },
  exclusive_gateway: { width: 120, height: 50 },
  parallel_gateway: { width: 120, height: 50 },
  data_store_reference: { width: 180, height: 60 },
  sub_process: { width: 180, height: 60 },
  annotation: { width: 200, height: 80 },
  pool: { width: 200, height: 60 },
  lane: { width: 180, height: 60 },
};

const DEFAULT_DIMENSIONS = { width: 150, height: 60 };

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  rankSpacing?: number;
}

/**
 * Snaps a value to the nearest grid point
 * @param value - Value to snap
 * @param gridSize - Grid size
 * @returns Snapped value
 */
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Applies automatic layout to nodes using dagre algorithm with grid snapping
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges
 * @param options - Layout options
 * @returns Layouted nodes with updated positions
 */
export function getLayoutedElements<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node<T>[] {
  const {
    direction = "LR",
    nodeSpacing = 50,
    rankSpacing = 80,
  } = options;

  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 50,
    marginy: 50,
    // Enable alignment for cleaner layouts
    align: direction === "LR" || direction === "RL" ? "UL" : "UL",
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    const nodeType = node.type || "default";
    const dimensions = NODE_DIMENSIONS[nodeType] || DEFAULT_DIMENSIONS;
    dagreGraph.setNode(node.id, {
      width: dimensions.width,
      height: dimensions.height,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(dagreGraph);

  // Grid size for snapping (20px matches ReactFlow snap grid)
  const GRID_SIZE = 20;

  // Apply calculated positions to nodes with grid snapping
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeType = node.type || "default";
    const dimensions = NODE_DIMENSIONS[nodeType] || DEFAULT_DIMENSIONS;

    // Calculate position (centered on dagre position)
    const rawX = nodeWithPosition.x - dimensions.width / 2;
    const rawY = nodeWithPosition.y - dimensions.height / 2;

    return {
      ...node,
      position: {
        // Snap to grid for perfect alignment
        x: snapToGrid(rawX, GRID_SIZE),
        y: snapToGrid(rawY, GRID_SIZE),
      },
    };
  });
}

/**
 * Aligns selected nodes horizontally (same Y position) with grid snapping
 * @param nodes - All nodes
 * @param selectedNodeIds - IDs of selected nodes
 * @returns Updated nodes with aligned positions
 */
export function alignNodesHorizontally<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedNodeIds: string[]
): Node<T>[] {
  if (selectedNodeIds.length < 2) return nodes;

  const GRID_SIZE = 20;
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const avgY =
    selectedNodes.reduce((sum, n) => sum + n.position.y, 0) /
    selectedNodes.length;

  // Snap to grid for perfect alignment
  const alignedY = snapToGrid(avgY, GRID_SIZE);

  return nodes.map((node) =>
    selectedNodeIds.includes(node.id)
      ? { ...node, position: { ...node.position, y: alignedY } }
      : node
  );
}

/**
 * Aligns selected nodes vertically (same X position) with grid snapping
 * @param nodes - All nodes
 * @param selectedNodeIds - IDs of selected nodes
 * @returns Updated nodes with aligned positions
 */
export function alignNodesVertically<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedNodeIds: string[]
): Node<T>[] {
  if (selectedNodeIds.length < 2) return nodes;

  const GRID_SIZE = 20;
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const avgX =
    selectedNodes.reduce((sum, n) => sum + n.position.x, 0) /
    selectedNodes.length;

  // Snap to grid for perfect alignment
  const alignedX = snapToGrid(avgX, GRID_SIZE);

  return nodes.map((node) =>
    selectedNodeIds.includes(node.id)
      ? { ...node, position: { ...node.position, x: alignedX } }
      : node
  );
}

/**
 * Distributes selected nodes evenly horizontally
 * @param nodes - All nodes
 * @param selectedNodeIds - IDs of selected nodes
 * @returns Updated nodes with distributed positions
 */
export function distributeNodesHorizontally<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedNodeIds: string[]
): Node<T>[] {
  if (selectedNodeIds.length < 3) return nodes;

  const selectedNodes = nodes
    .filter((n) => selectedNodeIds.includes(n.id))
    .sort((a, b) => a.position.x - b.position.x);

  const minX = selectedNodes[0].position.x;
  const maxX = selectedNodes[selectedNodes.length - 1].position.x;
  const step = (maxX - minX) / (selectedNodes.length - 1);

  const newPositions = new Map<string, number>();
  selectedNodes.forEach((node, index) => {
    newPositions.set(node.id, minX + step * index);
  });

  return nodes.map((node) =>
    newPositions.has(node.id)
      ? { ...node, position: { ...node.position, x: newPositions.get(node.id)! } }
      : node
  );
}

/**
 * Distributes selected nodes evenly vertically
 * @param nodes - All nodes
 * @param selectedNodeIds - IDs of selected nodes
 * @returns Updated nodes with distributed positions
 */
export function distributeNodesVertically<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedNodeIds: string[]
): Node<T>[] {
  if (selectedNodeIds.length < 3) return nodes;

  const selectedNodes = nodes
    .filter((n) => selectedNodeIds.includes(n.id))
    .sort((a, b) => a.position.y - b.position.y);

  const minY = selectedNodes[0].position.y;
  const maxY = selectedNodes[selectedNodes.length - 1].position.y;
  const step = (maxY - minY) / (selectedNodes.length - 1);

  const newPositions = new Map<string, number>();
  selectedNodes.forEach((node, index) => {
    newPositions.set(node.id, minY + step * index);
  });

  return nodes.map((node) =>
    newPositions.has(node.id)
      ? { ...node, position: { ...node.position, y: newPositions.get(node.id)! } }
      : node
  );
}
