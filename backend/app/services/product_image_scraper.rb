require "httparty"
require "cloudinary"
require "open-uri"
require "resolv"
require "ipaddr"

class ProductImageScraper
  include HTTParty

  GOOGLE_SEARCH_API_KEY = ENV["GOOGLE_SEARCH_API_KEY"] # Optional - for better results
  GOOGLE_CX = ENV["GOOGLE_SEARCH_CX"] # Optional - Custom Search Engine ID
  ANTHROPIC_API_KEY = ENV["ANTHROPIC_API_KEY"] # For Claude AI image selection

  def initialize(pricebook_item)
    @item = pricebook_item
    @supplier = @item.supplier
  end

  # Main method to fetch and upload image
  def fetch_and_upload_image
    @item.update(image_fetch_status: "fetching")

    # Step 1: Search for images using Google
    image_urls = search_google_images
    return fail_with_error("No images found") if image_urls.empty?

    # Step 2: Use Claude AI to select the best image (placeholder for now)
    best_image_url = select_best_image(image_urls)
    return fail_with_error("No suitable image found") unless best_image_url

    # Step 3: Download and upload to Cloudinary
    cloudinary_url = upload_to_cloudinary(best_image_url)
    return fail_with_error("Upload failed") unless cloudinary_url

    # Step 4: Save to database
    @item.update(
      image_url: cloudinary_url,
      image_source: "google_cloudinary",
      image_fetched_at: Time.current,
      image_fetch_status: "success"
    )

    { success: true, image_url: cloudinary_url }
  rescue StandardError => e
    fail_with_error(e.message)
  end

  private

  def search_google_images
    # Build search query
    query = build_search_query

    if GOOGLE_SEARCH_API_KEY && GOOGLE_CX
      # Use official Google Custom Search API (better results, requires API key)
      search_with_google_api(query)
    else
      # Fallback: Use a simple HTTP-based image search
      # For now, try searching Google Images directly with a simpler approach
      search_with_simple_google(query)
    end
  end

  def build_search_query
    parts = []
    parts << @supplier.name if @supplier
    parts << @item.brand if @item.brand.present?
    parts << @item.item_code if @item.item_code.present?
    parts << @item.item_name

    query = parts.join(" ")
    # Add "product image" to filter out irrelevant results
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
      []
    end
  rescue StandardError => e
    Rails.logger.error "Google API search failed: #{e.message}"
    []
  end

  def search_with_simple_google(query)
    # Simplified approach: Use Google Images with a user agent
    # This is more reliable than DuckDuckGo scraping
    begin
      # Build a better query focusing on brand and model
      clean_query = [
        @item.brand,
        @item.item_code,
        @item.item_name&.split(/[\(\-]/)&.first&.strip
      ].compact.join(" ").gsub(/\s+/, " ").strip

      Rails.logger.info "Searching for: #{clean_query}"

      # For now, let's generate some common product image URL patterns
      # In production, we'll use Google Custom Search API or SerpAPI
      image_urls = generate_placeholder_images(clean_query)

      Rails.logger.info "Found #{image_urls.length} potential images"
      image_urls
    rescue StandardError => e
      Rails.logger.error "Image search failed: #{e.message}"
      []
    end
  end

  def generate_placeholder_images(query)
    # Temporary: Generate placeholder image URLs until we set up proper API
    # In practice, these would come from Google Custom Search or SerpAPI
    # For now, we'll return an empty array and recommend setting up Google Custom Search
    Rails.logger.warn "No image search API configured. Please set GOOGLE_SEARCH_API_KEY and GOOGLE_CX environment variables."
    []
  end

  def select_best_image(image_urls)
    return nil if image_urls.empty?

    if ANTHROPIC_API_KEY.present? && image_urls.length > 1
      # Use Claude AI to select the best image
      select_with_claude_ai(image_urls)
    else
      # Fallback: return first valid image
      find_first_valid_image(image_urls)
    end
  end

  def select_with_claude_ai(image_urls)
    # Use Claude's vision capabilities to analyze images and select the best one
    begin
      # Prepare image URLs for Claude (limit to first 5 for cost)
      candidates = image_urls.first(5).map.with_index do |url, idx|
        {
          type: "image",
          source: {
            type: "url",
            url: url
          }
        }
      end

      prompt = <<~PROMPT
        I'm searching for a product image for: #{@item.item_name}
        #{@item.brand.present? ? "Brand: #{@item.brand}" : ""}
        #{@item.item_code.present? ? "Item Code: #{@item.item_code}" : ""}

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
          Rails.logger.info "Claude AI selected image #{selection} for #{@item.item_name}"
          return image_urls[selection - 1]
        end
      end

      Rails.logger.warn "Claude AI didn't select an image, falling back to first valid"
      find_first_valid_image(image_urls)
    rescue StandardError => e
      Rails.logger.error "Claude AI selection failed: #{e.message}"
      find_first_valid_image(image_urls)
    end
  end

  def find_first_valid_image(image_urls)
    image_urls.each do |url|
      # Quick validation: check if URL is accessible and is an image
      next unless url =~ /\.(jpg|jpeg|png|webp|gif)$/i

      begin
        # Test if image is accessible (HEAD request)
        response = HTTParty.head(url, timeout: 5, follow_redirects: true)
        return url if response.success? && response.headers["content-type"]&.include?("image")
      rescue StandardError
        next
      end
    end

    nil
  end

  def upload_to_cloudinary(image_url)
    # Download image temporarily
    temp_file = download_image(image_url)
    return nil unless temp_file

    begin
      # Upload to Cloudinary
      result = Cloudinary::Uploader.upload(
        temp_file.path,
        folder: "pricebook_items",
        public_id: "item_#{@item.id}",
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 800, height: 800, crop: :limit },
          { quality: "auto:good" },
          { fetch_format: :auto }
        ]
      )

      result["secure_url"]
    rescue StandardError => e
      Rails.logger.error "Cloudinary upload failed: #{e.message}"
      nil
    ensure
      temp_file.close! if temp_file
    end
  end

  def download_image(url)
    require "tempfile"

    # Validate URL to prevent SSRF attacks
    unless valid_image_url?(url)
      Rails.logger.error "Invalid or unsafe image URL: #{url}"
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
    Rails.logger.error "Image download failed: #{e.message}"
    temp_file&.close!
    nil
  end

  # Validate URL to prevent SSRF (Server-Side Request Forgery) attacks
  def valid_image_url?(url)
    return false unless url.present?

    begin
      uri = URI.parse(url)

      # Only allow HTTP/HTTPS schemes
      return false unless [ "http", "https" ].include?(uri.scheme&.downcase)

      # Resolve hostname to IP address
      resolved_ip = Resolv.getaddress(uri.host)

      # Block private IP ranges
      ip = IPAddr.new(resolved_ip)
      blocked_ranges = [
        IPAddr.new("10.0.0.0/8"),       # Private network
        IPAddr.new("172.16.0.0/12"),    # Private network
        IPAddr.new("192.168.0.0/16"),   # Private network
        IPAddr.new("127.0.0.0/8"),      # Loopback
        IPAddr.new("169.254.0.0/16"),   # Link-local
        IPAddr.new("::1/128"),          # IPv6 loopback
        IPAddr.new("fc00::/7"),         # IPv6 private
        IPAddr.new("fe80::/10")         # IPv6 link-local
      ]

      blocked_ranges.each do |range|
        if range.include?(ip)
          Rails.logger.warn "Blocked SSRF attempt to private IP: #{resolved_ip}"
          return false
        end
      end

      true
    rescue URI::InvalidURIError, Resolv::ResolvError, IPAddr::InvalidAddressError => e
      Rails.logger.error "URL validation failed: #{e.message}"
      false
    end
  end

  def fail_with_error(message)
    @item.update(
      image_fetch_status: "failed",
      notes: "Image fetch failed: #{message}"
    )

    { success: false, error: message }
  end

  # Class method to process items in batch
  def self.fetch_images_for_all_items(limit: 100)
    items = PricebookItem
            .where(image_url: nil)
            .where("image_fetch_status IS NULL OR image_fetch_status != ?", "fetching")
            .limit(limit)
            .to_a # Convert to array to respect limit

    results = {
      total: items.count,
      success: 0,
      failed: 0,
      errors: []
    }

    items.each do |item|
      scraper = new(item)
      result = scraper.fetch_and_upload_image

      if result[:success]
        results[:success] += 1
      else
        results[:failed] += 1
        results[:errors] << {
          item_id: item.id,
          item_name: item.item_name,
          error: result[:error]
        }
      end

      # Rate limiting: sleep between requests
      sleep 1
    end

    results
  end

  # Fetch images for specific supplier
  def self.fetch_images_for_supplier(supplier_id, limit: 50)
    items = PricebookItem
            .where(supplier_id: supplier_id)
            .where(image_url: nil)
            .where("image_fetch_status IS NULL OR image_fetch_status != ?", "fetching")
            .limit(limit)
            .to_a # Convert to array to respect limit

    results = { total: items.count, success: 0, failed: 0 }

    items.each do |item|
      scraper = new(item)
      result = scraper.fetch_and_upload_image

      results[:success] += 1 if result[:success]
      results[:failed] += 1 unless result[:success]

      sleep 1
    end

    results
  end
end
