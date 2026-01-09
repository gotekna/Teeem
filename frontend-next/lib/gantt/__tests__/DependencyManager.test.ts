/**
 * DependencyManager Tests
 *
 * Tests for dependency management functionality including:
 * - Dependency CRUD operations
 * - Cycle detection
 * - Broken dependency tracking
 * - Cascade calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DependencyManager } from '../engine/managers/DependencyManager';
import type { GanttTask, GanttDependency } from '../engine/GanttCanvas';

describe('DependencyManager', () => {
  let manager: DependencyManager;

  // Helper to create test tasks
  const createTask = (id: string, startDays: number, durationDays: number): GanttTask => {
    const start = new Date('2024-01-01');
    start.setDate(start.getDate() + startDays);
    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);
    return {
      id,
      name: `Task ${id}`,
      startDate: start,
      endDate: end,
      progress: 0,
    };
  };

  beforeEach(() => {
    manager = new DependencyManager();
  });

  describe('initialization', () => {
    it('should start with empty dependencies', () => {
      expect(manager.getDependencies()).toEqual([]);
    });
  });

  describe('CRUD operations', () => {
    describe('addDependency()', () => {
      it('should add a new dependency', () => {
        const dep = manager.addDependency('task-1', 'task-2', 'FS');

        expect(dep).not.toBeNull();
        expect(dep?.fromId).toBe('task-1');
        expect(dep?.toId).toBe('task-2');
        expect(dep?.type).toBe('FS');
        expect(manager.getDependencies()).toHaveLength(1);
      });

      it('should add dependency with lag', () => {
        const dep = manager.addDependency('task-1', 'task-2', 'FS', 2);

        expect(dep?.lag).toBe(2);
      });

      it('should prevent adding duplicate dependency', () => {
        manager.addDependency('task-1', 'task-2', 'FS');
        const dep2 = manager.addDependency('task-1', 'task-2', 'FS');

        expect(manager.getDependencies()).toHaveLength(1);
        expect(dep2).not.toBeNull(); // Returns existing
      });

      it('should prevent adding self-referencing dependency', () => {
        const dep = manager.addDependency('task-1', 'task-1', 'FS');

        expect(dep).toBeNull();
        expect(manager.getDependencies()).toHaveLength(0);
      });
    });

    describe('removeDependency()', () => {
      it('should remove dependency by ID', () => {
        const dep = manager.addDependency('task-1', 'task-2', 'FS');
        expect(manager.getDependencies()).toHaveLength(1);

        const removed = manager.removeDependency(dep!.id);

        expect(removed).toBe(true);
        expect(manager.getDependencies()).toHaveLength(0);
      });

      it('should return false for non-existent dependency', () => {
        const removed = manager.removeDependency('non-existent');

        expect(removed).toBe(false);
      });
    });

    describe('removeDependencyBetween()', () => {
      it('should remove dependency between two tasks', () => {
        manager.addDependency('task-1', 'task-2', 'FS');

        const removed = manager.removeDependencyBetween('task-1', 'task-2');

        expect(removed).toBe(true);
        expect(manager.getDependencies()).toHaveLength(0);
      });
    });

    describe('updateDependency()', () => {
      it('should update dependency type', () => {
        const dep = manager.addDependency('task-1', 'task-2', 'FS');

        manager.updateDependency(dep!.id, { type: 'SS' });

        const deps = manager.getDependencies();
        expect(deps[0].type).toBe('SS');
      });

      it('should update dependency lag', () => {
        const dep = manager.addDependency('task-1', 'task-2', 'FS', 0);

        manager.updateDependency(dep!.id, { lag: 5 });

        const deps = manager.getDependencies();
        expect(deps[0].lag).toBe(5);
      });
    });
  });

  describe('query operations', () => {
    beforeEach(() => {
      manager.addDependency('task-1', 'task-2', 'FS');
      manager.addDependency('task-1', 'task-3', 'FS');
      manager.addDependency('task-2', 'task-4', 'FS');
    });

    it('should find dependency between tasks', () => {
      const dep = manager.findDependency('task-1', 'task-2');

      expect(dep).not.toBeUndefined();
      expect(dep?.fromId).toBe('task-1');
      expect(dep?.toId).toBe('task-2');
    });

    it('should get predecessors', () => {
      const preds = manager.getPredecessors('task-2');

      expect(preds).toHaveLength(1);
      expect(preds[0].fromId).toBe('task-1');
    });

    it('should get successors', () => {
      const succs = manager.getSuccessors('task-1');

      expect(succs).toHaveLength(2);
      expect(succs.map(s => s.toId).sort()).toEqual(['task-2', 'task-3']);
    });

    it('should get all dependent tasks recursively', () => {
      const dependents = manager.getAllDependentTasks('task-1');

      expect(dependents).toContain('task-2');
      expect(dependents).toContain('task-3');
      expect(dependents).toContain('task-4'); // Through task-2
    });
  });

  describe('cycle detection', () => {
    it('should detect direct cycle', () => {
      const wouldCycle = manager.wouldCreateCycle('task-1', 'task-1');

      expect(wouldCycle).toBe(true);
    });

    it('should detect indirect cycle', () => {
      manager.addDependency('task-1', 'task-2', 'FS');
      manager.addDependency('task-2', 'task-3', 'FS');

      // Adding task-3 -> task-1 would create a cycle
      const wouldCycle = manager.wouldCreateCycle('task-3', 'task-1');

      expect(wouldCycle).toBe(true);
    });

    it('should not detect cycle when none exists', () => {
      manager.addDependency('task-1', 'task-2', 'FS');

      // Adding task-1 -> task-3 is fine
      const wouldCycle = manager.wouldCreateCycle('task-1', 'task-3');

      expect(wouldCycle).toBe(false);
    });

    it('should find existing cycles', () => {
      // Manually set dependencies that form a cycle (bypassing prevention)
      manager.setDependencies([
        { id: 'dep-1', fromId: 'task-1', toId: 'task-2', type: 'FS' },
        { id: 'dep-2', fromId: 'task-2', toId: 'task-3', type: 'FS' },
        { id: 'dep-3', fromId: 'task-3', toId: 'task-1', type: 'FS' }, // Creates cycle
      ]);

      const cycles = manager.findCycles();

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should remove circular dependencies', () => {
      manager.setDependencies([
        { id: 'dep-1', fromId: 'task-1', toId: 'task-2', type: 'FS' },
        { id: 'dep-2', fromId: 'task-2', toId: 'task-3', type: 'FS' },
        { id: 'dep-3', fromId: 'task-3', toId: 'task-1', type: 'FS' },
      ]);

      const removed = manager.removeCircularDependencies();

      expect(removed.length).toBeGreaterThan(0);
      expect(manager.findCycles()).toHaveLength(0);
    });
  });

  describe('broken dependencies', () => {
    it('should track broken dependencies', () => {
      manager.markAsBroken('task-2', 'task-1');

      expect(manager.hasBrokenDependencies('task-2')).toBe(true);
      expect(manager.getBrokenDependencies('task-2')).toContain('task-1');
    });

    it('should restore broken dependencies', () => {
      manager.markAsBroken('task-2', 'task-1');
      manager.restoreBroken('task-2', 'task-1');

      expect(manager.hasBrokenDependencies('task-2')).toBe(false);
    });

    it('should restore all broken dependencies', () => {
      manager.markAsBroken('task-2', 'task-1');
      manager.markAsBroken('task-2', 'task-3');
      manager.restoreAllBroken('task-2');

      expect(manager.hasBrokenDependencies('task-2')).toBe(false);
    });
  });

  describe('validation', () => {
    it('should detect missing predecessor', () => {
      manager.setDependencies([
        { id: 'dep-1', fromId: 'missing', toId: 'task-2', type: 'FS' },
      ]);
      manager.setTasks([createTask('task-2', 0, 5)]);

      const errors = manager.validate();

      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain('does not exist');
    });

    it('should detect FS constraint violation', () => {
      // Task 1: Day 0-5
      // Task 2: Day 3-8 (starts before task 1 ends)
      const task1 = createTask('task-1', 0, 5);
      const task2 = createTask('task-2', 3, 5);

      manager.setTasks([task1, task2]);
      manager.setDependencies([
        { id: 'dep-1', fromId: 'task-1', toId: 'task-2', type: 'FS' },
      ]);

      const errors = manager.validate();

      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain('FS violation');
    });
  });

  describe('cascade calculation', () => {
    it('should calculate cascade for FS dependency', () => {
      // Task 1: Day 0-5
      // Task 2: Day 6-10 (starts after task 1 ends)
      const task1 = createTask('task-1', 0, 5);
      const task2 = createTask('task-2', 6, 4);

      manager.setTasks([task1, task2]);
      manager.addDependency('task-1', 'task-2', 'FS');

      // Move task 1 to Day 5-10
      const newStart = new Date('2024-01-06');
      const newEnd = new Date('2024-01-11');

      const result = manager.calculateCascade('task-1', newStart, newEnd);

      // Task 2 should be pushed forward
      expect(result.updatedTaskIds).toContain('task-2');
    });
  });

  describe('events', () => {
    it('should emit events on add', () => {
      const callback = vi.fn();
      manager.onChange(callback);

      manager.addDependency('task-1', 'task-2', 'FS');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'add',
          dependency: expect.objectContaining({
            fromId: 'task-1',
            toId: 'task-2',
          }),
        })
      );
    });

    it('should emit events on remove', () => {
      const dep = manager.addDependency('task-1', 'task-2', 'FS');
      const callback = vi.fn();
      manager.onChange(callback);

      manager.removeDependency(dep!.id);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remove',
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should clear all data', () => {
      manager.addDependency('task-1', 'task-2', 'FS');
      manager.markAsBroken('task-2', 'task-1');

      manager.clear();

      expect(manager.getDependencies()).toHaveLength(0);
      expect(manager.hasBrokenDependencies('task-2')).toBe(false);
    });

    it('should dispose resources', () => {
      const callback = vi.fn();
      manager.onChange(callback);
      manager.addDependency('task-1', 'task-2', 'FS');

      manager.dispose();

      expect(manager.getDependencies()).toHaveLength(0);
    });
  });
});
