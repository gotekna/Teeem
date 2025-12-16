class BpmnProcess < ApplicationRecord
  # Associations
  belongs_to :workflow_definition, optional: true
  has_many :bpmn_nodes, dependent: :destroy
  has_many :bpmn_edges, dependent: :destroy
  has_many :bpmn_process_instances, dependent: :restrict_with_error
  has_many :bpmn_triggers, dependent: :destroy

  # Validations
  validates :name, presence: true

  # Scopes
  scope :published, -> { where(is_published: true) }
  scope :draft, -> { where(is_published: false) }

  # Class methods
  def self.node_types
    %w[
      start_event
      end_event
      user_task
      service_task
      exclusive_gateway
      parallel_gateway
      inclusive_gateway
      timer_event
      message_event
    ]
  end

  # Instance methods
  def start_node
    bpmn_nodes.find_by(node_type: "start_event")
  end

  def end_nodes
    bpmn_nodes.where(node_type: "end_event")
  end

  def publish!
    update!(is_published: true, published_at: Time.current)
  end

  def unpublish!
    update!(is_published: false, published_at: nil)
  end

  def published?
    is_published
  end

  def duplicate(new_name: nil)
    new_process = dup
    new_process.name = new_name || "#{name} (Copy)"
    new_process.is_published = false
    new_process.published_at = nil
    new_process.version = 1

    BpmnProcess.transaction do
      new_process.save!

      # Map old node IDs to new node IDs
      node_map = {}

      bpmn_nodes.each do |node|
        new_node = node.dup
        new_node.bpmn_process = new_process
        new_node.save!
        node_map[node.id] = new_node.id
      end

      bpmn_edges.each do |edge|
        new_edge = edge.dup
        new_edge.bpmn_process = new_process
        new_edge.source_node_id = node_map[edge.source_node_id]
        new_edge.target_node_id = node_map[edge.target_node_id]
        new_edge.save!
      end

      bpmn_triggers.each do |trigger|
        new_trigger = trigger.dup
        new_trigger.bpmn_process = new_process
        new_trigger.save!
      end
    end

    new_process
  end

  def active_instances
    bpmn_process_instances.where(status: "active")
  end

  def has_active_instances?
    active_instances.exists?
  end

  # Validation for process structure
  def validate_structure
    errors = []

    # Must have exactly one start event
    start_events = bpmn_nodes.where(node_type: "start_event")
    errors << "Process must have exactly one start event" if start_events.count != 1

    # Must have at least one end event
    end_events = bpmn_nodes.where(node_type: "end_event")
    errors << "Process must have at least one end event" if end_events.count.zero?

    # All nodes except start must have incoming edges
    bpmn_nodes.where.not(node_type: "start_event").each do |node|
      unless bpmn_edges.exists?(target_node_id: node.id)
        errors << "Node '#{node.name || node.node_key}' has no incoming connections"
      end
    end

    # All nodes except end must have outgoing edges
    bpmn_nodes.where.not(node_type: "end_event").each do |node|
      unless bpmn_edges.exists?(source_node_id: node.id)
        errors << "Node '#{node.name || node.node_key}' has no outgoing connections"
      end
    end

    errors
  end

  def valid_structure?
    validate_structure.empty?
  end
end
