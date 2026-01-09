# CompozaBpmnImporter - Imports Compoza BPMN XML files into TEEEM workflows
#
# Parses Compoza-specific BPMN extensions including:
# - compoza:fill-docx-document service tasks
# - rapid:getItemRequest data stores
# - Custom template/output drive configurations
#
class CompozaBpmnImporter
  class ImportError < StandardError; end

  COMPOZA_NS = "http://compoza".freeze
  RAPID_NS = "http://rapid".freeze
  BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL".freeze
  BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI".freeze
  DC_NS = "http://www.omg.org/spec/DD/20100524/DC".freeze

  def initialize(xml_content, name: nil, user: nil)
    @xml_content = xml_content
    @name = name
    @user = user
    @doc = nil
    @nodes = []
    @edges = []
    @data_stores = {}
    @position_map = {}
  end

  def import!
    parse_xml
    extract_positions
    extract_data_stores
    extract_nodes
    extract_edges

    create_bpmn_process
  end

  def preview
    parse_xml
    extract_positions
    extract_data_stores
    extract_nodes
    extract_edges

    {
      name: process_name,
      description: process_description,
      nodes: @nodes,
      edges: @edges,
      data_stores: @data_stores.values
    }
  end

  private

  def parse_xml
    @doc = Nokogiri::XML(@xml_content)
    @doc.remove_namespaces! # Simplify XPath queries

    raise ImportError, "Invalid BPMN XML" unless @doc.at("definitions")
  end

  def process_name
    @name || @doc.at("process")&.[]("name") || "Imported Workflow"
  end

  def process_description
    @doc.at("process > documentation")&.text
  end

  def extract_positions
    # Extract positions from BPMN diagram
    @doc.xpath("//BPMNShape").each do |shape|
      element_id = shape["bpmnElement"]
      bounds = shape.at("Bounds")
      next unless bounds

      @position_map[element_id] = {
        x: bounds["x"].to_f,
        y: bounds["y"].to_f + 300, # Offset to center in canvas
        width: bounds["width"].to_f,
        height: bounds["height"].to_f
      }
    end
  end

  def extract_data_stores
    @doc.xpath("//dataStoreReference").each do |ds|
      id = ds["id"]
      name = ds["name"]

      # Extract rapid:getItemRequest configuration
      get_item = ds.at("extensionElements > getItemRequest")

      @data_stores[id] = {
        id: id,
        name: name,
        list: get_item&.[]("list"),
        item_id_expression: get_item&.[]("itemId")
      }
    end
  end

  def extract_nodes
    # Start events
    @doc.xpath("//startEvent").each do |node|
      @nodes << build_node(node, "start_event")
    end

    # End events
    @doc.xpath("//endEvent").each do |node|
      @nodes << build_node(node, "end_event")
    end

    # Service tasks (document generation)
    @doc.xpath("//serviceTask").each do |node|
      @nodes << build_service_task_node(node)
    end

    # User tasks
    @doc.xpath("//userTask").each do |node|
      @nodes << build_node(node, "user_task")
    end

    # Parallel gateways
    @doc.xpath("//parallelGateway").each do |node|
      @nodes << build_node(node, "parallel_gateway")
    end

    # Exclusive gateways
    @doc.xpath("//exclusiveGateway").each do |node|
      @nodes << build_node(node, "exclusive_gateway")
    end

    # Timer events
    @doc.xpath("//intermediateCatchEvent[timerEventDefinition]").each do |node|
      @nodes << build_node(node, "timer_event")
    end
  end

  def build_node(xml_node, node_type)
    id = xml_node["id"]
    pos = @position_map[id] || { x: 100, y: 100 }

    {
      node_key: id,
      node_type: node_type,
      name: xml_node["name"] || node_type.humanize,
      description: xml_node.at("documentation")&.text,
      position: { x: pos[:x], y: pos[:y] },
      config: {}
    }
  end

  def build_service_task_node(xml_node)
    id = xml_node["id"]
    pos = @position_map[id] || { x: 100, y: 100 }
    implementation = xml_node["implementation"]

    config = {
      implementation: implementation
    }

    # Extract Compoza-specific attributes
    if implementation == "urn:compoza:fill-docx-document"
      config.merge!(
        task_type: "generate_document",
        template_drive_id: xml_node["templateFileDriveId"],
        template_item_id: xml_node["templateFileDriveItemId"],
        output_drive_id: xml_node["outputFileDriveId"],
        output_folder_id: xml_node["outputFileDriveItemId"],
        output_filename: xml_node["outputFileName"],
        convert_to_pdf: xml_node["convertToPDF"] == "true",
        item_data: parse_item_data(xml_node["itemData"])
      )
    end

    {
      node_key: id,
      node_type: "service_task",
      name: xml_node["name"] || "Service Task",
      description: xml_node.at("documentation")&.text,
      position: { x: pos[:x], y: pos[:y] },
      config: config
    }
  end

  def parse_item_data(json_string)
    return {} if json_string.blank?

    # Decode HTML entities
    decoded = CGI.unescapeHTML(json_string)
    JSON.parse(decoded)
  rescue JSON::ParserError => e
    Rails.logger.warn("CompozaBpmnImporter: Failed to parse itemData: #{e.message}")
    { raw: json_string }
  end

  def extract_edges
    @doc.xpath("//sequenceFlow").each do |flow|
      source = flow["sourceRef"]
      target = flow["targetRef"]
      condition = flow.at("conditionExpression")&.text

      @edges << {
        edge_key: flow["id"] || "#{source}_to_#{target}",
        source_key: source,
        target_key: target,
        name: flow["name"],
        condition_expression: condition.present? ? condition : nil,
        is_default: flow["isDefault"] == "true"
      }
    end
  end

  def create_bpmn_process
    ActiveRecord::Base.transaction do
      process = BpmnProcess.create!(
        name: process_name,
        description: process_description,
        canvas_data: {
          imported_from: "compoza",
          imported_at: Time.current.iso8601,
          imported_by_user_id: @user&.id,
          data_stores: @data_stores.values
        }
      )

      # Create nodes and build a map of node_key -> node_id
      node_key_to_id = {}
      @nodes.each do |node_data|
        node = process.bpmn_nodes.create!(
          node_key: node_data[:node_key],
          node_type: node_data[:node_type],
          name: node_data[:name],
          description: node_data[:description],
          position_x: node_data[:position][:x] || 0,
          position_y: node_data[:position][:y] || 0,
          config: node_data[:config]
        )
        node_key_to_id[node_data[:node_key]] = node.id
      end

      # Create edges using node IDs
      @edges.each do |edge_data|
        source_id = node_key_to_id[edge_data[:source_key]]
        target_id = node_key_to_id[edge_data[:target_key]]

        next unless source_id && target_id # Skip if nodes not found

        process.bpmn_edges.create!(
          edge_key: edge_data[:edge_key],
          source_node_id: source_id,
          target_node_id: target_id,
          name: edge_data[:name],
          condition_expression: edge_data[:condition_expression],
          is_default: edge_data[:is_default] || false
        )
      end

      process
    end
  end
end
