# frozen_string_literal: true

require "nokogiri"

module TeeemXl
  # Relationships parses and represents .rels files.
  #
  # Relationship files map relationship IDs (rId1, rId2, etc.) to
  # actual file paths and content types. They enable indirection
  # so parts can reference each other without hardcoding paths.
  #
  # Structure:
  #   <Relationships xmlns="...">
  #     <Relationship Id="rId1" Type="...worksheet" Target="worksheets/sheet1.xml"/>
  #     <Relationship Id="rId2" Type="...sharedStrings" Target="sharedStrings.xml"/>
  #     ...
  #   </Relationships>
  #
  # Key locations:
  # - _rels/.rels: Package-level relationships (points to workbook)
  # - xl/_rels/workbook.xml.rels: Workbook relationships (sheets, strings, styles)
  # - xl/worksheets/_rels/sheet1.xml.rels: Worksheet relationships (drawings, charts)
  #
  class Relationships
    NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships"

    # Single relationship entry
    Relationship = Struct.new(:id, :type, :target, :target_mode, keyword_init: true) do
      def external?
        target_mode == "External"
      end
    end

    attr_reader :relationships

    # Parse .rels XML content
    #
    # @param content [String] XML content
    # @param base_path [String] Base path for resolving relative targets
    # @return [Relationships]
    def self.parse(content, base_path: nil)
      return empty unless content

      doc = Nokogiri::XML(content)
      new(doc, base_path: base_path)
    end

    # Create empty Relationships
    #
    # @return [Relationships]
    def self.empty
      rels = allocate
      rels.instance_variable_set(:@relationships, {})
      rels.instance_variable_set(:@base_path, nil)
      rels
    end

    def initialize(doc, base_path: nil)
      @relationships = {}
      @base_path = base_path
      parse_document(doc)
    end

    # Get target path for a relationship ID
    #
    # @param rel_id [String] Relationship ID (e.g., "rId1")
    # @return [String, nil] Full target path
    def target_for(rel_id)
      rel = @relationships[rel_id]
      return nil unless rel

      resolve_target(rel.target)
    end

    # Get all targets for a specific relationship type
    #
    # @param type_uri [String] Full type URI
    # @return [Array<String>] Target paths
    def targets_for_type(type_uri)
      @relationships.values
                    .select { |r| r.type == type_uri }
                    .map { |r| resolve_target(r.target) }
    end

    # Get relationship by ID
    #
    # @param rel_id [String] Relationship ID
    # @return [Relationship, nil]
    def [](rel_id)
      @relationships[rel_id]
    end

    # Check if relationship exists
    #
    # @param rel_id [String] Relationship ID
    # @return [Boolean]
    def exists?(rel_id)
      @relationships.key?(rel_id)
    end

    # Get all relationships
    #
    # @return [Array<Relationship>]
    def all
      @relationships.values
    end

    # Get relationships of a specific type
    #
    # @param type_uri [String] Full type URI
    # @return [Array<Relationship>]
    def by_type(type_uri)
      @relationships.values.select { |r| r.type == type_uri }
    end

    # Generate .rels XML for writing
    #
    # @return [String] XML content
    def to_xml
      builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
        xml.Relationships(xmlns: NAMESPACE) do
          @relationships.values.sort_by(&:id).each do |rel|
            attrs = {
              Id: rel.id,
              Type: rel.type,
              Target: rel.target
            }
            attrs[:TargetMode] = rel.target_mode if rel.target_mode
            xml.Relationship(attrs)
          end
        end
      end
      builder.to_xml
    end

    # Add a relationship (for writing)
    #
    # @param id [String] Relationship ID
    # @param type [String] Relationship type URI
    # @param target [String] Target path
    # @param target_mode [String, nil] "External" for external targets
    def add(id:, type:, target:, target_mode: nil)
      @relationships[id] = Relationship.new(
        id: id,
        type: type,
        target: target,
        target_mode: target_mode
      )
    end

    # Generate next available relationship ID
    #
    # @return [String] Next available ID (e.g., "rId3")
    def next_id
      existing = @relationships.keys.map { |id| id.delete_prefix("rId").to_i }
      next_num = existing.max.to_i + 1
      "rId#{next_num}"
    end

    private

    def parse_document(doc)
      doc.xpath("//xmlns:Relationship", "xmlns" => NAMESPACE).each do |node|
        id = node["Id"]
        next unless id

        @relationships[id] = Relationship.new(
          id: id,
          type: node["Type"],
          target: node["Target"],
          target_mode: node["TargetMode"]
        )
      end
    end

    def resolve_target(target)
      return target if target.nil? || target.start_with?("/") || target.include?("://")

      if @base_path && !@base_path.empty? && @base_path != "."
        # Resolve relative path from base
        File.join(@base_path, target).gsub("\\", "/")
      else
        target
      end
    end
  end
end
