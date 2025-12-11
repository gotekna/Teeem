# frozen_string_literal: true

# Controller to proxy pricebook images from SharePoint with authentication
# This allows images to be displayed in the browser without auth issues
class Api::V1::PricebookImagesController < ApplicationController
  # CSRF not applicable in API mode (ActionController::API)

  # GET /api/v1/pricebook_images/:id
  # Returns the image binary data for a pricebook item
  def show
    item = PricebookItem.find(params[:id])

    unless item.image_url && item.image_source == "sharepoint"
      render json: { error: "Image not available" }, status: :not_found
      return
    end

    begin
      # Get the SharePoint file info from the image_url
      # The image_url format is: https://gotekna.sharepoint.com/sites/TEEEM/_layouts/15/Doc.aspx?...
      # We need to extract the file ID or path from it

      # For now, we'll download via Microsoft Graph API
      client = MicrosoftAppGraphClient.new
      sites = client.get_all_sites
      teeem_site = sites.find { |s| s[:display_name]&.include?("TEEEM") || s[:name]&.include?("teeem") }

      unless teeem_site
        render json: { error: "SharePoint site not found" }, status: :not_found
        return
      end

      drives = client.get_site_drives(teeem_site[:id])
      main_drive = drives.first

      unless main_drive
        render json: { error: "SharePoint drive not found" }, status: :not_found
        return
      end

      # Search for the image by filename (extracted from the item)
      # The image URL contains the filename, extract it
      filename = extract_filename_from_url(item.image_url)

      # Get warehousing folder
      root_items = client.list_drive_items(main_drive[:id])
      warehousing = root_items.find { |i| i[:is_folder] && i[:name]&.downcase&.include?("warehous") }

      unless warehousing
        render json: { error: "Warehousing folder not found" }, status: :not_found
        return
      end

      # Get pricebook photos folder
      contents = client.list_drive_items(main_drive[:id], folder_id: warehousing[:id])
      pricebook_folder = contents.find { |i| i[:is_folder] && i[:name]&.downcase&.include?("pricebook") }

      unless pricebook_folder
        render json: { error: "Pricebook Photos folder not found" }, status: :not_found
        return
      end

      # Find the specific image file
      photos = client.list_drive_items(main_drive[:id], folder_id: pricebook_folder[:id], top: 500)
      photo = photos.find { |p| p[:name] == filename }

      unless photo
        render json: { error: "Image file not found in SharePoint" }, status: :not_found
        return
      end

      # Get the image content
      image_binary = client.get_drive_item_content(drive_id: main_drive[:id], item_id: photo[:id])

      # Determine content type from file extension
      content_type = determine_content_type(filename)

      # Return the image
      send_data image_binary,
        type: content_type,
        disposition: "inline",
        filename: filename

    rescue StandardError => e
      Rails.logger.error("Failed to fetch pricebook image: #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
      render json: { error: "Failed to fetch image: #{e.message}" }, status: :internal_server_error
    end
  end

  private

  def extract_filename_from_url(url)
    # SharePoint URLs can be complex, try multiple patterns
    # Pattern 1: sourcedoc= parameter
    if url.include?("sourcedoc=")
      match = url.match(/sourcedoc=\{([^}]+)\}/)
      # This gives us a GUID, not helpful

      # Try getting from the URL path
      uri = URI.parse(url)
      path_parts = uri.path.split("/")
      # Look for the file in the path or query params
    end

    # Pattern 2: file= parameter
    if url.include?("file=")
      match = url.match(/file=([^&]+)/)
      return CGI.unescape(match[1]) if match
    end

    # Pattern 3: Path-based
    uri = URI.parse(url)
    path_parts = uri.path.split("/")
    filename = path_parts.last
    return filename if filename && filename.match?(/\.(png|jpg|jpeg|gif|webp)$/i)

    # Fallback: This shouldn't happen if we stored the web_url correctly
    # We should store both web_url and the item_id for easier retrieval
    raise "Could not extract filename from URL: #{url}"
  end

  def determine_content_type(filename)
    extension = File.extname(filename).downcase
    case extension
    when ".png"
      "image/png"
    when ".jpg", ".jpeg"
      "image/jpeg"
    when ".gif"
      "image/gif"
    when ".webp"
      "image/webp"
    else
      "application/octet-stream"
    end
  end
end
