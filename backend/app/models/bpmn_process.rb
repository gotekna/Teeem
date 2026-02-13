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

  # Generate BPMN XML from database nodes and edges
  # Use when nodes exist but bpmn_xml is missing (e.g., programmatically created workflows)
  def generate_xml_from_nodes!
    return if bpmn_nodes.empty?

    nodes = bpmn_nodes.order(:id)
    edges = bpmn_edges.includes(:source_node, :target_node)

    # Layout constants - generous spacing for readability
    x_start = 180
    y_midline = 260  # Vertical center for all elements
    x_spacing = 200  # Between node centers

    # Map node_type to BPMN element type and dimensions
    type_map = {
      "start_event" => { element: "bpmn:startEvent", width: 36, height: 36 },
      "end_event" => { element: "bpmn:endEvent", width: 36, height: 36 },
      "service_task" => { element: "bpmn:serviceTask", width: 100, height: 80 },
      "user_task" => { element: "bpmn:userTask", width: 100, height: 80 },
      "exclusive_gateway" => { element: "bpmn:exclusiveGateway", width: 50, height: 50 },
      "parallel_gateway" => { element: "bpmn:parallelGateway", width: 50, height: 50 },
      "inclusive_gateway" => { element: "bpmn:inclusiveGateway", width: 50, height: 50 },
      "timer_event" => { element: "bpmn:intermediateCatchEvent", width: 36, height: 36 },
      "message_event" => { element: "bpmn:intermediateThrowEvent", width: 36, height: 36 }
    }

    # Compute positions: center each element on the midline
    # Store computed bounds for edge waypoints
    node_bounds = {}

    nodes.each_with_index do |node, idx|
      info = type_map[node.node_type] || { element: "bpmn:task", width: 100, height: 80 }
      # Place center of each node at (x_start + idx * x_spacing, y_midline)
      cx = x_start + idx * x_spacing
      cy = y_midline
      x = cx - info[:width] / 2.0
      y = cy - info[:height] / 2.0
      node_bounds[node.node_key] = { x: x, y: y, w: info[:width], h: info[:height], cx: cx, cy: cy }
    end

    # Build process elements XML
    process_elements = ""
    shape_elements = ""
    edge_elements = ""

    nodes.each do |node|
      info = type_map[node.node_type] || { element: "bpmn:task", width: 100, height: 80 }
      b = node_bounds[node.node_key]

      # Escape XML special chars in names
      escaped_name = node.name.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub("\"", "&quot;")
      name_attr = node.name.present? ? " name=\"#{escaped_name}\"" : ""

      # Add documentation with config JSON if config exists
      doc_content = ""
      if node.config.present? && node.config.keys.any?
        escaped_json = node.config.to_json.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
        doc_content = "\n      <bpmn:documentation>#{escaped_json}</bpmn:documentation>"
      end

      process_elements += "    <#{info[:element]} id=\"#{node.node_key}\"#{name_attr}>#{doc_content}\n    </#{info[:element]}>\n"

      # Build the shape - no explicit label (bpmn-js auto-positions labels inside tasks)
      shape_elements += <<~SHAPE
            <bpmndi:BPMNShape id="#{node.node_key}_di" bpmnElement="#{node.node_key}">
              <dc:Bounds x="#{b[:x].round}" y="#{b[:y].round}" width="#{b[:w]}" height="#{b[:h]}" />
            </bpmndi:BPMNShape>
      SHAPE
    end

    # Add sequence flows with waypoints
    edges.each do |edge|
      escaped_edge_name = edge.name.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub("\"", "&quot;")
      name_attr = edge.name.present? ? " name=\"#{escaped_edge_name}\"" : ""
      condition = ""
      if edge.condition_expression.present?
        escaped_cond = edge.condition_expression.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
        condition = "\n      <bpmn:conditionExpression>#{escaped_cond}</bpmn:conditionExpression>"
      end

      process_elements += "    <bpmn:sequenceFlow id=\"#{edge.edge_key}\" sourceRef=\"#{edge.source_node.node_key}\" targetRef=\"#{edge.target_node.node_key}\"#{name_attr}>#{condition}\n    </bpmn:sequenceFlow>\n"

      # Compute edge waypoints: right side of source → left side of target
      src = node_bounds[edge.source_node.node_key]
      tgt = node_bounds[edge.target_node.node_key]
      if src && tgt
        src_x = src[:x] + src[:w]  # Right edge of source
        src_y = src[:cy]            # Vertical center
        tgt_x = tgt[:x]            # Left edge of target
        tgt_y = tgt[:cy]           # Vertical center

        edge_elements += <<~EDGE
              <bpmndi:BPMNEdge id="#{edge.edge_key}_di" bpmnElement="#{edge.edge_key}">
                <di:waypoint x="#{src_x.round}" y="#{src_y.round}" />
                <di:waypoint x="#{tgt_x.round}" y="#{tgt_y.round}" />
              </bpmndi:BPMNEdge>
        EDGE
      else
        edge_elements += <<~EDGE
              <bpmndi:BPMNEdge id="#{edge.edge_key}_di" bpmnElement="#{edge.edge_key}">
              </bpmndi:BPMNEdge>
        EDGE
      end
    end

    xml = <<~XML
      <?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                        xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                        xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                        xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                        id="Definitions_1"
                        targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true">
      #{process_elements}  </bpmn:process>
        <bpmndi:BPMNDiagram id="BPMNDiagram_1">
          <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      #{shape_elements}#{edge_elements}    </bpmndi:BPMNPlane>
        </bpmndi:BPMNDiagram>
      </bpmn:definitions>
    XML

    update!(bpmn_xml: xml)
    xml
  end

  # Sync nodes and edges from BPMN XML
  # Call this before test run if nodes are empty but XML exists
  def sync_nodes_from_xml!
    return unless bpmn_xml.present?

    doc = Nokogiri::XML(bpmn_xml)
    doc.remove_namespaces!

    transaction do
      # Clear existing nodes and edges
      bpmn_edges.destroy_all
      bpmn_nodes.destroy_all

      node_map = {} # Map XML IDs to database node IDs

      # Parse process elements
      process = doc.at_xpath("//process")
      return unless process

      # Create nodes from BPMN elements
      process.children.each do |element|
        node_type = bpmn_element_to_node_type(element.name)
        next unless node_type

        node_key = element["id"]
        name = element["name"]

        # Get position from diagram
        shape = doc.at_xpath("//BPMNShape[@bpmnElement='#{node_key}']")
        bounds = shape&.at_xpath("Bounds")
        pos_x = bounds ? bounds["x"].to_f : 0
        pos_y = bounds ? bounds["y"].to_f : 0

        # Extract config from element attributes/children
        config = extract_node_config(element, node_type)

        node = bpmn_nodes.create!(
          node_key: node_key,
          node_type: node_type,
          name: name,
          position_x: pos_x,
          position_y: pos_y,
          config: config
        )

        node_map[node_key] = node.id
      end

      # Create edges from sequence flows
      process.xpath("sequenceFlow").each do |flow|
        edge_key = flow["id"]
        source_key = flow["sourceRef"]
        target_key = flow["targetRef"]
        name = flow["name"]

        source_id = node_map[source_key]
        target_id = node_map[target_key]

        next unless source_id && target_id

        # Check for condition expression
        condition = flow.at_xpath("conditionExpression")&.text

        bpmn_edges.create!(
          edge_key: edge_key,
          source_node_id: source_id,
          target_node_id: target_id,
          name: name,
          condition_expression: condition
        )
      end
    end

    reload
  end

  private

  def bpmn_element_to_node_type(element_name)
    {
      "startEvent" => "start_event",
      "endEvent" => "end_event",
      "task" => "service_task",
      "serviceTask" => "service_task",
      "userTask" => "user_task",
      "exclusiveGateway" => "exclusive_gateway",
      "parallelGateway" => "parallel_gateway",
      "inclusiveGateway" => "inclusive_gateway",
      "intermediateCatchEvent" => "timer_event",
      "intermediateThrowEvent" => "message_event"
    }[element_name]
  end

  def extract_node_config(element, node_type)
    config = {}

    # Look for extensionElements with custom properties
    element.xpath("extensionElements/properties/property").each do |prop|
      config[prop["name"]] = prop["value"]
    end

    # Check documentation element for JSON config (used by BPMN designer)
    doc_element = element.at_xpath("documentation")
    if doc_element&.text.present?
      doc_text = doc_element.text.strip
      # Try to parse as JSON if it looks like JSON
      if doc_text.start_with?("{")
        begin
          doc_config = JSON.parse(doc_text)
          config = doc_config.merge(config) # Extension elements override doc config
        rescue JSON::ParserError
          # Not valid JSON, ignore
        end
      end
    end

    # For tasks, try to extract task_type from element or default based on name
    if node_type.in?(%w[service_task user_task])
      config["task_type"] ||= "generate_document" # Default for now
    end

    config
  end
end
