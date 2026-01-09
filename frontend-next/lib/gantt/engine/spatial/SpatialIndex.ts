/**
 * SpatialIndex - Optimized spatial indexing for hit testing
 *
 * Uses a grid-based spatial hash for O(1) average case hit testing.
 * Falls back to linear scan for edge cases.
 *
 * Performance targets:
 * - Insert: O(1) average
 * - Remove: O(1) average
 * - Query point: O(1) average, O(n) worst case
 * - Query rect: O(k) where k = items in rect
 *
 * @example
 * ```typescript
 * const index = new SpatialIndex(50); // 50px cell size
 *
 * // Insert items with their bounds
 * index.insert('task-1', { x: 100, y: 0, width: 200, height: 30 });
 * index.insert('task-2', { x: 150, y: 30, width: 180, height: 30 });
 *
 * // Query by point
 * const hits = index.queryPoint(120, 15); // Returns ['task-1']
 *
 * // Query by rectangle
 * const inRect = index.queryRect({ x: 100, y: 0, width: 100, height: 60 });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

interface IndexEntry {
  id: string;
  bounds: Rect;
  cells: Set<string>; // Cell keys this item occupies
}

// ============================================================================
// SpatialIndex Class
// ============================================================================

export class SpatialIndex {
  // Grid configuration
  private readonly cellSize: number;

  // Data structures
  private grid: Map<string, Set<string>> = new Map(); // cellKey -> itemIds
  private items: Map<string, IndexEntry> = new Map(); // itemId -> entry

  // Statistics
  private queryCount: number = 0;
  private insertCount: number = 0;
  private hitCount: number = 0;

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new SpatialIndex
   * @param cellSize Size of grid cells in pixels (default: 50)
   */
  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  // ============================================================================
  // Public API - CRUD Operations
  // ============================================================================

  /**
   * Insert an item into the index
   * @param id Unique identifier for the item
   * @param bounds Bounding rectangle
   */
  insert(id: string, bounds: Rect): void {
    // Remove existing entry if present
    if (this.items.has(id)) {
      this.remove(id);
    }

    // Calculate which cells this item occupies
    const cells = this.getCellsForRect(bounds);

    // Create entry
    const entry: IndexEntry = {
      id,
      bounds: { ...bounds },
      cells,
    };

    // Add to items map
    this.items.set(id, entry);

    // Add to grid cells
    for (const cellKey of cells) {
      let cellItems = this.grid.get(cellKey);
      if (!cellItems) {
        cellItems = new Set();
        this.grid.set(cellKey, cellItems);
      }
      cellItems.add(id);
    }

    this.insertCount++;
  }

  /**
   * Update an item's bounds
   * @param id Item identifier
   * @param bounds New bounding rectangle
   */
  update(id: string, bounds: Rect): void {
    // For simplicity, just re-insert
    this.insert(id, bounds);
  }

  /**
   * Remove an item from the index
   * @param id Item identifier
   */
  remove(id: string): boolean {
    const entry = this.items.get(id);
    if (!entry) {
      return false;
    }

    // Remove from all grid cells
    for (const cellKey of entry.cells) {
      const cellItems = this.grid.get(cellKey);
      if (cellItems) {
        cellItems.delete(id);
        // Clean up empty cells
        if (cellItems.size === 0) {
          this.grid.delete(cellKey);
        }
      }
    }

    // Remove from items map
    this.items.delete(id);
    return true;
  }

  /**
   * Clear all items from the index
   */
  clear(): void {
    this.grid.clear();
    this.items.clear();
  }

  // ============================================================================
  // Public API - Query Operations
  // ============================================================================

  /**
   * Query items at a specific point
   * @param x X coordinate
   * @param y Y coordinate
   * @returns Array of item IDs at this point
   */
  queryPoint(x: number, y: number): string[] {
    this.queryCount++;

    const cellKey = this.getCellKey(x, y);
    const cellItems = this.grid.get(cellKey);

    if (!cellItems || cellItems.size === 0) {
      return [];
    }

    // Check each item in the cell for actual intersection
    const results: string[] = [];
    for (const id of cellItems) {
      const entry = this.items.get(id);
      if (entry && this.pointInRect(x, y, entry.bounds)) {
        results.push(id);
        this.hitCount++;
      }
    }

    return results;
  }

  /**
   * Query items intersecting a rectangle
   * @param rect Query rectangle
   * @returns Array of item IDs intersecting the rectangle
   */
  queryRect(rect: Rect): string[] {
    this.queryCount++;

    const cells = this.getCellsForRect(rect);
    const candidateIds = new Set<string>();

    // Collect all candidates from intersecting cells
    for (const cellKey of cells) {
      const cellItems = this.grid.get(cellKey);
      if (cellItems) {
        for (const id of cellItems) {
          candidateIds.add(id);
        }
      }
    }

    // Filter candidates by actual intersection
    const results: string[] = [];
    for (const id of candidateIds) {
      const entry = this.items.get(id);
      if (entry && this.rectsIntersect(rect, entry.bounds)) {
        results.push(id);
        this.hitCount++;
      }
    }

    return results;
  }

  /**
   * Query items completely contained within a rectangle
   * @param rect Container rectangle
   * @returns Array of item IDs fully inside the rectangle
   */
  queryContained(rect: Rect): string[] {
    this.queryCount++;

    const cells = this.getCellsForRect(rect);
    const candidateIds = new Set<string>();

    for (const cellKey of cells) {
      const cellItems = this.grid.get(cellKey);
      if (cellItems) {
        for (const id of cellItems) {
          candidateIds.add(id);
        }
      }
    }

    const results: string[] = [];
    for (const id of candidateIds) {
      const entry = this.items.get(id);
      if (entry && this.rectContains(rect, entry.bounds)) {
        results.push(id);
        this.hitCount++;
      }
    }

    return results;
  }

  /**
   * Get the item closest to a point
   * @param x X coordinate
   * @param y Y coordinate
   * @param maxDistance Maximum search distance (optional)
   * @returns Closest item ID or null
   */
  queryNearest(x: number, y: number, maxDistance?: number): string | null {
    this.queryCount++;

    // Start with point query
    const atPoint = this.queryPoint(x, y);
    if (atPoint.length > 0) {
      return atPoint[0];
    }

    // Expand search in rings
    const maxRings = maxDistance ? Math.ceil(maxDistance / this.cellSize) : 3;
    let nearestId: string | null = null;
    let nearestDist = Infinity;

    for (let ring = 1; ring <= maxRings; ring++) {
      const searchRect: Rect = {
        x: x - ring * this.cellSize,
        y: y - ring * this.cellSize,
        width: ring * 2 * this.cellSize,
        height: ring * 2 * this.cellSize,
      };

      const candidates = this.queryRect(searchRect);
      for (const id of candidates) {
        const entry = this.items.get(id);
        if (entry) {
          const dist = this.distanceToRect(x, y, entry.bounds);
          if (dist < nearestDist && (!maxDistance || dist <= maxDistance)) {
            nearestDist = dist;
            nearestId = id;
          }
        }
      }

      // If we found something in this ring, no need to expand further
      if (nearestId !== null) {
        break;
      }
    }

    return nearestId;
  }

  // ============================================================================
  // Public API - State Access
  // ============================================================================

  /**
   * Get bounds for an item
   * @param id Item identifier
   */
  getBounds(id: string): Rect | undefined {
    return this.items.get(id)?.bounds;
  }

  /**
   * Check if an item exists in the index
   */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * Get the number of items in the index
   */
  size(): number {
    return this.items.size;
  }

  /**
   * Get all item IDs
   */
  getAllIds(): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    itemCount: number;
    cellCount: number;
    queryCount: number;
    insertCount: number;
    hitCount: number;
    avgItemsPerCell: number;
  } {
    let totalItems = 0;
    for (const cell of this.grid.values()) {
      totalItems += cell.size;
    }

    return {
      itemCount: this.items.size,
      cellCount: this.grid.size,
      queryCount: this.queryCount,
      insertCount: this.insertCount,
      hitCount: this.hitCount,
      avgItemsPerCell: this.grid.size > 0 ? totalItems / this.grid.size : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryCount = 0;
    this.insertCount = 0;
    this.hitCount = 0;
  }

  // ============================================================================
  // Private Methods - Cell Operations
  // ============================================================================

  /**
   * Get the cell key for a point
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cell keys that a rectangle occupies
   */
  private getCellsForRect(rect: Rect): Set<string> {
    const cells = new Set<string>();

    const startCellX = Math.floor(rect.x / this.cellSize);
    const startCellY = Math.floor(rect.y / this.cellSize);
    const endCellX = Math.floor((rect.x + rect.width) / this.cellSize);
    const endCellY = Math.floor((rect.y + rect.height) / this.cellSize);

    for (let cellX = startCellX; cellX <= endCellX; cellX++) {
      for (let cellY = startCellY; cellY <= endCellY; cellY++) {
        cells.add(`${cellX},${cellY}`);
      }
    }

    return cells;
  }

  // ============================================================================
  // Private Methods - Geometry
  // ============================================================================

  /**
   * Check if a point is inside a rectangle
   */
  private pointInRect(x: number, y: number, rect: Rect): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  /**
   * Check if two rectangles intersect
   */
  private rectsIntersect(a: Rect, b: Rect): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Check if rect 'a' fully contains rect 'b'
   */
  private rectContains(a: Rect, b: Rect): boolean {
    return (
      b.x >= a.x &&
      b.y >= a.y &&
      b.x + b.width <= a.x + a.width &&
      b.y + b.height <= a.y + a.height
    );
  }

  /**
   * Calculate distance from a point to a rectangle
   */
  private distanceToRect(x: number, y: number, rect: Rect): number {
    const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
    const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export default SpatialIndex;
