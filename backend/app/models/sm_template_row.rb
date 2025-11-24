# frozen_string_literal: true

# SmTemplateRow - Template row for SM Gantt system
#
# Represents a single task in an SM template. When the template is
# applied to a construction, these become sm_tasks with actual dates.
#
class SmTemplateRow < ApplicationRecord
  # Role/group constants for internal work assignment
  ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze

  # Dependency types
  DEPENDENCY_TYPES = %w[FS SS FF SF].freeze

  # Associations
  belongs_to :sm_template
  belongs_to :parent_row, class_name: 'SmTemplateRow', optional: true
  has_many :children, class_name: 'SmTemplateRow', foreign_key: :parent_row_id, dependent: :nullify

  belongs_to :supplier, class_name: 'Contact', optional: true
  belongs_to :checklist, class_name: 'SupervisorChecklistTemplate', optional: true

  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :task_number, presence: true, uniqueness: { scope: :sm_template_id }
  validates :sequence_order, presence: true
  validates :duration_days, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :cert_lag_days, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :subtask_count, numericality: { only_integer: true, greater_than_or_equal_to: 1 }, if: :has_subtasks?
  validate :supplier_required_if_auto_po
  validate :subtask_names_match_count
  validate :predecessor_ids_valid

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :in_sequence, -> { order(sequence_order: :asc) }
  scope :by_trade, ->(trade) { where(trade: trade) if trade.present? }
  scope :by_stage, ->(stage) { where(stage: stage) if stage.present? }
  scope :requiring_po, -> { where(po_required: true) }
  scope :with_photos, -> { where(require_photo: true) }

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

  # Format predecessors as "2FS+3, 5SS" etc
  def predecessor_display
    return 'None' if predecessor_task_ids.empty?

    predecessor_task_ids.map { |pred| format_predecessor(pred) }.compact.join(', ')
  end

  # Format predecessors with task names
  def predecessor_display_names
    return 'None' if predecessor_task_ids.empty?

    predecessor_task_ids.map { |pred| format_predecessor_with_name(pred) }.compact.join(', ')
  end

  private

  def set_task_number
    return if task_number.present?

    max_number = SmTemplateRow.where(sm_template_id: sm_template_id).maximum(:task_number) || 0
    self.task_number = max_number + 1
  end

  def supplier_required_if_auto_po
    if create_po_on_job_start? && supplier_id.blank?
      errors.add(:supplier_id, 'must be present when Auto PO is enabled')
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

    predecessor_ids.each_with_index do |pred, idx|
      unless pred.is_a?(Hash) && pred['id'].present?
        errors.add(:predecessor_ids, "entry #{idx} must have an id")
        next
      end

      if pred['type'].present? && !DEPENDENCY_TYPES.include?(pred['type'])
        errors.add(:predecessor_ids, "entry #{idx} has invalid type '#{pred['type']}'")
      end
    end
  end

  def format_predecessor(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = pred_data['id'] || pred_data[:id]
    dep_type = pred_data['type'] || pred_data[:type] || 'FS'
    lag = (pred_data['lag'] || pred_data[:lag] || 0).to_i

    return nil unless task_id

    result = "#{task_id}#{dep_type}"
    result += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0
    result
  end

  def format_predecessor_with_name(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = pred_data['id'] || pred_data[:id]
    dep_type = pred_data['type'] || pred_data[:type] || 'FS'
    lag = (pred_data['lag'] || pred_data[:lag] || 0).to_i

    return nil unless task_id

    predecessor_row = sm_template.sm_template_rows.find_by(task_number: task_id)
    task_name = predecessor_row&.name || "Task #{task_id}"

    dep_string = dep_type
    dep_string += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0

    "#{task_name} (#{dep_string})"
  end
end
