/**
 * CriticalPath - Critical Path Method (CPM) Implementation
 *
 * Calculates the critical path through a project network using:
 * - Forward pass: Calculate earliest start (ES) and earliest finish (EF)
 * - Backward pass: Calculate latest start (LS) and latest finish (LF)
 * - Slack calculation: LS - ES (tasks with 0 slack are critical)
 */

import { GanttTask, GanttDependency } from './GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface TaskSchedule {
  taskId: string;
  /** Earliest Start - earliest date the task can begin */
  earliestStart: Date;
  /** Earliest Finish - earliest date the task can complete */
  earliestFinish: Date;
  /** Latest Start - latest date the task can begin without delaying the project */
  latestStart: Date;
  /** Latest Finish - latest date the task can complete without delaying the project */
  latestFinish: Date;
  /** Total Slack/Float - how much the task can be delayed without affecting project end */
  totalSlack: number; // in days
  /** Free Slack - how much the task can be delayed without affecting successors */
  freeSlack: number; // in days
  /** Is this task on the critical path? */
  isCritical: boolean;
}

export interface CriticalPathResult {
  /** Map of task ID to schedule info */
  schedules: Map<string, TaskSchedule>;
  /** IDs of tasks on the critical path */
  criticalTasks: Set<string>;
  /** IDs of dependencies on the critical path */
  criticalDependencies: Set<string>;
  /** Total project duration in days */
  projectDuration: number;
  /** Earliest project start date */
  projectStart: Date;
  /** Latest project end date */
  projectEnd: Date;
}

// ============================================================================
// Dependency Helpers
// ============================================================================

/**
 * Build a map of task ID to its predecessors
 */
function buildPredecessorMap(
  tasks: GanttTask[],
  dependencies: GanttDependency[]
): Map<string, GanttDependency[]> {
  const predecessorMap = new Map<string, GanttDependency[]>();

  // Initialize empty arrays for all tasks
  tasks.forEach(task => {
    predecessorMap.set(task.id, []);
  });

  // Add dependencies
  dependencies.forEach(dep => {
    const existing = predecessorMap.get(dep.toId) || [];
    existing.push(dep);
    predecessorMap.set(dep.toId, existing);
  });

  return predecessorMap;
}

/**
 * Build a map of task ID to its successors
 */
function buildSuccessorMap(
  tasks: GanttTask[],
  dependencies: GanttDependency[]
): Map<string, GanttDependency[]> {
  const successorMap = new Map<string, GanttDependency[]>();

  // Initialize empty arrays for all tasks
  tasks.forEach(task => {
    successorMap.set(task.id, []);
  });

  // Add dependencies
  dependencies.forEach(dep => {
    const existing = successorMap.get(dep.fromId) || [];
    existing.push(dep);
    successorMap.set(dep.fromId, existing);
  });

  return successorMap;
}

/**
 * Topological sort of tasks based on dependencies
 */
function topologicalSort(
  tasks: GanttTask[],
  predecessorMap: Map<string, GanttDependency[]>
): GanttTask[] {
  const taskMap = new Map<string, GanttTask>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const inDegree = new Map<string, number>();
  tasks.forEach(t => {
    const preds = predecessorMap.get(t.id) || [];
    inDegree.set(t.id, preds.length);
  });

  // Start with tasks that have no predecessors
  const queue: GanttTask[] = [];
  tasks.forEach(t => {
    if (inDegree.get(t.id) === 0) {
      queue.push(t);
    }
  });

  const sorted: GanttTask[] = [];

  while (queue.length > 0) {
    const task = queue.shift()!;
    sorted.push(task);

    // Find all tasks that depend on this one
    tasks.forEach(t => {
      const preds = predecessorMap.get(t.id) || [];
      const hasDep = preds.some(d => d.fromId === task.id);
      if (hasDep) {
        inDegree.set(t.id, (inDegree.get(t.id) || 1) - 1);
        if (inDegree.get(t.id) === 0) {
          queue.push(t);
        }
      }
    });
  }

  // If not all tasks are sorted, there's a cycle
  if (sorted.length !== tasks.length) {
    console.warn('CriticalPath: Detected cycle in dependencies, returning original order');
    return tasks;
  }

  return sorted;
}

/**
 * Calculate task duration in days
 */
function getTaskDuration(task: GanttTask): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / msPerDay);
}

/**
 * Calculate the date when a predecessor constraint allows the successor to start
 */
