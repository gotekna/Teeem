# frozen_string_literal: true

# SmTemplateRow - Template row for SM Gantt system
#
# Represents a single task in an SM template. When the template is
# applied to a construction, these become sm_tasks with actual dates.
#
# Multi-Template Support:
# - A row can belong to multiple templates via sm_template_ids (JSONB array)
# - Use for_template(template_id) scope to filter by template
# - Use add_to_template/remove_from_template to manage membership
#
class SmTemplateRow < ApplicationRecord
  # Role/group constants for internal work assignment
  ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze

  # Dependency types
  DEPENDENCY_TYPES = %w[FS SS FF SF].freeze

  # Associations
  # Note: sm_template_id is deprecated, use sm_template_ids (JSONB array) instead
  # Keeping belongs_to for backwards compatibility during migration
  belongs_to :sm_template, optional: true
  belongs_to :parent_row, class_name: "SmTemplateRow", optional: true
  has_many :children, class_name: "SmTemplateRow", foreign_key: :parent_row_id, dependent: :nullify

  belongs_to :supplier, class_name: "Contact", optional: true
  belongs_to :checklist, class_name: "SupervisorChecklistTemplate", optional: true

  # PO hierarchy - link this task's PO to another task's PO
  belongs_to :linked_po_task, class_name: "SmTemplateRow", optional: true
  has_many :linked_po_children, class_name: "SmTemplateRow", foreign_key: :linked_po_task_id, dependent: :nullify

  # Photo storage EntityTab
  belongs_to :photo_entity_tab, class_name: "EntityTab", optional: true

  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :task_number, presence: true, uniqueness: true
  validates :sequence_order, presence: true
  validates :duration_days, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :cert_lag_days, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :subtask_count, numericality: { only_integer: true, greater_than_or_equal_to: 1 }, if: :has_subtasks?
  validate :supplier_required_if_auto_po
  validate :subtask_names_match_count
  validate :predecessor_ids_valid
  validate :no_circular_dependencies

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :in_sequence, -> { order(sequence_order: :asc) }
  scope :by_trade, ->(trade) { where(trade: trade) if trade.present? }
  scope :by_stage, ->(stage) { where(stage: stage) if stage.present? }
  scope :requiring_po, -> { where(po_required: true) }
  scope :with_photos, -> { where(require_photo: true) }
  scope :auto_included, -> { where(auto_include: true) }
  scope :manual_only, -> { where(auto_include: false) }
  scope :allow_duplicates, -> { where(allow_duplicates: true) }

  # Multi-template scope - filter rows by template membership
  scope :for_template, ->(template_id) { where("sm_template_ids @> ?", [template_id].to_json) }

  # Callbacks
  before_validation :set_task_number, on: :create

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
  def sm_templates
    SmTemplate.where(id: sm_template_ids)
  end

  # Check if row belongs to a specific template
  def in_template?(template_id)
    (sm_template_ids || []).include?(template_id)
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
    SmTemplate.find_by(id: sm_template_ids&.first)
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

  def set_task_number
    return if task_number.present?

    # Task numbers are now globally unique (not per-template)
    max_number = SmTemplateRow.maximum(:task_number) || 0
    self.task_number = max_number + 1
  end

  def supplier_required_if_auto_po
    if create_po_on_job_start? && supplier_id.blank?
      errors.add(:supplier_id, "must be present when Auto PO is enabled")
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
      SmTemplateRow.where(conditions)
                   .where.not(id: id)
                   .pluck(:task_number)
    else
      SmTemplateRow.where.not(id: id).pluck(:task_number)
    end

    predecessor_ids.each_with_index do |pred, idx|
      # Check structure
      unless pred.is_a?(Hash) && pred["id"].present?
        errors.add(:predecessor_ids, "entry #{idx} must have an id")
        next
      end

      pred_id = pred["id"] || pred[:id]

      # Check predecessor exists
      unless valid_task_numbers.include?(pred_id)
        errors.add(:predecessor_ids, "entry #{idx} references non-existent task #{pred_id}")
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
    template_ids = sm_template_ids || []
    return if template_ids.empty?

    # sm_template_ids is JSONB array, use @> to check containment
    conditions = template_ids.map { |tid| "sm_template_ids @> '[#{tid.to_i}]'::jsonb" }.join(' OR ')
    all_rows = SmTemplateRow.where(conditions)

    # Build dependency graph: task_number -> [predecessor_task_numbers]
    predecessor_map = {}
    all_rows.each do |row|
      next if row.predecessor_ids.blank?
      predecessor_map[row.task_number] = row.predecessor_ids.map { |p| p["id"] || p[:id] }.compact
    end

    # Update with our proposed changes (what we're trying to save)
    predecessor_map[task_number] = predecessor_ids.map { |p| p["id"] || p[:id] }.compact

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

    task_id = pred_data["id"] || pred_data[:id]
    dep_type = pred_data["type"] || pred_data[:type] || "FS"
    lag = (pred_data["lag"] || pred_data[:lag] || 0).to_i

    return nil unless task_id

    result = "#{task_id}#{dep_type}"
    result += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0
    result
  end

  def format_predecessor_with_name(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = pred_data["id"] || pred_data[:id]
    dep_type = pred_data["type"] || pred_data[:type] || "FS"
    lag = (pred_data["lag"] || pred_data[:lag] || 0).to_i

    return nil unless task_id

    # Task numbers are globally unique now, so we can find by task_number directly
    predecessor_row = SmTemplateRow.find_by(task_number: task_id)
    task_name = predecessor_row&.name || "Task #{task_id}"

    dep_string = dep_type
    dep_string += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0

    "#{task_name} (#{dep_string})"
  end
end
