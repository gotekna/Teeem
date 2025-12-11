# Service to sync pricebook photos from SharePoint to pricebook items
# Matches photos by filename to item names/codes and updates image_url

class PricebookPhotoSyncService
  SHAREPOINT_FOLDER_PATH = "Warehousing/Pricebook Photos"

  class SyncError < StandardError; end

  def initialize
    @client = MicrosoftAppGraphClient.new
    @stats = {
      total_photos: 0,
      matched: 0,
      unmatched: 0,
      updated: 0,
      errors: 0,
      matches: []
    }
  end

  # Main sync method
  def sync_photos(dry_run: false)
    Rails.logger.info "[PricebookPhotoSync] Starting photo sync (dry_run: #{dry_run})"

    # Get SharePoint site and drive
    sites = @client.get_all_sites
    teeem_site = sites.find { |s| s[:display_name]&.include?('TEEEM') || s[:name]&.include?('teeem') }
    raise SyncError, "TEEEM site not found" unless teeem_site

    drives = @client.get_site_drives(teeem_site[:id])
    main_drive = drives.first
    raise SyncError, "No drive found in TEEEM site" unless main_drive

    # Get warehousing folder
    root_items = @client.list_drive_items(main_drive[:id])
    warehousing = root_items.find { |item| item[:is_folder] && item[:name]&.downcase&.include?('warehous') }
    raise SyncError, "Warehousing folder not found" unless warehousing

    # Get pricebook photos folder
    warehousing_contents = @client.list_drive_items(main_drive[:id], folder_id: warehousing[:id])
    pricebook_folder = warehousing_contents.find { |item| item[:is_folder] && item[:name]&.downcase&.include?('pricebook') }
    raise SyncError, "Pricebook Photos folder not found" unless pricebook_folder

    # Get all photos (fetch up to 500)
    photos = @client.list_drive_items(main_drive[:id], folder_id: pricebook_folder[:id], top: 500)
    @stats[:total_photos] = photos.size

    Rails.logger.info "[PricebookPhotoSync] Found #{photos.size} photos in SharePoint"

    # Load all active pricebook items into memory for faster matching
    pricebook_items = PricebookItem.active.index_by(&:item_code)

    # Match and update
    photos.each do |photo|
      next if photo[:is_folder]

      begin
        match_result = match_photo_to_item(photo, pricebook_items)

        if match_result[:matched]
          @stats[:matched] += 1
          @stats[:matches] << match_result

          unless dry_run
            item = match_result[:item]
            item.update!(
              image_url: photo[:web_url],
              image_source: "sharepoint",
              image_fetched_at: Time.current,
              image_fetch_status: "success"
            )
            @stats[:updated] += 1
          end
        else
          @stats[:unmatched] += 1
        end
      rescue StandardError => e
        @stats[:errors] += 1
        Rails.logger.error "[PricebookPhotoSync] Error processing #{photo[:name]}: #{e.message}"
      end
    end

    log_summary(dry_run)
    @stats
  end

  # Match a photo to a pricebook item
  # Tries multiple matching strategies:
  # 1. Exact item_code match (e.g., "AIRSI25.png" → item_code: "AIRSI25")
  # 2. Fuzzy item_name match (e.g., "Bosch 60cm Oven.png" → item_name contains "Bosch 60cm Oven")
  # 3. Brand + category match (e.g., "Alder Basin Mixer.png" → brand: "Alder", category contains "Basin")
  def match_photo_to_item(photo, pricebook_items)
    filename = photo[:name]
    # Remove file extension
    name_without_ext = filename.gsub(/\.(png|jpg|jpeg|gif|webp)$/i, '')

    # Strategy 1: Try exact item_code match
    item = pricebook_items[name_without_ext]
    if item
      return {
        matched: true,
        item: item,
        photo: photo,
        match_strategy: "exact_code",
        confidence: "high"
      }
    end

    # Strategy 2: Try fuzzy item_name match
    # Look for items where the filename contains significant words from the item name
    name_words = normalize_name(name_without_ext)

    pricebook_items.each do |code, item|
      item_name_normalized = normalize_name(item.item_name)

      # Calculate similarity score
      similarity = calculate_similarity(name_words, item_name_normalized)

      if similarity > 0.7  # 70% match threshold
        return {
          matched: true,
          item: item,
          photo: photo,
          match_strategy: "fuzzy_name",
          confidence: similarity > 0.85 ? "high" : "medium",
          similarity: similarity
        }
      end
    end

    # Strategy 3: Brand + category partial match
    # Extract potential brand from filename (first word)
    potential_brand = name_without_ext.split(/[\s_-]/).first

    if potential_brand && potential_brand.length > 3
      matching_brand_items = pricebook_items.values.select do |item|
        item.brand&.downcase&.include?(potential_brand.downcase)
      end

      if matching_brand_items.size == 1
        return {
          matched: true,
          item: matching_brand_items.first,
          photo: photo,
          match_strategy: "brand_match",
          confidence: "low"
        }
      end
    end

    # No match found
    {
      matched: false,
      photo: photo,
      filename: filename
    }
  end

  private

  # Normalize name for comparison
  # - Convert to lowercase
  # - Remove special characters
  # - Remove common words (the, with, for, etc.)
  # - Split into words
  def normalize_name(name)
    name
      .downcase
      .gsub(/[^\w\s-]/, ' ')  # Replace special chars with space
      .split(/[\s_-]+/)       # Split on whitespace, underscore, dash
      .reject { |w| w.length < 3 }  # Remove short words
      .reject { |w| %w[the with for and from].include?(w) }  # Remove common words
  end

  # Calculate Jaccard similarity between two sets of words
  def calculate_similarity(words1, words2)
    return 0.0 if words1.empty? || words2.empty?

    set1 = words1.to_set
    set2 = words2.to_set

    intersection = (set1 & set2).size.to_f
    union = (set1 | set2).size.to_f

    return 0.0 if union.zero?

    intersection / union
  end

  def log_summary(dry_run)
    Rails.logger.info "[PricebookPhotoSync] ========== SYNC SUMMARY =========="
    Rails.logger.info "[PricebookPhotoSync] Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
    Rails.logger.info "[PricebookPhotoSync] Total photos: #{@stats[:total_photos]}"
    Rails.logger.info "[PricebookPhotoSync] Matched: #{@stats[:matched]}"
    Rails.logger.info "[PricebookPhotoSync] Unmatched: #{@stats[:unmatched]}"
    Rails.logger.info "[PricebookPhotoSync] Updated: #{@stats[:updated]}" unless dry_run
    Rails.logger.info "[PricebookPhotoSync] Errors: #{@stats[:errors]}"
    Rails.logger.info "[PricebookPhotoSync] Match rate: #{(@stats[:matched].to_f / @stats[:total_photos] * 100).round(1)}%"
    Rails.logger.info "[PricebookPhotoSync] ================================="
  end
end