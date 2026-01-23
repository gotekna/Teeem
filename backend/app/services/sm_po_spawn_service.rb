# frozen_string_literal: true

# SmPoSpawnService - Spawns Order and Call tasks when a PO is created/linked to a task
#
# When a Purchase Order is created and linked to an SmTask, this service checks
# if the task has spawn_order_task or spawn_call_task enabled and creates the
# corresponding reminder tasks.
#
# Usage:
#   SmPoSpawnService.new(sm_task, user: current_user).spawn!
#
# The spawned tasks are scheduled BEFORE the parent task:
#   - "Order [Task Name]" - scheduled order_time_days before parent start (default: 7 days)
#   - "Call [Task Name]" - scheduled call_time_days before parent start (default: 3 days)
#
class SmPoSpawnService
  attr_reader :task, :user, :spawned_tasks, :errors

  DEFAULT_ORDER_TIME_DAYS = 7
  DEFAULT_CALL_TIME_DAYS = 3

  def initialize(task, user: nil)
    @task = task
    @user = user
    @spawned_tasks = []
    @errors = []
  end

  # Spawn Order and Call tasks based on task configuration
  # Returns { success: bool, spawned_tasks: [], errors: [] }
  # SSoT: Uses task.has_linked_po? which checks PurchaseOrder.sm_task_id
  def spawn!
    return success_result if task.nil?
    return success_result unless task.has_linked_po?

    # Check if tasks already spawned for this PO to avoid duplicates
    existing_spawns = SmSpawnLog.where(parent_task: task, spawn_trigger: "po_created")
                                .pluck(:spawn_type)

    spawn_order_task unless existing_spawns.include?("order")
    spawn_call_task unless existing_spawns.include?("call")

    if errors.empty?
      success_result
    else
      failure_result
    end
  end

  # Preview what would be spawned (dry run)
  def preview
    spawns = []

    if task.spawn_order_task?
      order_days = task.order_time_days || DEFAULT_ORDER_TIME_DAYS
      order_date = task.start_date - order_days.days
      spawns << {
        type: "order",
        name: "Order #{task.name}",
        scheduled_date: order_date,
        days_before: order_days
      }
    end

    if task.spawn_call_task?
      call_days = task.call_time_days || DEFAULT_CALL_TIME_DAYS
      call_date = task.start_date - call_days.days
      spawns << {
        type: "call",
        name: "Call #{task.name}",
        scheduled_date: call_date,
        days_before: call_days
      }
    end

    spawns
  end

  private

  def spawn_order_task
    return unless task.spawn_order_task?

    order_days = task.order_time_days || DEFAULT_ORDER_TIME_DAYS
    start_date = task.start_date - order_days.days
    end_date = start_date # 1-day task

    spawned = create_spawned_task(
      name: "Order #{task.name}",
      description: "Order materials for: #{task.name}",
      spawn_type: "order",
      start_date: start_date,
      end_date: end_date,
      duration_days: 1
    )

    log_spawn(spawned, "order") if spawned
  end

  def spawn_call_task
    return unless task.spawn_call_task?

    call_days = task.call_time_days || DEFAULT_CALL_TIME_DAYS
    start_date = task.start_date - call_days.days
    end_date = start_date # 1-day task

    spawned = create_spawned_task(
      name: "Call #{task.name}",
      description: "Call supplier to confirm: #{task.name}",
      spawn_type: "call",
      start_date: start_date,
      end_date: end_date,
      duration_days: 1
    )

    log_spawn(spawned, "call") if spawned
  end

  def create_spawned_task(attrs)
    spawn_type = attrs.delete(:spawn_type)

    # Get next task number for the job
    max_task_number = SmTask.where(job_id: task.job_id).maximum(:task_number) || 0

    # SSoT: Multi-tenancy - set tenant_id from parent task (background job has no tenant context)
    spawned = SmTask.create!(
      job_id: task.job_id,
      task_number: max_task_number + 1,
      sequence_order: attrs[:start_date].to_time.to_i, # Order by date
      status: "not_started",
      trade: task.trade,
      stage: task.stage,
      supplier_id: task.supplier_id,
      # Note: Spawned Order/Call tasks are NOT linked to PO
      # SSoT: Only the parent task has the PO link via PurchaseOrder.sm_task_id
      # Audit
      created_by: user,
      updated_by: user,
      tenant_id: task&.tenant_id,
      **attrs.except(:spawn_type)
    )

    @spawned_tasks << spawned
    spawned
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to spawn #{spawn_type} task: #{e.message}"
    Rails.logger.error("[SmPoSpawnService] Failed to spawn #{spawn_type} task: #{e.message}")
    nil
  end

  def log_spawn(spawned_task, spawn_type)
    SmSpawnLog.create!(
      parent_task: task,
      spawned_task: spawned_task,
      spawn_type: spawn_type,
      spawn_trigger: "po_created",
      spawned_by: user
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("[SmPoSpawnService] Failed to log spawn: #{e.message}")
  end

  def success_result
    {
      success: true,
      spawned_tasks: spawned_tasks,
      errors: []
    }
  end

  def failure_result
    {
      success: false,
      spawned_tasks: spawned_tasks,
      errors: errors
    }
  end
end
