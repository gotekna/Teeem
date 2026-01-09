/**
 * Performance Benchmarks for Gantt Engine
 *
 * Tests performance characteristics with large datasets:
 * - SpatialIndex query performance
 * - Hit testing at scale
 * - Marquee selection performance
 * - Memory efficiency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex } from '../engine/spatial/SpatialIndex';
import { SelectionManager } from '../engine/managers/SelectionManager';
import { DependencyManager } from '../engine/managers/DependencyManager';

// Generate large datasets
const generateTasks = (count: number) => {
  const tasks = [];
  const startDate = new Date('2024-01-01');

  for (let i = 0; i < count; i++) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + Math.floor(i / 10)); // Stagger start dates
    const end = new Date(start);
    end.setDate(end.getDate() + Math.floor(Math.random() * 10) + 1);

    tasks.push({
      id: `task-${i}`,
      name: `Task ${i}`,
      startDate: start,
      endDate: end,
      progress: Math.floor(Math.random() * 100),
    });
  }

  return tasks;
};

const generateSpatialBounds = (count: number) => {
  const bounds = [];
  for (let i = 0; i < count; i++) {
    bounds.push({
      id: `task-${i}`,
      rect: {
        x: (i % 100) * 50,           // 100 tasks per row
        y: Math.floor(i / 100) * 30,  // 30px row height
        width: Math.floor(Math.random() * 200) + 50, // 50-250px width
        height: 28,
      },
    });
  }
  return bounds;
};

describe('Performance Benchmarks', () => {
  describe('SpatialIndex with 10K items', () => {
    let index: SpatialIndex;
    const TASK_COUNT = 10000;

    beforeEach(() => {
      index = new SpatialIndex(50);
      const bounds = generateSpatialBounds(TASK_COUNT);

      for (const { id, rect } of bounds) {
        index.insert(id, rect);
      }
    });

    it('should have correct item count', () => {
      expect(index.size()).toBe(TASK_COUNT);
    });

    it('should query point in under 1ms', () => {
      const start = performance.now();

      // Run 1000 point queries
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 5000;
        const y = Math.random() * 3000;
        index.queryPoint(x, y);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 1000;

      // Each query should be under 1ms on average
      expect(avgMs).toBeLessThan(1);
      console.log(`  Point query avg: ${avgMs.toFixed(3)}ms`);
    });

    it('should query rect efficiently', () => {
      const start = performance.now();

      // Run 100 rect queries
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 4000;
        const y = Math.random() * 2500;
        index.queryRect({ x, y, width: 200, height: 150 });
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 100;

      // Each rect query should be under 5ms
      expect(avgMs).toBeLessThan(5);
      console.log(`  Rect query avg: ${avgMs.toFixed(3)}ms`);
    });

    it('should insert items quickly', () => {
      const newIndex = new SpatialIndex(50);
      const bounds = generateSpatialBounds(TASK_COUNT);

      const start = performance.now();

      for (const { id, rect } of bounds) {
        newIndex.insert(id, rect);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / TASK_COUNT;

      // Each insert should be under 0.1ms
      expect(avgMs).toBeLessThan(0.1);
      console.log(`  Insert avg: ${avgMs.toFixed(4)}ms (${TASK_COUNT} items in ${elapsed.toFixed(1)}ms)`);
    });

    it('should remove items quickly', () => {
      const start = performance.now();

      // Remove 1000 items
      for (let i = 0; i < 1000; i++) {
        index.remove(`task-${i}`);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 1000;

      // Each remove should be under 0.1ms
      expect(avgMs).toBeLessThan(0.1);
      console.log(`  Remove avg: ${avgMs.toFixed(4)}ms`);
    });
  });

  describe('SelectionManager with 10K tasks', () => {
    let manager: SelectionManager;
    const TASK_COUNT = 10000;

    beforeEach(() => {
      manager = new SelectionManager();
      const taskOrder = Array.from({ length: TASK_COUNT }, (_, i) => `task-${i}`);
      manager.setTaskOrder(taskOrder);
    });

    it('should add selections quickly', () => {
      const start = performance.now();

      // Add 1000 selections
      for (let i = 0; i < 1000; i++) {
        manager.add(`task-${i}`);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 1000;

      expect(avgMs).toBeLessThan(0.1);
      console.log(`  Add selection avg: ${avgMs.toFixed(4)}ms`);
    });

    it('should handle range selection efficiently', () => {
      manager.handleClick('task-0', 'none');

      const start = performance.now();

      // Range select 5000 tasks
      manager.handleClick('task-5000', 'shift');

      const elapsed = performance.now() - start;

      // Range selection should be under 50ms for 5000 tasks
      expect(elapsed).toBeLessThan(50);
      console.log(`  Range select (5000 tasks): ${elapsed.toFixed(2)}ms`);
      expect(manager.count()).toBe(5001);
    });

    it('should clear selection quickly', () => {
      // First, add many selections
      for (let i = 0; i < 5000; i++) {
        manager.add(`task-${i}`);
      }

      const start = performance.now();
      manager.clear();
      const elapsed = performance.now() - start;

      // Clear should be under 10ms
      expect(elapsed).toBeLessThan(10);
      console.log(`  Clear selection (5000 tasks): ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('DependencyManager with many dependencies', () => {
    let manager: DependencyManager;
    const TASK_COUNT = 1000;
    const DEP_COUNT = 2000;

    beforeEach(() => {
      manager = new DependencyManager();

      // Create tasks
      const tasks = generateTasks(TASK_COUNT);
      manager.setTasks(tasks);

      // Create dependencies (chain pattern)
      for (let i = 0; i < DEP_COUNT && i < TASK_COUNT - 1; i++) {
        manager.addDependency(`task-${i}`, `task-${i + 1}`, 'FS');
      }
    });

    it('should have correct dependency count', () => {
      expect(manager.getDependencies().length).toBe(Math.min(DEP_COUNT, TASK_COUNT - 1));
    });

    it('should find predecessors quickly', () => {
      const start = performance.now();

      // Query predecessors for 1000 tasks
      for (let i = 0; i < 1000; i++) {
        manager.getPredecessors(`task-${i}`);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 1000;

      expect(avgMs).toBeLessThan(0.5);
      console.log(`  Get predecessors avg: ${avgMs.toFixed(4)}ms`);
    });

    it('should detect cycles quickly', () => {
      const start = performance.now();

      // Check for potential cycles 100 times
      for (let i = 0; i < 100; i++) {
        manager.wouldCreateCycle(`task-999`, `task-0`);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / 100;

      // Cycle detection should be under 5ms for a 1000-task chain
      expect(avgMs).toBeLessThan(5);
      console.log(`  Cycle detection avg: ${avgMs.toFixed(3)}ms`);
    });

    it('should calculate cascade quickly', () => {
      const tasks = generateTasks(100);
      const mgr = new DependencyManager();
      mgr.setTasks(tasks);

      // Create a more complex dependency graph
      for (let i = 0; i < 50; i++) {
        mgr.addDependency(`task-${i}`, `task-${i + 50}`, 'FS');
      }

      const start = performance.now();

      const newStart = new Date('2024-02-01');
      const newEnd = new Date('2024-02-05');
      mgr.calculateCascade('task-0', newStart, newEnd);

      const elapsed = performance.now() - start;

      // Cascade calculation should be under 10ms
      expect(elapsed).toBeLessThan(10);
      console.log(`  Cascade calculation: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Memory efficiency', () => {
    it('should not leak memory on repeated clear/insert cycles', () => {
      const index = new SpatialIndex(50);

      // Baseline memory (approximate via stats)
      const initialStats = index.getStats();

      // Perform 10 cycles of insert/clear
      for (let cycle = 0; cycle < 10; cycle++) {
        const bounds = generateSpatialBounds(1000);
        for (const { id, rect } of bounds) {
          index.insert(id, rect);
        }
        index.clear();
      }

      // After clearing, should be empty
      expect(index.size()).toBe(0);
      expect(index.getStats().cellCount).toBe(0);
    });
  });

  describe('Target: 60fps frame budget (16ms)', () => {
    it('should complete typical frame operations within budget', () => {
      const index = new SpatialIndex(50);
      const bounds = generateSpatialBounds(5000);

      // Build index
      for (const { id, rect } of bounds) {
        index.insert(id, rect);
      }

      const start = performance.now();

      // Simulate typical frame operations:
      // 1. Hit test for hover (mouse position)
      index.queryPoint(500, 200);

      // 2. Query visible items (viewport)
      index.queryRect({ x: 0, y: 0, width: 1920, height: 1080 });

      // 3. Some additional point queries for interactions
      for (let i = 0; i < 10; i++) {
        index.queryPoint(Math.random() * 1000, Math.random() * 500);
      }

      const elapsed = performance.now() - start;

      // All operations should complete in under 16ms (60fps budget)
      expect(elapsed).toBeLessThan(16);
      console.log(`  Frame operations (5K tasks): ${elapsed.toFixed(2)}ms`);
    });
  });
});
