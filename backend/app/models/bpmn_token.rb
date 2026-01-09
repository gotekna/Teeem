class BpmnToken < ApplicationRecord
  # Associations
  belongs_to :bpmn_process_instance
  belongs_to :current_node, class_name: "BpmnNode"
  belongs_to :parent_token, class_name: "BpmnToken", optional: true
  # Cascade delete child tokens and task instances when parent token is deleted
  has_many :child_tokens, class_name: "BpmnToken", foreign_key: :parent_token_id, dependent: :destroy
  has_many :bpmn_task_instances, dependent: :destroy

  # Constants
  STATUSES = %w[active waiting completed merged].freeze

  # Validations
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :waiting, -> { where(status: "waiting") }
  scope :completed, -> { where(status: "completed") }
  scope :merged, -> { where(status: "merged") }
  scope :root_tokens, -> { where(parent_token_id: nil) }

  # Instance methods
  def active?
    status == "active"
  end

  def waiting?
    status == "waiting"
  end

  def completed?
    status == "completed"
  end

  def merged?
    status == "merged"
  end

  def complete!
    update!(status: "completed", completed_at: Time.current)
  end

  def wait!
    update!(status: "waiting")
  end

  def merge!
    update!(status: "merged", completed_at: Time.current)
  end

  def move_to!(node)
    update!(current_node: node, arrived_at: Time.current)
  end

  # Data management
  def get_data(key)
    data&.dig(key.to_s)
  end

  def set_data(key, value)
    self.data = (data || {}).merge(key.to_s => value)
    save!
  end

  # Token ancestry
  def root_token
    parent_token&.root_token || self
  end

  def root_token?
    parent_token_id.nil?
  end

  def depth
    return 0 if root_token?

    parent_token.depth + 1
  end

  def all_child_tokens
    child_tokens + child_tokens.flat_map(&:all_child_tokens)
  end

  def sibling_tokens
    return BpmnToken.none if parent_token_id.nil?

    parent_token.child_tokens.where.not(id: id)
  end

  # Display
  def display_status
    case status
    when "active" then "Running"
    when "waiting" then "Waiting"
    when "completed" then "Completed"
    when "merged" then "Merged"
    else status.humanize
    end
  end

  def current_node_name
    current_node.display_name
  end
end