function getConstraintDate(
  fromTask: GanttTask,
  dependency: GanttDependency,
  schedules: Map<string, { es: Date; ef: Date }>
): Date {
  const lag = dependency.lag || 0;
  const fromSchedule = schedules.get(fromTask.id);

  // Use actual task dates if schedule not yet calculated
  const fromStart = fromSchedule?.es || fromTask.startDate;
  const fromEnd = fromSchedule?.ef || fromTask.endDate;

  let constraintDate: Date;

  switch (dependency.type) {
    case 'FS': // Finish-to-Start
      constraintDate = new Date(fromEnd);
      constraintDate.setDate(constraintDate.getDate() + lag + 1); // +1 because end date is inclusive
      break;
    case 'SS': // Start-to-Start
      constraintDate = new Date(fromStart);
      constraintDate.setDate(constraintDate.getDate() + lag);
      break;
    case 'FF': // Finish-to-Finish (calculate back from end)
      constraintDate = new Date(fromEnd);
      constraintDate.setDate(constraintDate.getDate() + lag);
      // This gives us when the successor should FINISH, not start
      // We'll need the task duration to calculate start
      break;
    case 'SF': // Start-to-Finish (rare)
      constraintDate = new Date(fromStart);
      constraintDate.setDate(constraintDate.getDate() + lag);
      break;
    default:
      constraintDate = new Date(fromEnd);
      constraintDate.setDate(constraintDate.getDate() + 1);
  }

  return constraintDate;
}

// ============================================================================
// Critical Path Calculator
// ============================================================================

/**
 * Calculate the critical path through a project
 */
