# frozen_string_literal: true

# SmTemplateSyncService - Smart sync of SmScheduleMaster to SmTask on a job
#
# SSoT: SmScheduleMaster is THE template definition, SmTask is THE job-level instance.
# This service syncs from template -> task while preserving "job reality" (actual work progress).
#
# Usage:
#   # Single row sync
#   result = SmTemplateSyncService.new(job, template_row, options).sync!
#
#   # Bulk sync all rows from a template to a job
#   results = SmTemplateSyncService.sync_all_for_job(job, template, options)
#
# Options:
#   user: User performing the sync (for audit trail)
#   force: Force update even on protected tasks (default: false) - USE WITH CAUTION
#
# Returns:
#   { success: true, task: SmTask, action: :created | :updated | :unchanged | :skipped }
#   { success: false, error: "message" }
#
class SmTemplateSyncService
  attr_reader :job, :template_row, :options

  # Fields that are safe to sync from template (exist on BOTH SmScheduleMaster and SmTask)
  # These don't affect schedule or represent actual work progress
  SAFE_SYNC_FIELDS = %i[
    name
    description
    trade
    stage
    checklist_id
    require_photo
    require_certificate
    po_required
    critical_po
    order_time_days
    call_time_days
    documentation_category_ids
    linked_task_ids
    show_in_docs_tab
    spawn_photo_task
    spawn_scan_task
    spawn_office_tasks
    pass_fail_enabled
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
    hold
  ].freeze

  # Compare template rows with job tasks - returns detailed comparison for UI
  # Returns array of comparisons, each with:
  #   - template_row: the source row
  #   - job_task: the matching task (or nil if not exists)
  #   - status: :will_create, :will_update, :will_skip, :unchanged
  #   - skip_reason: why it will be skipped (if applicable)
  #   - differences: hash of field differences { field: { from: x, to: y } }
  def self.compare_for_job(job, template)
    comparisons = []

    return comparisons unless job.present? && template.present?

    # Get active template rows
    rows = template.sm_schedule_master_rows.where(is_active: true).order(:sequence_order)

    rows.each do |row|
      service = new(job, row, {})
      comparisons << service.compare
    end

    comparisons
  end

  # Bulk sync all template rows to tasks for a job
  # Returns summary: { created: N, updated: N, skipped: N, unchanged: N, errors: [] }
  def self.sync_all_for_job(job, template, options = {})
    results = {
      created: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      errors: [],
      skipped_tasks: []
    }

    return results unless job.present? && template.present?

    # Get active template rows
    rows = template.sm_schedule_master_rows.where(is_active: true).order(:sequence_order)

    rows.each do |row|
      result = new(job, row, options).sync!

      if result[:success]
        case result[:action]
        when :created then results[:created] += 1
        when :updated then results[:updated] += 1
        when :skipped
          results[:skipped] += 1
          results[:skipped_tasks] << {
            task_id: result[:task]&.id,
            task_name: result[:task]&.name,
            reason: result[:reason]
          }
        when :unchanged then results[:unchanged] += 1
        end
      else
        results[:errors] << { row_id: row.id, row_name: row.name, error: result[:error] }
      end
    end

    Rails.logger.info "[SmTemplateSyncService] Bulk sync for job #{job.id}: " \
      "created=#{results[:created]}, updated=#{results[:updated]}, " \
      "skipped=#{results[:skipped]}, unchanged=#{results[:unchanged]}, " \
      "errors=#{results[:errors].count}"

    results
  end

  def initialize(job, template_row, options = {})
    @job = job
    @template_row = template_row
    @options = options.with_indifferent_access
  end

  # Sync a single template row to a task on the job
  # - If task has "job reality" (started, confirmed, etc): SKIP
  # - If task exists and is safe: update safe fields only
  # - If task doesn't exist: create new task at end of schedule
  def sync!
    return failure("Job is required") unless job.present?
    return failure("Template row is required") unless template_row.present?

    existing_task = find_existing_task

    # Check if task should be skipped (has job reality)
    if existing_task && should_skip_task?(existing_task) && !force?
      return {
        success: true,
        task: existing_task,
        action: :skipped,
        reason: skip_reason(existing_task),
        message: "Task skipped - has job-level changes that should not be overwritten"
      }
    end

    if existing_task
      update_existing_task(existing_task)
    else
      create_new_task
    end
  rescue StandardError => e
    Rails.logger.error "SmTemplateSyncService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    failure("Sync failed: #{e.message}")
  end

  # Compare a single template row with its job task (if exists)
  # Returns comparison data for UI display
  def compare
    existing_task = find_existing_task

    if existing_task.nil?
      return {
        template_row: template_row_json,
        job_task: nil,
        status: "will_create",
        skip_reason: nil,
        differences: {}
      }
    end

    # Check if task should be skipped
    if should_skip_task?(existing_task)
      return {
        template_row: template_row_json,
        job_task: task_json(existing_task),
        status: "will_skip",
        skip_reason: skip_reason(existing_task),
        differences: calculate_differences(existing_task)
      }
    end

    # Calculate differences
    differences = calculate_differences(existing_task)

    if differences.empty?
      {
        template_row: template_row_json,
        job_task: task_json(existing_task),
        status: "unchanged",
        skip_reason: nil,
        differences: {}
      }
    else
      {
        template_row: template_row_json,
        job_task: task_json(existing_task),
        status: "will_update",
        skip_reason: nil,
        differences: differences
      }
    end
  end

  private

  def template_row_json
    {
      id: template_row.id,
      task_number: template_row.task_number,
      name: template_row.name,
      description: template_row.description,
      duration_days: template_row.duration_days,
      trade: template_row.trade,
      stage: template_row.stage,
      require_photo: template_row.require_photo,
      require_certificate: template_row.require_certificate,
      po_required: template_row.po_required,
      critical_po: template_row.critical_po
    }
  end

  def task_json(task)
    {
      id: task.id,
      task_number: task.task_number,
      name: task.name,
      description: task.description,
      duration_days: task.duration_days,
      trade: task.trade,
      stage: task.stage,
      status: task.status,
      require_photo: task.require_photo,
      require_certificate: task.require_certificate,
      po_required: task.po_required,
      critical_po: task.critical_po,
      started_at: task.started_at,
      completed_at: task.completed_at,
      confirm: task.confirm,
      supplier_confirm: task.supplier_confirm,
      hold: task.hold,
      purchase_order_id: task.purchase_order_id
    }
  end

  def calculate_differences(task)
    differences = {}

    SAFE_SYNC_FIELDS.each do |field|
      next unless template_row.respond_to?(field) && task.respond_to?(field)

      template_value = template_row.send(field)
      task_value = task.send(field)

      # Only show difference if template has a value and it differs
      if template_value.present? && template_value != task_value
        differences[field.to_s] = {
          template: template_value,
          task: task_value
        }
      end
    end

    differences
  end

  def user
    @user ||= options[:user]
  end

  def force?
    options[:force] == true
  end

  def find_existing_task
    job.sm_tasks.find_by(sm_schedule_master_id: template_row.id)
  end

  # Check if task has "job reality" that should not be overwritten
  # These represent actual work progress, confirmations, or commitments
  def should_skip_task?(task)
    return false if task.nil?

    # Skip if task has any of these job-level states
    task.status.in?(%w[started completed]) ||
      task.started_at.present? ||
      task.completed_at.present? ||
      task.supplier_confirm == true ||
      task.confirm == true ||
      task.hold == true ||
      task.purchase_order_id.present?
  end

  # Return human-readable reason why task was skipped
  def skip_reason(task)
    reasons = []
    reasons << "completed" if task.status == "completed" || task.completed_at.present?
    reasons << "started" if task.status == "started" || task.started_at.present?
    reasons << "supplier confirmed" if task.supplier_confirm == true
    reasons << "confirmation locked" if task.confirm == true
    reasons << "on hold" if task.hold == true
    reasons << "has PO ##{task.purchase_order_id}" if task.purchase_order_id.present?
    reasons.join(", ")
  end

  def update_existing_task(task)
    changes = {}

    SAFE_SYNC_FIELDS.each do |field|
      next unless template_row.respond_to?(field) && task.respond_to?(field)
      next unless task.respond_to?("#{field}=")

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
    duration = template_row.duration_days || 1
    end_date = start_date + (duration - 1).days

    task = SmTask.new(
      # Core identifiers
      construction_id: job.id,
      sm_schedule_master_id: template_row.id,
      task_number: next_task_number,
      sequence_order: next_sequence,

      # Core task info (from template)
      name: template_row.name,
      description: template_row.description,
      duration_days: duration,
      trade: template_row.trade,
      stage: template_row.stage,
      checklist_id: template_row.checklist_id,

      # Requirements (from template)
      require_photo: template_row.require_photo,
      require_certificate: template_row.require_certificate,
      po_required: template_row.po_required,
      critical_po: template_row.critical_po,

      # Timing (from template)
      order_time_days: template_row.order_time_days,
      call_time_days: template_row.call_time_days,

      # Documentation (from template)
      documentation_category_ids: template_row.documentation_category_ids,
      linked_task_ids: template_row.linked_task_ids,
      show_in_docs_tab: template_row.show_in_docs_tab,

      # Automation (from template)
      spawn_photo_task: template_row.spawn_photo_task,
      spawn_scan_task: template_row.spawn_scan_task,
      spawn_office_tasks: template_row.spawn_office_tasks,
      pass_fail_enabled: template_row.pass_fail_enabled,

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
