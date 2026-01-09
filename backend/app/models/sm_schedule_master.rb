# frozen_string_literal: true

# SmScheduleMaster - Master task definitions for SM Gantt system
#
# Represents a single task definition that can be used in templates.
# When a template is applied to a construction, these become sm_tasks with actual dates.
#
# Multi-Template Support:
# - A row can belong to multiple templates via sm_template_ids (JSONB array)
# - Use for_template(template_id) scope to filter by template
# - Use add_to_template/remove_from_template to manage membership
#
class SmScheduleMaster < ApplicationRecord
  # Table renamed from sm_schedule_master to sm_schedule_masters (Rails convention)

  # SSoT: Roles come from Role model (see Role.for_select)
  # No hardcoded ASSIGNABLE_ROLES constant - database is the source of truth

  # Dependency types
  DEPENDENCY_TYPES = %w[FS SS FF SF].freeze

  # Performance: Define which associations are safe to eager load
  # Excludes self-referential (spawn_scan_task) and heavy (po_supplier) associations
  # Used by Foundation API's apply_eager_loading method
  def self.safe_eager_load_associations
    [:checklist, :created_by, :updated_by]
  end

  # Associations
  # Note: sm_template_id column has been removed
  # sm_template_ids (JSONB array) handles multi-template membership

  belongs_to :checklist, class_name: "SupervisorChecklistTemplate", optional: true

  # Spawn scan task - which task template to spawn on completion
  belongs_to :spawn_scan_task, class_name: "SmScheduleMaster", optional: true

  # SmTasks created from this template - nullify on delete so tasks remain but lose template link
  has_many :sm_tasks, dependent: :nullify

  # Photo storage EntityTab
  belongs_to :photo_entity_tab, class_name: "EntityTab", optional: true

  # Auto-PO supplier - for create_po_on_job_start feature
  belongs_to :po_supplier, class_name: "Contact", optional: true

  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true

  # Workflow triggers
  belongs_to :start_workflow, class_name: "BpmnProcess", optional: true
  belongs_to :complete_workflow, class_name: "BpmnProcess", optional: true

  # Completion document requirement - document type that must be attached to complete task
  belongs_to :completion_document_type, class_name: "DocumentType", optional: true

  # Claim invoice template - visual style for claim invoices
  belongs_to :claim_invoice_template, optional: true

  # Document types for GET task spawning on completion
  has_many :sm_schedule_master_document_types, dependent: :destroy
  has_many :document_types, through: :sm_schedule_master_document_types
  accepts_nested_attributes_for :sm_schedule_master_document_types, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  # Note: task_number is synced to equal id after creation (see sync_task_number_to_id callback)
  # This ensures consistent task_number across all sm_tasks that reference this template
  validates :task_number, presence: true
  validates :sequence_order, presence: true
  validates :duration_days, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :header_cannot_be_po

  def header_cannot_be_po
    if allow_header && (po_required || create_po_on_job_start)
      errors.add(:allow_header, "cannot be enabled for PO tasks")
    end
  end

  validates :subtask_count, numericality: { only_integer: true, greater_than_or_equal_to: 1 }, if: :has_subtasks?
  validate :subtask_names_match_count
  validate :predecessor_ids_valid
  validate :no_circular_dependencies

  # Claim task validations
  # Percentage required for claim tasks UNLESS it's a variation (variations have amounts entered later)
  validates :claim_percentage, presence: true, if: -> { is_claim_task? && !is_variation? }
  validates :claim_percentage, numericality: { greater_than: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :in_sequence, -> { order(sequence_order: :asc) }
  scope :by_trade, ->(trade) { where(trade: trade) if trade.present? }
  scope :by_stage, ->(stage) { where(stage: stage) if stage.present? }
  scope :requiring_po, -> { where(po_required: true) }
  scope :with_photos, -> { where(require_photo: true) }
  scope :claim_tasks, -> { where(is_claim_task: true) }

  # Multi-template scope - filter rows by template membership
  scope :for_template, ->(template_id) { where("sm_template_ids @> ?", [template_id].to_json) }

  # Callbacks
  before_validation :set_temporary_task_number, on: :create
  before_validation :set_sequence_order, on: :create
  after_create :sync_task_number_to_id
  before_validation :clean_invalid_predecessors
  before_validation :uppercase_name_if_header
  before_validation :default_duration_for_tasks
  before_validation :default_claim_percentage
  before_save :clear_spawn_tasks_if_not_po
  after_save :clean_orphaned_predecessor_references, if: :saved_change_to_is_active?

  # Helper methods
  def predecessor_task_ids
    predecessor_ids || []
  end

  def linked_task_list
    linked_task_ids || []
  end

  def subtask_list
    return [] unless has_subtasks?
    subtask_names || []
  end

  def tag_list
    tags || []
  end

  # Extract claim stage name from task name
  # "CLAIM - Slab" -> "Slab"
  # "CLAIM - Practical Completion" -> "Practical Completion"
  # "Slab Claim" -> "Slab Claim" (no transformation if no prefix)
  def claim_stage_name
    return name unless is_claim_task?
    name.sub(/^CLAIM\s*[-–—:]\s*/i, "").strip
  end

  # Plan types to attach to this task
  def plan_type_list
    plan_type_ids || []
  end

  # EntityTabs for documents sent on START
  def start_entity_tabs
    return [] if start_entity_tab_ids.blank?
    EntityTab.where(id: start_entity_tab_ids)
  end

  # EntityTabs for documents received on COMPLETE
  def complete_entity_tabs
    return [] if complete_entity_tab_ids.blank?
    EntityTab.where(id: complete_entity_tab_ids)
  end

  # All linked EntityTab IDs (start + complete)
  def all_entity_tab_ids
    (start_entity_tab_ids || []) + (complete_entity_tab_ids || [])
  end

  # Multi-template management methods

  # Get all templates this row belongs to
  def sm_schedule_master_templates
    SmScheduleMasterTemplate.where(id: sm_template_ids)
  end

  # Check if row belongs to a specific template
  def in_template?(template_id)
    (sm_template_ids || []).include?(template_id.to_i)
  end

  # Add row to a template
  def add_to_template(template_id)
    new_ids = ((sm_template_ids || []) + [template_id]).uniq
    update!(sm_template_ids: new_ids)
  end

  # Remove row from a template
  def remove_from_template(template_id)
    new_ids = (sm_template_ids || []) - [template_id]
    update!(sm_template_ids: new_ids)
  end

  # Get the first template (for backwards compatibility)
  def primary_template
    SmScheduleMasterTemplate.find_by(id: sm_template_ids&.first)
  end

  # Format predecessors as "2FS+3, 5SS" etc
  def predecessor_display
    return "None" if predecessor_task_ids.empty?

    predecessor_task_ids.map { |pred| format_predecessor(pred) }.compact.join(", ")
  end

  # Format predecessors with task names
  def predecessor_display_names
    return "None" if predecessor_task_ids.empty?

    predecessor_task_ids.map { |pred| format_predecessor_with_name(pred) }.compact.join(", ")
  end

  private

  # Set a temporary task_number to pass validation (will be synced to id after create)
  def set_temporary_task_number
    return if task_number.present?
    # Use a placeholder - will be replaced with actual id after create
    self.task_number = 0
  end

  # Sync task_number to match id after creation
  # This ensures task_number = id for all rows (SSoT)
  def sync_task_number_to_id
    update_column(:task_number, id) if task_number != id
  end

  def set_sequence_order
    return if sequence_order.present?

    # Auto-generate sequence order at the end of the list
    max_order = SmScheduleMaster.maximum(:sequence_order) || 0
    self.sequence_order = max_order + 1
  end

  # Force uppercase name for header rows
  def uppercase_name_if_header
    self.name = name.upcase if allow_header && name.present?
  end

  # Default duration_days to 1 for non-header tasks if 0 or nil
  def default_duration_for_tasks
    return if allow_header # Headers can have 0 duration
    self.duration_days = 1 if duration_days.blank? || duration_days <= 0
  end

  # Default claim_percentage when is_claim_task is enabled
  # This allows inline editing to set is_claim_task without immediately needing the percentage
  # Skip for variations - they don't need a percentage
  def default_claim_percentage
    return unless is_claim_task?
    return if is_variation? # Variations don't need a percentage
    return if claim_percentage.present? && claim_percentage > 0

    # Default to 10% - user can adjust afterward
    self.claim_percentage = 10.0
  end

  # Clear spawn_order_task and spawn_call_task if po_required is false
  # These spawn tasks are only valid for PO tasks
  def clear_spawn_tasks_if_not_po
    unless po_required || create_po_on_job_start
      self.spawn_order_task = false
      self.spawn_call_task = false
      self.order_time_days = nil
      self.call_time_days = nil
    end
  end

  def subtask_names_match_count
    return unless has_subtasks?

    if subtask_count.present? && subtask_names.present?
      if subtask_names.length != subtask_count
        errors.add(:subtask_names, "count (#{subtask_names.length}) must match subtask_count (#{subtask_count})")
      end
    end
  end

  def predecessor_ids_valid
    return if predecessor_ids.blank?

    # Get valid task numbers in same template(s) for referential validation
    template_ids = sm_template_ids || []
    valid_task_numbers = if template_ids.any?
      # sm_template_ids is JSONB array, use @> to check containment
      conditions = template_ids.map { |tid| "sm_template_ids @> '[#{tid.to_i}]'::jsonb" }.join(' OR ')
      SmScheduleMaster.where(conditions)
                   .where.not(id: id)
                   .pluck(:task_number)
    else
      SmScheduleMaster.where.not(id: id).pluck(:task_number)
    end

    predecessor_ids.each_with_index do |pred, idx|
      # Check structure
      unless pred.is_a?(Hash) && pred["id"].present?
        errors.add(:predecessor_ids, "entry #{idx} must have an id")
        next
      end

      pred_id = (pred["id"] || pred[:id]).to_i

      # Check predecessor exists in same template(s)
      unless valid_task_numbers.include?(pred_id)
        # Check if task exists at all (just in different template)
        task_exists = SmScheduleMaster.exists?(task_number: pred_id)
        if task_exists
          pred_task = SmScheduleMaster.find_by(task_number: pred_id)
          errors.add(:predecessor_ids, "task #{pred_id} (#{pred_task&.name}) is not in the same template - dependencies must share at least one common template")
        else
          errors.add(:predecessor_ids, "task #{pred_id} does not exist")
        end
      end

      # Check dependency type is valid
      if pred["type"].present? && !DEPENDENCY_TYPES.include?(pred["type"])
        errors.add(:predecessor_ids, "entry #{idx} has invalid type '#{pred['type']}'")
      end

      # Check lag is numeric
      lag = pred["lag"] || pred[:lag]
      if lag.present? && !lag.is_a?(Numeric) && !lag.to_s.match?(/\A-?\d+\z/)
        errors.add(:predecessor_ids, "entry #{idx} has non-numeric lag '#{lag}'")
      end
    end
  end

  def no_circular_dependencies
    return if predecessor_ids.blank?

    # Get all rows in same template(s) to build the dependency graph
    # Must match validator/cleaner logic - handle empty templates with global fallback
    template_ids = sm_template_ids || []
    all_rows = if template_ids.any?
      # sm_template_ids is JSONB array, use @> to check containment
      conditions = template_ids.map { |tid| "sm_template_ids @> '[#{tid.to_i}]'::jsonb" }.join(' OR ')
      SmScheduleMaster.where(conditions)
    else
      # Global fallback - matches validator behavior
      SmScheduleMaster.all
    end

    # Build dependency graph: task_number -> [predecessor_task_numbers]
    # CRITICAL: Convert IDs to integers to ensure consistent lookups
    predecessor_map = {}
    all_rows.each do |row|
      next if row.predecessor_ids.blank?
      predecessor_map[row.task_number] = row.predecessor_ids.map { |p| (p["id"] || p[:id]).to_i }.compact
    end

    # Update with our proposed changes (what we're trying to save)
    predecessor_map[task_number] = predecessor_ids.map { |p| (p["id"] || p[:id]).to_i }.compact

    # DFS cycle detection
    if has_cycle_in_graph?(task_number, predecessor_map, Set.new, Set.new)
      errors.add(:predecessor_ids, "would create a circular dependency")
    end
  end

  def has_cycle_in_graph?(node, graph, visiting, visited)
    return false if visited.include?(node)
    return true if visiting.include?(node)

    visiting.add(node)

    (graph[node] || []).each do |pred|
      return true if has_cycle_in_graph?(pred, graph, visiting, visited)
    end

    visiting.delete(node)
    visited.add(node)
    false
  end

  def format_predecessor(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = (pred_data["id"] || pred_data[:id]).to_i
    dep_type = pred_data["type"] || pred_data[:type] || "FS"
    lag = (pred_data["lag"] || pred_data[:lag] || 0).to_i

    return nil if task_id.zero?

    result = "#{task_id}#{dep_type}"
    result += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0
    result
  end

  def format_predecessor_with_name(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = (pred_data["id"] || pred_data[:id]).to_i
    dep_type = pred_data["type"] || pred_data[:type] || "FS"
    lag = (pred_data["lag"] || pred_data[:lag] || 0).to_i

    return nil if task_id.zero?

    # Task numbers are globally unique now, so we can find by task_number directly
    predecessor_row = SmScheduleMaster.find_by(task_number: task_id)
    task_name = predecessor_row&.name || "Task #{task_id}"

    dep_string = dep_type
    dep_string += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0

    "#{task_name} (#{dep_string})"
  end

  # Auto-clean invalid predecessor references before validation
  # This prevents validation errors from orphaned predecessor IDs
  def clean_invalid_predecessors
    return if predecessor_ids.blank?

    # Get valid task numbers - must match validator logic exactly (no .active filter)
    template_ids = sm_template_ids || []
    valid_task_numbers = if template_ids.any?
      # Same template(s) - use JSONB containment check
      conditions = template_ids.map { |tid| "sm_template_ids @> '[#{tid.to_i}]'::jsonb" }.join(" OR ")
      SmScheduleMaster.where(conditions).where.not(id: id).pluck(:task_number)
    else
      # No templates - fall back to global check (matches validator behavior)
      SmScheduleMaster.where.not(id: id).pluck(:task_number)
    end

    # Filter out invalid predecessors
    original_count = predecessor_ids.length
    self.predecessor_ids = predecessor_ids.select do |pred|
      pred_id = (pred["id"] || pred[:id]).to_i
      valid_task_numbers.include?(pred_id)
    end

    # Log if we cleaned any
    cleaned_count = original_count - predecessor_ids.length
    if cleaned_count > 0
      Rails.logger.info("[SmScheduleMaster] Cleaned #{cleaned_count} invalid predecessor(s) from row #{id || 'new'} (#{name})")
    end
  end

  # When a task is soft-deleted, remove references to it from other tasks' predecessors
  def clean_orphaned_predecessor_references
    return unless is_active == false # Only run when being deactivated

    # Find all rows that reference this task as a predecessor
    # Query both integer and string formats for consistency (predecessor IDs may be stored as either)
    SmScheduleMaster.active.where(
      "predecessor_ids @> ? OR predecessor_ids @> ?",
      [{ "id" => task_number }].to_json,
      [{ "id" => task_number.to_s }].to_json
    ).find_each do |row|
      original_preds = row.predecessor_ids.dup
      row.predecessor_ids = row.predecessor_ids.reject do |pred|
        (pred["id"] || pred[:id]).to_i == task_number
      end

      if row.predecessor_ids != original_preds
        # Backup the original predecessors before clearing
        row.predecessor_ids_backup = original_preds if row.predecessor_ids_backup.blank?
        row.dependency_broken = true
        row.save!(validate: false) # Skip validation to avoid circular issues
        Rails.logger.info("[SmScheduleMaster] Removed predecessor #{task_number} from row #{row.id} (#{row.name}) - marked as dependency_broken")
      end
    end
  end
end
