# frozen_string_literal: true

# Service to extract brand assets from a company website
# Used to auto-populate brand colors, logo, and other assets when setting up a new company
#
# Usage:
#   result = BrandExtractorService.extract("https://tekna.com.au")
#   result[:logo_url]     # => "https://tekna.com.au/logo.png"
#   result[:favicon_url]  # => "https://tekna.com.au/favicon.ico"
#   result[:colors]       # => { primary: "#0c352d", secondary: "#f8f8f8", ... }
#   result[:company_name] # => "Tekna Homes"
#
class BrandExtractorService
  require "net/http"
  require "nokogiri"
  require "uri"

  # Main entry point - extracts all brand assets from a URL
  def self.extract(url)
    new(url).extract
  end

  def initialize(url)
    @url = normalize_url(url)
    @base_uri = URI.parse(@url)
    @doc = nil
    @css_content = ""
  end

  def extract
    fetch_page
    return error_result("Could not fetch website") unless @doc

    {
      success: true,
      url: @url,
      company_name: extract_company_name,
      logo_url: extract_logo,
      logo_dark_url: extract_logo_dark,
      favicon_url: extract_favicon,
      colors: extract_colors
    }
  rescue StandardError => e
    Rails.logger.error("[BrandExtractor] Error extracting from #{@url}: #{e.message}")
    error_result(e.message)
  end

  private

  def normalize_url(url)
    url = "https://#{url}" unless url.start_with?("http")
    url.chomp("/")
  end

  def fetch_page
    uri = URI.parse(@url)
    response = Net::HTTP.get_response(uri)

    # Follow redirects
    if response.is_a?(Net::HTTPRedirection)
      uri = URI.parse(response["location"])
      response = Net::HTTP.get_response(uri)
    end

    return unless response.is_a?(Net::HTTPSuccess)

    @doc = Nokogiri::HTML(response.body)

    # Also fetch CSS content for color extraction
    fetch_css_content
  rescue StandardError => e
    Rails.logger.warn("[BrandExtractor] Failed to fetch #{@url}: #{e.message}")
    nil
  end

  def fetch_css_content
    # Collect inline styles
    @css_content = @doc.css("style").map(&:text).join("\n")

    # Fetch linked stylesheets (first 3 only to avoid slow loading)
    @doc.css('link[rel="stylesheet"]').first(3).each do |link|
      href = link["href"]
      next unless href

      css_url = absolute_url(href)
      begin
        uri = URI.parse(css_url)
        response = Net::HTTP.get_response(uri)
        @css_content += "\n" + response.body if response.is_a?(Net::HTTPSuccess)
      rescue StandardError
        # Skip failed CSS fetches
      end
    end
  end

  def extract_company_name
    # Try multiple sources for company name
    name = nil

    # 1. Open Graph title
    og_title = @doc.at('meta[property="og:site_name"]')&.[]("content")
    name ||= og_title

    # 2. Title tag (clean it up)
    if name.blank?
      title = @doc.at("title")&.text&.strip
      # Remove common suffixes like "| Home" or "- Welcome"
      name = title&.split(/\s*[|\-–—]\s*/)&.first&.strip
    end

    # 3. H1 in header
    if name.blank?
      header_h1 = @doc.at("header h1, .header h1, #header h1")&.text&.strip
      name = header_h1 if header_h1.present? && header_h1.length < 50
    end

    name.presence || "Unknown Company"
  end

  def extract_logo
    logo_url = nil

    # 1. Open Graph image
    og_image = @doc.at('meta[property="og:image"]')&.[]("content")
    logo_url ||= og_image if og_image&.include?("logo")

    # 2. Header img (common patterns)
    header_selectors = [
      'header img[src*="logo"]',
      'header img[alt*="logo"]',
      'header img[alt*="Logo"]',
      '.header img[src*="logo"]',
      '#header img[src*="logo"]',
      '.logo img',
      '#logo img',
      'a.logo img',
      '.navbar-brand img',
      'header a img:first-of-type'
    ]

    header_selectors.each do |selector|
      img = @doc.at(selector)
      if img
        logo_url = img["src"] || img["data-src"]
        break if logo_url
      end
    end

    # 3. SVG logo
    if logo_url.blank?
      svg = @doc.at('header svg, .logo svg')
      # If SVG found, we'd need to save it separately - for now skip
    end

    logo_url.present? ? absolute_url(logo_url) : nil
  end

  def extract_logo_dark
    # Look for dark mode logo variants
    dark_selectors = [
      'img[src*="logo-dark"]',
      'img[src*="logo_dark"]',
      'img[src*="logo-white"]',
      'img[src*="logo_white"]',
      '.dark img[src*="logo"]'
    ]

    dark_selectors.each do |selector|
      img = @doc.at(selector)
      return absolute_url(img["src"]) if img && img["src"]
    end

    nil
  end

  def extract_favicon
    # Check various favicon formats
    favicon_selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]'
    ]

    favicon_selectors.each do |selector|
      link = @doc.at(selector)
      return absolute_url(link["href"]) if link && link["href"]
    end

    # Default location
    "#{@url}/favicon.ico"
  end

  def extract_colors
    colors = {
      primary: nil,
      primary_foreground: nil,
      secondary: nil,
      muted: nil,
      accent: nil
    }

    # Extract colors from CSS variables
    css_var_colors = extract_css_variable_colors
    inline_colors = extract_inline_colors

    # Merge and prioritize
    all_colors = (css_var_colors + inline_colors).uniq

    # Categorize colors by usage
    categorize_colors(all_colors, colors)

    colors
  end

  def extract_css_variable_colors
    colors = []

    # Match CSS custom properties with color values
    @css_content.scan(/--[\w-]+:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/) do |match|
      colors << normalize_color(match[0])
    end

    colors.compact
  end

  def extract_inline_colors
    colors = []

    # Match hex colors in CSS
    @css_content.scan(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/) do |match|
      colors << "##{match[0]}"
    end

    # Match rgb colors
    @css_content.scan(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) do |r, g, b|
      colors << rgb_to_hex(r.to_i, g.to_i, b.to_i)
    end

    colors.compact.uniq
  end

  def normalize_color(color)
    return nil if color.blank?

    if color.start_with?("#")
      # Normalize 3-char hex to 6-char
      if color.length == 4
        "##{color[1]}#{color[1]}#{color[2]}#{color[2]}#{color[3]}#{color[3]}"
      else
        color.downcase
      end
    elsif color.start_with?("rgb")
      # Parse rgb(r,g,b) format
      match = color.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/)
      return nil unless match

      rgb_to_hex(match[1].to_i, match[2].to_i, match[3].to_i)
    else
      nil
    end
  end

  def rgb_to_hex(r, g, b)
    "##{r.to_s(16).rjust(2, '0')}#{g.to_s(16).rjust(2, '0')}#{b.to_s(16).rjust(2, '0')}"
  end

  def categorize_colors(all_colors, colors)
    return if all_colors.empty?

    # Filter out common non-brand colors
    filtered = all_colors.reject do |c|
      c.nil? ||
        c == "#ffffff" || c == "#fff" ||
        c == "#000000" || c == "#000" ||
        c =~ /^#[ef]{6}$/i || # Near-white
        c =~ /^#[01]{6}$/i    # Near-black
    end

    # Sort by frequency (most common first)
    color_counts = filtered.tally.sort_by { |_, count| -count }

    # Assign colors based on characteristics
    color_counts.each do |color, _count|
      luminance = calculate_luminance(color)

      if colors[:primary].nil? && luminance < 0.5
        # Dark color = likely primary
        colors[:primary] = color
        colors[:primary_foreground] = "#ffffff"
      elsif colors[:accent].nil? && luminance >= 0.3 && luminance <= 0.7
        # Mid-tone = accent
        colors[:accent] = color
      elsif colors[:secondary].nil? && luminance > 0.8
        # Light color = secondary/background
        colors[:secondary] = color
      elsif colors[:muted].nil? && luminance >= 0.3 && luminance <= 0.6
        # Gray-ish = muted
        colors[:muted] = color
      end

      break if colors.values.all?(&:present?)
    end

    # Fallbacks
    colors[:primary] ||= color_counts.first&.first || "#000000"
    colors[:primary_foreground] ||= "#ffffff"
    colors[:secondary] ||= "#f8f8f8"
    colors[:muted] ||= "#666666"
    colors[:accent] ||= colors[:primary]
  end

  def calculate_luminance(hex)
    return 0.5 if hex.blank?

    hex = hex.gsub("#", "")

    # Expand 3-char hex to 6-char (e.g., "fff" -> "ffffff")
    if hex.length == 3
      hex = "#{hex[0]}#{hex[0]}#{hex[1]}#{hex[1]}#{hex[2]}#{hex[2]}"
    end

    return 0.5 if hex.length < 6

    r = hex[0..1].to_i(16) / 255.0
    g = hex[2..3].to_i(16) / 255.0
    b = hex[4..5].to_i(16) / 255.0

    0.2126 * r + 0.7152 * g + 0.0722 * b
  end

  def absolute_url(path)
    return nil if path.blank?
    return path if path.start_with?("http")

    if path.start_with?("//")
      "https:#{path}"
    elsif path.start_with?("/")
      "#{@base_uri.scheme}://#{@base_uri.host}#{path}"
    else
      "#{@url}/#{path}"
    end
  end

  def error_result(message)
    {
      success: false,
      error: message,
      url: @url
    }
  end
end
