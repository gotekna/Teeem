# frozen_string_literal: true

# SmDependencyGraphService - Circular dependency detection for SM Gantt
#
# Uses Breadth-First Search (BFS) to detect cycles before creating dependencies.
# Prevents infinite cascade loops.
#
# SSoT: Uses predecessor_ids jsonb column on SmTask (not SmDependency table)
#
# See GANTT_ARCHITECTURE_PLAN.md Section 6.1 (Architecture Review)
#
class SmDependencyGraphService
  attr_reader :construction

  def initialize(construction)
    @construction = construction
  end

  # Check if adding a dependency from predecessor to successor would create a cycle
  def creates_cycle?(predecessor_task_id, successor_task_id)
    # A cycle would exist if successor can already reach predecessor
    # (i.e., predecessor is downstream from successor)
    can_reach?(successor_task_id, predecessor_task_id)
  end

  # Check if task_a can reach task_b through the dependency graph
  # Uses BFS for efficient traversal
  def can_reach?(from_task_id, to_task_id)
    return true if from_task_id == to_task_id

    visited = Set.new
    queue = [from_task_id]

    # Build task lookup for job
    from_task = SmTask.find_by(id: from_task_id)
    return false unless from_task&.job_id

    task_lookup = construction.sm_tasks.index_by(&:id)
    task_by_number = construction.sm_tasks.index_by(&:task_number)

    while queue.any?
      current_id = queue.shift
      next if visited.include?(current_id)

      visited.add(current_id)

      # Get all successors of current task (tasks that have current in predecessor_ids)
      current_task = task_lookup[current_id]
      next unless current_task

      successor_ids = construction.sm_tasks
        .where("predecessor_ids @> ?", [{ id: current_task.task_number }].to_json)
        .pluck(:id)

      return true if successor_ids.include?(to_task_id)

      queue.concat(successor_ids - visited.to_a)
    end

    false
  end

  # Get all tasks that would be affected by moving a task (full dependency tree)
  def affected_tasks(task_id, direction: :downstream)
    visited = Set.new
    result = []
    queue = [task_id]

    task_lookup = construction.sm_tasks.index_by(&:id)
    task_by_number = construction.sm_tasks.index_by(&:task_number)

    while queue.any?
      current_id = queue.shift
      next if visited.include?(current_id)
      next if current_id == task_id # Don't include the source task

      visited.add(current_id)
      result << current_id

      current_task = task_lookup[current_id]
      next unless current_task

      # Get next level based on direction
      next_ids = if direction == :downstream
        # Find tasks that have current_task in their predecessor_ids
        construction.sm_tasks
          .where("predecessor_ids @> ?", [{ id: current_task.task_number }].to_json)
          .pluck(:id)
      else
        # Find predecessor tasks from predecessor_ids
        current_task.predecessor_ids.filter_map do |pred_data|
          pred_task_number = (pred_data["id"] || pred_data[:id]).to_i
          task_by_number[pred_task_number]&.id
        end
      end

      queue.concat(next_ids - visited.to_a)
    end

    result
  end

  # Topological sort of all tasks in construction
  # Returns tasks in order where predecessors come before successors
  def topological_sort
    # Build adjacency list from predecessor_ids jsonb
    tasks = construction.sm_tasks.to_a
    task_by_number = tasks.index_by(&:task_number)

    in_degree = Hash.new(0)
    adjacency = Hash.new { |h, k| h[k] = [] }

    tasks.each { |t| in_degree[t.id] = 0 }

    # Build graph from predecessor_ids on each task
    tasks.each do |task|
      next if task.predecessor_ids.blank?

      task.predecessor_ids.each do |pred_data|
        pred_task_number = (pred_data["id"] || pred_data[:id]).to_i
        predecessor = task_by_number[pred_task_number]
        next unless predecessor

        adjacency[predecessor.id] << task.id
        in_degree[task.id] += 1
      end
    end

    # Kahn's algorithm
    queue = tasks.select { |t| in_degree[t.id] == 0 }.map(&:id)
    result = []

    while queue.any?
      current = queue.shift
      result << current

      adjacency[current].each do |successor|
        in_degree[successor] -= 1
        queue << successor if in_degree[successor] == 0
      end
    end

    # If result size != tasks size, there's a cycle
    if result.size != tasks.size
      raise CyclicDependencyError, "Circular dependency detected in construction #{construction.id}"
    end

    result
  end

  # Validate entire dependency graph has no cycles
  def validate_graph
    topological_sort
    { valid: true, message: "No cycles detected" }
  rescue CyclicDependencyError => e
    { valid: false, message: e.message }
  end

  # Find all dependency paths between two tasks
  def find_paths(from_task_id, to_task_id, max_paths: 10)
    paths = []
    current_path = [from_task_id]

    dfs_paths(from_task_id, to_task_id, current_path, paths, max_paths)
    paths
  end

  # Get dependency chain for visualization
  def dependency_chain(task_id, direction: :downstream, max_depth: 10)
    chain = []
    build_chain(task_id, chain, Set.new, direction, 0, max_depth)
    chain
  end

  private

  def dfs_paths(current, target, path, paths, max_paths)
    return if paths.size >= max_paths

    if current == target && path.size > 1
      paths << path.dup
      return
    end

    current_task = SmTask.find_by(id: current)
    return unless current_task

    # Find successors (tasks that have current_task in their predecessor_ids)
    successor_ids = construction.sm_tasks
      .where("predecessor_ids @> ?", [{ id: current_task.task_number }].to_json)
      .pluck(:id)

    successor_ids.each do |succ|
      next if path.include?(succ) # Avoid cycles in path finding

      path << succ
      dfs_paths(succ, target, path, paths, max_paths)
      path.pop
    end
  end

  def build_chain(task_id, chain, visited, direction, depth, max_depth)
    return if depth > max_depth || visited.include?(task_id)

    visited.add(task_id)

    task = SmTask.find_by(id: task_id)
    return unless task

    chain << {
      id: task.id,
      name: task.name,
      depth: depth,
      locked: task.locked?,
      lock_type: task.lock_type
    }

    task_by_number = construction.sm_tasks.index_by(&:task_number)

    next_ids = if direction == :downstream
      # Find tasks that have this task in their predecessor_ids
      construction.sm_tasks
        .where("predecessor_ids @> ?", [{ id: task.task_number }].to_json)
        .pluck(:id)
    else
      # Find predecessor tasks
      task.predecessor_ids.filter_map do |pred_data|
        pred_task_number = (pred_data["id"] || pred_data[:id]).to_i
        task_by_number[pred_task_number]&.id
      end
    end

    next_ids.each do |next_id|
      build_chain(next_id, chain, visited, direction, depth + 1, max_depth)
    end
  end

  class CyclicDependencyError < StandardError; end
end
