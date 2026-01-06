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
  end

  # Complete a task with optional pass/fail for inspections
  # Returns { success: bool, task: SmTask, spawned_tasks: [], errors: [] }
  def complete(passed: nil)
    ActiveRecord::Base.transaction do
      # Validate task can be completed
      unless can_complete?
        return failure_result
      end

      # Update task status
      complete_task!(passed)

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
    if task.status_completed?
      @errors << "Task is already completed"
      return false
    end

    if task.is_hold_task? && task.hold_active?
      @errors << "Cannot complete a hold task while hold is active"
      return false
    end

    true
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
    calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)

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

    # Create JobDocument with the generated PDF
    job_document = JobDocument.new(
      job: job,
      document_type: document_type,
      file_name: result[:filename],
      file_extension: "pdf",
      file_size: result[:pdf_content].bytesize,
      sharepoint_item_id: "generated_#{SecureRandom.uuid}",
      source: "generated",
      sync_status: "synced",
      version_status: "signed",
      signed_by: supervisor,
      signed_at: result[:generated_at],
      folder_path: document_type.target_folder || "Certificates"
    )

    # Attach the PDF content
    job_document.file.attach(
      io: StringIO.new(result[:pdf_content]),
      filename: result[:filename],
      content_type: "application/pdf"
    )

    job_document.save!

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
    max_number = SmTask.where(construction_id: task.construction_id).maximum(:task_number) || 0

    # Get sequence order (place right after parent task)
    new_sequence = task.sequence_order + 0.01

    # Generate unique name for duplicates (e.g., "Req Bath 1", "Req Bath 2")
    # Skip for inspection retries which have special naming
    task_name = if attrs[:spawn_type] == "inspection_retry"
                  attrs[:name]
                else
                  generate_unique_task_name(attrs[:name])
                end

    spawned = SmTask.create!(
      construction_id: task.construction_id,
      parent_task_id: task.id,
      task_number: max_number + 1,
      sequence_order: new_sequence,
      start_date: Date.current,
      end_date: Date.current + (attrs[:duration_days] || 1) - 1,
      duration_days: attrs[:duration_days] || 1,
      status: "not_started",
      created_by: user,
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

    job = Construction.find(task.construction_id)

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
      errors: []
    }
  end

  def failure_result
    {
      success: false,
      task: task,
      spawned_tasks: [],
      errors: @errors
    }
  end
end