export function calculateCriticalPath(
  tasks: GanttTask[],
  dependencies: GanttDependency[]
): CriticalPathResult {
  if (tasks.length === 0) {
    return {
      schedules: new Map(),
      criticalTasks: new Set(),
      criticalDependencies: new Set(),
      projectDuration: 0,
      projectStart: new Date(),
      projectEnd: new Date(),
    };
  }

  const taskMap = new Map<string, GanttTask>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const predecessorMap = buildPredecessorMap(tasks, dependencies);
  const successorMap = buildSuccessorMap(tasks, dependencies);
  const sortedTasks = topologicalSort(tasks, predecessorMap);

  // =========================================================================
  // Forward Pass - Calculate Earliest Start (ES) and Earliest Finish (EF)
  // =========================================================================

  const forwardSchedule = new Map<string, { es: Date; ef: Date }>();

  sortedTasks.forEach(task => {
    const predecessors = predecessorMap.get(task.id) || [];
    let earliestStart: Date;

    if (predecessors.length === 0) {
      // No predecessors - use task's actual start date
      earliestStart = new Date(task.startDate);
    } else {
      // Calculate earliest start based on all predecessor constraints
      earliestStart = new Date(0); // Very early date

      predecessors.forEach(dep => {
        const fromTask = taskMap.get(dep.fromId);
        if (!fromTask) return;

        const constraintDate = getConstraintDate(fromTask, dep, forwardSchedule);

        // Handle FF type specially - it constrains finish, not start
        if (dep.type === 'FF') {
          const duration = getTaskDuration(task);
          const startFromFF = new Date(constraintDate);
          startFromFF.setDate(startFromFF.getDate() - duration + 1);
          if (startFromFF > earliestStart) {
            earliestStart = startFromFF;
          }
        } else {
          if (constraintDate > earliestStart) {
            earliestStart = constraintDate;
          }
        }
      });

      // Ensure it's at least the task's actual start date
      if (earliestStart.getTime() === 0 || earliestStart < task.startDate) {
        earliestStart = new Date(task.startDate);
      }
    }

    // Calculate earliest finish
    const duration = getTaskDuration(task);
    const earliestFinish = new Date(earliestStart);
    earliestFinish.setDate(earliestFinish.getDate() + duration - 1);

    forwardSchedule.set(task.id, { es: earliestStart, ef: earliestFinish });
  });

  // =========================================================================
  // Determine Project End Date
  // =========================================================================

  let projectEnd = new Date(0);
  tasks.forEach(task => {
    const schedule = forwardSchedule.get(task.id);
    if (schedule && schedule.ef > projectEnd) {
      projectEnd = new Date(schedule.ef);
    }
  });

  // =========================================================================
  // Backward Pass - Calculate Latest Start (LS) and Latest Finish (LF)
  // =========================================================================

  const backwardSchedule = new Map<string, { ls: Date; lf: Date }>();

  // Process in reverse order
  const reversedTasks = [...sortedTasks].reverse();

  reversedTasks.forEach(task => {
    const successors = successorMap.get(task.id) || [];
    let latestFinish: Date;

    if (successors.length === 0) {
      // No successors - can finish at project end
      latestFinish = new Date(projectEnd);
    } else {
      // Calculate latest finish based on successor constraints
      latestFinish = new Date(projectEnd); // Start with project end

      successors.forEach(dep => {
        const toTask = taskMap.get(dep.toId);
        if (!toTask) return;

        const toSchedule = backwardSchedule.get(dep.toId);
        const toLS = toSchedule?.ls || toTask.startDate;
        const lag = dep.lag || 0;

        let constraint: Date;

        switch (dep.type) {
          case 'FS': // Finish-to-Start: must finish before successor can start
            constraint = new Date(toLS);
            constraint.setDate(constraint.getDate() - lag - 1);
            break;
          case 'SS': // Start-to-Start: successor's LS constrains this task's LF via duration
            constraint = new Date(toLS);
            constraint.setDate(constraint.getDate() - lag);
            // Add this task's duration since SS constrains starts
            const duration = getTaskDuration(task);
            constraint.setDate(constraint.getDate() + duration - 1);
            break;
          case 'FF': // Finish-to-Finish: this finish constrains successor's finish
            const toLF = toSchedule?.lf || toTask.endDate;
            constraint = new Date(toLF);
            constraint.setDate(constraint.getDate() - lag);
            break;
          case 'SF': // Start-to-Finish: successor's finish constrains this start
            // This is complex, use simple approach
            constraint = new Date(toLS);
            constraint.setDate(constraint.getDate() - lag);
            break;
          default:
            constraint = new Date(toLS);
            constraint.setDate(constraint.getDate() - 1);
        }

        if (constraint < latestFinish) {
          latestFinish = constraint;
        }
      });
    }

    // Calculate latest start
    const duration = getTaskDuration(task);
    const latestStart = new Date(latestFinish);
    latestStart.setDate(latestStart.getDate() - duration + 1);

    backwardSchedule.set(task.id, { ls: latestStart, lf: latestFinish });
  });

  // =========================================================================
  // Calculate Slack and Identify Critical Path
  // =========================================================================

  const schedules = new Map<string, TaskSchedule>();
  const criticalTasks = new Set<string>();

  // Slack tolerance - tasks with slack <= 1 day are considered critical
  const slackTolerance = 1;

  tasks.forEach(task => {
    const forward = forwardSchedule.get(task.id)!;
    const backward = backwardSchedule.get(task.id)!;

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalSlack = Math.round((backward.ls.getTime() - forward.es.getTime()) / msPerDay);

    // Calculate free slack (how much this task can slip without affecting direct successors)
    let freeSlack = totalSlack;
    const successors = successorMap.get(task.id) || [];
    if (successors.length > 0) {
      successors.forEach(dep => {
        const toSchedule = forwardSchedule.get(dep.toId);
        if (toSchedule) {
          const gap = Math.round((toSchedule.es.getTime() - forward.ef.getTime()) / msPerDay) - 1;
          if (gap < freeSlack) {
            freeSlack = Math.max(0, gap);
          }
        }
      });
    }

    const isCritical = totalSlack <= slackTolerance;
    if (isCritical) {
      criticalTasks.add(task.id);
    }

    schedules.set(task.id, {
      taskId: task.id,
      earliestStart: forward.es,
      earliestFinish: forward.ef,
      latestStart: backward.ls,
      latestFinish: backward.lf,
      totalSlack: Math.max(0, totalSlack),
      freeSlack: Math.max(0, freeSlack),
      isCritical,
    });
  });

  // Identify critical dependencies (dependencies between critical tasks)
  const criticalDependencies = new Set<string>();
  dependencies.forEach(dep => {
    if (criticalTasks.has(dep.fromId) && criticalTasks.has(dep.toId)) {
      criticalDependencies.add(dep.id);
    }
  });

  // Calculate project duration
  const projectStart = new Date(Math.min(...tasks.map(t => forwardSchedule.get(t.id)!.es.getTime())));
  const msPerDay = 24 * 60 * 60 * 1000;
  const projectDuration = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / msPerDay);

  return {
    schedules,
    criticalTasks,
    criticalDependencies,
    projectDuration,
    projectStart,
    projectEnd,
  };
}

/**
 * Get a summary of the critical path for debugging/display
 */
export function getCriticalPathSummary(result: CriticalPathResult): string {
  const lines: string[] = [];

  lines.push(`Project Duration: ${result.projectDuration} days`);
  lines.push(`Project Start: ${result.projectStart.toLocaleDateString()}`);
  lines.push(`Project End: ${result.projectEnd.toLocaleDateString()}`);
  lines.push(`Critical Tasks: ${result.criticalTasks.size}`);
  lines.push('');
  lines.push('Task Schedule:');

  result.schedules.forEach((schedule, taskId) => {
    const marker = schedule.isCritical ? '🔴' : '⚪';
    lines.push(
      `${marker} ${taskId}: ES=${schedule.earliestStart.toLocaleDateString()} ` +
        `EF=${schedule.earliestFinish.toLocaleDateString()} ` +
        `Slack=${schedule.totalSlack}d`
    );
  });

  return lines.join('\n');
}

export default calculateCriticalPath;
