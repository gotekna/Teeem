class OnedrivePricebookSyncService
  attr_reader :credential, :folder_path, :results

  def initialize(credential, folder_path = nil)
    @credential = credential
    @folder_path = folder_path || "00 - TEEEM/Photos for Price Book"
    @results = {
      matched: 0,
      photos_matched: 0,
      specs_matched: 0,
      qr_codes_matched: 0,
      unmatched_files: [],
      unmatched_items: [],
      errors: []
    }
  end

  def preview_matches
    # Get OneDrive client
    client = get_onedrive_client
    return { success: false, error: "OneDrive not connected" } unless client

    # Find the folder
    folder = find_or_create_folder(client, @folder_path)
    return { success: false, error: "Could not access folder: #{@folder_path}" } unless folder

    # Get all files in the folder
    files = list_folder_files(client, folder["id"])
    Rails.logger.info "Found #{files.count} files in folder '#{@folder_path}'"

    # Get all active pricebook items
    items = PricebookItem.active
    Rails.logger.info "Found #{items.count} active pricebook items"

    # Build items lookup hash
    items_by_name = {}
    items.each do |item|
      normalized = normalize_name(item.item_name)
      items_by_name[normalized] ||= []
      items_by_name[normalized] << item
    end

    # Preview matches without updating anything (EXACT MATCHES ONLY for speed)
    # Fuzzy matching is too slow for 630 files × 5,285 items
    # We'll only do fuzzy matching during actual sync if needed
    matches = []
    files.each do |file|
      filename_without_ext = File.basename(file["name"], ".*")
      normalized_filename = normalize_name(filename_without_ext)

      # Only try exact match (instant lookup in hash)
      matching_items = items_by_name[normalized_filename]

      similarity = matching_items && matching_items.any? ? 100 : 0
      match_type = matching_items && matching_items.any? ? "exact" : "no_match"

      # Determine file type
      file_type = if is_qr_code_file?(file["name"])
        "qr_code"
      elsif is_spec_file?(file["name"]) || is_spec_file_by_name?(file["name"])
        "spec"
      else
        "photo"
      end

      if matching_items && matching_items.any?
        matching_items.each do |item|
          matches << {
            file_id: file["id"],
            filename: file["name"],
            file_type: file_type,
            item_id: item.id,
            item_code: item.item_code,
            item_name: item.item_name,
            similarity: similarity,
            match_type: match_type
          }
        end
      else
        matches << {
          file_id: file["id"],
          filename: file["name"],
          file_type: file_type,
          item_id: nil,
          item_code: nil,
          item_name: nil,
          similarity: 0,
          match_type: "no_match"
        }
      end
    end

    {
      success: true,
      matches: matches,
      total_files: files.count,
      total_items: items.count
    }
  rescue => e
    Rails.logger.error "OneDrive preview error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    {
      success: false,
      error: e.message
    }
  end

  def apply_matches(accepted_matches)
    # Get OneDrive client
    client = get_onedrive_client
    return { success: false, error: "OneDrive not connected" } unless client

    # Find the folder
    folder = find_or_create_folder(client, @folder_path)
    return { success: false, error: "Could not access folder: #{@folder_path}" } unless folder

    # Get all files in the folder
    files_response = list_folder_files(client, folder["id"])
    files_by_id = files_response.index_by { |f| f["id"] }

    # Collect updates to perform in batch
    updates_to_perform = []

    accepted_matches.each do |match|
      file_id = match["file_id"]
      item_id = match["item_id"]

      next unless file_id && item_id

      file = files_by_id[file_id]
      item = PricebookItem.find_by(id: item_id)

      next unless file && item

      # Prepare update data
      update_data = prepare_item_update(client, item, file)
      updates_to_perform << update_data if update_data
    end

    # Perform all updates in batch
    perform_batch_updates(updates_to_perform)

    {
      success: true,
      matched: @results[:matched],
      photos_matched: @results[:photos_matched],
      specs_matched: @results[:specs_matched],
      qr_codes_matched: @results[:qr_codes_matched],
      errors: @results[:errors]
    }
  rescue => e
    Rails.logger.error "OneDrive apply matches error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    {
      success: false,
      error: e.message
    }
  end

  def sync
    # Get OneDrive client
    client = get_onedrive_client
    return { success: false, error: "OneDrive not connected" } unless client

    # Find or create the folder
    folder = find_or_create_folder(client, @folder_path)
    return { success: false, error: "Could not access folder: #{@folder_path}" } unless folder

    # Get all files in the folder
    files = list_folder_files(client, folder["id"])
    Rails.logger.info "Found #{files.count} files in folder '#{@folder_path}'"
    Rails.logger.info "First 10 files: #{files.first(10).map { |f| f['name'] }.join(', ')}" if files.any?

    # Get all active pricebook items
    items = PricebookItem.active
    Rails.logger.info "Found #{items.count} active pricebook items"
    Rails.logger.info "First 10 items: #{items.first(10).map(&:item_name).join(', ')}" if items.any?

    # Match files to items by name
    match_files_to_items(client, files, items)

    {
      success: true,
      matched: @results[:matched],
      photos_matched: @results[:photos_matched],
      specs_matched: @results[:specs_matched],
      qr_codes_matched: @results[:qr_codes_matched],
      unmatched_files: @results[:unmatched_files],
      unmatched_items: @results[:unmatched_items],
      errors: @results[:errors]
    }
  rescue => e
    Rails.logger.error "OneDrive sync error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    {
      success: false,
      error: e.message
    }
  end

  private

  def get_onedrive_client
    return nil unless @credential

    MicrosoftGraphClient.new(@credential)
  end

  def find_or_create_folder(client, folder_path)
    # Handle nested folder paths like "00 - TEEEM/Photos for Price Book"
    path_parts = folder_path.split("/")
    current_parent_path = "/me/drive/root"
    current_folder = nil

    path_parts.each do |folder_name|
      # Get children of current parent
      response = client.get("#{current_parent_path}/children")
      folders = response["value"] || []

      # Find folder in current level
      folder = folders.find { |f| f["name"] == folder_name && f["folder"] }

      if folder
        current_folder = folder
        current_parent_path = "/me/drive/items/#{folder['id']}"
      else
        # Create folder if it doesn't exist
        response = client.post("#{current_parent_path}/children", {
          name: folder_name,
          folder: {},
          "@microsoft.graph.conflictBehavior" => "fail"
        })
        current_folder = response
        current_parent_path = "/me/drive/items/#{response['id']}"
      end
    end

    current_folder
  rescue => e
    Rails.logger.error "Error finding/creating folder: #{e.message}"
    nil
  end

  def list_folder_files(client, folder_id)
    all_files = []
    # Request @microsoft.graph.downloadUrl explicitly via $select parameter
    # Without this, the API returns webUrl (sharing link) instead of direct download URL
    next_link = "/me/drive/items/#{folder_id}/children?$select=id,name,file,@microsoft.graph.downloadUrl"

    # Follow pagination to get all files
    while next_link
      response = client.get(next_link)
      files = response["value"] || []
      all_files.concat(files)

      # Check for next page
      next_link = response["@odata.nextLink"]
      # If nextLink is a full URL, extract the path and remove /v1.0 prefix
      if next_link && next_link.start_with?("https://")
        next_link = URI.parse(next_link).request_uri
        # Remove /v1.0 prefix since client.get will add it via GRAPH_API_BASE
        next_link = next_link.sub(%r{^/v1\.0}, "")
      end
    end

    Rails.logger.info "Retrieved #{all_files.length} total files from OneDrive"

    # Filter for image and document files (specs)
    all_files.select { |f| f["file"] && (is_image_file?(f["name"]) || is_spec_file?(f["name"])) }
  end

  def is_image_file?(filename)
    extensions = %w[.jpg .jpeg .png .gif .bmp .webp]
    extensions.any? { |ext| filename.downcase.end_with?(ext) }
  end

  def is_spec_file?(filename)
    extensions = %w[.pdf .doc .docx]
    extensions.any? { |ext| filename.downcase.end_with?(ext) }
  end

  def is_qr_code_file?(filename)
    filename.downcase.include?("qr") || filename.downcase.include?("qrcode")
  end

  def is_spec_file_by_name?(filename)
    spec_keywords = %w[spec specification datasheet data_sheet manual]
    spec_keywords.any? { |keyword| filename.downcase.include?(keyword) }
  end

  def match_files_to_items(client, files, items)
    # Create a hash of items by normalized name for exact lookup
    items_by_name = {}
    items.each do |item|
      normalized = normalize_name(item.item_name)
      items_by_name[normalized] ||= []
      items_by_name[normalized] << item
    end

    Rails.logger.info "Created lookup hash with #{items_by_name.keys.count} unique normalized names"

    # Track which items were matched
    matched_items = Set.new

    # Collect all updates to perform in batch
    updates_to_perform = []

    # Match each file to an item
    files.each_with_index do |file, index|
      filename_without_ext = File.basename(file["name"], ".*")
      normalized_filename = normalize_name(filename_without_ext)

      if index < 5
        Rails.logger.info "Processing file #{index + 1}: '#{file['name']}' -> normalized: '#{normalized_filename}'"
      end

      # Try exact match first
      matching_items = items_by_name[normalized_filename]

      # If no exact match, try fuzzy matching
      if matching_items.nil? || matching_items.empty?
        matching_items = find_fuzzy_matches(normalized_filename, items, items_by_name)
      end

      if matching_items && matching_items.any?
        matching_items.each do |item|
          # Prepare update data instead of updating immediately
          update_data = prepare_item_update(client, item, file)
          updates_to_perform << update_data if update_data
          matched_items.add(item.id)
        end
      else
        @results[:unmatched_files] << file["name"]
      end
    end

    # Perform all updates in batch
    perform_batch_updates(updates_to_perform)

    # Track items that weren't matched
    items.each do |item|
      unless matched_items.include?(item.id)
        @results[:unmatched_items] << {
          id: item.id,
          name: item.item_name,
          code: item.item_code
        }
      end
    end
  end

  # Optimized fuzzy matching that reuses a pre-created fuzzy matcher
  # This avoids creating a new FuzzyMatch object for each file (HUGE performance gain)
  def find_fuzzy_matches_optimized(filename, items_by_name, fuzzy_matcher)
    # Find best fuzzy match using the pre-created matcher
    best_match = fuzzy_matcher.find(filename, must_match_at_least_one_word: true)

    if best_match
      # Calculate similarity score
      similarity = calculate_similarity(filename, best_match)

      # Only accept matches with 70% or higher similarity
      if similarity >= 0.70
        Rails.logger.info "Fuzzy matched '#{filename}' to '#{best_match}' (#{(similarity * 100).round}% similar)"
        return items_by_name[best_match]
      end
    end

    nil
  end

  # Original fuzzy matching method (kept for backward compatibility with sync method)
  def find_fuzzy_matches(filename, items, items_by_name)
    # Use fuzzy matching with 80% similarity threshold
    # This handles typos, extra spaces, and minor differences
    require "fuzzy_match"

    # Get all item names
    item_names = items_by_name.keys

    # Find best fuzzy match
    fuzzy_matcher = FuzzyMatch.new(item_names, read: ->(name) { name })
    best_match = fuzzy_matcher.find(filename, must_match_at_least_one_word: true)

    if best_match
      # Calculate similarity score
      similarity = calculate_similarity(filename, best_match)

      # Only accept matches with 70% or higher similarity
      if similarity >= 0.70
        Rails.logger.info "Fuzzy matched '#{filename}' to '#{best_match}' (#{(similarity * 100).round}% similar)"
        return items_by_name[best_match]
      end
    end

    nil
  end

  def calculate_similarity(str1, str2)
    # Levenshtein distance based similarity
    longer = [ str1.length, str2.length ].max
    return 1.0 if longer == 0

    distance = levenshtein_distance(str1, str2)
    (longer - distance).to_f / longer
  end

  def levenshtein_distance(str1, str2)
    # Classic Levenshtein distance algorithm
    n = str1.length
    m = str2.length
    return m if n == 0
    return n if m == 0

    d = Array.new(n + 1) { Array.new(m + 1) }

    (0..n).each { |i| d[i][0] = i }
    (0..m).each { |j| d[0][j] = j }

    (1..n).each do |i|
      (1..m).each do |j|
        cost = str1[i - 1] == str2[j - 1] ? 0 : 1
        d[i][j] = [
          d[i - 1][j] + 1,      # deletion
          d[i][j - 1] + 1,      # insertion
          d[i - 1][j - 1] + cost # substitution
        ].min
      end
    end

    d[n][m]
  end

  def prepare_item_update(client, item, file)
    # Get direct download URL from the file metadata
    # Note: @microsoft.graph.downloadUrl expires after 1 hour, but it's embeddable
    # We store the file_id so we can refresh the URL later if needed
    file_id = file["id"]
    filename = file["name"]

    # The children endpoint doesn't include @microsoft.graph.downloadUrl
    # We need to fetch it separately using the /content endpoint
    download_url = file["@microsoft.graph.downloadUrl"]
    if download_url.blank?
      # Get the download URL by fetching the file's content redirect
      download_url = "https://graph.microsoft.com/v1.0/me/drive/items/#{file_id}/content"
    end

    Rails.logger.info "Preparing update for #{filename} - File ID: #{file_id}"

    # Determine file type and prepare update data
    update_data = {
      item_id: item.id,
      item_name: item.item_name,
      item_code: item.item_code,
      filename: filename,
      image_source: "onedrive",
      image_fetched_at: Time.current,
      image_fetch_status: "success"
    }

    if is_qr_code_file?(filename)
      update_data[:qr_code_url] = download_url
      update_data[:qr_code_file_id] = file_id
      update_data[:type] = :qr_code
    elsif is_spec_file?(filename) || is_spec_file_by_name?(filename)
      update_data[:spec_url] = download_url
      update_data[:spec_file_id] = file_id
      update_data[:type] = :spec
    else
      update_data[:image_url] = download_url
      update_data[:image_file_id] = file_id
      update_data[:type] = :photo
    end

    update_data
  rescue => e
    @results[:errors] << "Error preparing update for item #{item.item_code}: #{e.message}"
    Rails.logger.error "Error preparing update for item #{item.item_code}: #{e.message}"
    nil
  end

  def perform_batch_updates(updates_to_perform)
    return if updates_to_perform.empty?

    # Group updates by item_id to handle multiple files per item
    updates_by_item = updates_to_perform.group_by { |u| u[:item_id] }

    # Wrap all updates in a transaction for atomicity
    ActiveRecord::Base.transaction do
      # Perform batch update using update_all for better performance
      updates_by_item.each do |item_id, item_updates|
        begin
          # Merge all updates for this item
          merged_update = {
            image_source: "onedrive",
            image_fetched_at: Time.current,
            image_fetch_status: "success"
          }

          item_updates.each do |update_data|
            case update_data[:type]
            when :qr_code
              merged_update[:qr_code_url] = update_data[:qr_code_url]
              merged_update[:qr_code_file_id] = update_data[:qr_code_file_id]
              merged_update[:spec_attached] = true
              @results[:qr_codes_matched] += 1
              Rails.logger.info "Matched QR code '#{update_data[:filename]}' to item '#{update_data[:item_name]}' (#{update_data[:item_code]})"
            when :spec
              merged_update[:spec_url] = update_data[:spec_url]
              merged_update[:spec_file_id] = update_data[:spec_file_id]
              merged_update[:spec_attached] = true
              @results[:specs_matched] += 1
              Rails.logger.info "Matched spec '#{update_data[:filename]}' to item '#{update_data[:item_name]}' (#{update_data[:item_code]})"
            when :photo
              merged_update[:image_url] = update_data[:image_url]
              merged_update[:image_file_id] = update_data[:image_file_id]
              merged_update[:photo_attached] = true
              @results[:photos_matched] += 1
              Rails.logger.info "Matched photo '#{update_data[:filename]}' to item '#{update_data[:item_name]}' (#{update_data[:item_code]})"
            end
          end

          # Increment matched counter once per item (not per file)
          @results[:matched] += 1

          # Perform single update for this item
          PricebookItem.where(id: item_id).update_all(merged_update)
        rescue => e
          @results[:errors] << "Error updating item #{item_id}: #{e.message}"
          Rails.logger.error "Error updating item #{item_id}: #{e.message}"
          raise # Re-raise to rollback transaction
        end
      end
    end
  end

  def normalize_name(name)
    # Remove special characters, extra spaces, and convert to lowercase
    name.to_s
      .downcase
      .gsub(/[^a-z0-9\s]/, " ")  # Replace special chars with space
      .gsub(/\s+/, " ")           # Collapse multiple spaces
      .strip
  end
end
