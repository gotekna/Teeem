# frozen_string_literal: true

# SmTemplateSyncService - Smart sync of a single SmTemplateRow to SmTask on a job
#
# SSoT: SmTemplateRow is THE template definition, SmTask is THE job-level instance.
# This service syncs from template → task while preserving local schedule integrity.
#
# Usage:
#   result = SmTemplateSyncService.new(job, template_row, options).sync!
#
# Options:
#   user: User performing the sync (for audit trail)
#   force_update: Update even "safe" fields that are usually preserved (default: false)
#
# Returns:
#   { success: true, task: SmTask, action: :created | :updated | :unchanged }
#   { success: false, error: "message" }
#
class SmTemplateSyncService
  attr_reader :job, :template_row, :options

  # Fields that are safe to sync from template (don't affect schedule)
  SAFE_SYNC_FIELDS = %i[
    name
    description
    supplier_id
    trade
    stage
    checklist_id
    require_photo
    require_voice_note
    po_required
    assignable_role
    tags
    spawn_type
    spawn_on
    spawn_per_item
    spawn_prefix
    cert_lag_days
    has_subtasks
    subtask_count
    subtask_names
  ].freeze

  # Fields that affect schedule - NEVER sync these automatically
  SCHEDULE_FIELDS = %i[
    start_date
    end_date
    duration_days
    predecessor_ids
    status
    confirm
    supplier_confirm
    manually_positioned
  ].freeze

  def initialize(job, template_row, options = {})
    @job = job
    @template_row = template_row
    @options = options.with_indifferent_access
  end

  # Sync a single template row to a task on the job
  # - If task exists: update safe fields only (preserves schedule)
  # - If task doesn't exist: create new task at end of schedule
  def sync!
    return failure("Job is required") unless job.present?
    return failure("Template row is required") unless template_row.present?

    existing_task = find_existing_task

    if existing_task
      update_existing_task(existing_task)
    else
      create_new_task
    end
  rescue StandardError => e
    Rails.logger.error "SmTemplateSyncService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    failure("Sync failed: #{e.message}")
  end

  private

  def user
    @user ||= options[:user]
  end

  def find_existing_task
    job.sm_tasks.find_by(sm_template_row_id: template_row.id)
  end

  def update_existing_task(task)
    changes = {}

    SAFE_SYNC_FIELDS.each do |field|
      template_value = template_row.send(field)
      task_value = task.send(field)

      # Only update if template has a value and it differs
      if template_value.present? && template_value != task_value
        changes[field] = { from: task_value, to: template_value }
        task.send("#{field}=", template_value)
      end
    end

    if changes.empty?
      return {
        success: true,
        task: task,
        action: :unchanged,
        message: "Task already in sync with template"
      }
    end

    task.updated_by = user if user
    task.save!

    Rails.logger.info "[SmTemplateSyncService] Updated task #{task.id} (#{task.name}) with #{changes.keys.join(', ')}"

    {
      success: true,
      task: task,
      action: :updated,
      changes: changes,
      message: "Updated #{changes.keys.count} field(s) from template"
    }
  end

  def create_new_task
    # Get next task number for this job
    max_task_number = job.sm_tasks.maximum(:task_number) || 0
    next_task_number = max_task_number + 1

    # Get max sequence order for appending at end
    max_sequence = job.sm_tasks.maximum(:sequence_order) || 0
    next_sequence = max_sequence + 1

    # Calculate start date - either from job or today
    start_date = job.construction_start_date || Date.current
    end_date = start_date + (template_row.duration_days - 1).days

    task = SmTask.new(
      # Core identifiers
      construction_id: job.id,
      sm_template_row_id: template_row.id,
      task_number: next_task_number,
      sequence_order: next_sequence,

      # Copied from template
      name: template_row.name,
      description: template_row.description,
      duration_days: template_row.duration_days,
      trade: template_row.trade,
      stage: template_row.stage,
      supplier_id: template_row.supplier_id,
      checklist_id: template_row.checklist_id,
      require_photo: template_row.require_photo,
      require_voice_note: template_row.require_voice_note,
      po_required: template_row.po_required,
      assignable_role: template_row.assignable_role,
      tags: template_row.tags,

      # Spawn settings
      spawn_type: template_row.spawn_type,
      spawn_on: template_row.spawn_on,
      spawn_per_item: template_row.spawn_per_item,
      spawn_prefix: template_row.spawn_prefix,
      cert_lag_days: template_row.cert_lag_days,

      # Subtasks
      has_subtasks: template_row.has_subtasks,
      subtask_count: template_row.subtask_count,
      subtask_names: template_row.subtask_names,

      # Schedule - start at end of schedule, no dependencies (safe)
      start_date: start_date,
      end_date: end_date,
      status: "not_started",

      # Audit
      created_by: user,
      updated_by: user
    )

    task.save!

    Rails.logger.info "[SmTemplateSyncService] Created task #{task.id} (#{task.name}) from template row #{template_row.id}"

    {
      success: true,
      task: task,
      action: :created,
      message: "Created new task from template"
    }
  end

  def failure(message)
    {
      success: false,
      error: message
    }
  end
end
