class BpmnEdge < ApplicationRecord
  # Associations
  belongs_to :bpmn_process
  belongs_to :source_node, class_name: "BpmnNode"
  belongs_to :target_node, class_name: "BpmnNode"

  # Validations
  validates :edge_key, presence: true, uniqueness: { scope: :bpmn_process_id }
  validate :nodes_belong_to_same_process

  # Scopes
  scope :default_edges, -> { where(is_default: true) }
  scope :conditional, -> { where.not(condition_expression: [ nil, "" ]) }

  # Instance methods
  def conditional?
    condition_expression.present?
  end

  def condition_met?(variables)
    return true if condition_expression.blank?

    Bpmn::ConditionEvaluator.evaluate(condition_expression, variables)
  rescue StandardError => e
    Rails.logger.error("BpmnEdge##{id}: Condition evaluation failed - #{e.message}")
    false
  end

  def display_name
    name.presence || (conditional? ? "Conditional" : "")
  end

  private

  def nodes_belong_to_same_process
    if source_node&.bpmn_process_id != bpmn_process_id
      errors.add(:source_node, "must belong to the same process")
    end

    if target_node&.bpmn_process_id != bpmn_process_id
      errors.add(:target_node, "must belong to the same process")
    end
  end
end
