# Service to migrate job documents from legacy SharePoint folder structure
# to the new job-specific OneDrive folders
#
# Usage:
#   service = JobDocumentMigrationService.new
#   service.run(dry_run: true)  # Preview changes
#   service.run(dry_run: false) # Execute migration
#
class JobDocumentMigrationService
  # Path to legacy job documents in SharePoint
  SOURCE_FOLDER_PATH = "Old House Data/00 Active - Soon to be moved out"

  attr_reader :stats, :credential, :client

  def initialize
    @credential = begin
      cred = MicrosoftCredential.sharepoint_credential
      # Try to access an encrypted field to verify decryption works
      cred&.access_token if cred
      cred
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.warn "[JobDocumentMigration] Decryption error loading credential: #{e.message}"
      nil
    end

    @client = MicrosoftGraphClient.new(@credential) if @credential
    @stats = {
      matched: 0,
      unmatched: 0,
      files_found: 0,
      files_moved: 0,
      folders_processed: 0,
      errors: [],
      unmatched_folders: [],
      matched_jobs: []
    }
  end

  # Run the migration
  # @param dry_run [Boolean] If true, only preview changes without moving files
  # @param limit [Integer] Limit number of folders to process (nil = all)
  # @return [Hash] Statistics about the migration
  def run(dry_run: true, limit: nil)
    unless @credential && @client
      puts "ERROR: No active OneDrive credential found"
      return { success: false, error: "No OneDrive credential" }
    end

    puts "=== Job Document Migration ==="
    puts "Mode: #{dry_run ? 'DRY RUN (preview only)' : 'LIVE (files will be moved)'}"
    puts ""

    # Find the source folder
    source_folder = find_folder_by_path(SOURCE_FOLDER_PATH)
    unless source_folder
      puts "ERROR: Source folder not found: #{SOURCE_FOLDER_PATH}"
      return { success: false, error: "Source folder not found" }
    end

    puts "Found source folder: #{source_folder['name']} (ID: #{source_folder['id']})"
    puts ""

    # List all subfolders (each should be a job)
    job_folders = list_subfolders(source_folder["id"])
    puts "Found #{job_folders.count} job folders"
    puts ""

    # Apply limit if specified
    job_folders = job_folders.first(limit) if limit

    # Process each folder
    job_folders.each_with_index do |folder, index|
      puts "[#{index + 1}/#{job_folders.count}] Processing: #{folder['name']}"
      @stats[:folders_processed] += 1

      # Try to match folder to a job
      job = match_folder_to_job(folder["name"])

      if job
        @stats[:matched] += 1
        @stats[:matched_jobs] << { folder: folder["name"], job_id: job.id, job_title: job.title }
        puts "  MATCHED to Job ##{job.id}: #{job.title}"

        migrate_folder_to_job(folder, job, dry_run: dry_run)
      else
        @stats[:unmatched] += 1
        @stats[:unmatched_folders] << folder["name"]
        puts "  NOT MATCHED - no job found"
      end

      puts ""
    end

    print_summary(dry_run)
    @stats
  end

  # List legacy files for a specific job (used by API)
  # ULTRA-OPTIMIZED: Uses cached folder ID and single-level listing for speed
  # @param job [Job] The job to find legacy files for
  # @param folder_id [String, nil] Optional folder ID to navigate into (for subfolder navigation)
  # @param recursive [Boolean] If true, recursively list ALL files from all subfolders
  # @return [Array<Hash>] Array of items (files and folders) with type field
  def list_legacy_files_for_job(job, folder_id: nil, recursive: false)
    return [] unless @credential && @client

    # If folder_id provided, just list that folder directly (for subfolder navigation)
    if folder_id.present?
      if recursive
        return list_all_files_recursive(folder_id)
      else
        return list_folder_contents_fast(folder_id)
      end
    end

    # Find the job's legacy folder using cached source folder ID
    matching_folder = find_legacy_folder_for_job(job)
    return [] unless matching_folder

    # If recursive, get ALL files from all subfolders
    if recursive
      return list_all_files_recursive(matching_folder["id"])
    end

    # Return top-level contents only (files + folders as navigable items)
    list_folder_contents_fast(matching_folder["id"])
  end

  # Recursively list ALL files from a folder and all subfolders
  # Returns flat list of files with folder_path for context
  # Has a 25 second timeout to avoid Heroku's 30 second limit
  def list_all_files_recursive(root_folder_id, max_depth: 5, max_time: 25)
    files = []
    folders_to_process = [ [ root_folder_id, 0, "" ] ] # [folder_id, depth, path]
    start_time = Time.now
    timed_out = false

    while folders_to_process.any?
      # Check if we've exceeded the time limit
      if Time.now - start_time > max_time
        Rails.logger.warn("[JobDocumentMigration] Recursive listing timed out after #{max_time}s with #{files.length} files found, #{folders_to_process.length} folders remaining")
        timed_out = true
        break
      end

      current_id, depth, current_path = folders_to_process.shift

      begin
        url = "/drives/#{@credential.drive_id}/items/#{current_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$top=200"
        result = @client.get(url)

        result["value"]&.each do |item|
          if item["file"]
            files << {
              id: item["id"],
              name: item["name"],
              size: item["size"],
              web_url: item["webUrl"],
              modified: item["lastModifiedDateTime"],
              type: "file",
              folder_path: current_path
            }
          elsif item["folder"] && depth < max_depth
            folder_name = item["name"]
            new_path = current_path.empty? ? folder_name : "#{current_path}/#{folder_name}"
            folders_to_process << [ item["id"], depth + 1, new_path ]
          end
        end
      rescue MicrosoftGraphClient::APIError => e
        Rails.logger.warn("[JobDocumentMigration] Failed to list folder #{current_id}: #{e.message}")
      end
    end

    Rails.logger.info("[JobDocumentMigration] Recursive listing completed: #{files.length} files in #{(Time.now - start_time).round(2)}s#{timed_out ? ' (partial due to timeout)' : ''}")

    # Sort by folder path then name
    files.sort_by { |f| [ f[:folder_path].downcase, f[:name].downcase ] }
  end

  # Find the legacy folder matching a job (cached in instance for speed)
  def find_legacy_folder_for_job(job)
    # Use instance variable to cache source folder ID (avoid repeated path navigation)
    @source_folder_id ||= begin
      folder = find_folder_by_path(SOURCE_FOLDER_PATH)
      folder&.dig("id")
    end

    return nil unless @source_folder_id

    # Get job folders (also cache in instance)
    @job_folders ||= list_subfolders(@source_folder_id)

    # Find matching folder
    @job_folders.find { |folder| folder_matches_job?(folder["name"], job) }
  end

  # List folder contents in a single API call (files + subfolders)
  # Returns items with type: 'file' or 'folder' for navigation
  def list_folder_contents_fast(folder_id)
    items = []

    begin
      url = "/drives/#{@credential.drive_id}/items/#{folder_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$top=200"
      result = @client.get(url)

      result["value"]&.each do |item|
        items << {
          id: item["id"],
          name: item["name"],
          size: item["size"],
          web_url: item["webUrl"],
          modified: item["lastModifiedDateTime"],
          type: item["file"] ? "file" : "folder",
          child_count: item.dig("folder", "childCount")
        }
      end
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.warn("[JobDocumentMigration] Failed to list folder #{folder_id}: #{e.message}")
    end

    # Sort: folders first, then files
    items.sort_by { |i| [ i[:type] == "folder" ? 0 : 1, i[:name].downcase ] }
  end

  # Fast file listing - gets files with folder structure in fewer API calls
  # Uses $select to reduce payload and limits depth
  def list_files_fast(folder_id, max_depth: 2)
    files = []
    folders_to_process = [ [ folder_id, 0 ] ] # [folder_id, depth]

    while folders_to_process.any?
      current_id, depth = folders_to_process.shift

      begin
        # Get items with minimal fields for speed - include query params in URL
        url = "/drives/#{@credential.drive_id}/items/#{current_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$top=200"
        result = @client.get(url)

        result["value"]&.each do |item|
          if item["file"]
            files << {
              id: item["id"],
              name: item["name"],
              size: item["size"],
              web_url: item["webUrl"],
              modified: item["lastModifiedDateTime"]
            }
          elsif item["folder"] && depth < max_depth
            folders_to_process << [ item["id"], depth + 1 ]
          end
        end
      rescue MicrosoftGraphClient::APIError => e
        Rails.logger.warn("[JobDocumentMigration] Failed to list folder #{current_id}: #{e.message}")
      end
    end

    files
  end

  # Import specific files from legacy location to a job
  # @param job [Job] The target job
  # @param file_ids [Array<String>] OneDrive file IDs to import
  # @return [Hash] Result of the import
  def import_files_to_job(job, file_ids)
    return { success: false, error: "No OneDrive credential" } unless @credential && @client

    results = { success: true, imported: [], errors: [] }

    # Ensure job has OneDrive folder - returns folder ID or nil
    job_folder_id = ensure_job_folder(job)
    return { success: false, error: "Could not find or create job folder in OneDrive" } unless job_folder_id

    file_ids.each do |file_id|
      begin
        # Get file info
        file = @client.get("/drives/#{@credential.drive_id}/items/#{file_id}")

        # Detect category based on filename
        category = detect_document_category(file["name"])

        # Get or create target folder
        target_folder_id = find_or_create_category_folder(job, category)

        # Move the file
        @client.patch("/drives/#{@credential.drive_id}/items/#{file_id}", {
          parentReference: { id: target_folder_id }
        })

        results[:imported] << {
          file_id: file_id,
          name: file["name"],
          category: category
        }
      rescue StandardError => e
        results[:errors] << { file_id: file_id, error: e.message }
        results[:success] = false if results[:errors].count > results[:imported].count
      end
    end

    results
  end

  private

  # Find a folder by path (e.g., "Old House Data/00 Active")
  def find_folder_by_path(path)
    parts = path.split("/")
    current_folder_id = nil

    parts.each do |part|
      parent_path = current_folder_id ? "/drives/#{@credential.drive_id}/items/#{current_folder_id}/children" : "/drives/#{@credential.drive_id}/root/children"

      result = @client.get(parent_path)
      folder = result["value"]&.find { |item| item["name"] == part && item["folder"].present? }

      return nil unless folder

      current_folder_id = folder["id"]
    end

    @client.get("/drives/#{@credential.drive_id}/items/#{current_folder_id}")
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("Failed to find folder path '#{path}': #{e.message}")
    nil
  end

  # List subfolders in a folder
  def list_subfolders(folder_id)
    result = @client.get("/drives/#{@credential.drive_id}/items/#{folder_id}/children")
    result["value"]&.select { |item| item["folder"].present? } || []
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("Failed to list subfolders: #{e.message}")
    []
  end

  # Match a folder name to a Job
  def match_folder_to_job(folder_name)
    # Clean up folder name for matching
    normalized = normalize_folder_name(folder_name)

    # 1. Try exact match on title
    job = Job.find_by("LOWER(title) = ?", normalized.downcase)
    return job if job

    # 2. Try match on job ID if folder starts with a number
    if folder_name =~ /^(\d+)\s*[-_]/
      job_id = $1.to_i
      job = Job.find_by(id: job_id)
      return job if job
    end

    # 3. Try fuzzy match on address components (Lot, Street, Suburb)
    # Extract key components from folder name
    address_parts = extract_address_parts(folder_name)

    if address_parts[:lot] || address_parts[:street]
      conditions = []
      params = []

      if address_parts[:lot]
        conditions << "title ILIKE ?"
        params << "%#{address_parts[:lot]}%"
      end

      if address_parts[:street]
        conditions << "title ILIKE ?"
        params << "%#{address_parts[:street]}%"
      end

      if conditions.any?
        job = Job.where(conditions.join(" AND "), *params).first
        return job if job
      end
    end

    # 4. Try contains match (folder name within job title or vice versa)
    job = Job.where("LOWER(title) LIKE ?", "%#{normalized.downcase}%").first
    return job if job

    # 5. Try job title within folder name
    Job.find_each do |j|
      if folder_name.downcase.include?(j.title.downcase.split(",").first) ||
         j.title.downcase.include?(folder_name.downcase)
        return j
      end
    end

    nil
  end

  # Check if a folder name matches a specific job
  def folder_matches_job?(folder_name, job)
    normalized = normalize_folder_name(folder_name)
    job_title_normalized = normalize_folder_name(job.title)

    # Check various match conditions
    return true if job_title_normalized.downcase == normalized.downcase
    return true if job_title_normalized.downcase.include?(normalized.downcase)
    return true if normalized.downcase.include?(job_title_normalized.downcase)

    # Extract key address from folder (remove leading number like "94 - ")
    folder_address = normalized.sub(/^\d+\s*[-_]\s*/, "").strip
    job_address = job_title_normalized.sub(/\s*(qld|nsw|vic|sa|wa|tas|nt|act)\s*$/i, "").strip

    # Check if addresses match (ignoring state suffix and case)
    return true if folder_address.downcase == job_address.downcase
    return true if folder_address.downcase.gsub(/[,\s]+/, " ").strip == job_address.downcase.gsub(/[,\s]+/, " ").strip

    # Check for significant overlap (street name + number match)
    folder_words = folder_address.downcase.split(/[\s,]+/).reject { |w| w.length < 3 }
    job_words = job_address.downcase.split(/[\s,]+/).reject { |w| w.length < 3 }
    common_words = folder_words & job_words
    return true if common_words.length >= 2

    # Check address components
    address_parts = extract_address_parts(folder_name)
    if address_parts[:lot] && job.title.downcase.include?(address_parts[:lot].downcase)
      return true
    end

    if address_parts[:street] && job.title.downcase.include?(address_parts[:street].downcase)
      return true
    end

    false
  end

  # Normalize folder name for matching
  def normalize_folder_name(name)
    name.gsub(/[_-]+/, " ")
        .gsub(/\s+/, " ")
        .strip
  end

  # Extract address components from a folder name
  # Returns hash with :lot, :street, :suburb
  def extract_address_parts(name)
    parts = {}

    # Match "Lot X" or "Lot X (Y)"
    if name =~ /lot\s*(\d+)/i
      parts[:lot] = "Lot #{$1}"
    end

    # Match street number and name
    if name =~ /(\d+)\s+([A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres))/i
      parts[:street] = "#{$1} #{$2}"
    end

    # Match suburb (usually last word or in caps)
    words = name.split(/[,\s]+/)
    potential_suburb = words.select { |w| w =~ /^[A-Z]{3,}$/ || w =~ /QLD|NSW|VIC|SA|WA|TAS|NT|ACT/i }.first
    parts[:suburb] = potential_suburb if potential_suburb

    parts
  end

  # Migrate all files from a folder to a job
  def migrate_folder_to_job(source_folder, job, dry_run:)
    # Get all files recursively
    files = list_files_recursive(source_folder["id"])
    @stats[:files_found] += files.count

    puts "  Found #{files.count} files"

    return if files.empty?

    # Ensure job has OneDrive folder (only if not dry run)
    ensure_job_folder(job) unless dry_run

    files.each do |file|
      category = detect_document_category(file[:name])

      if dry_run
        puts "    WOULD MOVE: #{file[:name]} -> #{category}/"
      else
        begin
          target_folder_id = find_or_create_category_folder(job, category)

          @client.patch("/drives/#{@credential.drive_id}/items/#{file[:id]}", {
            parentReference: { id: target_folder_id }
          })

          @stats[:files_moved] += 1
          puts "    MOVED: #{file[:name]} -> #{category}/"
        rescue StandardError => e
          @stats[:errors] << { file: file[:name], error: e.message }
          puts "    ERROR: #{file[:name]} - #{e.message}"
        end
      end
    end
  end

  # List all files in a folder recursively
  def list_files_recursive(folder_id, depth = 0)
    return [] if depth > 5 # Prevent infinite recursion

    files = []

    begin
      result = @client.get("/drives/#{@credential.drive_id}/items/#{folder_id}/children")

      result["value"]&.each do |item|
        if item["file"]
          files << {
            id: item["id"],
            name: item["name"],
            size: item["size"],
            web_url: item["webUrl"],
            modified: item["lastModifiedDateTime"]
          }
        elsif item["folder"]
          # Recurse into subfolder
          files.concat(list_files_recursive(item["id"], depth + 1))
        end
      end
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.error("Failed to list files in folder #{folder_id}: #{e.message}")
    end

    files
  end

  # Ensure job has a OneDrive folder and return its ID
  # Uses MicrosoftGraphClient.find_job_folder instead of storing ID on job model
  def ensure_job_folder(job)
    # First check if job folder already exists
    existing_folder = @client.find_job_folder(job)
    return existing_folder["id"] if existing_folder

    # Create folder structure for job
    # SSoT: Use centralized SharePoint path sanitization
    job_folder_name = SharePoint::FilenameSanitizer.sanitize_path_segment(job.title)
    root_folder = get_or_create_jobs_root_folder

    folder = @client.post("/drives/#{@credential.drive_id}/items/#{root_folder['id']}/children", {
      name: job_folder_name,
      folder: {},
      '@microsoft.graph.conflictBehavior': "rename"
    })

    # Mark job as having folders created
    job.update(storage_folder_status: "completed")

    folder["id"]
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("Failed to create job folder: #{e.message}")
    nil
  end

  # Get or create the root folder for job documents
  def get_or_create_jobs_root_folder
    root_folder_name = CorporateCompanySetting.job_documents_base_path

    result = @client.get("/drives/#{@credential.drive_id}/root/children")
    folder = result["value"]&.find { |item| item["name"] == root_folder_name && item["folder"].present? }

    return folder if folder

    @client.post("/drives/#{@credential.drive_id}/root/children", {
      name: root_folder_name,
      folder: {},
      '@microsoft.graph.conflictBehavior': "fail"
    })
  rescue MicrosoftGraphClient::APIError => e
    # If folder exists, try to get it
    result = @client.get("/drives/#{@credential.drive_id}/root/children")
    result["value"]&.find { |item| item["name"] == root_folder_name }
  end

  # Detect document category from filename
  def detect_document_category(filename)
    filename_lower = filename.downcase

    # Contract/Sales documents
    return "Sales" if filename_lower.include?("contract") || filename_lower.include?("agreement")
    return "Sales" if filename_lower.include?("variation") || filename_lower.include?("vo")
    return "Sales" if filename_lower.include?("quote") || filename_lower.include?("proposal")

    # Site documents
    return "Site" if filename_lower.include?("site") || filename_lower.include?("inspection")
    return "Site" if filename_lower.include?("soil") || filename_lower.include?("survey")

    # Plans
    return "Plan" if filename_lower.include?("plan") || filename_lower.include?("drawing")
    return "Plan" if filename_lower.include?("blueprint") || filename_lower.include?("cad")

    # Precon documents
    return "Precon" if filename_lower.include?("engineer") || filename_lower.include?("structural")
    return "Precon" if filename_lower.include?("approval") || filename_lower.include?("permit")
    return "Precon" if filename_lower.include?("certif") # Certificate/Certification

    # Photos
    return "Photo" if filename_lower.include?("photo") || filename_lower.include?("image")
    return "Photo" if filename_lower =~ /\.(jpg|jpeg|png|gif|heic|heif)$/i

    # Final Certificate
    return "Final Certificate" if filename_lower.include?("final") || filename_lower.include?("completion")
    return "Final Certificate" if filename_lower.include?("occupancy") || filename_lower.include?("ccc")

    # Client documents
    return "Client" if filename_lower.include?("client") || filename_lower.include?("customer")

    # Default to General/Site
    "Site"
  end

  # Find or create a category subfolder within job folder
  def find_or_create_category_folder(job, category)
    # First get the job's OneDrive folder
    job_folder = @client.find_job_folder(job)
    return nil unless job_folder

    job_folder_id = job_folder["id"]
    return job_folder_id unless category.present?

    # Check if category folder exists
    result = @client.get("/drives/#{@credential.drive_id}/items/#{job_folder_id}/children")
    existing = result["value"]&.find { |item| item["name"].downcase == category.downcase && item["folder"].present? }

    return existing["id"] if existing

    # Create the folder
    folder = @client.post("/drives/#{@credential.drive_id}/items/#{job_folder_id}/children", {
      name: category,
      folder: {},
      '@microsoft.graph.conflictBehavior': "rename"
    })

    folder["id"]
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("Failed to create category folder #{category}: #{e.message}")
    job_folder_id # Fall back to root job folder
  end

  # Print summary of migration
  def print_summary(dry_run)
    puts "=== Migration Summary ==="
    puts "Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
    puts ""
    puts "Folders processed: #{@stats[:folders_processed]}"
    puts "  Matched to jobs: #{@stats[:matched]}"
    puts "  Not matched:     #{@stats[:unmatched]}"
    puts ""
    puts "Files found:  #{@stats[:files_found]}"
    puts "Files moved:  #{@stats[:files_moved]}" unless dry_run
    puts ""

    if @stats[:unmatched_folders].any?
      puts "Unmatched folders (need manual review):"
      @stats[:unmatched_folders].first(20).each { |f| puts "  - #{f}" }
      puts "  ... and #{@stats[:unmatched_folders].count - 20} more" if @stats[:unmatched_folders].count > 20
      puts ""
    end

    if @stats[:errors].any?
      puts "Errors:"
      @stats[:errors].first(10).each { |e| puts "  - #{e[:file]}: #{e[:error]}" }
      puts ""
    end

    if dry_run
      puts "This was a DRY RUN. No files were actually moved."
      puts "To execute the migration, run with dry_run: false"
    end
  end
end
