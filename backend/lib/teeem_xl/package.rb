# frozen_string_literal: true

require "zip"
require "nokogiri"

module TeeemXL
  # Package handles the ZIP archive structure of XLSX files.
  #
  # An XLSX file is a ZIP archive containing XML files following the
  # Office Open XML (OOXML) specification. The Package class provides:
  # - ZIP file access (read/write)
  # - Part extraction by path
  # - Content type resolution
  # - Relationship resolution
  #
  # Structure of an XLSX archive:
  #   file.xlsx (ZIP)
  #   ├── [Content_Types].xml           # Catalogs all parts
  #   ├── _rels/.rels                   # Package relationships
  #   └── xl/
  #       ├── workbook.xml              # Workbook definition
  #       ├── _rels/workbook.xml.rels   # Workbook relationships
  #       ├── worksheets/sheet1.xml     # Worksheet data
  #       ├── sharedStrings.xml         # Shared string table
  #       ├── styles.xml                # Cell styles
  #       └── theme/theme1.xml          # Color/font theme
  #
  class Package
    attr_reader :content_types, :package_relationships

    # Initialize Package from file path, IO, or string data
    #
    # @param source [String, IO, Pathname] File path or IO object
    # @raise [InvalidFileError] If source is not a valid ZIP/XLSX
    def initialize(source)
      @zip = open_zip(source)
      @content_types = ContentTypes.parse(read_part("[Content_Types].xml"))
      @package_relationships = Relationships.parse(read_part("_rels/.rels"))
      @relationships_cache = {}
    rescue Zip::Error => e
      raise InvalidFileError, "Not a valid XLSX file: #{e.message}"
    end

    # Read a part (file) from the package
    #
    # @param path [String] Path within the archive (e.g., "xl/workbook.xml")
    # @return [String, nil] File contents or nil if not found
    def read_part(path)
      # Normalize path (remove leading slash if present)
      normalized = path.start_with?("/") ? path[1..] : path
      entry = @zip.find_entry(normalized)
      entry&.get_input_stream&.read
    end

    # Check if a part exists in the package
    #
    # @param path [String] Path within the archive
    # @return [Boolean]
    def part_exists?(path)
      normalized = path.start_with?("/") ? path[1..] : path
      @zip.find_entry(normalized) != nil
    end

    # Read a part and parse as XML
    #
    # @param path [String] Path within the archive
    # @return [Nokogiri::XML::Document, nil]
    def read_xml(path)
      content = read_part(path)
      return nil unless content

      Nokogiri::XML(content) do |config|
        config.strict.noblanks
      end
    end

    # Get relationships for a specific part
    # Relationships are stored in _rels/{part_name}.rels
    #
    # @param part_path [String] Path of the part (e.g., "xl/workbook.xml")
    # @return [TeeemXL::Relationships] Relationships for that part
    def relationships_for(part_path)
      return @relationships_cache[part_path] if @relationships_cache.key?(part_path)

      # Build rels path: xl/workbook.xml -> xl/_rels/workbook.xml.rels
      dir = File.dirname(part_path)
      base = File.basename(part_path)
      rels_path = if dir == "."
                    "_rels/#{base}.rels"
                  else
                    "#{dir}/_rels/#{base}.rels"
                  end

      rels_content = read_part(rels_path)
      @relationships_cache[part_path] = if rels_content
                                          Relationships.parse(rels_content, base_path: dir)
                                        else
                                          Relationships.empty
                                        end
    end

    # Resolve a relationship ID to a full path
    #
    # @param part_path [String] Path of the part containing the reference
    # @param rel_id [String] Relationship ID (e.g., "rId1")
    # @return [String, nil] Full path to the target part
    def resolve_relationship(part_path, rel_id)
      rels = relationships_for(part_path)
      rels.target_for(rel_id)
    end

    # Find parts by relationship type
    #
    # @param part_path [String] Path of the part containing relationships
    # @param type [Symbol] Relationship type (see RELATIONSHIP_TYPES)
    # @return [Array<String>] Paths to matching parts
    def find_parts_by_type(part_path, type)
      rels = relationships_for(part_path)
      type_uri = RELATIONSHIP_TYPES[type]
      rels.targets_for_type(type_uri)
    end

    # Get the workbook path from package relationships
    #
    # @return [String] Path to workbook.xml
    def workbook_path
      @workbook_path ||= begin
        office_doc_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
        targets = @package_relationships.targets_for_type(office_doc_type)
        targets.first || "xl/workbook.xml"
      end
    end

    # List all parts in the package
    #
    # @return [Array<String>] All file paths in the archive
    def parts
      @zip.entries.map(&:name).reject { |n| n.end_with?("/") }
    end

    # Close the package (releases file handles)
    def close
      @zip.close
    end

    private

    def open_zip(source)
      case source
      when String
        if File.exist?(source)
          Zip::File.open(source)
        else
          # Treat as raw data
          Zip::File.open_buffer(source)
        end
      when Pathname
        Zip::File.open(source.to_s)
      when IO, StringIO
        Zip::File.open_buffer(source)
      else
        raise ArgumentError, "Unknown source type: #{source.class}"
      end
    end
  end
end
