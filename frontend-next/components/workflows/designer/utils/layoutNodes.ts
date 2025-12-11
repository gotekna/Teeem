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
 * Groups values that are close together (within threshold)
 * and returns the average for each group
 */
function groupAndAlignValues(values: number[], threshold: number = 40): Map<number, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];

  sorted.forEach(value => {
    // Find a group this value belongs to
    let foundGroup = false;
    for (const group of groups) {
      const groupAvg = group.reduce((sum, v) => sum + v, 0) / group.length;
      if (Math.abs(value - groupAvg) <= threshold) {
        group.push(value);
        foundGroup = true;
        break;
      }
    }

    // Create new group if not found
    if (!foundGroup) {
      groups.push([value]);
    }
  });

  // Create a map of original value -> aligned value
  const alignmentMap = new Map<number, number>();
  groups.forEach(group => {
    const alignedValue = group.reduce((sum, v) => sum + v, 0) / group.length;
    const snappedValue = snapToGrid(alignedValue, 20);
    group.forEach(originalValue => {
      alignmentMap.set(originalValue, snappedValue);
    });
  });

  return alignmentMap;
}

/**
 * Simple custom grid layout - ignores dagre and uses fixed grid positions
 */
function simpleGridLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[]
): Node<T>[] {
  const COL_WIDTH = 250;  // Horizontal spacing between columns
  const ROW_HEIGHT = 150; // Vertical spacing between rows

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  edges.forEach(edge => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  });

  // Find start nodes (no incoming edges)
  const startNodes = nodes.filter(n => !incoming.has(n.id) || incoming.get(n.id)!.length === 0);

  // Assign column (depth) to each node using BFS
  const nodeColumns = new Map<string, number>();
  const nodeRows = new Map<string, number>();
  const queue: Array<{id: string, col: number, row: number}> = [];

  startNodes.forEach((n, idx) => {
    queue.push({id: n.id, col: 0, row: idx});
    nodeColumns.set(n.id, 0);
    nodeRows.set(n.id, idx);
  });

  const visited = new Set<string>();

  while (queue.length > 0) {
    const {id, col, row} = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const neighbors = outgoing.get(id) || [];

    // Check if this is a parallel gateway (multiple outgoing edges)
    if (neighbors.length > 1) {
      // Parallel split - assign each branch to a different row
      neighbors.forEach((neighborId, idx) => {
        if (!nodeColumns.has(neighborId)) {
          nodeColumns.set(neighborId, col + 1);
          nodeRows.set(neighborId, idx);
          queue.push({id: neighborId, col: col + 1, row: idx});
        }
      });
    } else {
      // Single path - continue in same row
      neighbors.forEach(neighborId => {
        if (!nodeColumns.has(neighborId)) {
          nodeColumns.set(neighborId, col + 1);
          nodeRows.set(neighborId, row);
          queue.push({id: neighborId, col: col + 1, row: row});
        }
      });
    }
  }

  // Apply grid positions
  return nodes.map(node => {
    const col = nodeColumns.get(node.id) ?? 0;
    const row = nodeRows.get(node.id) ?? 0;

    return {
      ...node,
      position: {
        x: col * COL_WIDTH,
        y: row * ROW_HEIGHT,
      },
    };
  });
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
  // Use simple grid layout instead of dagre for perfect alignment
  return simpleGridLayout(nodes, edges);
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
