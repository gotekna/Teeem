# frozen_string_literal: true

# SmCriticalPathService - Critical Path Method (CPM) calculations
#
# Calculates:
# - Early Start (ES) and Early Finish (EF) - Forward pass
# - Late Start (LS) and Late Finish (LF) - Backward pass
# - Total Float/Slack
# - Critical Path (tasks with zero float)
#
class SmCriticalPathService
  attr_reader :construction, :tasks, :results

  def initialize(construction)
    @construction = construction
    @tasks = construction.sm_tasks.includes(:predecessors, :successors).to_a
    @results = {}
  end

  def calculate
    return { critical_path: [], tasks: {} } if tasks.empty?

    # Build task lookup
    @task_map = tasks.index_by(&:id)

    # Initialize results
    tasks.each do |task|
      @results[task.id] = {
        id: task.id,
        name: task.name,
        duration: task.duration_days || 1,
        es: nil, # Early Start
        ef: nil, # Early Finish
        ls: nil, # Late Start
        lf: nil, # Late Finish
        float: nil,
        is_critical: false
      }
    end

    # Forward pass - calculate ES and EF
    forward_pass

    # Backward pass - calculate LS and LF
    backward_pass

    # Calculate float and identify critical path
    calculate_float

    # Build response
    {
      critical_path: critical_path_tasks,
      project_duration: project_duration,
      tasks: @results,
      summary: build_summary
    }
  end

  private

  # Forward pass: Calculate Early Start and Early Finish
  def forward_pass
    # Start with tasks that have no predecessors
    ready = tasks.select { |t| t.predecessors.empty? }
    processed = Set.new

    # Set ES=0 for starting tasks
    ready.each do |task|
      @results[task.id][:es] = 0
      @results[task.id][:ef] = @results[task.id][:duration]
    end
    processed.merge(ready.map(&:id))

    # Process remaining tasks in topological order
    while processed.size < tasks.size
      tasks.each do |task|
        next if processed.include?(task.id)

        # Check if all predecessors are processed
        pred_ids = task.predecessors.map(&:id)
        next unless pred_ids.all? { |id| processed.include?(id) }

        # ES = max(EF of all predecessors)
        if pred_ids.empty?
          es = 0
        else
          es = pred_ids.map { |id| @results[id][:ef] }.max
        end

        @results[task.id][:es] = es
        @results[task.id][:ef] = es + @results[task.id][:duration]
        processed.add(task.id)
      end

      # Safety check for circular dependencies
      break if processed.size == processed.size
    end
  end

  # Backward pass: Calculate Late Start and Late Finish
  def backward_pass
    # Find project end (max EF)
    max_ef = @results.values.map { |r| r[:ef] }.compact.max || 0

    # Start with tasks that have no successors
    ending_tasks = tasks.select { |t| t.successors.empty? }
    processed = Set.new

    # Set LF = project end for ending tasks
    ending_tasks.each do |task|
      @results[task.id][:lf] = max_ef
      @results[task.id][:ls] = max_ef - @results[task.id][:duration]
    end
    processed.merge(ending_tasks.map(&:id))

    # Process remaining tasks in reverse topological order
    while processed.size < tasks.size
      tasks.each do |task|
        next if processed.include?(task.id)

        # Check if all successors are processed
        succ_ids = task.successors.map(&:id)
        next unless succ_ids.all? { |id| processed.include?(id) }

        # LF = min(LS of all successors)
        if succ_ids.empty?
          lf = max_ef
        else
          lf = succ_ids.map { |id| @results[id][:ls] }.min
        end

        @results[task.id][:lf] = lf
        @results[task.id][:ls] = lf - @results[task.id][:duration]
        processed.add(task.id)
      end
    end
  end

  # Calculate float (slack) for each task
  def calculate_float
    @results.each do |task_id, result|
      next unless result[:ls] && result[:es]

      result[:float] = result[:ls] - result[:es]
      result[:is_critical] = result[:float] == 0
    end
  end

  # Get tasks on the critical path
  def critical_path_tasks
    @results.values
            .select { |r| r[:is_critical] }
            .sort_by { |r| r[:es] || 0 }
            .map { |r| { id: r[:id], name: r[:name], duration: r[:duration] } }
  end

  # Total project duration
  def project_duration
    @results.values.map { |r| r[:ef] }.compact.max || 0
  end

  # Build summary statistics
  def build_summary
    critical_count = @results.values.count { |r| r[:is_critical] }
    total_float = @results.values.sum { |r| r[:float] || 0 }

    {
      total_tasks: tasks.size,
      critical_tasks: critical_count,
      non_critical_tasks: tasks.size - critical_count,
      project_duration_days: project_duration,
      average_float: tasks.size > 0 ? (total_float.to_f / tasks.size).round(1) : 0,
      critical_path_length: critical_path_tasks.size
    }
  end

  class << self
    def calculate(construction)
      new(construction).calculate
    end

    # Identify tasks that could delay the project if delayed
    def at_risk_tasks(construction, buffer_days: 2)
      result = calculate(construction)

      result[:tasks].values.select do |task|
        task[:float] && task[:float] <= buffer_days && !task[:is_critical]
      end
    end

    # What-if analysis: impact of delaying a task
    def delay_impact(construction, task_id, delay_days)
      service = new(construction)
      original = service.calculate

      # Simulate delay
      service.results[task_id][:duration] += delay_days
      service.send(:forward_pass)
      service.send(:backward_pass)
      service.send(:calculate_float)

      delayed = {
        project_duration: service.project_duration,
        critical_path: service.critical_path_tasks
      }

      {
        original_duration: original[:project_duration],
        delayed_duration: delayed[:project_duration],
        impact_days: delayed[:project_duration] - original[:project_duration],
        new_critical_path: delayed[:critical_path],
        task_was_critical: original[:tasks][task_id][:is_critical]
      }
    end
  end
end
