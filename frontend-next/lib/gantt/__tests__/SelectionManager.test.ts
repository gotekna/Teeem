/**
 * SelectionManager Tests
 *
 * Tests for the selection management functionality including:
 * - Single selection
 * - Multi-selection (ctrl+click)
 * - Range selection (shift+click)
 * - Selection events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectionManager } from '../engine/managers/SelectionManager';
import type { GanttTask } from '../engine/GanttCanvas';

describe('SelectionManager', () => {
  let manager: SelectionManager;

  beforeEach(() => {
    manager = new SelectionManager();
  });

  describe('initialization', () => {
    it('should start with empty selection', () => {
      expect(manager.count()).toBe(0);
      expect(manager.hasSelection()).toBe(false);
      expect(manager.getSelectedArray()).toEqual([]);
    });

    it('should have no last selected task', () => {
      expect(manager.getLastSelected()).toBeNull();
    });
  });

  describe('add()', () => {
    it('should add a task to selection', () => {
      manager.add('task-1');

      expect(manager.count()).toBe(1);
      expect(manager.isSelected('task-1')).toBe(true);
      expect(manager.getLastSelected()).toBe('task-1');
    });

    it('should not duplicate already selected task', () => {
      manager.add('task-1');
      manager.add('task-1');

      expect(manager.count()).toBe(1);
    });

    it('should add multiple tasks', () => {
      manager.add('task-1');
      manager.add('task-2');
      manager.add('task-3');

      expect(manager.count()).toBe(3);
      expect(manager.isSelected('task-1')).toBe(true);
      expect(manager.isSelected('task-2')).toBe(true);
      expect(manager.isSelected('task-3')).toBe(true);
    });
  });

  describe('remove()', () => {
    it('should remove a task from selection', () => {
      manager.add('task-1');
      manager.add('task-2');
      manager.remove('task-1');

      expect(manager.count()).toBe(1);
      expect(manager.isSelected('task-1')).toBe(false);
      expect(manager.isSelected('task-2')).toBe(true);
    });

    it('should do nothing for non-selected task', () => {
      manager.add('task-1');
      manager.remove('task-2');

      expect(manager.count()).toBe(1);
    });

    it('should update lastSelectedTaskId when removed', () => {
      manager.add('task-1');
      manager.add('task-2');
      manager.remove('task-2');

      // lastSelectedTaskId should fall back to another selected task
      expect(manager.getLastSelected()).toBe('task-1');
    });
  });

  describe('toggle()', () => {
    it('should select unselected task', () => {
      manager.toggle('task-1');

      expect(manager.isSelected('task-1')).toBe(true);
    });

    it('should deselect selected task', () => {
      manager.add('task-1');
      manager.toggle('task-1');

      expect(manager.isSelected('task-1')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should clear all selections', () => {
      manager.add('task-1');
      manager.add('task-2');
      manager.add('task-3');
      manager.clear();

      expect(manager.count()).toBe(0);
      expect(manager.hasSelection()).toBe(false);
      expect(manager.getLastSelected()).toBeNull();
    });

    it('should do nothing when already empty', () => {
      manager.clear();

      expect(manager.count()).toBe(0);
    });
  });

  describe('selectSingle()', () => {
    it('should clear previous selection and select new task', () => {
      manager.add('task-1');
      manager.add('task-2');
      manager.selectSingle('task-3');

      expect(manager.count()).toBe(1);
      expect(manager.isSelected('task-3')).toBe(true);
      expect(manager.isSelected('task-1')).toBe(false);
      expect(manager.isSelected('task-2')).toBe(false);
    });
  });

  describe('handleClick()', () => {
    beforeEach(() => {
      manager.setTaskOrder(['task-1', 'task-2', 'task-3', 'task-4', 'task-5']);
    });

    it('should single select with no modifier', () => {
      manager.handleClick('task-1', 'none');

      expect(manager.count()).toBe(1);
      expect(manager.isSelected('task-1')).toBe(true);
    });

    it('should toggle with ctrl modifier', () => {
      manager.handleClick('task-1', 'none');
      manager.handleClick('task-2', 'ctrl');

      expect(manager.count()).toBe(2);
      expect(manager.isSelected('task-1')).toBe(true);
      expect(manager.isSelected('task-2')).toBe(true);

      manager.handleClick('task-1', 'ctrl');
      expect(manager.count()).toBe(1);
      expect(manager.isSelected('task-1')).toBe(false);
    });

    it('should range select with shift modifier', () => {
      manager.handleClick('task-1', 'none');
      manager.handleClick('task-4', 'shift');

      expect(manager.count()).toBe(4);
      expect(manager.isSelected('task-1')).toBe(true);
      expect(manager.isSelected('task-2')).toBe(true);
      expect(manager.isSelected('task-3')).toBe(true);
      expect(manager.isSelected('task-4')).toBe(true);
      expect(manager.isSelected('task-5')).toBe(false);
    });
  });

  describe('selectMultiple()', () => {
    it('should select multiple tasks at once', () => {
      manager.selectMultiple(['task-1', 'task-2', 'task-3']);

      expect(manager.count()).toBe(3);
      expect(manager.getSelectedArray()).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should replace previous selection', () => {
      manager.add('task-1');
      manager.selectMultiple(['task-2', 'task-3']);

      expect(manager.count()).toBe(2);
      expect(manager.isSelected('task-1')).toBe(false);
    });
  });

  describe('addMultiple()', () => {
    it('should add to existing selection', () => {
      manager.add('task-1');
      manager.addMultiple(['task-2', 'task-3']);

      expect(manager.count()).toBe(3);
      expect(manager.isSelected('task-1')).toBe(true);
      expect(manager.isSelected('task-2')).toBe(true);
      expect(manager.isSelected('task-3')).toBe(true);
    });
  });

  describe('onChange()', () => {
    it('should emit events on selection change', () => {
      const callback = vi.fn();
      manager.onChange(callback);

      manager.add('task-1');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          selected: expect.any(Set),
          added: ['task-1'],
          removed: [],
        })
      );
    });

    it('should allow unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onChange(callback);

      manager.add('task-1');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      manager.add('task-2');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getState() / setState()', () => {
    it('should serialize and restore state', () => {
      manager.add('task-1');
      manager.add('task-2');

      const state = manager.getState();
      expect(state.selected).toContain('task-1');
      expect(state.selected).toContain('task-2');

      const newManager = new SelectionManager();
      newManager.setState(state);

      expect(newManager.isSelected('task-1')).toBe(true);
      expect(newManager.isSelected('task-2')).toBe(true);
    });
  });

  describe('dispose()', () => {
    it('should clean up resources', () => {
      const callback = vi.fn();
      manager.onChange(callback);
      manager.add('task-1');

      manager.dispose();

      expect(manager.count()).toBe(0);
      // Callback should be removed
    });
  });
});
