# frozen_string_literal: true

# SmTaskCompletionService - Handles task completion and spawning follow-up tasks
#
# When a task is completed, this service:
# 1. Updates the task status to completed
# 2. Spawns follow-up tasks based on configuration (photo, scan, office tasks)
# 3. Handles pass/fail inspections with retry spawning
# 4. Logs all spawned tasks for audit trail
#
# See GANTT_ARCHITECTURE_PLAN.md Section 10 (Task Spawning System)
#
class SmTaskCompletionService
  attr_reader :task, :user, :errors

  SPAWN_TYPES = %w[photo scan office inspection_retry document_get].freeze

  def initialize(task, user: nil)
    @task = task
    @user = user
    @errors = []
    @spawned_tasks = []
    @cascade_completed_tasks = []
  end

  # Complete a task with optional pass/fail for inspections
  # also_complete_task_ids: array of task IDs to cascade complete with this task
  # Returns { success: bool, task: SmTask, spawned_tasks: [], cascade_completed_tasks: [], errors: [], already_completed: bool }
  #
  # IDEMPOTENT: If task is already completed, returns success (not error).
  # This handles double-clicks, multi-tab usage, network retries gracefully.
  def complete(passed: nil, also_complete_task_ids: [])
    # Idempotent: already completed = success (no work to do)
    if task.status_completed?
      Rails.logger.info("[SmTaskCompletionService] Task #{task.id} already completed - returning idempotent success")
      return idempotent_success_result
    end

    ActiveRecord::Base.transaction do
      # Validate task can be completed (hold status, required docs, etc.)
      unless can_complete?
        return failure_result
      end

      # Update task status
      complete_task!(passed)

      # Cascade complete selected linked tasks
      complete_linked_tasks(also_complete_task_ids) if also_complete_task_ids.present?

      # Handle spawning based on completion result
      if task.pass_fail_enabled? && passed == false
        # Failed inspection - spawn retry task
        spawn_inspection_retry
      else
        # Normal completion - spawn configured follow-up tasks
        spawn_follow_up_tasks
      end

      success_result
    end
  rescue StandardError => e
    @errors << "Completion failed: #{e.message}"
    Rails.logger.error("SmTaskCompletionService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    failure_result
  end

  # Preview what tasks would be spawned (dry run)
  def preview_spawns
    spawns = []

    if task.pass_fail_enabled?
      spawns << { type: "inspection_retry", condition: "if inspection fails" }
    end

    if task.spawn_scan_task_id.present?
      scan_template = SmScheduleMaster.find_by(id: task.spawn_scan_task_id)
      spawns << {
        type: "scan",
        name: scan_template&.name || "Document Scan",
        condition: "on completion",
        lag_days: task.spawn_scan_lag_days || 0
      }
    end

    spawns
  end

  private

  def can_complete?
    # Note: already-completed check is handled earlier for idempotency
    if task.is_hold_task? && task.hold_active?
      @errors << "Cannot complete a hold task while hold is active"
      return false
    end

    # Check if required document is attached
    if task.requires_document_to_complete? && task.completion_document_type_id.present?
      unless has_required_document_attached?
        doc_type_name = task.completion_document_type&.display_name || task.completion_document_type&.name || "required document"
        @errors << "Cannot complete task: #{doc_type_name} must be attached"
        return false
      end
    end

    true
  end

  def has_required_document_attached?
    required_doc_type_id = task.completion_document_type_id
    return false unless required_doc_type_id

    # Check attached documents for matching document type
    # SSoT (Jan 2026): All documents are now WarehouseDocument
    task.sm_task_attachments.documents.any? do |attachment|
      doc = attachment.attachable
      doc.is_a?(WarehouseDocument) && doc.meta("document_type_id")&.to_i == required_doc_type_id
    end
  end

  def complete_task!(passed)
    attrs = {
      status: "completed",
      completed_at: Time.current,
      updated_by: user
    }

    # Only set passed if pass_fail is enabled
    if task.pass_fail_enabled?
      attrs[:passed] = passed
    end

    task.update!(attrs)
  end

  def spawn_follow_up_tasks
    # Fire completion workflow if configured
    fire_complete_workflow if task.complete_workflow_enabled? && task.complete_workflow_id.present?

    # Spawn scan task (existing functionality)
    spawn_scan_task if task.spawn_scan_task_id.present?

    # Generate certificates for document types that require auto-generation
    generate_certificates if task.sm_task_document_types.any?

    # Spawn GET tasks for linked document types
    spawn_document_get_tasks if task.sm_task_document_types.any?
  end

  # Complete selected linked tasks (cascade completion)
  # Only completes tasks on the same job that are in completion_linked_task_ids
  def complete_linked_tasks(task_ids)
    return if task_ids.blank?

    task_ids.each do |linked_task_id|
      linked_task = SmTask.find_by(id: linked_task_id, job_id: task.job_id)
      next unless linked_task
      next unless linked_task.can_complete?

      # Complete the linked task
      linked_task.update!(
        status: "completed",
        completed_at: Time.current,
        updated_by: user
      )

      # Log the cascade completion for audit trail
      TaskActivityLog.log_cascade_completion(
        task: linked_task,
        triggered_by: task,
        user: user
      )

      @cascade_completed_tasks << linked_task

      Rails.logger.info("[SmTaskCompletionService] Cascade completed task #{linked_task.id} (#{linked_task.name}) with parent task #{task.id}")
    end
  end

  def fire_complete_workflow
    workflow = task.complete_workflow
    return unless workflow

    Bpmn::EngineService.start_process(
      process_id: workflow.id,
      subject: task.job,
      variables: {
        task_id: task.id,
        task_name: task.name,
        task_number: task.task_number,
        job_id: task.job_id,
        job_code: task.job&.job_code,
        completed_by_user_id: user&.id,
        completed_at: Time.current.iso8601
      },
      triggered_by: "task_complete"
    )

    Rails.logger.info("[SmTaskCompletionService] Fired workflow '#{workflow.name}' for task #{task.id} (#{task.name})")
  end

  def spawn_document_get_tasks
    calendar = WorkingDaysCalculator.new(TenantSetting.instance)

    task.sm_task_document_types.includes(:document_type).each do |doc_type_link|
      doc_type = doc_type_link.document_type
      next unless doc_type

      # Calculate start date using working days
      lag_days = doc_type_link.lag_days || 0
      start_date = calendar.add_working_days(task.completed_at.to_date, lag_days)

      spawned = create_spawned_task(
        name: "GET - #{doc_type.display_name || doc_type.name}",
        description: "Collect document: #{doc_type.display_name || doc_type.name}",
        spawn_type: "document_get",
        duration_days: 1,
        start_date: start_date,
        end_date: start_date,
        assigned_role: doc_type_link.assigned_role
      )

      log_spawn(spawned, "document_get", "parent_complete") if spawned
    end
  end

  # Generate certificates for document types that have generates_certificate: true
  # Creates signed PDF certificates using the job supervisor's signature
  def generate_certificates
    job = task.job
    return unless job

    supervisor = job.supervisor_user
    unless supervisor&.can_sign_certificates?
      Rails.logger.info("[SmTaskCompletionService] Skipping certificate generation - supervisor cannot sign (task #{task.id})")
      return
    end

    task.sm_task_document_types.includes(:document_type).each do |doc_type_link|
      doc_type = doc_type_link.document_type
      next unless doc_type&.generates_certificate?
      next unless doc_type.certificate_template.present?

      begin
        generate_certificate_for_document_type(job, doc_type, supervisor)
      rescue StandardError => e
        Rails.logger.error("[SmTaskCompletionService] Certificate generation failed for #{doc_type.name}: #{e.message}")
        @errors << "Certificate generation failed for #{doc_type.name}: #{e.message}"
      end
    end
  end

  # Generate a single certificate for a document type
  def generate_certificate_for_document_type(job, document_type, supervisor)
    # Select the appropriate generator based on template
    generator = case document_type.certificate_template
                when "form_43"
                  Form43CertificateGenerator.new(
                    job: job,
                    document_type: document_type,
                    supervisor: supervisor
                  )
                else
                  Rails.logger.warn("[SmTaskCompletionService] Unknown certificate template: #{document_type.certificate_template}")
                  return
                end

    result = generator.generate

    # Create StorageBlob with deduplicated PDF content
    blob = StorageBlob.find_or_create_for_content!(
      result[:pdf_content],
      filename: result[:filename],
      content_type: "application/pdf"
    )

    # Create WarehouseDocument (SSoT for all document metadata)
    warehouse_doc = WarehouseDocument.create!(
      source_type: "job",
      display_name: result[:filename],
      original_filename: result[:filename],
      content_type: "application/pdf",
      file_size: result[:pdf_content].bytesize,
      storage_blob: blob,
      folder: document_type.target_folder || "Certificates",
      linkable: job,
      metadata: {
        document_type_id: document_type.id,
        document_type: document_type.name,
        job_code: job.job_code,
        version_status: "signed",
        signed_by_id: supervisor.id,
        signed_at: result[:generated_at]&.iso8601,
        source: "generated",
        certificate_template: document_type.certificate_template
      }
    )

    # Record signature usage in digital register
    SignatureUsage.record!(
      user: supervisor,
      certificate_type: document_type.certificate_template,
      document_name: result[:filename],
      purpose: "#{document_type.certificate_template_display} - #{document_type.name}",
      document_type: document_type,
      job: job,
      job_document: job_document
    )

    Rails.logger.info("[SmTaskCompletionService] Generated certificate: #{result[:filename]} for job #{job.id} (document #{job_document.id})")
  end

  def spawn_scan_task
    scan_template = SmScheduleMaster.find_by(id: task.spawn_scan_task_id)
    return unless scan_template

    lag_days = task.spawn_scan_lag_days || 0
    start_date = task.completed_at.to_date + lag_days.days

    spawned = create_spawned_task(
      name: scan_template.name,
      description: scan_template.description || "Document scan for: #{task.name}",
      spawn_type: "scan",
      duration_days: scan_template.duration_days || 1,
      start_date: start_date,
      end_date: start_date + (scan_template.duration_days || 1).days,
      trade: scan_template.trade,
      checklist_id: scan_template.checklist_id
    )
    log_spawn(spawned, "scan", "parent_complete") if spawned
  end

  def spawn_inspection_retry
    # Find the original inspection task (trace back through parent chain)
    original_task = find_original_inspection_task
    original_name = original_task.name.sub(/^Re-inspect \d+: /, "")

    # Count existing retries for this original task
    retry_count = count_inspection_retries(original_task)

    spawned = create_spawned_task(
      name: "Re-inspect #{retry_count + 1}: #{original_name}",
      description: "Re-inspection ##{retry_count + 1} for: #{original_name}",
      spawn_type: "inspection_retry",
      duration_days: task.duration_days,
      pass_fail_enabled: true,
      # Inherit key settings from parent
      trade: task.trade,
      supplier_id: task.supplier_id,
      checklist_id: task.checklist_id
    )
    log_spawn(spawned, "inspection_retry", "inspection_fail") if spawned
  end

  # Trace back to find the original inspection task (before any retries)
  def find_original_inspection_task
    current = task
    while current.parent_task.present? && current.parent_task.pass_fail_enabled?
      current = current.parent_task
    end
    current
  end

  # Count all retry tasks spawned from the original inspection
  def count_inspection_retries(original_task)
    SmSpawnLog.where(
      parent_task_id: all_task_ids_in_chain(original_task),
      spawn_type: "inspection_retry"
    ).count
  end

  # Get all task IDs in the retry chain (original + all retries)
  def all_task_ids_in_chain(original_task)
    ids = [original_task.id]
    SmSpawnLog.where(parent_task_id: original_task.id, spawn_type: "inspection_retry").find_each do |log|
      ids << log.spawned_task_id if log.spawned_task_id
      # Recursively get children
      ids += all_task_ids_in_chain_recursive(log.spawned_task_id) if log.spawned_task_id
    end
    ids.compact.uniq
  end

  def all_task_ids_in_chain_recursive(task_id)
    ids = []
    SmSpawnLog.where(parent_task_id: task_id, spawn_type: "inspection_retry").find_each do |log|
      ids << log.spawned_task_id if log.spawned_task_id
      ids += all_task_ids_in_chain_recursive(log.spawned_task_id) if log.spawned_task_id
    end
    ids
  end

  def create_spawned_task(attrs)
    # Get next task number
    max_number = SmTask.where(job_id: task.job_id).maximum(:task_number) || 0

    # Get sequence order (place right after parent task)
    new_sequence = task.sequence_order + 0.01

    # Generate unique name for duplicates (e.g., "Req Bath 1", "Req Bath 2")
    # Skip for inspection retries which have special naming
    task_name = if attrs[:spawn_type] == "inspection_retry"
                  attrs[:name]
                else
                  generate_unique_task_name(attrs[:name])
                end

    # SSoT: Multi-tenancy - set tenant_id from parent task (background job has no tenant context)
    spawned = SmTask.create!(
      construction_id: task.job_id,
      parent_task_id: task.id,
      task_number: max_number + 1,
      sequence_order: new_sequence,
      start_date: Date.current,
      end_date: Date.current + (attrs[:duration_days] || 1) - 1,
      duration_days: attrs[:duration_days] || 1,
      status: "not_started",
      created_by: user,
      tenant_id: task&.tenant_id,
      **attrs.except(:spawn_type).merge(name: task_name)
    )

    @spawned_tasks << spawned
    spawned
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to spawn #{attrs[:spawn_type]} task: #{e.message}"
    Rails.logger.error("Failed to spawn task: #{e.message}")
    nil
  end

  # Generate unique task name for duplicates
  # If task "Req Bath" already exists:
  #   - Rename existing to "Req Bath 1"
  #   - Return "Req Bath 2" for new task
  def generate_unique_task_name(base_name)
    return base_name if base_name.blank?

    job = Construction.find(task.job_id)

    # Find all tasks with exact name or numbered variants
    existing_tasks = job.sm_tasks.where(
      "name = :exact OR name ~ :pattern",
      exact: base_name,
      pattern: "^#{Regexp.escape(base_name)} \\d+$"
    )

    return base_name if existing_tasks.empty?

    # Check if there's an unnumbered task that needs renaming
    unnumbered_task = existing_tasks.find_by(name: base_name)
    if unnumbered_task
      unnumbered_task.update_column(:name, "#{base_name} 1")
      Rails.logger.info "[SmTaskCompletionService] Renamed task #{unnumbered_task.id} to '#{base_name} 1' for duplicate numbering"
    end

    # Find the highest number used
    max_number = existing_tasks.pluck(:name).map do |name|
      if name == base_name
        1
      elsif name =~ /^#{Regexp.escape(base_name)} (\d+)$/
        $1.to_i
      else
        0
      end
    end.max || 0

    "#{base_name} #{max_number + 1}"
  end

  def log_spawn(spawned_task, spawn_type, spawn_trigger)
    SmSpawnLog.create!(
      parent_task: task,
      spawned_task: spawned_task,
      spawn_type: spawn_type,
      spawn_trigger: spawn_trigger,
      spawned_by: user
    )
  end

  def success_result
    {
      success: true,
      task: task.reload,
      spawned_tasks: @spawned_tasks,
      cascade_completed_tasks: @cascade_completed_tasks,
      errors: [],
      already_completed: false
    }
  end

  # Idempotent success - task was already completed, no work done
  def idempotent_success_result
    {
      success: true,
      task: task,
      spawned_tasks: [],
      cascade_completed_tasks: [],
      errors: [],
      already_completed: true
    }
  end

  def failure_result
    {
      success: false,
      task: task,
      spawned_tasks: [],
      cascade_completed_tasks: [],
      errors: @errors
    }
  end
end
