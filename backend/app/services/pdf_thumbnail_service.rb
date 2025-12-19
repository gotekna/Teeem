# Generates WebP thumbnails from PDF files for instant preview
# Creates TWO thumbnails for progressive loading:
#   1. Micro (50px, blurred) - 3KB, inline in JSON for instant display
#   2. Full (500px, sharp) - 15KB, loads in background for quality
#
# Usage:
#   PdfThumbnailService.new(revision).generate!
#
class PdfThumbnailService
  # Micro thumbnail (instant display, small but readable)
  MICRO_WIDTH = 300
  MICRO_BLUR = 0      # No blur - keep it readable
  MICRO_QUALITY = 50  # Lower quality to keep file small

  # Full thumbnail (high quality, loads in background)
  FULL_WIDTH = 500
  FULL_QUALITY = 75

  # Shared settings
  THUMBNAIL_FORMAT = 'webp'  # WebP is 50% smaller than PNG
  THUMBNAIL_DENSITY = 72      # Screen resolution (was 150)

  class ThumbnailError < StandardError; end

  def initialize(revision)
    @revision = revision
    @job_plan = revision.job_plan
  end

  # Generate thumbnails (micro + full) and upload to SharePoint
  # Returns the thumbnail file info or raises ThumbnailError
  def generate!
    validate!

    Rails.logger.info "[PdfThumbnail] Generating thumbnails for revision ##{@revision.id}"

    pdf_content = download_pdf

    # Generate BOTH thumbnails from the PDF
    micro_content = generate_micro_thumbnail(pdf_content)
    full_content = generate_full_thumbnail(pdf_content)

    # Upload full thumbnail to SharePoint (micro stays inline)
    thumbnail_info = upload_thumbnail(full_content)

    # Update revision with both thumbnails
    update_revision(thumbnail_info, micro_content)

    Rails.logger.info "[PdfThumbnail] Thumbnails generated: micro=#{micro_content.bytesize}B, full=#{full_content.bytesize}B"
    thumbnail_info
  rescue StandardError => e
    Rails.logger.error "[PdfThumbnail] Failed for revision ##{@revision.id}: #{e.message}"
    raise ThumbnailError, "Failed to generate thumbnails: #{e.message}"
  end

  private

  def validate!
    raise ThumbnailError, "Revision has no SharePoint file" unless @revision.sharepoint_file_id.present?
    raise ThumbnailError, "File is not a PDF" unless pdf_file?
  end

  def pdf_file?
    return true if @revision.file_name&.downcase&.end_with?('.pdf')
    # Could also check MIME type if available
    true
  end

  def download_pdf
    Rails.logger.info "[PdfThumbnail] Downloading PDF from SharePoint..."
    credential = OrganizationSharePointCredential.active_credential
    raise ThumbnailError, "SharePoint not connected" unless credential&.valid_credential?

    # Use appropriate client based on credential type
    if credential.is_a?(MicrosoftCredential) && credential.credential_type == "app"
      client = MicrosoftAppGraphClient.new(credential)
      sharepoint_config = CorporateCompanySetting.sharepoint_config
      raise ThumbnailError, "SharePoint not configured" unless sharepoint_config[:configured]

      client.get_drive_item_content(
        drive_id: sharepoint_config[:drive_id],
        item_id: @revision.sharepoint_file_id
      )
    else
      client = MicrosoftGraphClient.new(credential)
      client.download_file(@revision.sharepoint_file_id)
    end
  end

  # Generate micro thumbnail: 300px wide, sharp, WebP
  # Target size: ~10-15KB for inline base64 delivery (readable preview)
  def generate_micro_thumbnail(pdf_content)
    Rails.logger.info "[PdfThumbnail] Generating micro thumbnail (#{MICRO_WIDTH}px WebP)..."

    pdf_file = Tempfile.new(['pdf_micro', '.pdf'], binmode: true)
    output_file = Tempfile.new(['micro', ".#{THUMBNAIL_FORMAT}"], binmode: true)

    begin
      pdf_file.write(pdf_content)
      pdf_file.flush
      pdf_file.close

      output_path = output_file.path
      output_file.close

      MiniMagick::Tool::Convert.new do |convert|
        convert.density THUMBNAIL_DENSITY
        convert << "#{pdf_file.path}[0]"      # First page only
        convert.resize "#{MICRO_WIDTH}x"       # 300px wide
        convert.blur "0x#{MICRO_BLUR}" if MICRO_BLUR > 0  # Only blur if configured
        convert.quality MICRO_QUALITY          # Lower quality = smaller file
        convert << "#{THUMBNAIL_FORMAT}:#{output_path}"
      end

      File.binread(output_path)
    ensure
      pdf_file.unlink if pdf_file
      output_file.unlink if output_file
    end
  end

  # Generate full thumbnail: 500px wide, sharp, WebP
  # Target size: ~15KB for fast background loading
  def generate_full_thumbnail(pdf_content)
    Rails.logger.info "[PdfThumbnail] Generating full thumbnail (500px WebP)..."

    pdf_file = Tempfile.new(['pdf_full', '.pdf'], binmode: true)
    output_file = Tempfile.new(['full', ".#{THUMBNAIL_FORMAT}"], binmode: true)

    begin
      pdf_file.write(pdf_content)
      pdf_file.flush
      pdf_file.close

      output_path = output_file.path
      output_file.close

      MiniMagick::Tool::Convert.new do |convert|
        convert.density THUMBNAIL_DENSITY
        convert << "#{pdf_file.path}[0]"      # First page only
        convert.resize "#{FULL_WIDTH}x"       # 500px wide
        convert.quality FULL_QUALITY          # Good quality, reasonable size
        convert << "#{THUMBNAIL_FORMAT}:#{output_path}"
      end

      File.binread(output_path)
    ensure
      pdf_file.unlink if pdf_file
      output_file.unlink if output_file
    end
  end

  def upload_thumbnail(thumbnail_content)
    Rails.logger.info "[PdfThumbnail] Uploading thumbnail to SharePoint..."

    credential = OrganizationSharePointCredential.active_credential
    raise ThumbnailError, "SharePoint not connected" unless credential&.valid_credential?

    # Generate thumbnail filename: original_name_thumb.png
    base_name = File.basename(@revision.file_name || 'plan', '.*')
    thumbnail_name = "#{base_name}_thumb.#{THUMBNAIL_FORMAT}"

    # Use appropriate client based on credential type
    if credential.is_a?(MicrosoftCredential) && credential.credential_type == "app"
      client = MicrosoftAppGraphClient.new(credential)
      sharepoint_config = CorporateCompanySetting.sharepoint_config
      raise ThumbnailError, "SharePoint not configured" unless sharepoint_config[:configured]

      # Get parent folder from original file
      file_info = client.get_drive_item(sharepoint_config[:drive_id], @revision.sharepoint_file_id)
      parent_folder_id = file_info[:parent_id]
      raise ThumbnailError, "Could not determine parent folder" unless parent_folder_id

      # Upload thumbnail to same folder
      result = client.upload_to_folder(
        drive_id: sharepoint_config[:drive_id],
        parent_folder_id: parent_folder_id,
        filename: thumbnail_name,
        content: thumbnail_content
      )

      {
        file_id: result['id'],
        name: result['name'],
        web_url: result['webUrl']
      }
    else
      client = MicrosoftGraphClient.new(credential)

      # Get parent folder ID from the original file
      file_info = client.get_file(@revision.sharepoint_file_id)
      parent_folder_id = file_info.dig('parentReference', 'id')
      raise ThumbnailError, "Could not determine parent folder" unless parent_folder_id

      # Upload thumbnail
      result = client.upload_file_content(parent_folder_id, thumbnail_name, thumbnail_content)

      {
        file_id: result[:id],
        name: result[:name],
        web_url: result[:web_url]
      }
    end
  end

  def update_revision(thumbnail_info, micro_content)
    # Encode micro thumbnail as base64 for inline delivery
    micro_base64 = Base64.strict_encode64(micro_content)

    @revision.update!(
      thumbnail_file_id: thumbnail_info[:file_id],
      thumbnail_url: thumbnail_info[:web_url],
      micro_thumbnail_base64: micro_base64,
      thumbnail_generated_at: Time.current
    )

    Rails.logger.info "[PdfThumbnail] Stored micro thumbnail (#{micro_base64.bytesize} base64 chars)"
  end
end
