# Service to fetch product images from the internet and upload to SharePoint
# Uses Google Images + Claude AI for image search and selection
# Uploads to SharePoint "Warehousing/Photo Test" folder for review

require "httparty"
require "open-uri"
require "resolv"
require "ipaddr"
require "tempfile"
require "mini_magick"

class PricebookImageFetcherService
  include HTTParty

  GOOGLE_SEARCH_API_KEY = ENV["GOOGLE_SEARCH_API_KEY"]
  GOOGLE_CX = ENV["GOOGLE_CX"]
  ANTHROPIC_API_KEY = ENV["ANTHROPIC_API_KEY"]

  SHAREPOINT_TEST_FOLDER = "Warehousing/Photo Test"

  # Standard image dimensions to match existing photos
  IMAGE_SIZE = 800  # 800x800 pixels (square)

  class FetchError < StandardError; end

  def initialize
    @graph_client = MicrosoftAppGraphClient.new
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

    # Get SharePoint site and drive info
    sites = @graph_client.get_all_sites
    teeem_site = sites.find { |s| s[:display_name]&.include?('TEEEM') || s[:name]&.include?('teeem') }
    raise FetchError, "TEEEM site not found" unless teeem_site

    drives = @graph_client.get_site_drives(teeem_site[:id])
    main_drive = drives.first
    raise FetchError, "No drive found in TEEEM site" unless main_drive

    # Store for later use
    @site_id = teeem_site[:id]
    @drive_id = main_drive[:id]

    # Ensure test folder exists
    unless dry_run
      ensure_test_folder_exists
      results[:test_folder_url] = "#{teeem_site[:web_url]}/Shared%20Documents/#{SHAREPOINT_TEST_FOLDER.gsub('/', '%20')}"
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
      # Step 4: Process image (resize to square, convert to PNG)
      processed_file = process_image(temp_file.path)
      return { success: false, error: "Failed to process image" } unless processed_file

      # Step 5: Upload to SharePoint test folder
      # Use item_name for filename to match existing photo naming convention
      filename = "#{item.item_name}.png"
      sharepoint_url = upload_to_sharepoint(processed_file.path, filename)

      return { success: false, error: "Failed to upload to SharePoint" } unless sharepoint_url

      Rails.logger.info "[ImageFetcher] Uploaded to SharePoint: #{sharepoint_url}"

      # Step 5: Update pricebook item (optional - just mark as fetched)
      item.update(
        image_fetch_status: "fetched_to_test_folder",
        notes: [item.notes, "Test image uploaded to SharePoint: #{Time.current}"].compact.join("\n")
      )

      { success: true, image_url: sharepoint_url, sharepoint_path: "#{SHAREPOINT_TEST_FOLDER}/#{filename}" }
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
    return image_urls.first unless ANTHROPIC_API_KEY.present? && image_urls.length > 1

    begin
      # Limit to first 5 images for cost
      candidates = image_urls.first(5).map do |url|
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
          return image_urls[selection - 1]
        end
      end

      Rails.logger.warn "[ImageFetcher] Claude didn't select, using first image"
      image_urls.first
    rescue StandardError => e
      Rails.logger.error "[ImageFetcher] Claude selection failed: #{e.message}"
      image_urls.first
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

    URI.open(url, "rb", read_timeout: 10) do |source|
      temp_file.write(source.read)
    end

    temp_file.rewind
    temp_file
  rescue StandardError => e
    Rails.logger.error "[ImageFetcher] Download failed: #{e.message}"
    temp_file&.close!
    nil
  end

  # Process image: resize to square and convert to PNG
  def process_image(source_path)
    begin
      image = MiniMagick::Image.open(source_path)

      # Get current dimensions
      width = image.width
      height = image.height

      Rails.logger.info "[ImageFetcher] Original image: #{width}x#{height}"

      # Resize and crop to square (center crop)
      # First resize so the smallest dimension is IMAGE_SIZE
      if width > height
        image.resize "#{(IMAGE_SIZE * width / height).to_i}x#{IMAGE_SIZE}"
      else
        image.resize "#{IMAGE_SIZE}x#{(IMAGE_SIZE * height / width).to_i}"
      end

      # Then crop to exact square from center
      image.crop "#{IMAGE_SIZE}x#{IMAGE_SIZE}+0+0"
      image.gravity "center"

      # Convert to PNG format
      image.format "png"

      # Create output temp file
      output_file = Tempfile.new([ "processed_image", ".png" ])
      output_file.close

      # Write processed image
      image.write(output_file.path)

      Rails.logger.info "[ImageFetcher] Processed image: #{IMAGE_SIZE}x#{IMAGE_SIZE} PNG"

      output_file
    rescue StandardError => e
      Rails.logger.error "[ImageFetcher] Image processing failed: #{e.message}"
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

  # Upload file to SharePoint test folder
  def upload_to_sharepoint(file_path, filename)
    content = File.read(file_path)

    result = @graph_client.upload_file_content(
      @site_id,
      @drive_id,
      SHAREPOINT_TEST_FOLDER,
      filename,
      content
    )

    result[:web_url]
  rescue StandardError => e
    Rails.logger.error "[ImageFetcher] SharePoint upload failed: #{e.message}"
    nil
  end

  # Ensure Photo Test folder exists in SharePoint
  def ensure_test_folder_exists
    # Get root items
    root_items = @graph_client.list_drive_items(@drive_id)

    # Find or create Warehousing folder
    warehousing = root_items.find { |item| item[:is_folder] && item[:name]&.downcase&.include?('warehous') }
    unless warehousing
      warehousing = @graph_client.create_folder(@site_id, @drive_id, "", "Warehousing")
    end

    # Find or create Photo Test subfolder
    warehousing_items = @graph_client.list_drive_items(@drive_id, folder_id: warehousing[:id])
    photo_test = warehousing_items.find { |item| item[:is_folder] && item[:name]&.downcase == 'photo test' }

    unless photo_test
      begin
        photo_test = @graph_client.create_folder(@site_id, @drive_id, "Warehousing", "Photo Test")
        Rails.logger.info "[ImageFetcher] Created Photo Test folder in SharePoint"
      rescue StandardError => e
        # Folder might already exist - try to find it again
        Rails.logger.warn "[ImageFetcher] Error creating Photo Test folder (#{e.message}), attempting to find it..."
        warehousing_items = @graph_client.list_drive_items(@drive_id, folder_id: warehousing[:id])
        photo_test = warehousing_items.find { |item| item[:is_folder] && item[:name]&.downcase == 'photo test' }

        raise FetchError, "Could not find or create Photo Test folder: #{e.message}" unless photo_test
      end
    end

    photo_test
  end
end