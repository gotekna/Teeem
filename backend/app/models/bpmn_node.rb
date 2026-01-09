class BpmnNode < ApplicationRecord
  # Associations
  belongs_to :bpmn_process
  has_many :outgoing_edges, class_name: "BpmnEdge", foreign_key: :source_node_id, dependent: :destroy
  has_many :incoming_edges, class_name: "BpmnEdge", foreign_key: :target_node_id, dependent: :destroy
  # Cascade delete tokens and task instances when node is deleted (workflow cleanup)
  has_many :bpmn_tokens, foreign_key: :current_node_id, dependent: :destroy
  has_many :bpmn_task_instances, dependent: :destroy

  # Constants
  NODE_TYPES = %w[
    start_event
    end_event
    user_task
    service_task
    exclusive_gateway
    parallel_gateway
    inclusive_gateway
    timer_event
    message_event
    data_store_reference
  ].freeze

  EVENT_TYPES = %w[start_event end_event timer_event message_event].freeze
  TASK_TYPES = %w[user_task service_task].freeze
  GATEWAY_TYPES = %w[exclusive_gateway parallel_gateway inclusive_gateway].freeze
  DATA_TYPES = %w[data_store_reference].freeze

  # Validations
  validates :node_type, presence: true, inclusion: { in: NODE_TYPES }
  validates :node_key, presence: true, uniqueness: { scope: :bpmn_process_id }

  # Scopes
  scope :events, -> { where(node_type: EVENT_TYPES) }
  scope :tasks, -> { where(node_type: TASK_TYPES) }
  scope :gateways, -> { where(node_type: GATEWAY_TYPES) }
  scope :start_events, -> { where(node_type: "start_event") }
  scope :end_events, -> { where(node_type: "end_event") }

  # Instance methods
  def gateway?
    GATEWAY_TYPES.include?(node_type)
  end

  def event?
    EVENT_TYPES.include?(node_type)
  end

  def task?
    TASK_TYPES.include?(node_type)
  end

  def start_event?
    node_type == "start_event"
  end

  def end_event?
    node_type == "end_event"
  end

  def user_task?
    node_type == "user_task"
  end

  def service_task?
    node_type == "service_task"
  end

  def exclusive_gateway?
    node_type == "exclusive_gateway"
  end

  def parallel_gateway?
    node_type == "parallel_gateway"
  end

  def timer_event?
    node_type == "timer_event"
  end

  # Config accessors for common patterns
  def assignee_type
    config&.dig("assignee_type")
  end

  def assignee_value
    config&.dig("assignee_value")
  end

  def task_type
    config&.dig("task_type")
  end

  def timer_duration
    config&.dig("duration")
  end

  def form_schema
    config&.dig("form_schema")
  end

  def default_edge_key
    config&.dig("default_edge_key")
  end

  # Position helpers
  def position
    { x: position_x, y: position_y }
  end

  def position=(pos)
    self.position_x = pos[:x] || pos["x"]
    self.position_y = pos[:y] || pos["y"]
  end

  # Display helpers
  def display_name
    name.presence || node_key.humanize
  end

  def icon_name
    case node_type
    when "start_event" then "play"
    when "end_event" then "stop"
    when "user_task" then "user"
    when "service_task" then "cog"
    when "exclusive_gateway" then "git-branch"
    when "parallel_gateway" then "git-merge"
    when "timer_event" then "clock"
    else "circle"
    end
  end

  def color
    case node_type
    when "start_event" then "green"
    when "end_event" then "red"
    when "user_task" then "blue"
    when "service_task" then "purple"
    when "exclusive_gateway" then "amber"
    when "parallel_gateway" then "green"
    when "timer_event" then "cyan"
    else "gray"
    end
  end
end
