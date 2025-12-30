# frozen_string_literal: true

# SmScheduleMasterSyncService - Smart sync of SmScheduleMaster to SmTask on a job
#
# SSoT: SmScheduleMaster is THE template definition, SmTask is THE job-level instance.
# This service syncs from template -> task while preserving "job reality" (actual work progress).
#
# BLACKLIST APPROACH:
# Uses PROTECTED_FIELDS (blacklist) instead of whitelist. All common columns between
# SmScheduleMaster and SmTask are synced EXCEPT protected fields. This means:
# - New columns added to both models are automatically synced
# - Protected fields (gantt dates, status, confirmations, holds) are never overwritten
#
# PROTECTED (never synced - represents job reality):
# - Schedule: start_date, end_date, duration_days, predecessor_ids, sequence_order
# - Progress: status, started_at, completed_at
# - Confirmations: confirm, supplier_confirm, confirmed_at, supplier_confirmed_at
# - Holds: hold, hold_at, hold_date, hold_reason_id, etc.
# - System: id, created_at, updated_at, task_number, job_id
#
# SYNCED (template metadata):
# - Core: name, description, trade, stage, assigned_role
# - Requirements: require_photo, po_required, critical_po, checklist_id
# - Timing: order_time_days, call_time_days
# - Automation: spawn_* fields, pass_fail_enabled
# - References: documentation_category_ids, linked_task_ids
#
# INTELLIGENT MATCHING (for unlinked tasks):
# - 95%+ similarity: Auto-link without asking
# - 65-95% similarity: User confirmation required (shown in analyze step)
# - <65% similarity: Create new task
#
# Usage:
#   # Analyze matches BEFORE syncing (for unlinked tasks)
#   matches = SmScheduleMasterSyncService.analyze_matches_for_job(job, template)
#   # Returns array of { template_row, matched_task, similarity, action: :auto_link | :confirm | :create }
#
#   # Apply confirmed links, then sync
#   SmScheduleMasterSyncService.apply_links!(job, confirmed_links)
#   results = SmScheduleMasterSyncService.sync_all_for_job(job, template, options)
#
#   # Single row sync
#   result = SmScheduleMasterSyncService.new(job, template_row, options).sync!
#
#   # Bulk sync all rows from a template to a job
#   results = SmScheduleMasterSyncService.sync_all_for_job(job, template, options)
#
# Options:
#   user: User performing the sync (for audit trail)
#   force: Force update even on protected tasks (default: false) - USE WITH CAUTION
#
# Returns:
#   { success: true, task: SmTask, action: :created | :updated | :unchanged | :skipped }
#   { success: false, error: "message" }
#
class SmScheduleMasterSyncService
  # Matching thresholds
  AUTO_LINK_THRESHOLD = 0.95  # 95%+ = auto-link
  CONFIRM_THRESHOLD = 0.65    # 65-95% = ask user

  attr_reader :job, :template_row, :options

  # BLACKLIST approach: Protect "job reality" fields, sync everything else
  # This ensures new columns are synced by default
  #
  # Protected fields represent actual work done on the job:
  # - Schedule dates and duration (gantt positions)
  # - Status and progress (work started/completed)
  # - Confirmations (commitments made)
  # - Holds (job-specific blocks)
  # - System/identity fields
  PROTECTED_FIELDS = %i[
    id
    created_at
    updated_at
    created_by_id
    updated_by_id
    sm_schedule_master_id
    job_id
    construction_id
    saas_customer_id
    task_number
    sequence_order
    start_date
    end_date
    duration_days
    predecessor_ids
    status
    started_at
    completed_at
    confirm
    confirmed_at
    confirm_requested_at
    confirm_status
    require_confirm
    supplier_confirm
    supplier_confirmed_at
    supplier_confirmed_by_id
    supplier_id
    hold
    hold_at
    hold_date
    hold_reason_id
    hold_release_reason
    hold_released_at
    hold_released_by_id
    hold_started_at
    hold_started_by_id
    is_hold_task
  ].freeze

  # Dynamically calculate syncable fields (all common fields minus protected)
  def self.syncable_fields
    @syncable_fields ||= begin
      master_cols = SmScheduleMaster.column_names.map(&:to_sym)
      task_cols = SmTask.column_names.map(&:to_sym)
      common = master_cols & task_cols
      common - PROTECTED_FIELDS
    end
  end

  # Legacy alias for backwards compatibility
  SAFE_SYNC_FIELDS = nil # Use syncable_fields method instead

  # ============================================================================
  # INTELLIGENT MATCHING - Analyze unlinked tasks and suggest matches
  # ============================================================================

  # Analyze matches between template rows and unlinked job tasks
  # Returns summary with matches organized by action required
  #
  # Returns:
  # {
  #   auto_link: [{ template_row_id, task_id, name, similarity }...],
  #   needs_confirmation: [{ template_row_id, task_id, template_name, task_name, similarity }...],
  #   will_create: [{ template_row_id, name }...],
  #   already_linked: N,
  #   unlinked_tasks: [{ task_id, name }...]  # Tasks with no match (orphans)
  # }
  def self.analyze_matches_for_job(job, template)
    result = {
      auto_link: [],
      needs_confirmation: [],
      will_create: [],
      already_linked: 0,
      unlinked_tasks: []
    }

    return result unless job.present? && template.present?

    # Get active template rows
    template_rows = template.sm_schedule_master_rows.where(is_active: true).order(:sequence_order)

    # Get all unlinked tasks on the job (tasks without sm_schedule_master_id)
    unlinked_tasks = job.sm_tasks.where(sm_schedule_master_id: nil).to_a

    # Track which unlinked tasks have been matched
    matched_task_ids = Set.new

    template_rows.each do |row|
      # Check if already linked
      linked_task = job.sm_tasks.find_by(sm_schedule_master_id: row.id)
      if linked_task.present?
        result[:already_linked] += 1
        next
      end

      # Find best matching unlinked task
      best_match = find_best_match(row, unlinked_tasks, matched_task_ids)

      if best_match.nil?
        # No match found - will create new task
        result[:will_create] << {
          template_row_id: row.id,
          task_number: row.task_number,
          name: row.name
        }
      elsif best_match[:similarity] >= AUTO_LINK_THRESHOLD
        # Auto-link (95%+ match)
        result[:auto_link] << {
          template_row_id: row.id,
          task_id: best_match[:task].id,
          name: row.name,
          task_name: best_match[:task].name,
          similarity: (best_match[:similarity] * 100).round(1)
        }
        matched_task_ids << best_match[:task].id
      elsif best_match[:similarity] >= CONFIRM_THRESHOLD
        # Needs user confirmation (65-95% match)
        result[:needs_confirmation] << {
          template_row_id: row.id,
          task_id: best_match[:task].id,
          template_name: row.name,
          template_task_number: row.task_number,
          task_name: best_match[:task].name,
          task_task_number: best_match[:task].task_number,
          similarity: (best_match[:similarity] * 100).round(1)
        }
        matched_task_ids << best_match[:task].id
      else
        # Low match - will create new task
        result[:will_create] << {
          template_row_id: row.id,
          task_number: row.task_number,
          name: row.name,
          closest_match: {
            task_id: best_match[:task].id,
            name: best_match[:task].name,
            similarity: (best_match[:similarity] * 100).round(1)
          }
        }
      end
    end

    # Any unlinked tasks not matched are orphans
    unlinked_tasks.each do |task|
      next if matched_task_ids.include?(task.id)
      result[:unlinked_tasks] << {
        task_id: task.id,
        task_number: task.task_number,
        name: task.name
      }
    end

    result
  end

  # Apply confirmed links - update tasks to link to template rows
  # links is array of { template_row_id: X, task_id: Y }
  def self.apply_links!(job, links, user: nil)
    results = { linked: 0, errors: [] }

    return results unless links.present?

    links.each do |link|
      task = job.sm_tasks.find_by(id: link[:task_id] || link["task_id"])
      template_row_id = link[:template_row_id] || link["template_row_id"]

      unless task
        results[:errors] << "Task #{link[:task_id]} not found"
        next
      end

      task.sm_schedule_master_id = template_row_id
      task.updated_by = user if user
      if task.save
        results[:linked] += 1
        Rails.logger.info "[SmScheduleMasterSyncService] Linked task #{task.id} (#{task.name}) to template row #{template_row_id}"
      else
        results[:errors] << "Failed to link task #{task.id}: #{task.errors.full_messages.join(', ')}"
      end
    end

    results
  end

  # Find the best matching unlinked task for a template row
  def self.find_best_match(template_row, unlinked_tasks, already_matched_ids)
    return nil if unlinked_tasks.empty?

    best_match = nil
    best_similarity = 0

    unlinked_tasks.each do |task|
      next if already_matched_ids.include?(task.id)

      # Calculate similarity score
      similarity = calculate_similarity(template_row, task)

      if similarity > best_similarity
        best_similarity = similarity
        best_match = { task: task, similarity: similarity }
      end
    end

    best_match
  end

  # Calculate similarity score between template row and task
  # Uses multiple factors: task_number match, name similarity
  def self.calculate_similarity(template_row, task)
    score = 0.0
    weights = { task_number: 0.3, name: 0.7 }

    # Task number match (exact match only, weighted 30%)
    if template_row.task_number.present? && task.task_number.present?
      if template_row.task_number.to_s == task.task_number.to_s
        score += weights[:task_number]
      end
    end

    # Name similarity (Levenshtein-based, weighted 70%)
    if template_row.name.present? && task.name.present?
      name_similarity = string_similarity(template_row.name, task.name)
      score += weights[:name] * name_similarity
    end

    score
  end

  # Calculate string similarity using normalized Levenshtein distance
  # Returns 0.0 to 1.0 (1.0 = identical)
  def self.string_similarity(str1, str2)
    return 1.0 if str1 == str2
    return 0.0 if str1.blank? || str2.blank?

    # Normalize strings: downcase, strip, remove extra spaces
    s1 = str1.to_s.downcase.strip.gsub(/\s+/, ' ')
    s2 = str2.to_s.downcase.strip.gsub(/\s+/, ' ')

    return 1.0 if s1 == s2

    # Calculate Levenshtein distance
    distance = levenshtein_distance(s1, s2)
    max_length = [s1.length, s2.length].max

    # Normalize to 0-1 (1 = identical, 0 = completely different)
    1.0 - (distance.to_f / max_length)
  end

  # Levenshtein distance algorithm (edit distance)
  def self.levenshtein_distance(s1, s2)
    m = s1.length
    n = s2.length

    # Create distance matrix
    d = Array.new(m + 1) { Array.new(n + 1, 0) }

    # Initialize first row/column
    (0..m).each { |i| d[i][0] = i }
    (0..n).each { |j| d[0][j] = j }

    # Fill in the rest
    (1..m).each do |i|
      (1..n).each do |j|
        cost = s1[i - 1] == s2[j - 1] ? 0 : 1
        d[i][j] = [
          d[i - 1][j] + 1,      # deletion
          d[i][j - 1] + 1,      # insertion
          d[i - 1][j - 1] + cost # substitution
        ].min
      end
    end

    d[m][n]
  end

  # ============================================================================
  # COMPARISON AND SYNC
  # ============================================================================

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

    Rails.logger.info "[SmScheduleMasterSyncService] Bulk sync for job #{job.id}: " \
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
  # - If linked_task_ids exist but parent tasks don't: SKIP (visibility inheritance)
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

    # Check if this task is linked FROM a PO task - only create if PO parent is on job
    if !existing_task && !po_parent_visible?
      return {
        success: true,
        task: nil,
        action: :skipped,
        reason: "PO parent task not on job",
        message: "Task skipped - linked PO task not present on this job"
      }
    end

    if existing_task
      update_existing_task(existing_task)
    else
      create_new_task
    end
  rescue StandardError => e
    Rails.logger.error "SmScheduleMasterSyncService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
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
      po_required: task.po_required,
      critical_po: task.critical_po,
      started_at: task.started_at,
      completed_at: task.completed_at,
      confirm: task.confirm,
      supplier_confirm: task.supplier_confirm,
      hold: task.hold,
      # SSoT: PO link is via PurchaseOrder.sm_task_id (Option B)
      linked_purchase_order_id: task.linked_purchase_order&.id
    }
  end

  def calculate_differences(task)
    differences = {}

    self.class.syncable_fields.each do |field|
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

  # Check if this task's PO parent(s) are visible on the job
  # PO tasks can have linked_task_ids pointing to non-PO tasks
  # Non-PO tasks are only visible if their PO parent is on the job
  def po_parent_visible?
    # Find all PO tasks that link to this template row
    po_parents = SmScheduleMaster.where(po_required: true)
                                  .where("linked_task_ids @> ?", [template_row.id].to_json)

    # If no PO parents link to this task, it's always visible
    return true if po_parents.empty?

    # Check if at least one PO parent exists on the job
    po_parents.any? do |po_parent|
      job.sm_tasks.exists?(sm_schedule_master_id: po_parent.id)
    end
  end

  # Check if task has "job reality" that should not be overwritten
  # These represent actual work progress, confirmations, or commitments
  # NOTE: PO attachment does NOT block sync - PO handles supplier commitments separately,
  # and sync only touches safe fields (name, trade, stage, etc.) not schedule/PO fields
  def should_skip_task?(task)
    return false if task.nil?

    # Skip if task has any of these job-level states
    task.status.in?(%w[started completed]) ||
      task.started_at.present? ||
      task.completed_at.present? ||
      task.supplier_confirm == true ||
      task.confirm == true ||
      task.hold == true
  end

  # Return human-readable reason why task was skipped
  def skip_reason(task)
    reasons = []
    reasons << "completed" if task.status == "completed" || task.completed_at.present?
    reasons << "started" if task.status == "started" || task.started_at.present?
    reasons << "supplier confirmed" if task.supplier_confirm == true
    reasons << "confirmation locked" if task.confirm == true
    reasons << "on hold" if task.hold == true
    reasons.join(", ")
  end

  def update_existing_task(task)
    changes = {}

    self.class.syncable_fields.each do |field|
      next unless template_row.respond_to?(field) && task.respond_to?(field)
      next unless task.respond_to?("#{field}=")

      # Special handling for calculated timing fields
      template_value = case field
                       when :order_time_days
                         calculate_order_time_days
                       when :call_time_days
                         calculate_call_time_days
                       else
                         template_row.send(field)
                       end
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

    Rails.logger.info "[SmScheduleMasterSyncService] Updated task #{task.id} (#{task.name}) with #{changes.keys.join(', ')}"

    {
      success: true,
      task: task,
      action: :updated,
      changes: changes,
      message: "Updated #{changes.keys.count} field(s) from template"
    }
  end

  def create_new_task
    # Use template's task_number (SSoT for task numbering)
    # This ensures job tasks match the schedule master template structure
    template_task_number = template_row.task_number

    # Get max sequence order for appending at end
    max_sequence = job.sm_tasks.maximum(:sequence_order) || 0
    next_sequence = max_sequence + 1

    # Calculate start date - either from job or today
    start_date = job.start_date || Date.current
    # Calculate duration - use team-based calculation if supplier has team_size
    duration = calculate_task_duration
    end_date = start_date + (duration - 1).days

    # Generate unique name for duplicate tasks (e.g., "Req Bath 1", "Req Bath 2")
    task_name = generate_unique_task_name(template_row.name)

    task = SmTask.new(
      # Core identifiers
      construction_id: job.id,
      sm_schedule_master_id: template_row.id,
      task_number: template_task_number,
      sequence_order: next_sequence,

      # Core task info (from template)
      name: task_name,
      description: template_row.description,
      duration_days: duration,
      trade: template_row.trade,
      stage: template_row.stage,
      checklist_id: template_row.checklist_id,

      # Requirements (from template)
      require_photo: template_row.require_photo,
      po_required: template_row.po_required,
      critical_po: template_row.critical_po,

      # Timing (calculated from pricebook lead times or template defaults)
      order_time_days: calculate_order_time_days,
      call_time_days: calculate_call_time_days,

      # Documentation (from template)
      documentation_category_ids: template_row.documentation_category_ids,
      linked_task_ids: template_row.linked_task_ids,

      # Automation (from template)
      spawn_scan_task_id: template_row.spawn_scan_task_id,
      spawn_scan_lag_days: template_row.spawn_scan_lag_days,
      spawn_order_task: template_row.spawn_order_task,
      spawn_call_task: template_row.spawn_call_task,
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

    Rails.logger.info "[SmScheduleMasterSyncService] Created task #{task.id} (#{task.name}) from template row #{template_row.id}"

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

  # Generate unique task name for duplicates
  # If task "Req Bath" already exists:
  #   - Rename existing to "Req Bath 1"
  #   - Return "Req Bath 2" for new task
  # If "Req Bath 1", "Req Bath 2" exist:
  #   - Return "Req Bath 3" for new task
  def generate_unique_task_name(base_name)
    return base_name if base_name.blank?

    # Find all tasks with exact name or numbered variants (e.g., "Req Bath", "Req Bath 1", "Req Bath 2")
    # Pattern: base_name or base_name followed by space and number
    existing_tasks = job.sm_tasks.where(
      "name = :exact OR name ~ :pattern",
      exact: base_name,
      pattern: "^#{Regexp.escape(base_name)} \\d+$"
    )

    return base_name if existing_tasks.empty?

    # Check if there's an unnumbered task that needs renaming
    unnumbered_task = existing_tasks.find_by(name: base_name)
    if unnumbered_task
      # Rename it to "Base Name 1"
      unnumbered_task.update_column(:name, "#{base_name} 1")
      Rails.logger.info "[SmScheduleMasterSyncService] Renamed task #{unnumbered_task.id} to '#{base_name} 1' for duplicate numbering"
    end

    # Find the highest number used
    max_number = existing_tasks.pluck(:name).map do |name|
      if name == base_name
        1  # Will be renamed to 1
      elsif name =~ /^#{Regexp.escape(base_name)} (\d+)$/
        $1.to_i
      else
        0
      end
    end.max || 0

    # Return next number
    "#{base_name} #{max_number + 1}"
  end

  # Calculate duration based on supplier team size or template default
  # Formula: ceil(PO Amount / (Team Size × Daily Rate))
  # If no team_size on supplier, use template's duration_days
  def calculate_task_duration
    # Only calculate for PO tasks with a supplier
    if (template_row.po_required || template_row.create_po_on_job_start) && template_row.po_supplier_id.present?
      supplier = Contact.find_by(id: template_row.po_supplier_id)

      if supplier&.team_size.present? && supplier.team_size > 0
        # Calculate PO amount from po_line_items
        po_amount = calculate_po_amount_from_line_items

        if po_amount && po_amount > 0
          calculated_duration = supplier.calculate_duration_from_amount(po_amount)
          if calculated_duration && calculated_duration > 0
            Rails.logger.info "[SmScheduleMasterSyncService] Calculated duration #{calculated_duration} days from team_size=#{supplier.team_size}, rate=#{supplier.daily_rate_per_person || 800}, po_amount=#{po_amount}"
            return calculated_duration
          end
        end
      end
    end

    # Fallback to template default
    template_row.duration_days || 1
  end

  # Calculate PO amount from pricebook items in po_line_items
  def calculate_po_amount_from_line_items
    return nil if template_row.po_line_items.blank?

    total = 0.0
    template_row.po_line_items.each do |item|
      pricebook_item_id = item["pricebook_item_id"]
      qty = (item["qty"] || 1).to_f

      next unless pricebook_item_id

      # Get current price from PriceHistory
      price_history = PriceHistory.where(pricebook_item_id: pricebook_item_id)
                                   .order(effective_date: :desc)
                                   .first

      if price_history&.new_price.present?
        total += price_history.new_price.to_f * qty
      end
    end

    total > 0 ? total : nil
  end

  # Calculate order_time_days based on pricebook items or template default
  # Priority:
  #   1. Max lead_time_days from pricebook items in po_line_items
  #   2. Template row's order_time_days if set
  #   3. Default of 7 days for PO tasks
  #   4. nil for non-PO tasks
  DEFAULT_PO_LEAD_TIME_DAYS = 7

  def calculate_order_time_days
    # Only apply lead time logic to PO tasks
    return nil unless template_row.po_required || template_row.create_po_on_job_start

    # Try to get lead time from pricebook items
    if template_row.po_line_items.present? && template_row.po_line_items.any?
      price_history_ids = template_row.po_line_items.map { |item| item["price_history_id"] }.compact
      if price_history_ids.any?
        # Get max lead_time_days from associated pricebook items
        max_lead_time = PriceHistory
          .where(id: price_history_ids)
          .joins(:pricebook_item)
          .maximum("pricebooks.lead_time_days")

        return max_lead_time if max_lead_time.present?
      end
    end

    # Fall back to template's order_time_days if set
    return template_row.order_time_days if template_row.order_time_days.present?

    # Default to 7 days for PO tasks
    DEFAULT_PO_LEAD_TIME_DAYS
  end

  # Calculate call_time_days based on pricebook items or template default
  # Priority:
  #   1. Max call_time_days from pricebook items in po_line_items
  #   2. Template row's call_time_days if set
  #   3. Default of 3 days for PO tasks
  #   4. nil for non-PO tasks
  DEFAULT_CALL_TIME_DAYS = 3

  def calculate_call_time_days
    # Only apply call time logic to PO tasks
    return nil unless template_row.po_required || template_row.create_po_on_job_start

    # Try to get call time from pricebook items
    if template_row.po_line_items.present? && template_row.po_line_items.any?
      price_history_ids = template_row.po_line_items.map { |item| item["price_history_id"] }.compact
      if price_history_ids.any?
        # Get max call_time_days from associated pricebook items
        max_call_time = PriceHistory
          .where(id: price_history_ids)
          .joins(:pricebook_item)
          .maximum("pricebooks.call_time_days")

        return max_call_time if max_call_time.present?
      end
    end

    # Fall back to template's call_time_days if set
    return template_row.call_time_days if template_row.call_time_days.present?

    # Default to 3 days for PO tasks
    DEFAULT_CALL_TIME_DAYS
  end
end
