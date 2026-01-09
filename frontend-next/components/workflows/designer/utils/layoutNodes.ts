import dagre from "dagre";
import { Node, Edge } from "@xyflow/react";

// Node dimensions for layout calculation (horizontal flow)
// IMPORTANT: These must match the actual component widths in the node files
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  start_event: { width: 180, height: 70 },
  end_event: { width: 150, height: 70 },
  timer_event: { width: 250, height: 90 },
  intermediate_event: { width: 320, height: 90 },
  user_task: { width: 350, height: 140 },
  service_task: { width: 350, height: 140 },
  exclusive_gateway: { width: 180, height: 90 },
  parallel_gateway: { width: 180, height: 90 },
  data_store_reference: { width: 350, height: 140 },
  sub_process: { width: 350, height: 140 },
  annotation: { width: 380, height: 160 },
  pool: { width: 380, height: 140 },
  lane: { width: 350, height: 140 },
};

const DEFAULT_DIMENSIONS = { width: 320, height: 140 };

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
  const COL_WIDTH = 450;  // Horizontal spacing between columns (RULE: must be > node width to prevent overlap)
  const ROW_HEIGHT = 320; // Vertical spacing between rows (RULE: nodes can NEVER overlap)
  const START_X = -350;   // Negative offset to shift workflow left and eliminate wasted space
  const START_Y = 150;    // Starting Y offset to align with canvas rows

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  edges.forEach(edge => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  });

  // Find parallel gateways and start node
  const startNode = nodes.find(n => (!incoming.has(n.id) || incoming.get(n.id)!.length === 0) && n.type === 'start_event');
  const parallelGateways = nodes.filter(n => n.type === 'parallel_gateway');
  const endNode = nodes.find(n => n.type === 'end_event');

  // Track positions - using fractional rows for gateways at intersection points
  const nodePositions = new Map<string, {col: number, row: number}>();
  let branchCount = 0;

  // Start event at column 0
  if (startNode) {
    nodePositions.set(startNode.id, {col: 0, row: 1}); // Will be adjusted after we know branch count
  }

  // First parallel gateway at column 1
  if (parallelGateways[0]) {
    // Get the parallel branches to determine row spread
    const branches = outgoing.get(parallelGateways[0].id) || [];
    branchCount = branches.length;

    // For each branch, traverse and assign positions
    branches.forEach((branchStartId, branchIndex) => {
      let currentId = branchStartId;
      let col = 2; // Start at column 2

      // Walk this branch until we hit the convergence gateway
      while (currentId) {
        // Assign this node to its row and column
        nodePositions.set(currentId, {col, row: branchIndex});

        // Get next node in path
        const nextNodes = outgoing.get(currentId) || [];
        if (nextNodes.length === 0) break;

        const nextId = nextNodes[0];
        const nextNode = nodes.find(n => n.id === nextId);

        // Stop if we hit the convergence gateway
        if (nextNode?.type === 'parallel_gateway') break;

        // Move to next node
        currentId = nextId;
        col++;
      }
    });

    // Position the split gateway at the visual center of all branches
    // For 3 branches (rows 0, 1, 2), center is row 1
    // For 2 branches (rows 0, 1), center is row 0.5
    const centerRow = (branchCount - 1) / 2;
    // Position gateway at col 1.8 (closer to tasks) so edges visually originate from it
    nodePositions.set(parallelGateways[0].id, {col: 1.8, row: centerRow});

    // Also adjust start node to align with gateway
    if (startNode) {
      nodePositions.set(startNode.id, {col: 0, row: centerRow});
    }
  }

  // Find max column used
  const maxCol = Math.max(
    ...Array.from(nodePositions.values()).map(p => p.col),
    0
  );

  // Second parallel gateway (convergence) - position closer to tasks so edges converge AT it
  if (parallelGateways[1]) {
    const centerRow = (branchCount - 1) / 2;
    // Position at col maxCol + 0.2 (closer to tasks) so edges visually converge at it
    nodePositions.set(parallelGateways[1].id, {col: maxCol + 0.2, row: centerRow});
  }

  // End event - align with gateways
  if (endNode) {
    const centerRow = (branchCount - 1) / 2;
    nodePositions.set(endNode.id, {col: maxCol + 1.2, row: centerRow});
  }

  // Ensure all nodes have positions - assign any missing nodes
  nodes.forEach(node => {
    if (!nodePositions.has(node.id)) {
      console.warn(`Node ${node.id} not positioned, defaulting to row 1`);
      nodePositions.set(node.id, {col: maxCol + 3, row: 1});
    }
  });

  // Apply grid positions with offsets to align with canvas grid
  return nodes.map(node => {
    const pos = nodePositions.get(node.id)!; // Now guaranteed to exist

    // Get node dimensions for both horizontal and vertical centering
    const dimensions = NODE_DIMENSIONS[node.type || ''] || DEFAULT_DIMENSIONS;

    // Calculate exact Y position for this row - supports fractional rows for centered gateways
    const rowCenterY = START_Y + (pos.row * ROW_HEIGHT);
    const rowY = Math.round(rowCenterY - (dimensions.height / 2));

    // Debug logging
    console.log(`Node: ${node.data?.name || node.id}, Row: ${pos.row}, Col: ${pos.col}, Y: ${rowY}, Height: ${dimensions.height}`);

    return {
      ...node,
      position: {
        x: Math.round(START_X + (pos.col * COL_WIDTH) - (dimensions.width / 2)),
        y: rowY,
      },
      // Prevent React Flow from auto-positioning
      draggable: node.draggable ?? true,
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
