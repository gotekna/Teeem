# Service to fetch product images from the internet and upload to storage
# Uses Google Images + Claude AI for image search and selection
# Uploads to "Warehousing/Photo Test" folder for review
#
# SSoT: Uses StorageUploadable for provider-agnostic storage (Wasabi/S3/SharePoint)

require "httparty"
require "open-uri"
require "resolv"
require "ipaddr"
require "tempfile"
require "mini_magick"

class PricebookImageFetcherService
  include HTTParty
  include StorageUploadable

  GOOGLE_SEARCH_API_KEY = ENV["GOOGLE_SEARCH_API_KEY"]
  GOOGLE_CX = ENV["GOOGLE_CX"]
  ANTHROPIC_API_KEY = ENV["ANTHROPIC_API_KEY"]

  # SSoT: Get test folder from StorageConfiguration (falls back to pricebook path)
  def self.storage_test_folder
    StorageConfiguration.instance.path_for(:pricebook_photos)
  end

  # Maximum file size for compressed images
  MAX_FILE_SIZE = 900 * 1024  # 900 KB in bytes

  class FetchError < StandardError; end

  def initialize
    # SSoT: Uses StorageUploadable - no direct client initialization needed
  end

  # Fetch images for multiple items
  def fetch_images_for_items(items, dry_run: false)
    results = {
      total: items.count,
      success: 0,
      failed: 0,
      errors: [],
      test_folder_url: nil
    }

    # SSoT: Check storage is connected
    unless storage_connected?
      raise FetchError, "Storage not connected. Please configure storage provider."
    end

    # Ensure test folder exists
    unless dry_run
      folder_path = self.class.storage_test_folder
      get_or_create_folder_path(folder_path)
      results[:test_folder_url] = folder_path
    end

    items.each_with_index do |item, index|
      begin
        Rails.logger.info "[ImageFetcher] [#{index + 1}/#{results[:total]}] Processing: #{item.item_code}"

        result = fetch_and_upload_image_for_item(item, dry_run: dry_run)

        if result[:success]
          results[:success] += 1
        else
          results[:failed] += 1
          results[:errors] << {
            item_code: item.item_code,
            item_name: item.item_name,
            error: result[:error]
          }
        end

        # Rate limiting
        sleep 2 if index < results[:total] - 1
      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << {
          item_code: item.item_code,
          item_name: item.item_name,
          error: e.message
        }
        Rails.logger.error "[ImageFetcher] Exception for #{item.item_code}: #{e.message}"
      end
    end

    results
  end

  # Fetch and upload image for a single item
  def fetch_and_upload_image_for_item(item, dry_run: false)
    # Step 1: Search for images
    image_urls = search_google_images(item)
    return { success: false, error: "No images found" } if image_urls.empty?

    Rails.logger.info "[ImageFetcher] Found #{image_urls.length} candidate images"

    # Step 2: Use Claude AI to select best image
    best_image_url = select_best_image(item, image_urls)
    return { success: false, error: "No suitable image selected" } unless best_image_url

    Rails.logger.info "[ImageFetcher] Selected image: #{best_image_url}"

    return { success: true, image_url: best_image_url, dry_run: true } if dry_run

    # Step 3: Download image
    temp_file = download_image(best_image_url)
    return { success: false, error: "Failed to download image" } unless temp_file

    begin
      # Step 4: Compress image to be under 900KB
      processed_file = compress_image(temp_file.path)
      return { success: false, error: "Failed to compress image" } unless processed_file

      # Step 5: Upload to storage test folder
      # Use item_name for filename to match existing photo naming convention
      # Include source URL in filename for reference
      # Sanitize filename to prevent folder creation
      filename = sanitize_filename("#{item.item_name} [#{best_image_url}].png")
      storage_url = upload_to_storage(processed_file.path, filename)

      return { success: false, error: "Failed to upload to storage" } unless storage_url

      Rails.logger.info "[ImageFetcher] Uploaded to storage: #{storage_url}"

      # Step 5: Update pricebook item (optional - just mark as fetched)
      item.update(
        image_fetch_status: "fetched_to_test_folder",
        notes: [ item.notes, "Test image uploaded to storage: #{Time.current}" ].compact.join("\n")
      )

      { success: true, image_url: storage_url, storage_path: "#{self.class.storage_test_folder}/#{filename}" }
    ensure
      temp_file.close! if temp_file
      processed_file.close! if processed_file
    end
  end

  private

  # Search for images using Google
  def search_google_images(item)
    query = build_search_query(item)
    Rails.logger.info "[ImageFetcher] Searching for: #{query}"

    if GOOGLE_SEARCH_API_KEY && GOOGLE_CX
      search_with_google_api(query)
    else
      Rails.logger.warn "[ImageFetcher] Google Search API not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_CX"
      []
    end
  end

  def build_search_query(item)
    parts = []
    parts << item.supplier&.name if item.supplier
    parts << item.brand if item.brand.present?
    parts << item.item_code if item.item_code.present?
    parts << item.item_name

    query = parts.join(" ")
    "#{query} product"
  end

  def search_with_google_api(query)
    response = HTTParty.get("https://www.googleapis.com/customsearch/v1", query: {
      key: GOOGLE_SEARCH_API_KEY,
      cx: GOOGLE_CX,
      q: query,
      searchType: "image",
      num: 10,
      imgSize: "medium",
      safe: "active"
    })

    if response.success? && response["items"]
      response["items"].map { |item| item.dig("link") }.compact
    else
      Rails.logger.error "[ImageFetcher] Google API error: #{response.code} - #{response.body}"
      []
    end
  rescue StandardError => e
    Rails.logger.error "[ImageFetcher] Google API search failed: #{e.message}"
    []
  end

  # Use Claude AI to select the best image
  def select_best_image(item, image_urls)
    # Filter out blocked domains first
    blocked_domains = ['aldertapware.com.au']
    filtered_urls = image_urls.reject do |url|
      blocked_domains.any? { |domain| url.include?(domain) }
    end

    # If all URLs are blocked, use original list as fallback
    urls_to_use = filtered_urls.any? ? filtered_urls : image_urls

    return urls_to_use.first unless ANTHROPIC_API_KEY.present? && urls_to_use.length > 1

    begin
      # Limit to first 5 images for cost
      candidates = urls_to_use.first(5).map do |url|
        {
          type: "image",
          source: {
            type: "url",
            url: url
          }
        }
      end

      prompt = <<~PROMPT
        I'm searching for a product image for: #{item.item_name}
        #{item.brand.present? ? "Brand: #{item.brand}" : ""}
        #{item.item_code.present? ? "Item Code: #{item.item_code}" : ""}

        Please analyze these #{candidates.length} images and select the best one that represents this product.
        Consider:
        1. Is it a clear product photo (not a logo, diagram, or unrelated image)?
        2. Is it the actual product (not similar items)?
        3. Is the image high quality and well-lit?
        4. Does it show the product clearly?

        Respond with ONLY the number (1-#{candidates.length}) of the best image, or 0 if none are suitable.
      PROMPT

      response = HTTParty.post("https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type" => "application/json",
          "x-api-key" => ANTHROPIC_API_KEY,
          "anthropic-version" => "2023-06-01"
        },
        body: {
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                *candidates
              ]
            }
          ]
        }.to_json
      )

      if response.success? && response["content"]
        selection = response["content"].first["text"].to_i
        if selection > 0 && selection <= candidates.length
          Rails.logger.info "[ImageFetcher] Claude selected image #{selection}"
          return urls_to_use[selection - 1]
        end
      end

      Rails.logger.warn "[ImageFetcher] Claude didn't select, using first image"
      urls_to_use.first
    rescue StandardError => e
      Rails.logger.error "[ImageFetcher] Claude selection failed: #{e.message}"
      urls_to_use.first
    end
  end

  # Download image to temp file
  def download_image(url)
    unless valid_image_url?(url)
      Rails.logger.error "[ImageFetcher] Invalid or unsafe URL: #{url}"
      return nil
    end

    temp_file = Tempfile.new([ "product_image", ".jpg" ])
    temp_file.binmode

    # Add User-Agent and other headers to bypass 403 Forbidden errors
    referer = begin
      url.match(/^https?:\/\/[^\/]+/)[0]
    rescue StandardError
      url
    end

    headers = {
      "User-Agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept" => "image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language" => "en-US,en;q=0.9",
      "Referer" => referer
    }

    URI.open(url, "rb", read_timeout: 10, **headers) do |source|
      temp_file.write(source.read)
    end

    temp_file.rewind
    temp_file
  rescue StandardError => e
    Rails.logger.error "[ImageFetcher] Download failed: #{e.message}"
    temp_file&.close!
    nil
  end

  # Compress image to be under MAX_FILE_SIZE (900KB) and make it square with padding
  def compress_image(source_path)
    begin
      image = MiniMagick::Image.open(source_path)

      # Get current dimensions and file size
      width = image.width
      height = image.height
      original_size = File.size(source_path)

      Rails.logger.info "[ImageFetcher] Original image: #{width}x#{height}, #{(original_size / 1024.0).round(1)} KB"

      # Make image square by adding white padding (extend to square)
      max_dimension = [ width, height ].max

      # Calculate padding needed
      if width < max_dimension || height < max_dimension
        # Set background color and gravity, then extend canvas to center the image
        image.background "white"

        # Use combine_options to ensure gravity is applied correctly
        image.combine_options do |c|
          c.gravity "center"
          c.extent "#{max_dimension}x#{max_dimension}"
        end

        Rails.logger.info "[ImageFetcher] Padded to square: #{max_dimension}x#{max_dimension}"
      end

      # Convert to PNG format
      image.format "png"

      # Create output temp file
      output_file = Tempfile.new([ "compressed_image", ".png" ])
      output_file.close

      # Try different quality/compression levels to get under MAX_FILE_SIZE
      quality = 85

      loop do
        # Set compression quality (0-100, higher = better quality but larger file)
        image.quality quality.to_s

        # Write to temp file
        image.write(output_file.path)

        file_size = File.size(output_file.path)

        # If file is small enough or quality is already at minimum, we're done
        if file_size <= MAX_FILE_SIZE || quality <= 60
          Rails.logger.info "[ImageFetcher] Compressed image: #{max_dimension}x#{max_dimension}, #{(file_size / 1024.0).round(1)} KB (quality: #{quality})"
          break
        end

        # Reduce quality for next attempt
        quality -= 5
      end

      output_file
    rescue StandardError => e
      Rails.logger.error "[ImageFetcher] Image compression failed: #{e.message}"
      nil
    end
  end

  # Validate URL to prevent SSRF attacks
  def valid_image_url?(url)
    return false unless url.present?

    uri = URI.parse(url)
    return false unless [ "http", "https" ].include?(uri.scheme&.downcase)

    resolved_ip = Resolv.getaddress(uri.host)
    ip = IPAddr.new(resolved_ip)

    blocked_ranges = [
      IPAddr.new("10.0.0.0/8"),
      IPAddr.new("172.16.0.0/12"),
      IPAddr.new("192.168.0.0/16"),
      IPAddr.new("127.0.0.0/8"),
      IPAddr.new("169.254.0.0/16"),
      IPAddr.new("::1/128"),
      IPAddr.new("fc00::/7"),
      IPAddr.new("fe80::/10")
    ]

    blocked_ranges.each do |range|
      if range.include?(ip)
        Rails.logger.warn "[ImageFetcher] Blocked SSRF attempt: #{resolved_ip}"
        return false
      end
    end

    true
  rescue URI::InvalidURIError, Resolv::ResolvError, IPAddr::InvalidAddressError => e
    Rails.logger.error "[ImageFetcher] URL validation failed: #{e.message}"
    false
  end

  # Upload file to storage test folder
  # SSoT: Uses StorageUploadable for provider-agnostic upload
  def upload_to_storage(file_path, filename)
    content = File.read(file_path)
    folder_path = self.class.storage_test_folder

    result = upload_to_storage_path(folder_path, content, filename, content_type: "image/png")

    if result[:success]
      result[:url]
    else
      Rails.logger.error "[ImageFetcher] Storage upload failed: #{result[:error]}"
      nil
    end
  rescue StandardError => e
    Rails.logger.error "[ImageFetcher] Storage upload failed: #{e.message}"
    nil
  end

  # SSoT: Use centralized filename sanitization
  def sanitize_filename(filename)
    sanitize_storage_path(filename)
  end
end
