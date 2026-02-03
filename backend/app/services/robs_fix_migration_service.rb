# frozen_string_literal: true

# Service to migrate files from "rob fix" folder to correct TEEEM job folders
# Uses DocumentType naming conventions and OCR for classification
class RobsFixMigrationService
  # Known "rob fix" folder ID in SharePoint (discovered via exploration)
  ROBS_FIX_FOLDER_ID = "01P43HWV25TOK4MS3YLVEKDLXF7S7VFB6V"

  # Subfolder containers in "rob fix" that contain job folders
  CONTAINER_FOLDERS = [
    "00 Active - Soon to be moved out",
    "00 Current Kitchen Jobs",
    "01 Drafting",
    "TEEEM Jobs 5"
  ].freeze

  # Map source folder prefixes to target WarehouseFolder tab_keys
  SOURCE_TO_TAB_MAP = {
    /^01\s*revit/i => "drawings",
    /^02\s*land\s*info/i => "documents",
    /^03\s*contract/i => "documents",
    /^04\s*certif/i => "documents",
    /^05\s*estim/i => "documents",
    /^06\s*colour/i => "documents",
    /^07\s*photo/i => "photos",
    /photo/i => "photos",
    /drawing/i => "drawings",
    /revit/i => "drawings",
    /contract/i => "documents",
    /cert/i => "documents"
  }.freeze

  # File extension to DocumentType mapping
  EXTENSION_TO_DOCTYPE = {
    # Images → Site Photo
    ".jpg" => "Site Photo",
    ".jpeg" => "Site Photo",
    ".png" => "Site Photo",
    ".heic" => "Site Photo",
    ".heif" => "Site Photo",
    # CAD files → keep original name
    ".dwg" => nil,
    ".rvt" => nil,
    ".dxf" => nil,
    ".skp" => nil,
    # Documents - classify by content
    ".pdf" => :classify,
    ".doc" => :classify,
    ".docx" => :classify,
    ".xls" => :classify,
    ".xlsx" => :classify
  }.freeze

  # OCR confidence threshold (75%)
  OCR_CONFIDENCE_THRESHOLD = 0.75

  attr_reader :credential, :client, :drive_id, :results

  def initialize
    @credential = MicrosoftCredential.sharepoint_credential
    raise "No SharePoint credential found" unless @credential

    @client = MicrosoftGraphClient.new(@credential)
    @drive_id = @credential.drive_id
    @results = { migrated: [], skipped: [], errors: [] }
  end

  # Discover what's in the "rob fix" folder
  # Returns a hash of discovered jobs and their files
  def discover(dry_run: true)
    puts "=== ROB FIX FOLDER DISCOVERY ===" if dry_run
    puts ""

    discovered = {}

    # Get contents of rob fix folder
    rob_fix_contents = list_folder(ROBS_FIX_FOLDER_ID)

    rob_fix_contents.each do |item|
      next unless item[:is_folder]

      if CONTAINER_FOLDERS.any? { |c| item[:name].downcase.include?(c.downcase.split.first) }
        # This is a container folder (00 Active, 00 Current Kitchen Jobs, etc.)
        puts "📁 Container: #{item[:name]}" if dry_run
        container_contents = list_folder(item[:id])

        container_contents.each do |sub_item|
          next unless sub_item[:is_folder]

          job = match_folder_to_job(sub_item[:name])
          if job
            puts "  ✅ #{sub_item[:name]} → Job #{job.id}" if dry_run
            discovered[job.id] ||= { job: job, source_folders: [] }
            discovered[job.id][:source_folders] << {
              id: sub_item[:id],
              name: sub_item[:name],
              container: item[:name]
            }
          else
            puts "  ⚠️  #{sub_item[:name]} → NO MATCH" if dry_run
          end
        end
      else
        # Direct job folder at root of rob fix
        job = match_folder_to_job(item[:name])
        if job
          puts "📁 #{item[:name]} → Job #{job.id}" if dry_run
          discovered[job.id] ||= { job: job, source_folders: [] }
          discovered[job.id][:source_folders] << {
            id: item[:id],
            name: item[:name],
            container: nil
          }
        end
      end
    end

    puts ""
    puts "=== SUMMARY ===" if dry_run
    puts "Jobs found: #{discovered.count}" if dry_run
    puts "Total source folders: #{discovered.values.sum { |d| d[:source_folders].count }}" if dry_run

    discovered
  end

  # Run migration for specific job IDs or all discovered jobs
  def run(job_ids: nil, dry_run: true)
    puts "=== ROB FIX MIGRATION ==="
    puts "Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
    puts ""

    discovered = discover(dry_run: false)

    # Filter to specific jobs if requested
    if job_ids.present?
      job_ids = Array(job_ids).map(&:to_i)
      discovered = discovered.slice(*job_ids)
    end

    if discovered.empty?
      puts "No matching jobs found to migrate."
      return @results
    end

    discovered.each do |job_id, data|
      job = data[:job]
      puts ""
      puts "=== JOB #{job_id}: #{job.name} ==="

      # Ensure job has SharePoint folder
      target_folder_id = ensure_job_folder(job)
      unless target_folder_id
        @results[:errors] << { job_id: job_id, error: "No SharePoint folder" }
        puts "❌ Job has no SharePoint folder"
        next
      end

      # Process each source folder
      data[:source_folders].each do |source|
        puts "  Source: #{source[:name]}"
        migrate_folder_contents(source[:id], job, target_folder_id, dry_run: dry_run)
      end
    end

    print_summary
    @results
  end

  # Migrate a single job (for testing)
  def migrate_single_job(job_id, dry_run: true)
    run(job_ids: [job_id], dry_run: dry_run)
  end

  private

  # List folder contents with pagination
  def list_folder(folder_id)
    items = []
    url = "/drives/#{@drive_id}/items/#{folder_id}/children?$select=id,name,folder,file,size,createdDateTime"

    loop do
      response = @client.get(url)
      items.concat((response["value"] || []).map do |item|
        {
          id: item["id"],
          name: item["name"],
          size: item["size"],
          is_folder: item["folder"].present?,
          created_at: item["createdDateTime"]
        }
      end)

      next_link = response["@odata.nextLink"]
      break unless next_link

      url = next_link.sub("https://graph.microsoft.com/v1.0", "")
    end

    items
  end

  # Match folder name to TEEEM Job
  def match_folder_to_job(folder_name)
    # Pattern 1: "NNN - Address" or "NN - Address"
    if folder_name =~ /^(\d{1,4})\s*[-_]\s*/
      job_id = $1.to_i
      job = Job.find_by(id: job_id)
      return job if job
    end

    # Pattern 2: "Lot NNN Address" format (extract address for matching)
    if folder_name =~ /^(?:lot\s*)?(\d+)?\s*(.+)/i
      address_part = $2.to_s.strip

      # Try to match by address
      Job.find_each do |job|
        job_address = job.name.to_s.downcase.gsub(/[^\w\s]/, "")
        folder_address = address_part.downcase.gsub(/[^\w\s]/, "")

        # Check if significant overlap
        job_words = job_address.split.reject { |w| w.length < 4 }
        folder_words = folder_address.split.reject { |w| w.length < 4 }

        matching = (job_words & folder_words).count
        if matching >= 2 || (matching >= 1 && folder_words.count <= 3)
          return job
        end
      end
    end

    nil
  end

  # Ensure job has a storage folder, return the folder ID
  def ensure_job_folder(job)
    return job.storage_folder_id if job.storage_folder_id.present?

    # Try to find existing folder
    folder = @client.find_job_folder(job)
    if folder
      job.update_column(:storage_folder_id, folder["id"])
      return folder["id"]
    end

    nil
  end

  # Get target subfolder ID in job's SharePoint folder
  def get_target_subfolder(job_folder_id, tab_key)
    # Get job's subfolders
    subfolders = list_folder(job_folder_id)

    # Map tab_key to expected folder name
    folder_name = case tab_key
    when "photos" then "Photos"
    when "drawings" then "Drawings"
    when "documents" then "Documents"
    when "site" then "Site"
    else "Documents"
    end

    # Find or create subfolder
    existing = subfolders.find { |f| f[:is_folder] && f[:name].downcase == folder_name.downcase }
    return existing[:id] if existing

    # Create the folder
    created = @client.create_folder(folder_name, parent_id: job_folder_id)
    created["id"]
  end

  # Migrate all files from a source folder to the job's target folder
  def migrate_folder_contents(source_folder_id, job, target_folder_id, path: "", dry_run: true)
    items = list_folder(source_folder_id)

    items.each do |item|
      full_path = path.present? ? "#{path}/#{item[:name]}" : item[:name]

      if item[:is_folder]
        # Recurse into subfolders
        migrate_folder_contents(item[:id], job, target_folder_id, path: full_path, dry_run: dry_run)
      else
        # Migrate file
        migrate_file(item, job, target_folder_id, source_path: full_path, dry_run: dry_run)
      end
    end
  end

  # Migrate a single file
  def migrate_file(file_item, job, job_folder_id, source_path:, dry_run:)
    file_ext = File.extname(file_item[:name]).downcase
    original_name = file_item[:name]

    # Determine target tab based on source path
    tab_key = determine_tab_from_path(source_path)

    # Get target subfolder
    target_subfolder_id = get_target_subfolder(job_folder_id, tab_key)

    # Determine new name based on document type
    new_name = determine_new_name(file_item, job, file_ext, source_path)

    if dry_run
      puts "    📄 #{original_name}"
      puts "       → #{tab_key}/#{new_name}"
      @results[:migrated] << {
        job_id: job.id,
        source: source_path,
        target_tab: tab_key,
        original_name: original_name,
        new_name: new_name,
        dry_run: true
      }
    else
      begin
        # Move file with new name
        @client.move_file(file_item[:id], target_subfolder_id, new_name: new_name)

        puts "    ✅ #{original_name} → #{new_name}"
        @results[:migrated] << {
          job_id: job.id,
          source: source_path,
          target_tab: tab_key,
          original_name: original_name,
          new_name: new_name,
          dry_run: false
        }
      rescue => e
        puts "    ❌ #{original_name}: #{e.message}"
        @results[:errors] << {
          job_id: job.id,
          file: original_name,
          error: e.message
        }
      end
    end
  end

  # Determine which tab (folder) the file should go into based on source path
  def determine_tab_from_path(source_path)
    SOURCE_TO_TAB_MAP.each do |pattern, tab_key|
      return tab_key if source_path =~ pattern
    end
    "documents" # Default
  end

  # Determine new filename for the file
  def determine_new_name(file_item, job, file_ext, source_path)
    original_name = file_item[:name]

    # Check extension mapping
    doc_type_hint = EXTENSION_TO_DOCTYPE[file_ext]

    case doc_type_hint
    when nil
      # Keep original name (CAD files, etc.)
      original_name
    when :classify
      # Try to classify PDF/documents
      classify_and_name(file_item, job, file_ext, source_path)
    else
      # Known type (e.g., photos)
      generate_standard_name(doc_type_hint, job, file_ext, original_name)
    end
  end

  # Classify a document and generate appropriate name
  def classify_and_name(file_item, job, file_ext, source_path)
    original_name = file_item[:name]

    # Try to match by filename patterns first
    doc_type = match_doc_type_by_name(original_name, source_path)

    if doc_type
      generate_standard_name(doc_type.name, job, file_ext, original_name)
    else
      # Keep original name, will run AI analysis later
      original_name
    end
  end

  # Match document type by filename/path patterns
  def match_doc_type_by_name(filename, source_path)
    combined = "#{source_path}/#{filename}".downcase

    # Check against DocumentType aliases
    DocumentType.for_job.find_each do |dt|
      terms = dt.all_terms.map(&:downcase)
      if terms.any? { |term| combined.include?(term.downcase.gsub(/\s+/, "")) ||
                            combined.include?(term.downcase.gsub(/\s+/, "_")) ||
                            combined.include?(term.downcase.gsub(/\s+/, "-")) }
        return dt
      end
    end

    nil
  end

  # Generate a standardized filename using DocumentType template
  def generate_standard_name(doc_type_name, job, file_ext, original_name)
    doc_type = DocumentType.find_by(name: doc_type_name)

    if doc_type&.download_name.present?
      # Use the DocumentType template
      base_name = doc_type.generate_proposed_name(
        job: job,
        description: extract_description(original_name)
      )
      base_name + file_ext
    else
      # Fallback: JobCode + Date + original name - SSoT: use database column
      job_code = job.job_code
      date = Date.current.strftime("%d-%m-%Y")
      clean_name = original_name.gsub(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, "") # Remove date prefix if exists
      "#{job_code} #{date} #{clean_name}"
    end
  end

  # Extract description from original filename
  def extract_description(filename)
    # Remove extension
    name = File.basename(filename, ".*")
    # Remove common prefixes like dates, IMG_, DSC_, etc.
    name.gsub(/^IMG_\d+|^DSC_\d+|^\d{8}_\d+|^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, "")
        .gsub(/[_-]+/, " ")
        .strip
        .presence || "Document"
  end

  def print_summary
    puts ""
    puts "=== MIGRATION SUMMARY ==="
    puts "Migrated: #{@results[:migrated].count}"
    puts "Skipped: #{@results[:skipped].count}"
    puts "Errors: #{@results[:errors].count}"

    if @results[:errors].any?
      puts ""
      puts "Errors:"
      @results[:errors].each do |err|
        puts "  - Job #{err[:job_id]}: #{err[:file] || 'N/A'} - #{err[:error]}"
      end
    end
  end
end
