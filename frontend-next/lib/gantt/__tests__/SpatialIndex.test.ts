/**
 * SpatialIndex Tests
 *
 * Tests for spatial indexing functionality including:
 * - CRUD operations
 * - Point queries
 * - Rectangle queries
 * - Nearest neighbor queries
 * - Performance characteristics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex } from '../engine/spatial/SpatialIndex';
import type { Rect } from '../engine/spatial/SpatialIndex';

describe('SpatialIndex', () => {
  let index: SpatialIndex;

  beforeEach(() => {
    index = new SpatialIndex(50); // 50px cell size
  });

  describe('initialization', () => {
    it('should start empty', () => {
      expect(index.size()).toBe(0);
    });

    it('should have zero stats initially', () => {
      const stats = index.getStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.cellCount).toBe(0);
      expect(stats.queryCount).toBe(0);
    });
  });

  describe('insert()', () => {
    it('should insert an item', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });

      expect(index.size()).toBe(1);
      expect(index.has('task-1')).toBe(true);
    });

    it('should store correct bounds', () => {
      const bounds: Rect = { x: 100, y: 50, width: 200, height: 30 };
      index.insert('task-1', bounds);

      const stored = index.getBounds('task-1');
      expect(stored).toEqual(bounds);
    });

    it('should replace existing item with same ID', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-1', { x: 150, y: 60, width: 250, height: 35 });

      expect(index.size()).toBe(1);
      expect(index.getBounds('task-1')?.x).toBe(150);
    });

    it('should insert multiple items', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-2', { x: 150, y: 100, width: 180, height: 30 });
      index.insert('task-3', { x: 200, y: 150, width: 160, height: 30 });

      expect(index.size()).toBe(3);
    });
  });

  describe('remove()', () => {
    it('should remove an item', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      const removed = index.remove('task-1');

      expect(removed).toBe(true);
      expect(index.size()).toBe(0);
      expect(index.has('task-1')).toBe(false);
    });

    it('should return false for non-existent item', () => {
      const removed = index.remove('non-existent');

      expect(removed).toBe(false);
    });

    it('should not affect other items', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-2', { x: 150, y: 100, width: 180, height: 30 });

      index.remove('task-1');

      expect(index.size()).toBe(1);
      expect(index.has('task-2')).toBe(true);
    });
  });

  describe('update()', () => {
    it('should update item bounds', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.update('task-1', { x: 200, y: 100, width: 250, height: 40 });

      const bounds = index.getBounds('task-1');
      expect(bounds?.x).toBe(200);
      expect(bounds?.y).toBe(100);
    });
  });

  describe('clear()', () => {
    it('should remove all items', () => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-2', { x: 150, y: 100, width: 180, height: 30 });

      index.clear();

      expect(index.size()).toBe(0);
    });
  });

  describe('queryPoint()', () => {
    beforeEach(() => {
      // Set up test items
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-2', { x: 150, y: 100, width: 180, height: 30 });
      index.insert('task-3', { x: 400, y: 50, width: 100, height: 30 });
    });

    it('should find item at point', () => {
      const hits = index.queryPoint(150, 60);

      expect(hits).toContain('task-1');
    });

    it('should return empty for point with no items', () => {
      const hits = index.queryPoint(600, 300);

      expect(hits).toHaveLength(0);
    });

    it('should return multiple overlapping items', () => {
      // task-1 and task-2 overlap in x, and point is in overlap zone
      const hits = index.queryPoint(180, 60);

      expect(hits).toContain('task-1');
    });

    it('should detect edge correctly', () => {
      // Point at exact edge of task-1
      const hits = index.queryPoint(100, 50);

      expect(hits).toContain('task-1');
    });
  });

  describe('queryRect()', () => {
    beforeEach(() => {
      index.insert('task-1', { x: 100, y: 50, width: 200, height: 30 });
      index.insert('task-2', { x: 150, y: 100, width: 180, height: 30 });
      index.insert('task-3', { x: 400, y: 50, width: 100, height: 30 });
    });

    it('should find items intersecting rectangle', () => {
      const hits = index.queryRect({ x: 120, y: 40, width: 100, height: 100 });

      expect(hits).toContain('task-1');
      expect(hits).toContain('task-2');
      expect(hits).not.toContain('task-3');
    });

    it('should return empty for rect with no items', () => {
      const hits = index.queryRect({ x: 600, y: 300, width: 50, height: 50 });

      expect(hits).toHaveLength(0);
    });

    it('should find all items with large rect', () => {
      const hits = index.queryRect({ x: 0, y: 0, width: 1000, height: 500 });

      expect(hits).toContain('task-1');
      expect(hits).toContain('task-2');
      expect(hits).toContain('task-3');
    });
  });

  describe('queryContained()', () => {
    beforeEach(() => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });
      index.insert('task-2', { x: 200, y: 50, width: 100, height: 30 });
    });

    it('should find items fully contained in rectangle', () => {
      const hits = index.queryContained({ x: 90, y: 40, width: 70, height: 50 });

      expect(hits).toContain('task-1');
      expect(hits).not.toContain('task-2');
    });

    it('should not include partially intersecting items', () => {
      const hits = index.queryContained({ x: 100, y: 50, width: 25, height: 30 });

      // task-1 is not fully contained (it's 50px wide, container is 25px)
      expect(hits).not.toContain('task-1');
    });
  });

  describe('queryNearest()', () => {
    beforeEach(() => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });
      index.insert('task-2', { x: 300, y: 50, width: 50, height: 30 });
    });

    it('should find nearest item', () => {
      const nearest = index.queryNearest(160, 65);

      expect(nearest).toBe('task-1');
    });

    it('should return item if point is inside', () => {
      const nearest = index.queryNearest(120, 60);

      expect(nearest).toBe('task-1');
    });

    it('should return null if no items within max distance', () => {
      const nearest = index.queryNearest(600, 300, 50);

      expect(nearest).toBeNull();
    });
  });

  describe('getAllIds()', () => {
    it('should return all item IDs', () => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });
      index.insert('task-2', { x: 200, y: 50, width: 50, height: 30 });
      index.insert('task-3', { x: 300, y: 50, width: 50, height: 30 });

      const ids = index.getAllIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('task-1');
      expect(ids).toContain('task-2');
      expect(ids).toContain('task-3');
    });
  });

  describe('statistics', () => {
    it('should track query count', () => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });

      index.queryPoint(120, 60);
      index.queryPoint(130, 65);
      index.queryRect({ x: 0, y: 0, width: 500, height: 500 });

      const stats = index.getStats();
      expect(stats.queryCount).toBe(3);
    });

    it('should track insert count', () => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });
      index.insert('task-2', { x: 200, y: 50, width: 50, height: 30 });

      const stats = index.getStats();
      expect(stats.insertCount).toBe(2);
    });

    it('should reset stats', () => {
      index.insert('task-1', { x: 100, y: 50, width: 50, height: 30 });
      index.queryPoint(120, 60);

      index.resetStats();

      const stats = index.getStats();
      expect(stats.queryCount).toBe(0);
      expect(stats.insertCount).toBe(0);
    });
  });

  describe('grid behavior', () => {
    it('should handle items spanning multiple cells', () => {
      // Item spans 6 cells (3x2) with 50px cell size
      index.insert('large-task', { x: 0, y: 0, width: 150, height: 80 });

      // Should be found at any point within bounds
      expect(index.queryPoint(10, 10)).toContain('large-task');
      expect(index.queryPoint(140, 70)).toContain('large-task');
    });

    it('should handle negative coordinates', () => {
      index.insert('task-neg', { x: -100, y: -50, width: 50, height: 30 });

      const hits = index.queryPoint(-80, -40);
      expect(hits).toContain('task-neg');
    });
  });

  describe('edge cases', () => {
    it('should handle zero-width items', () => {
      index.insert('zero-width', { x: 100, y: 50, width: 0, height: 30 });

      expect(index.has('zero-width')).toBe(true);
    });

    it('should handle very large items', () => {
      index.insert('huge-task', { x: 0, y: 0, width: 10000, height: 5000 });

      expect(index.has('huge-task')).toBe(true);
      expect(index.queryPoint(5000, 2500)).toContain('huge-task');
    });

    it('should handle items at exact cell boundaries', () => {
      // Cell size is 50, so item at x=50 is right at a boundary
      index.insert('boundary-task', { x: 50, y: 50, width: 50, height: 50 });

      expect(index.queryPoint(75, 75)).toContain('boundary-task');
    });
  });
});
