# frozen_string_literal: true

# SmAiService - AI-powered scheduling suggestions and predictions
#
# Features:
# - Schedule optimization suggestions
# - Delay risk predictions
# - Resource optimization
# - Task duration estimates
#
class SmAiService
  attr_reader :construction

  def initialize(construction)
    @construction = construction
  end

  # Get scheduling suggestions
  def scheduling_suggestions
    tasks = construction.sm_tasks.includes(:predecessors, :successors, :resource_allocations)
    critical_path = SmCriticalPathService.calculate(construction)

    suggestions = []

    # Analyze for parallel work opportunities
    suggestions.concat(find_parallel_opportunities(tasks))

    # Analyze resource conflicts
    suggestions.concat(find_resource_conflicts(tasks))

    # Analyze critical path optimization
    suggestions.concat(optimize_critical_path(tasks, critical_path))

    # Analyze task sequencing
    suggestions.concat(analyze_task_sequencing(tasks))

    # Prioritize suggestions
    suggestions.sort_by { |s| -s[:priority] }
  end

  # Predict delays based on historical data and current status
  def delay_predictions
    tasks = construction.sm_tasks.where.not(status: 'completed')
    predictions = []

    tasks.each do |task|
      risk_score = calculate_delay_risk(task)
      next if risk_score < 0.3 # Only show significant risks

      predictions << {
        task_id: task.id,
        task_name: task.name,
        risk_score: risk_score,
        risk_level: risk_level(risk_score),
        factors: identify_risk_factors(task),
        recommended_actions: recommend_actions(task, risk_score),
        estimated_delay_days: estimate_delay_days(task, risk_score)
      }
    end

    predictions.sort_by { |p| -p[:risk_score] }
  end

  # Resource optimization suggestions
  def resource_optimization
    resources = SmResource.joins(:allocations)
                          .where(sm_resource_allocations: { sm_task_id: construction.sm_tasks.pluck(:id) })
                          .distinct

    suggestions = []

    # Find overallocated resources
    resources.each do |resource|
      utilization = calculate_resource_utilization(resource)

      if utilization > 100
        suggestions << {
          type: 'overallocation',
          resource_id: resource.id,
          resource_name: resource.name,
          utilization: utilization,
          message: "#{resource.name} is overallocated at #{utilization.round}%",
          suggestion: "Consider redistributing tasks or adding another #{resource.resource_type}",
          priority: :high
        }
      elsif utilization < 50
        suggestions << {
          type: 'underutilization',
          resource_id: resource.id,
          resource_name: resource.name,
          utilization: utilization,
          message: "#{resource.name} is underutilized at #{utilization.round}%",
          suggestion: "Consider assigning more tasks to this resource",
          priority: :low
        }
      end
    end

    # Find tasks without resources
    unassigned = construction.sm_tasks.left_joins(:resource_allocations)
                             .where(sm_resource_allocations: { id: nil })
                             .where.not(status: 'completed')

    unassigned.each do |task|
      suggestions << {
        type: 'unassigned',
        task_id: task.id,
        task_name: task.name,
        message: "Task '#{task.name}' has no resources assigned",
        suggestion: recommend_resource_for_task(task),
        priority: :medium
      }
    end

    suggestions
  end

  # Estimate task duration using AI/historical data
  def estimate_duration(task_name:, trade:, scope: nil)
    # Look for similar completed tasks
    similar_tasks = SmTask.where(status: 'completed')
                          .where('LOWER(trade) = ?', trade.to_s.downcase)

    if similar_tasks.any?
      avg_duration = similar_tasks.average(:duration_days).to_f
      min_duration = similar_tasks.minimum(:duration_days)
      max_duration = similar_tasks.maximum(:duration_days)

      {
        estimated_days: avg_duration.round,
        range: {
          min: min_duration,
          max: max_duration,
          average: avg_duration.round(1)
        },
        confidence: calculate_confidence(similar_tasks.count),
        based_on: "#{similar_tasks.count} similar completed tasks"
      }
    else
      # Use trade-based defaults
      default = default_duration_for_trade(trade)
      {
        estimated_days: default,
        range: { min: default - 2, max: default + 5, average: default },
        confidence: 'low',
        based_on: 'trade defaults (no historical data)'
      }
    end
  end

  # Generate AI summary using LLM (if configured)
  def generate_summary
    return nil unless llm_configured?

    tasks = construction.sm_tasks
    evm = SmEvmService.calculate(construction)
    critical_path = SmCriticalPathService.calculate(construction)

    prompt = build_summary_prompt(tasks, evm, critical_path)
    call_llm(prompt)
  end

  private

  def find_parallel_opportunities(tasks)
    suggestions = []

    # Find sequential tasks that could run in parallel
    tasks.each do |task|
      next if task.predecessors.empty?

      task.predecessors.each do |pred|
        # If predecessor is the only dependency and they're in different trades
        if task.predecessors.count == 1 && pred.trade != task.trade
          # Check if they actually need to be sequential
          unless requires_sequence?(pred, task)
            suggestions << {
              type: 'parallel_opportunity',
              task_id: task.id,
              predecessor_id: pred.id,
              message: "'#{task.name}' could potentially run in parallel with '#{pred.name}'",
              impact: "Could save #{task.duration_days || 5} days",
              priority: 7
            }
          end
        end
      end
    end

    suggestions
  end

  def find_resource_conflicts(tasks)
    suggestions = []

    # Group tasks by resource and date
    allocations = SmResourceAllocation.where(sm_task_id: tasks.pluck(:id))
                                      .includes(:task, :resource)

    allocations.group_by(&:resource_id).each do |_resource_id, resource_allocs|
      resource = resource_allocs.first.resource
      next unless resource

      # Find overlapping allocations
      resource_allocs.combination(2).each do |a1, a2|
        if dates_overlap?(a1.task, a2.task)
          suggestions << {
            type: 'resource_conflict',
            resource_id: resource.id,
            resource_name: resource.name,
            task_ids: [a1.sm_task_id, a2.sm_task_id],
            message: "#{resource.name} is assigned to overlapping tasks: '#{a1.task.name}' and '#{a2.task.name}'",
            priority: 9
          }
        end
      end
    end

    suggestions
  end

  def optimize_critical_path(tasks, critical_path)
    suggestions = []

    critical_path[:critical_path].each do |cp_task|
      task = tasks.find { |t| t.id == cp_task[:id] }
      next unless task

      # Suggest crashing critical tasks
      if task.duration_days && task.duration_days > 3
        suggestions << {
          type: 'crash_opportunity',
          task_id: task.id,
          task_name: task.name,
          message: "'#{task.name}' is on critical path. Consider adding resources to reduce duration.",
          current_duration: task.duration_days,
          priority: 8
        }
      end

      # Suggest fast-tracking
      if task.successors.any?
        suggestions << {
          type: 'fast_track',
          task_id: task.id,
          task_name: task.name,
          message: "Consider starting '#{task.successors.first.name}' before '#{task.name}' completes (fast-tracking)",
          priority: 6
        }
      end
    end

    suggestions
  end

  def analyze_task_sequencing(tasks)
    suggestions = []

    # Find tasks with many predecessors (bottlenecks)
    tasks.each do |task|
      if task.predecessors.count >= 3
        suggestions << {
          type: 'bottleneck',
          task_id: task.id,
          task_name: task.name,
          predecessor_count: task.predecessors.count,
          message: "'#{task.name}' depends on #{task.predecessors.count} tasks - potential bottleneck",
          priority: 5
        }
      end
    end

    suggestions
  end

  def calculate_delay_risk(task)
    risk = 0.0

    # Factor 1: Behind schedule
    if task.start_date && task.start_date < Date.current && task.status == 'not_started'
      days_late = (Date.current - task.start_date).to_i
      risk += [days_late * 0.1, 0.4].min
    end

    # Factor 2: Dependencies not complete
    incomplete_deps = task.predecessors.where.not(status: 'completed').count
    risk += incomplete_deps * 0.15

    # Factor 3: No resources assigned
    risk += 0.2 if task.resource_allocations.empty?

    # Factor 4: On critical path
    risk += 0.15 if on_critical_path?(task)

    # Factor 5: Historical performance of trade
    risk += trade_risk_factor(task.trade)

    [risk, 1.0].min
  end

  def risk_level(score)
    case score
    when 0..0.3 then 'low'
    when 0.3..0.6 then 'medium'
    when 0.6..0.8 then 'high'
    else 'critical'
    end
  end

  def identify_risk_factors(task)
    factors = []

    factors << 'Task is overdue to start' if task.start_date && task.start_date < Date.current && task.status == 'not_started'
    factors << 'Waiting on incomplete dependencies' if task.predecessors.where.not(status: 'completed').any?
    factors << 'No resources assigned' if task.resource_allocations.empty?
    factors << 'On critical path' if on_critical_path?(task)

    factors
  end

  def recommend_actions(task, risk_score)
    actions = []

    actions << 'Assign resources immediately' if task.resource_allocations.empty?
    actions << 'Follow up on predecessor tasks' if task.predecessors.where.not(status: 'completed').any?
    actions << 'Consider crashing or fast-tracking' if risk_score > 0.6
    actions << 'Add buffer time to schedule' if risk_score > 0.4

    actions
  end

  def estimate_delay_days(task, risk_score)
    base_delay = (task.duration_days || 5) * risk_score
    base_delay.round
  end

  def calculate_resource_utilization(resource)
    # Simple utilization calculation
    total_hours = resource.allocations.sum(:allocated_hours)
    available_hours = 40 * 4 # Assume 4 weeks, 40 hours/week
    (total_hours.to_f / available_hours) * 100
  end

  def recommend_resource_for_task(task)
    # Find available resources matching the trade
    available = SmResource.where(resource_type: 'labor')
                          .where('LOWER(trade) = ? OR trade IS NULL', task.trade.to_s.downcase)
                          .first

    if available
      "Consider assigning #{available.name}"
    else
      "No matching resources found - consider hiring #{task.trade}"
    end
  end

  def dates_overlap?(task1, task2)
    return false unless task1.start_date && task1.end_date && task2.start_date && task2.end_date

    task1.start_date <= task2.end_date && task2.start_date <= task1.end_date
  end

  def requires_sequence?(pred, task)
    # Logic to determine if tasks truly need to be sequential
    # For now, assume same location/area requires sequence
    pred.location == task.location
  end

  def on_critical_path?(task)
    critical_path = SmCriticalPathService.calculate(construction)
    critical_path[:critical_path].any? { |cp| cp[:id] == task.id }
  end

  def trade_risk_factor(trade)
    # Historical delay rates by trade (could be calculated from data)
    trade_risks = {
      'concrete' => 0.1,
      'framing' => 0.05,
      'electrical' => 0.08,
      'plumbing' => 0.1,
      'roofing' => 0.15, # Weather dependent
      'painting' => 0.05,
      'landscaping' => 0.12 # Weather dependent
    }
    trade_risks[trade.to_s.downcase] || 0.07
  end

  def calculate_confidence(sample_size)
    case sample_size
    when 0..2 then 'very_low'
    when 3..5 then 'low'
    when 6..10 then 'medium'
    when 11..20 then 'high'
    else 'very_high'
    end
  end

  def default_duration_for_trade(trade)
    defaults = {
      'siteworks' => 5,
      'concrete' => 7,
      'framing' => 10,
      'roofing' => 5,
      'electrical' => 8,
      'plumbing' => 8,
      'hvac' => 6,
      'insulation' => 3,
      'drywall' => 7,
      'painting' => 5,
      'flooring' => 4,
      'cabinets' => 3,
      'fixtures' => 2,
      'landscaping' => 5
    }
    defaults[trade.to_s.downcase] || 5
  end

  def llm_configured?
    ENV['OPENAI_API_KEY'].present? || ENV['ANTHROPIC_API_KEY'].present?
  end

  def build_summary_prompt(tasks, evm, critical_path)
    <<~PROMPT
      Analyze this construction project and provide a brief executive summary:

      Project Stats:
      - Total tasks: #{tasks.count}
      - Completed: #{tasks.where(status: 'completed').count}
      - In progress: #{tasks.where(status: 'started').count}
      - Not started: #{tasks.where(status: 'not_started').count}

      Schedule Performance Index (SPI): #{evm[:indices][:spi]}
      Cost Performance Index (CPI): #{evm[:indices][:cpi]}
      Percent Complete: #{evm[:progress][:percent_complete]}%

      Critical Path: #{critical_path[:summary][:critical_tasks]} tasks, #{critical_path[:project_duration]} days

      Provide:
      1. Overall project health assessment (1-2 sentences)
      2. Top 3 risks or concerns
      3. Top 3 recommended actions
    PROMPT
  end

  def call_llm(prompt)
    # Placeholder for LLM integration
    # Could use OpenAI, Anthropic, or other providers
    nil
  end

  class << self
    def suggestions(construction)
      new(construction).scheduling_suggestions
    end

    def predictions(construction)
      new(construction).delay_predictions
    end

    def optimize_resources(construction)
      new(construction).resource_optimization
    end

    def estimate_duration(task_name:, trade:, scope: nil)
      new(nil).estimate_duration(task_name: task_name, trade: trade, scope: scope)
    end
  end
end
