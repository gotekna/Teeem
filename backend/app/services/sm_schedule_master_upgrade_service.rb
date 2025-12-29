# frozen_string_literal: true

# SmScheduleMasterUpgradeService - Upgrade a job's schedule to a newer template version
#
# Handles the intelligent upgrade of a job's tasks when a newer template version
# is available. Respects "job reality" by protecting tasks that have started,
# completed, confirmed, or are on hold.
#
# Usage:
#   service = SmScheduleMasterUpgradeService.new(job, user: current_user)
#
#   # Preview changes without applying
#   preview = service.preview_upgrade
#
#   # Execute the upgrade
#   result = service.execute_upgrade
#
# Protected Tasks (will be skipped):
#   - status = "started" or "completed"
#   - started_at is present
#   - completed_at is present
#   - supplier_confirm = true
#   - confirm = true
#   - hold = true
#   - is_custom = true (no sm_schedule_master_id)
#
class SmScheduleMasterUpgradeService
  attr_reader :job, :user, :errors

  def initialize(job, user: nil)
    @job = job
    @user = user
    @errors = []
  end

  # Preview upgrade without making changes
  # Returns detailed diff of what would change
  def preview_upgrade
    return failure("Job required") unless job.present?
    return failure("No template version applied to job") unless current_version.present?

    template = current_version.sm_schedule_master_template
    return failure("Template not found") unless template.present?

    latest = template.published_version
    return failure("No published version available") unless latest.present?
    return failure("Already on latest version") if latest.id == current_version.id

    # Calculate the diff
    diff = calculate_diff(current_version, latest)

    success(
      current_version: {
        id: current_version.id,
        number: current_version.version_number,
        published_at: current_version.published_at
      },
      target_version: {
        id: latest.id,
        number: latest.version_number,
        published_at: latest.published_at,
        change_summary: latest.change_summary
      },
      template_name: template.name,
      summary: {
        tasks_to_add: diff[:to_add].count,
        tasks_to_remove: diff[:to_remove].count,
        tasks_to_update: diff[:to_update].count,
        tasks_protected: diff[:protected].count,
        custom_tasks: diff[:custom].count
      },
      details: diff
    )
  end

  # Execute the upgrade
  def execute_upgrade
    preview = preview_upgrade
    return preview unless preview[:success]

    diff = preview[:details]
    target_version = SmScheduleMasterVersion.find(preview[:target_version][:id])

    ActiveRecord::Base.transaction do
      results = {
        added: [],
        removed: [],
        updated: [],
        skipped: [],
        errors: []
      }

      # 1. Add new tasks
      diff[:to_add].each do |row_data|
        result = add_task_from_row(row_data[:row])
        if result[:success]
          results[:added] << { id: result[:task].id, name: result[:task].name }
        else
          results[:errors] << { action: :add, row: row_data[:name], error: result[:error] }
        end
      end

      # 2. Remove tasks (only unprotected)
      diff[:to_remove].each do |task_data|
        task = SmTask.find_by(id: task_data[:task_id])
        next unless task

        if task_data[:protected]
          results[:skipped] << { id: task.id, name: task.name, reason: task_data[:protection_reason] }
        else
          task.destroy!
          results[:removed] << { id: task_data[:task_id], name: task_data[:name] }
        end
      end

      # 3. Update tasks
      diff[:to_update].each do |update_data|
        task = SmTask.find_by(id: update_data[:task_id])
        next unless task

        if update_data[:protected]
          results[:skipped] << { id: task.id, name: task.name, reason: update_data[:protection_reason] }
        else
          result = update_task_from_row(task, update_data[:row], update_data[:changes])
          if result[:success]
            results[:updated] << { id: task.id, name: task.name, changes: update_data[:changes] }
          else
            results[:errors] << { action: :update, task: task.name, error: result[:error] }
          end
        end
      end

      # Update job to reference new version
      job.update!(
        sm_template_version_id: target_version.id,
        template_applied_at: Time.current
      )

      if results[:errors].any?
        raise ActiveRecord::Rollback
      end

      success(
        version_upgraded: target_version.version_number,
        results: results
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    failure("Upgrade failed: #{e.message}")
  end

  private

  def current_version
    @current_version ||= job.sm_template_version
  end

  # Calculate differences between versions
  def calculate_diff(from_version, to_version)
    # Get all tasks for the job
    job_tasks = job.sm_tasks.to_a
    job_tasks_by_row_id = job_tasks.index_by(&:sm_schedule_master_id)

    # Get rows from both versions
    old_rows = from_version.sm_schedule_master_rows.index_by(&:id)
    new_rows = to_version.sm_schedule_master_rows.index_by(&:id)

    # Build task_number mapping (old version task_number -> new version task_number)
    # Since rows have same task_number across versions when copied
    old_task_numbers = from_version.sm_schedule_master_rows.pluck(:task_number)
    new_task_numbers = to_version.sm_schedule_master_rows.pluck(:task_number)

    # Track what needs to happen
    to_add = []
    to_remove = []
    to_update = []
    protected_tasks = []
    custom_tasks = []

    # Find custom tasks (no template row link)
    job_tasks.each do |task|
      if task.sm_schedule_master_id.nil?
        custom_tasks << {
          task_id: task.id,
          name: task.name,
          reason: "No template row link (custom/manual task)"
        }
      end
    end

    # Find tasks to remove (in job but row deleted from new version)
    job_tasks.each do |task|
      next if task.sm_schedule_master_id.nil? # Skip custom tasks
      next if new_rows.values.any? { |r| r.task_number == old_rows[task.sm_schedule_master_id]&.task_number }

      protected, reason = check_protection(task)
      if protected
        protected_tasks << {
          task_id: task.id,
          name: task.name,
          action: :would_remove,
          protection_reason: reason
        }
        to_remove << {
          task_id: task.id,
          name: task.name,
          protected: true,
          protection_reason: reason
        }
      else
        to_remove << {
          task_id: task.id,
          name: task.name,
          protected: false
        }
      end
    end

    # Find tasks to add (in new version but not in job)
    existing_task_numbers = job_tasks.filter_map { |t| old_rows[t.sm_schedule_master_id]&.task_number }
    new_rows.each do |_id, row|
      unless existing_task_numbers.include?(row.task_number)
        to_add << {
          row_id: row.id,
          name: row.name,
          task_number: row.task_number,
          row: row
        }
      end
    end

    # Find tasks to update (exist in both, check for changes)
    job_tasks.each do |task|
      next if task.sm_schedule_master_id.nil?

      old_row = old_rows[task.sm_schedule_master_id]
      next unless old_row

      # Find corresponding row in new version (by task_number)
      new_row = new_rows.values.find { |r| r.task_number == old_row.task_number }
      next unless new_row

      # Compare fields
      changes = compare_row_to_task(new_row, task)
      next if changes.empty?

      protected, reason = check_protection(task)
      if protected
        protected_tasks << {
          task_id: task.id,
          name: task.name,
          action: :would_update,
          changes: changes,
          protection_reason: reason
        }
        to_update << {
          task_id: task.id,
          name: task.name,
          changes: changes,
          protected: true,
          protection_reason: reason,
          row: new_row
        }
      else
        to_update << {
          task_id: task.id,
          name: task.name,
          changes: changes,
          protected: false,
          row: new_row
        }
      end
    end

    {
      to_add: to_add,
      to_remove: to_remove,
      to_update: to_update,
      protected: protected_tasks,
      custom: custom_tasks
    }
  end

  # Check if task is protected from changes
  def check_protection(task)
    if task.status_started?
      [true, "Task started"]
    elsif task.status_completed?
      [true, "Task completed"]
    elsif task.started_at.present?
      [true, "Task has start timestamp"]
    elsif task.completed_at.present?
      [true, "Task has completion timestamp"]
    elsif task.supplier_confirm?
      [true, "Supplier confirmed"]
    elsif task.confirm?
      [true, "Task confirmed"]
    elsif task.hold?
      [true, "Task on hold"]
    else
      [false, nil]
    end
  end

  # Fields to compare between template row and task
  SYNCABLE_FIELDS = %i[
    name description duration_days trade stage
    checklist_id require_photo po_required critical_po
    order_time_days call_time_days spawn_order_task spawn_call_task
    pass_fail_enabled assigned_role
  ].freeze

  def compare_row_to_task(row, task)
    changes = []

    SYNCABLE_FIELDS.each do |field|
      # Handle field name mapping (some differ between row and task)
      row_field = field
      task_field = case field
                   when :assigned_role then :assigned_role
                   when :pass_fail_enabled then :pass_fail_enabled
                   else field
                   end

      row_value = row.respond_to?(row_field) ? row.send(row_field) : nil
      task_value = task.respond_to?(task_field) ? task.send(task_field) : nil

      next if row_value == task_value

      changes << {
        field: field,
        from: task_value,
        to: row_value
      }
    end

    changes
  end

  # Add a new task from a template row
  def add_task_from_row(row)
    max_task_number = job.sm_tasks.maximum(:task_number) || 0
    max_sequence = job.sm_tasks.maximum(:sequence_order) || 0

    task = SmTask.new(
      construction_id: job.id,
      sm_schedule_master_id: row.id,
      name: row.name,
      description: row.description,
      task_number: max_task_number + 1,
      sequence_order: max_sequence + 1,
      duration_days: row.duration_days,
      trade: row.trade,
      stage: row.stage,
      checklist_id: row.checklist_id,
      status: "not_started",
      require_photo: row.require_photo,
      po_required: row.po_required,
      critical_po: row.critical_po,
      order_time_days: row.order_time_days,
      call_time_days: row.call_time_days,
      spawn_order_task: row.spawn_order_task,
      spawn_call_task: row.spawn_call_task,
      pass_fail_enabled: row.pass_fail_enabled,
      assigned_role: row.assigned_role,
      start_date: Date.current, # Will need to be recalculated
      end_date: Date.current + (row.duration_days - 1).days,
      created_by: user,
      updated_by: user
    )

    if task.save
      { success: true, task: task }
    else
      { success: false, error: task.errors.full_messages.join(", ") }
    end
  end

  # Update task from template row
  def update_task_from_row(task, row, changes)
    updates = {}

    changes.each do |change|
      updates[change[:field]] = change[:to]
    end

    updates[:updated_by] = user if user.present?
    updates[:sm_schedule_master_id] = row.id # Update link to new row

    if task.update(updates)
      { success: true }
    else
      { success: false, error: task.errors.full_messages.join(", ") }
    end
  end

  def success(data = {})
    { success: true }.merge(data)
  end

  def failure(message)
    { success: false, error: message }
  end
end
