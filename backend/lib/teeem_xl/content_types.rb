# frozen_string_literal: true

require "nokogiri"

module TeeemXl
  # ContentTypes parses and represents the [Content_Types].xml file.
  #
  # This mandatory file catalogs all parts in the XLSX archive,
  # mapping file extensions and specific paths to content types.
  #
  # Structure:
  #   <Types xmlns="...">
  #     <Default Extension="xml" ContentType="application/xml"/>
  #     <Default Extension="rels" ContentType="application/vnd...relationships+xml"/>
  #     <Override PartName="/xl/workbook.xml" ContentType="application/vnd...sheet.main+xml"/>
  #     ...
  #   </Types>
  #
  # Two types of mappings:
  # - Default: Maps file extensions to content types (fallback)
  # - Override: Maps specific paths to content types (takes precedence)
  #
  class ContentTypes
    NAMESPACE = "http://schemas.openxmlformats.org/package/2006/content-types"

    attr_reader :defaults, :overrides

    # Parse [Content_Types].xml content
    #
    # @param content [String] XML content
    # @return [ContentTypes]
    def self.parse(content)
      raise InvalidFileError, "Missing [Content_Types].xml" unless content

      doc = Nokogiri::XML(content)
      new(doc)
    end

    def initialize(doc)
      @defaults = {}
      @overrides = {}
      parse_document(doc)
    end

    # Get content type for a part
    #
    # @param path [String] Path within the archive
    # @return [String, nil] Content type
    def content_type_for(path)
      normalized = path.start_with?("/") ? path : "/#{path}"

      # Override takes precedence
      return @overrides[normalized] if @overrides.key?(normalized)

      # Fall back to extension-based default
      ext = File.extname(path).delete_prefix(".")
      @defaults[ext]
    end

    # Check if a path has a specific content type
    #
    # @param path [String] Path within the archive
    # @param type [String] Expected content type
    # @return [Boolean]
    def type_matches?(path, type)
      content_type_for(path) == type
    end

    # Find all parts with a specific content type
    #
    # @param type [String] Content type to find
    # @return [Array<String>] Paths matching the content type
    def parts_with_type(type)
      @overrides.select { |_, v| v == type }.keys
    end

    # Generate [Content_Types].xml for writing
    #
    # @return [String] XML content
    def to_xml
      builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
        xml.Types(xmlns: NAMESPACE) do
          @defaults.each do |ext, type|
            xml.Default(Extension: ext, ContentType: type)
          end
          @overrides.each do |path, type|
            xml.Override(PartName: path, ContentType: type)
          end
        end
      end
      builder.to_xml
    end

    # Create empty ContentTypes (for writing new files)
    #
    # @return [ContentTypes]
    def self.empty
      ct = allocate
      ct.instance_variable_set(:@defaults, {})
      ct.instance_variable_set(:@overrides, {})
      ct
    end

    # Add a default extension mapping
    def add_default(extension, content_type)
      @defaults[extension] = content_type
    end

    # Add an override for a specific path
    def add_override(path, content_type)
      normalized = path.start_with?("/") ? path : "/#{path}"
      @overrides[normalized] = content_type
    end

    private

    def parse_document(doc)
      doc.xpath("//xmlns:Default", "xmlns" => NAMESPACE).each do |node|
        ext = node["Extension"]
        type = node["ContentType"]
        @defaults[ext] = type if ext && type
      end

      doc.xpath("//xmlns:Override", "xmlns" => NAMESPACE).each do |node|
        path = node["PartName"]
        type = node["ContentType"]
        @overrides[path] = type if path && type
      end
    end
  end
end
