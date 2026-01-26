# frozen_string_literal: true

# SmScheduleMasterSyncService - Smart sync of SmScheduleMaster to SmTask on a job
#
# SSoT: SmScheduleMaster is THE template definition, SmTask is THE job-level instance.
# This service syncs from template -> task while preserving "job reality" (actual work progress).
#
# SYNC APPROACH:
# 1. Check if task has "job reality" (started, confirmed, on hold) → SKIP entire task
# 2. If safe to sync → sync ALL common fields from template (except system IDs)
#
# SKIP RULES (should_skip_task?):
# - Task status is started or completed
# - Task has started_at or completed_at
# - Task is confirmed or supplier_confirmed
# - Task is on hold
#
# If ANY of these are true, the task is SKIPPED (no fields synced).
# If NONE are true, ALL template fields are synced.
#
# PROTECTED (system identity only):
# - id, created_at, updated_at, created_by_id, updated_by_id
# - sm_schedule_master_id, job_id, construction_id, saas_customer_id
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

  # System/identity fields only - business rules handle job reality
  PROTECTED_FIELDS = %i[
    id
    created_at
    updated_at
    created_by_id
    updated_by_id
    sm_schedule_master_id
    job_id
    saas_customer_id
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
  # SCHEMA SYNC - Auto-add missing columns from SmScheduleMaster to SmTask
  # ============================================================================

  # SSoT: SmScheduleMaster defines the schema. SmTask must have all the same columns.
  # This method auto-adds any missing columns to prevent sync failures.
  # Called at start of sync_all_for_job to ensure schema is aligned.
  def self.sync_schema!
    master_cols = SmScheduleMaster.columns.index_by(&:name)
    task_cols = SmTask.columns.index_by(&:name)

    # Columns that are intentionally different between master and task
    excluded_cols = PROTECTED_FIELDS.map(&:to_s) + %w[
      sm_template_ids
      is_completed
      finance_approved
      dependency_broken
      predecessor_ids_backup
    ]

    # Find columns in master that are missing from task
    missing = master_cols.keys - task_cols.keys - excluded_cols

    return { added: [], message: "Schema in sync" } if missing.empty?

    Rails.logger.info "[SmScheduleMasterSyncService] Auto-adding missing columns to sm_tasks: #{missing.join(', ')}"

    added = []
    missing.each do |col_name|
      master_col = master_cols[col_name]
      begin
        ActiveRecord::Base.connection.add_column(
          :sm_tasks, col_name, master_col.type,
          default: master_col.default,
          null: master_col.null
        )
        added << col_name
        Rails.logger.info "[SmScheduleMasterSyncService] Added column #{col_name} (#{master_col.type}) to sm_tasks"
      rescue StandardError => e
        Rails.logger.error "[SmScheduleMasterSyncService] Failed to add column #{col_name}: #{e.message}"
      end
    end

    SmTask.reset_column_information
    @syncable_fields = nil  # Clear cached syncable fields

    { added: added, message: "Added #{added.count} column(s) to sm_tasks" }
  end

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

    # Performance: Pre-load all linked template IDs to avoid N+1 queries
    # Before: 1 query per template row (O(n) queries)
    # After: 1 query total (O(1) queries)
    linked_template_ids = Set.new(job.sm_tasks.where.not(sm_schedule_master_id: nil).pluck(:sm_schedule_master_id))

    # Track which unlinked tasks have been matched
    matched_task_ids = Set.new

    template_rows.each do |row|
      # Check if already linked (using pre-loaded set instead of per-row query)
      if linked_template_ids.include?(row.id)
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

  # Sync Foundation column types from SmScheduleMaster to SmTask
  # SSoT: SmScheduleMaster foundation defines the column types, SmTask should match
  # Self-healing: Automatically detects and fixes column type mismatches
  def self.sync_foundation_column_types!
    master_f = Foundation.find_by(slug: 'sm_schedule_masters') || Foundation.find_by(model_class: 'SmScheduleMaster')
    task_f = Foundation.find_by(slug: 'sm_tasks') || Foundation.find_by(model_class: 'SmTask')

    return { synced: 0, columns_migrated: [] } unless master_f && task_f

    synced = 0
    columns_migrated = []

    # Get actual database column info
    master_db_cols = SmScheduleMaster.columns.index_by(&:name)
    task_db_cols = SmTask.columns.index_by(&:name)

    # Get Foundation metadata
    master_cols = master_f.columns.index_by(&:column_name)
    task_cols = task_f.columns.index_by(&:column_name)
    common = master_cols.keys & task_cols.keys

    common.each do |col_name|
      m = master_cols[col_name]
      t = task_cols[col_name]
      m_db = master_db_cols[col_name]
      t_db = task_db_cols[col_name]

      next unless m_db && t_db

      # Check if this is a lookup column that should be integer
      is_lookup_column = m.column_type.in?(Column::LOOKUP_COLUMN_TYPES)

      # Check for database type mismatch and auto-migrate if needed
      if m_db.type != t_db.type
        Rails.logger.info "[SmScheduleMasterSyncService] Column type mismatch detected: #{col_name} - Master: #{m_db.type}, Task: #{t_db.type}"

        if migrate_column_type!(col_name, m_db, t_db)
          columns_migrated << col_name
        end
      # Also check if lookup column is string but should be integer
      elsif is_lookup_column && m_db.type == :string
        Rails.logger.info "[SmScheduleMasterSyncService] Lookup column #{col_name} is string, should be integer - migrating both tables"

        if migrate_lookup_column_to_integer!(col_name)
          columns_migrated << col_name
        end
      elsif is_lookup_column && t_db.type == :string && m_db.type == :integer
        # Master is already integer, task needs migration
        Rails.logger.info "[SmScheduleMasterSyncService] Task column #{col_name} is string, master is integer - migrating task table"

        if migrate_column_type!(col_name, m_db, t_db)
          columns_migrated << col_name
        end
      end

      # Sync lookup config if master has it configured
      if m.lookup_foundation_slug.present? && m.lookup_foundation_slug != t.lookup_foundation_slug
        t.update!(
          column_type: m.column_type,
          lookup_foundation_id: m.lookup_foundation_id,
          lookup_foundation_slug: m.lookup_foundation_slug,
          lookup_display_column: m.lookup_display_column
        )
        synced += 1
        Rails.logger.info "[SmScheduleMasterSyncService] Synced column type for #{col_name}: #{m.column_type} -> #{m.lookup_foundation_slug}"
      end
    end

    if columns_migrated.any?
      Rails.logger.info "[SmScheduleMasterSyncService] Auto-migrated columns: #{columns_migrated.join(', ')}"
    end

    { synced: synced, columns_migrated: columns_migrated }
  end

  # Auto-migrate a lookup column from string to integer in BOTH tables
  # SmScheduleMaster may have IDs stored as strings ("3")
  # SmTask may have names stored as strings ("accounts")
  def self.migrate_lookup_column_to_integer!(col_name)
    lookup_map = build_lookup_map_for_column(col_name)
    if lookup_map.empty?
      Rails.logger.warn "[SmScheduleMasterSyncService] No lookup map for #{col_name}, skipping migration"
      return false
    end

    Rails.logger.info "[SmScheduleMasterSyncService] Migrating #{col_name} to integer in both tables..."

    ActiveRecord::Base.transaction do
      # Migrate SmScheduleMaster (has IDs stored as strings like "3")
      migrate_table_column_to_integer!(:sm_schedule_masters, SmScheduleMaster, col_name, :id_as_string)

      # Migrate SmTask (has names stored as strings like "accounts")
      migrate_table_column_to_integer!(:sm_tasks, SmTask, col_name, :name_as_string, lookup_map)

      Rails.logger.info "[SmScheduleMasterSyncService] Successfully migrated #{col_name} to integer in both tables"
    end

    true
  rescue StandardError => e
    Rails.logger.error "[SmScheduleMasterSyncService] Failed to migrate #{col_name}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    false
  end

  # Migrate a single table's column from string to integer
  def self.migrate_table_column_to_integer!(table_name, model_class, col_name, value_type, lookup_map = nil)
    return unless model_class.column_names.include?(col_name)
    return unless model_class.columns.find { |c| c.name == col_name }&.type == :string

    temp_col = "#{col_name}_new"

    # Add temp integer column if not exists
    unless ActiveRecord::Base.connection.column_exists?(table_name, temp_col)
      ActiveRecord::Base.connection.add_column table_name, temp_col, :integer
    end

    # Convert values
    model_class.distinct.pluck(col_name).compact.each do |string_value|
      new_id = case value_type
               when :id_as_string
                 # Value is already an ID stored as string, just convert to int
                 string_value.to_i if string_value.to_s.match?(/^\d+$/)
               when :name_as_string
                 # Value is a name, look up the ID
                 lookup_map[string_value]
               end

      if new_id
        model_class.where(col_name => string_value).update_all(temp_col => new_id)
      end
    end

    # Swap columns
    ActiveRecord::Base.connection.remove_column table_name, col_name
    ActiveRecord::Base.connection.rename_column table_name, temp_col, col_name

    # Reset column cache
    model_class.reset_column_information

    Rails.logger.info "[SmScheduleMasterSyncService] Migrated #{table_name}.#{col_name} to integer"
  end

  # Auto-migrate a column type from string to integer (for lookup fields)
  # Converts existing string values to IDs using the lookup table
  def self.migrate_column_type!(col_name, master_col, task_col)
    # Only handle string → integer conversion for lookup fields
    return false unless task_col.type == :string && master_col.type == :integer

    lookup_map = build_lookup_map_for_column(col_name)
    if lookup_map.empty?
      Rails.logger.warn "[SmScheduleMasterSyncService] No lookup map for #{col_name}, skipping migration"
      return false
    end

    Rails.logger.info "[SmScheduleMasterSyncService] Migrating #{col_name} from string to integer..."

    ActiveRecord::Base.transaction do
      # 1. Add temp integer column
      temp_col = "#{col_name}_new"
      unless ActiveRecord::Base.connection.column_exists?(:sm_tasks, temp_col)
        ActiveRecord::Base.connection.add_column :sm_tasks, temp_col, :integer
      end

      # 2. Convert existing string values to IDs
      converted_count = 0
      unmatched_values = []

      SmTask.distinct.pluck(col_name).compact.each do |string_value|
        if lookup_map.key?(string_value)
          SmTask.where(col_name => string_value).update_all(temp_col => lookup_map[string_value])
          converted_count += SmTask.where(temp_col => lookup_map[string_value]).count
        else
          unmatched_values << string_value
        end
      end

      if unmatched_values.any?
        Rails.logger.warn "[SmScheduleMasterSyncService] #{col_name}: No matching ID for values: #{unmatched_values.join(', ')} - these will be NULL"
      end

      # 3. Drop old string column, rename temp to original
      ActiveRecord::Base.connection.remove_column :sm_tasks, col_name
      ActiveRecord::Base.connection.rename_column :sm_tasks, temp_col, col_name

      # 4. Reset column info cache
      SmTask.reset_column_information

      Rails.logger.info "[SmScheduleMasterSyncService] Successfully migrated #{col_name}: converted #{converted_count} values"
    end

    true
  rescue StandardError => e
    Rails.logger.error "[SmScheduleMasterSyncService] Failed to migrate #{col_name}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    false
  end

  # Build a name → id lookup map for a column
  def self.build_lookup_map_for_column(col_name)
    foundation_slug = case col_name
                      when 'trade' then 'sm_trades'
                      when 'stage' then 'sm_stages'
                      when 'assigned_role' then 'roles'
                      else return {}
                      end

    foundation = Foundation.find_by(slug: foundation_slug)
    return {} unless foundation

    # Build name → id map
    # For roles, use display_name or name
    if col_name == 'assigned_role'
      Role.all.each_with_object({}) { |r, h| h[r.name] = r.id; h[r.display_name] = r.id if r.display_name.present? }
    else
      ActiveRecord::Base.connection
        .execute("SELECT id, name FROM #{foundation.database_table_name}")
        .each_with_object({}) { |row, h| h[row['name']] = row['id'] }
    end
  end

  # Normalize lookup values - now that all lookup columns are integers, this just passes through
  # Kept for backwards compatibility in case there are edge cases
  def self.normalize_lookup_value(col_name, value, is_from_template:)
    value
  end

  # Bulk sync all template rows to tasks for a job
  # Returns summary: { created: N, updated: N, skipped: N, unchanged: N, errors: [] }
  def self.sync_all_for_job(job, template, options = {})
    # SSoT: Ensure SmTask has all columns from SmScheduleMaster
    sync_schema!

    # Ensure Foundation column types are in sync first
    sync_foundation_column_types!

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

    # SSoT: Sync predecessor_ids after all tasks exist (requires remapping)
    sync_predecessor_ids_for_job(job, template)

    Rails.logger.info "[SmScheduleMasterSyncService] Bulk sync for job #{job.id}: " \
      "created=#{results[:created]}, updated=#{results[:updated]}, " \
      "skipped=#{results[:skipped]}, unchanged=#{results[:unchanged]}, " \
      "errors=#{results[:errors].count}"

    results
  end

  # ============================================================================
  # RESET AND RELINK POs - Nuclear reset with PO preservation
  # ============================================================================
  #
  # Deletes ALL SmTasks for a job, re-creates from template, and re-links existing
  # PurchaseOrders to the new tasks by matching sm_schedule_master_id.
  #
  # This is a "nuclear reset" option when the schedule is too broken to sync
  # incrementally, but existing POs must be preserved.
  #
  # Returns:
  # {
  #   success: true,
  #   deleted_tasks: N,
  #   created_tasks: N,
  #   pos_relinked: N,
  #   pos_not_found: [{ po_id: X, master_id: Y, po_number: "PO-123" }...]
  # }
  def self.reset_and_relink_pos(template, job, user = nil)
    ActiveRecord::Base.transaction do
      # 1. Capture PO → SmScheduleMaster mapping BEFORE deleting tasks
      po_to_master = capture_po_to_master_mapping(job)
      Rails.logger.info "[SmScheduleMasterSyncService] Captured #{po_to_master.size} PO → master mappings"

      # 2. Clear sm_task_id from POs (prevent FK constraint issues during delete)
      PurchaseOrder.where(id: po_to_master.keys).update_all(sm_task_id: nil)
      Rails.logger.info "[SmScheduleMasterSyncService] Cleared sm_task_id from #{po_to_master.size} POs"

      # 3. Delete ALL SmTasks for this job
      deleted_count = job.sm_tasks.delete_all
      Rails.logger.info "[SmScheduleMasterSyncService] Deleted #{deleted_count} SmTasks for job #{job.id}"

      # 4. Copy fresh from template using SmScheduleMasterTemplateCopyService
      copy_service = SmScheduleMasterTemplateCopyService.new(template, job, user)
      copy_result = copy_service.execute

      unless copy_result[:success]
        raise ActiveRecord::Rollback, "Template copy failed: #{copy_result[:error]}"
      end

      Rails.logger.info "[SmScheduleMasterSyncService] Created #{copy_result[:tasks_created]} tasks from template"

      # 5. Re-link POs to new tasks by matching sm_schedule_master_id
      relink_result = relink_pos_to_new_tasks(job, po_to_master)
      Rails.logger.info "[SmScheduleMasterSyncService] Re-linked #{relink_result[:linked]} POs, #{relink_result[:not_found].size} not found"

      {
        success: true,
        deleted_tasks: deleted_count,
        created_tasks: copy_result[:tasks_created],
        dependencies_created: copy_result[:dependencies_created],
        purchase_orders_created: copy_result[:purchase_orders_created],
        pos_relinked: relink_result[:linked],
        pos_not_found: relink_result[:not_found]
      }
    end
  rescue StandardError => e
    Rails.logger.error "[SmScheduleMasterSyncService] reset_and_relink_pos failed: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    {
      success: false,
      error: e.message
    }
  end

  # Capture mapping: PO.id => sm_schedule_master_id (via the PO's linked SmTask)
  def self.capture_po_to_master_mapping(job)
    mapping = {}

    PurchaseOrder.where(job_id: job.id).where.not(sm_task_id: nil).find_each do |po|
      task = SmTask.find_by(id: po.sm_task_id)
      if task&.sm_schedule_master_id
        mapping[po.id] = {
          master_id: task.sm_schedule_master_id,
          po_number: po.po_number,
          task_name: task.name
        }
      end
    end

    mapping
  end

  # Re-link POs to new SmTasks by matching sm_schedule_master_id
  def self.relink_pos_to_new_tasks(job, po_to_master)
    # Build lookup: sm_schedule_master_id → new SmTask
    master_to_task = job.sm_tasks.where.not(sm_schedule_master_id: nil)
                         .index_by(&:sm_schedule_master_id)

    linked = 0
    not_found = []

    po_to_master.each do |po_id, info|
      master_id = info[:master_id]
      new_task = master_to_task[master_id]

      if new_task
        PurchaseOrder.where(id: po_id).update_all(sm_task_id: new_task.id)
        linked += 1
        Rails.logger.debug "[SmScheduleMasterSyncService] Re-linked PO #{po_id} (#{info[:po_number]}) to task #{new_task.id}"
      else
        not_found << {
          po_id: po_id,
          po_number: info[:po_number],
          master_id: master_id,
          original_task_name: info[:task_name]
        }
        Rails.logger.warn "[SmScheduleMasterSyncService] No new task found for PO #{po_id} (master_id: #{master_id})"
      end
    end

    { linked: linked, not_found: not_found }
  end

  # SSoT: Sync predecessor_ids from templates to tasks
  # Since task_number = sm_schedule_master.task_number (= sm_schedule_master.id),
  # no remapping is needed - predecessor_ids can be copied directly from template
  def self.sync_predecessor_ids_for_job(job, template)
    return unless job.present? && template.present?

    updated_count = 0

    # Copy predecessor_ids directly from template to tasks (no remapping needed)
    job.sm_tasks.where.not(sm_schedule_master_id: nil).includes(:sm_schedule_master).find_each do |task|
      template_row = task.sm_schedule_master
      next unless template_row
      next if template_row.predecessor_ids.blank?

      # Copy predecessor_ids directly - task_numbers match template
      new_predecessor_ids = template_row.predecessor_ids

      # Only update if changed
      if task.predecessor_ids != new_predecessor_ids
        task.update_column(:predecessor_ids, new_predecessor_ids)
        updated_count += 1
      end
    end

    Rails.logger.info "[SmScheduleMasterSyncService] Synced predecessor_ids for #{updated_count} tasks on job #{job.id}"
    updated_count
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

      raw_template_value = template_row.send(field)
      task_value = task.send(field)

      # Special handling for predecessor_ids - needs remapping to compare
      if field == :predecessor_ids
        remapped_template_preds = remap_predecessor_ids_for_comparison(raw_template_value)
        if remapped_template_preds != task_value
          # Show count for cleaner display
          template_count = remapped_template_preds&.size || 0
          task_count = task_value&.size || 0
          differences["predecessor_ids"] = {
            template: "#{template_count} dependencies",
            task: "#{task_count} dependencies"
          }
        end
        next
      end

      # Normalize lookup values where template stores ID and task stores name
      template_value = self.class.normalize_lookup_value(field.to_s, raw_template_value, is_from_template: true)

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

  # Compare predecessor_ids between template and job task
  # Since task_number = sm_schedule_master.task_number, no remapping is needed
  def remap_predecessor_ids_for_comparison(template_preds)
    return [] if template_preds.blank?
    # No remapping needed - task_numbers match template
    template_preds
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
  # Visibility can come from:
  # 1. Task Group membership - if ANY PO from the group is on the job
  # 2. Direct linked_task_ids - if a PO with this task in its linked_task_ids is on the job
  def po_parent_visible?
    # Check 1: Group-based visibility
    # If this task is in a group, check if ANY PO from the group is on the job
    if template_row.sm_task_group_id.present?
      group = template_row.sm_task_group
      return true if group&.any_po_on_job?(job)
      # If in a group but no PO from group is on job, continue to check linked_task_ids
    end

    # Check 2: Direct linked_task_ids (backwards compatible)
    # Find all PO tasks that link to this template row
    po_parents = SmScheduleMaster.where(po_required: true)
                                  .where("linked_task_ids @> ?", [template_row.id].to_json)

    # If no PO parents link to this task AND no group membership, it's always visible
    return true if po_parents.empty? && template_row.sm_task_group_id.blank?

    # If in a group with no PO on job, and no direct links, hide
    return false if po_parents.empty? && template_row.sm_task_group_id.present?

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

      # Special handling for calculated timing fields and lookup normalization
      raw_template_value = case field
                           when :order_time_days
                             calculate_order_time_days
                           when :call_time_days
                             calculate_call_time_days
                           else
                             template_row.send(field)
                           end

      # Normalize lookup values where template stores ID and task stores name
      template_value = self.class.normalize_lookup_value(field.to_s, raw_template_value, is_from_template: true)
      task_value = task.send(field)

      # Master is SSoT - update if values differ (including nil overwriting values)
      if template_value != task_value
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

    # Normalize assigned_role (template stores ID as string, task stores name)
    normalized_assigned_role = self.class.normalize_lookup_value('assigned_role', template_row.assigned_role, is_from_template: true)

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
      assigned_role: normalized_assigned_role,
      checklist_id: template_row.checklist_id,

      # Requirements (from template)
      require_photo: template_row.require_photo,
      po_required: template_row.po_required,
      critical_po: template_row.critical_po,

      # Timing (calculated from pricebook lead times or template defaults)
      order_time_days: calculate_order_time_days,
      call_time_days: calculate_call_time_days,

      # Linked tasks (from template)
      linked_task_ids: template_row.linked_task_ids,

      # Workflow triggers (from template)
      start_workflow_enabled: template_row.start_workflow_enabled,
      start_workflow_id: template_row.start_workflow_id,
      complete_workflow_enabled: template_row.complete_workflow_enabled,
      complete_workflow_id: template_row.complete_workflow_id,

      # Completion document requirement (from template)
      requires_document_to_complete: template_row.requires_document_to_complete,
      completion_document_type_id: template_row.completion_document_type_id,

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
      updated_by: user,
      # SSoT: Multi-tenancy - set tenant_id from job (background job has no tenant context)
      tenant_id: job&.tenant_id
    )

    task.save!

    # Copy document type links from template
    sync_document_type_links(template_row, task)

    Rails.logger.info "[SmScheduleMasterSyncService] Created task #{task.id} (#{task.name}) from template row #{template_row.id}"

    {
      success: true,
      task: task,
      action: :created,
      message: "Created new task from template"
    }
  end

  # Copy document type links from template row to task
  def sync_document_type_links(template_row, task)
    template_row.sm_schedule_master_document_types.each do |doc_type_link|
      SmTaskDocumentType.create!(
        sm_task_id: task.id,
        document_type_id: doc_type_link.document_type_id,
        lag_days: doc_type_link.lag_days,
        assigned_role: doc_type_link.assigned_role
      )
    end
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[SmScheduleMasterSyncService] Failed to sync document type link: #{e.message}"
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
