# Service to sync pricebook photos and QR codes from SharePoint to pricebook items
# Matches photos and QR codes by filename to item names/codes and updates image_url and qr_code_url

class PricebookPhotoSyncService
  # SSoT: Folder path from WarehouseProvider, fallback to default
  def self.folder_path
    WarehouseProvider.instance.path_for(:pricebook_photos)
  end

  class SyncError < StandardError; end

  def initialize
    @client = MicrosoftAppGraphClient.new
    @stats = {
      total_files: 0,
      total_photos: 0,
      total_qr_codes: 0,
      photos_matched: 0,
      photos_unmatched: 0,
      photos_updated: 0,
      qr_matched: 0,
      qr_unmatched: 0,
      qr_updated: 0,
      errors: 0,
      matches: []
    }
  end

  # Main sync method
  def sync_photos(dry_run: false)
    Rails.logger.info "[PricebookPhotoSync] Starting photo and QR code sync (dry_run: #{dry_run})"

    # Get SharePoint site and drive
    sites = @client.get_all_sites
    teeem_site = sites.find { |s| s[:display_name]&.include?("TEEEM") || s[:name]&.include?("teeem") }
    raise SyncError, "TEEEM site not found" unless teeem_site

    drives = @client.get_site_drives(teeem_site[:id])
    main_drive = drives.first
    raise SyncError, "No drive found in TEEEM site" unless main_drive

    # Get warehousing folder
    root_items = @client.list_drive_items(main_drive[:id])
    warehousing = root_items.find { |item| item[:is_folder] && item[:name]&.downcase&.include?("warehous") }
    raise SyncError, "Warehousing folder not found" unless warehousing

    # Get pricebook photos folder
    warehousing_contents = @client.list_drive_items(main_drive[:id], folder_id: warehousing[:id])
    pricebook_folder = warehousing_contents.find { |item| item[:is_folder] && item[:name]&.downcase&.include?("pricebook") }
    raise SyncError, "Pricebook Photos folder not found" unless pricebook_folder

    # Get all files (fetch up to 500)
    all_files = @client.list_drive_items(main_drive[:id], folder_id: pricebook_folder[:id], top: 500)
    @stats[:total_files] = all_files.size

    # Separate photos and QR codes
    photos = []
    qr_codes = []

    all_files.each do |file|
      next if file[:is_folder]

      if qr_code_file?(file[:name])
        qr_codes << file
      else
        photos << file
      end
    end

    @stats[:total_photos] = photos.size
    @stats[:total_qr_codes] = qr_codes.size

    Rails.logger.info "[PricebookPhotoSync] Found #{photos.size} photos and #{qr_codes.size} QR codes in SharePoint"

    # Load all active pricebook items into memory for faster matching
    pricebook_items = PricebookItem.active.index_by(&:item_code)

    # Process photos
    photos.each do |photo|
      begin
        match_result = match_photo_to_item(photo, pricebook_items)

        if match_result[:matched]
          @stats[:photos_matched] += 1
          @stats[:matches] << match_result.merge(file_type: "photo")

          unless dry_run
            item = match_result[:item]
            item.update!(
              image_url: photo[:web_url],
              image_file_id: photo[:id],
              image_source: "sharepoint",
              image_fetched_at: Time.current,
              image_fetch_status: "success"
            )
            @stats[:photos_updated] += 1
          end
        else
          @stats[:photos_unmatched] += 1
        end
      rescue StandardError => e
        @stats[:errors] += 1
        Rails.logger.error "[PricebookPhotoSync] Error processing photo #{photo[:name]}: #{e.message}"
      end
    end

    # Process QR codes
    qr_codes.each do |qr_code|
      begin
        match_result = match_qr_code_to_item(qr_code, pricebook_items)

        if match_result[:matched]
          @stats[:qr_matched] += 1
          @stats[:matches] << match_result.merge(file_type: "qr_code")

          unless dry_run
            item = match_result[:item]
            item.update!(
              qr_code_url: qr_code[:web_url],
              qr_code_file_id: qr_code[:id]
            )
            @stats[:qr_updated] += 1
          end
        else
          @stats[:qr_unmatched] += 1
        end
      rescue StandardError => e
        @stats[:errors] += 1
        Rails.logger.error "[PricebookPhotoSync] Error processing QR code #{qr_code[:name]}: #{e.message}"
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
    name_without_ext = filename.gsub(/\.(png|jpg|jpeg|gif|webp)$/i, "")

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

  # Match a QR code to a pricebook item
  # QR code filenames typically contain "QR" or "qr" along with the item code
  # Examples: "ITEMCODE QR.png", "ITEMCODE_QR.png", "QR_ITEMCODE.png", "ITEMCODE-QR-Code.png"
  def match_qr_code_to_item(qr_code, pricebook_items)
    filename = qr_code[:name]

    # Remove file extension and QR-related keywords
    clean_name = filename
      .gsub(/\.(png|jpg|jpeg|gif|webp)$/i, "")
      .gsub(/\b(qr|code)\b/i, "")  # Remove "QR" and "Code" words
      .gsub(/[-_\s]+/, " ")         # Normalize separators to spaces
      .strip

    # Strategy 1: Try exact item_code match on cleaned name
    item = pricebook_items[clean_name]
    if item
      return {
        matched: true,
        item: item,
        file: qr_code,
        match_strategy: "exact_code_from_qr",
        confidence: "high"
      }
    end

    # Strategy 2: Try matching against each item code by removing spaces/dashes
    normalized_clean_name = clean_name.gsub(/[\s_-]/, "").upcase

    pricebook_items.each do |code, item|
      normalized_code = code.gsub(/[\s_-]/, "").upcase

      if normalized_clean_name == normalized_code
        return {
          matched: true,
          item: item,
          file: qr_code,
          match_strategy: "normalized_code_from_qr",
          confidence: "high"
        }
      end
    end

    # Strategy 3: Try fuzzy match on remaining text (similar to photo matching)
    name_words = normalize_name(clean_name)

    pricebook_items.each do |code, item|
      item_name_normalized = normalize_name(item.item_name)

      similarity = calculate_similarity(name_words, item_name_normalized)

      if similarity > 0.7
        return {
          matched: true,
          item: item,
          file: qr_code,
          match_strategy: "fuzzy_name_from_qr",
          confidence: similarity > 0.85 ? "medium" : "low",
          similarity: similarity
        }
      end
    end

    # No match found
    {
      matched: false,
      file: qr_code,
      filename: filename
    }
  end

  private

  # Detect if a file is a QR code based on filename
  # Patterns: "qrcode_supplier.com.png", "ITEMCODE QR.png", "QR_ITEMCODE.png", etc.
  def qr_code_file?(filename)
    filename.match?(/^qrcode_/i) || filename.match?(/\bqr\b/i)
  end

  # Normalize name for comparison
  # - Convert to lowercase
  # - Remove special characters
  # - Remove common words (the, with, for, etc.)
  # - Split into words
  def normalize_name(name)
    name
      .downcase
      .gsub(/[^\w\s-]/, " ")  # Replace special chars with space
      .split(/[\s_-]+/)       # Split on whitespace, underscore, dash
      .reject { |w| w.length < 3 }  # Remove short words
      .reject { |w| %w[the with for and from qr code].include?(w) }  # Remove common words and QR-related terms
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
    Rails.logger.info "[PricebookPhotoSync]"
    Rails.logger.info "[PricebookPhotoSync] PHOTOS:"
    Rails.logger.info "[PricebookPhotoSync]   Total: #{@stats[:total_photos]}"
    Rails.logger.info "[PricebookPhotoSync]   Matched: #{@stats[:photos_matched]}"
    Rails.logger.info "[PricebookPhotoSync]   Unmatched: #{@stats[:photos_unmatched]}"
    Rails.logger.info "[PricebookPhotoSync]   Updated: #{@stats[:photos_updated]}" unless dry_run
    Rails.logger.info "[PricebookPhotoSync]   Match rate: #{(@stats[:photos_matched].to_f / @stats[:total_photos] * 100).round(1)}%" if @stats[:total_photos] > 0
    Rails.logger.info "[PricebookPhotoSync]"
    Rails.logger.info "[PricebookPhotoSync] QR CODES:"
    Rails.logger.info "[PricebookPhotoSync]   Total: #{@stats[:total_qr_codes]}"
    Rails.logger.info "[PricebookPhotoSync]   Matched: #{@stats[:qr_matched]}"
    Rails.logger.info "[PricebookPhotoSync]   Unmatched: #{@stats[:qr_unmatched]}"
    Rails.logger.info "[PricebookPhotoSync]   Updated: #{@stats[:qr_updated]}" unless dry_run
    Rails.logger.info "[PricebookPhotoSync]   Match rate: #{(@stats[:qr_matched].to_f / @stats[:total_qr_codes] * 100).round(1)}%" if @stats[:total_qr_codes] > 0
    Rails.logger.info "[PricebookPhotoSync]"
    Rails.logger.info "[PricebookPhotoSync] OVERALL:"
    Rails.logger.info "[PricebookPhotoSync]   Total files: #{@stats[:total_files]}"
    Rails.logger.info "[PricebookPhotoSync]   Errors: #{@stats[:errors]}"
    Rails.logger.info "[PricebookPhotoSync] ================================="
  end
end
