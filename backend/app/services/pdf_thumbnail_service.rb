# Generates PNG thumbnails from PDF files for instant preview
# Thumbnails are stored in SharePoint alongside the original PDFs
#
# Usage:
#   PdfThumbnailService.new(revision).generate!
#
class PdfThumbnailService
  THUMBNAIL_WIDTH = 800   # px - configurable
  THUMBNAIL_FORMAT = 'png'
  THUMBNAIL_QUALITY = 90
  THUMBNAIL_DENSITY = 150  # DPI for PDF rendering

  class ThumbnailError < StandardError; end

  def initialize(revision)
    @revision = revision
    @job_plan = revision.job_plan
  end

  # Generate thumbnail and upload to SharePoint
  # Returns the thumbnail file info or raises ThumbnailError
  def generate!
    validate!

    Rails.logger.info "[PdfThumbnail] Generating thumbnail for revision ##{@revision.id}"

    pdf_content = download_pdf
    thumbnail_content = convert_to_thumbnail(pdf_content)
    thumbnail_info = upload_thumbnail(thumbnail_content)
    update_revision(thumbnail_info)

    Rails.logger.info "[PdfThumbnail] Thumbnail generated successfully: #{thumbnail_info[:name]}"
    thumbnail_info
  rescue StandardError => e
    Rails.logger.error "[PdfThumbnail] Failed for revision ##{@revision.id}: #{e.message}"
    raise ThumbnailError, "Failed to generate thumbnail: #{e.message}"
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

  def convert_to_thumbnail(pdf_content)
    Rails.logger.info "[PdfThumbnail] Converting page 1 to PNG..."

    # Write PDF to temp file
    pdf_file = Tempfile.new(['pdf_thumbnail', '.pdf'], binmode: true)
    output_file = Tempfile.new(['thumbnail', '.png'], binmode: true)

    begin
      pdf_file.write(pdf_content)
      pdf_file.flush
      pdf_file.close # Close so ImageMagick can read it

      output_path = output_file.path
      output_file.close

      # Use MiniMagick::Tool::Convert directly - the [0] syntax works in command context
      MiniMagick::Tool::Convert.new do |convert|
        convert.density THUMBNAIL_DENSITY
        convert << "#{pdf_file.path}[0]"  # [0] = first page
        convert.resize "#{THUMBNAIL_WIDTH}x"
        convert.quality THUMBNAIL_QUALITY
        convert << output_path
      end

      Rails.logger.info "[PdfThumbnail] Conversion complete, reading output..."

      # Read the generated thumbnail
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

  def update_revision(thumbnail_info)
    @revision.update!(
      thumbnail_file_id: thumbnail_info[:file_id],
      thumbnail_url: thumbnail_info[:web_url],
      thumbnail_generated_at: Time.current
    )
  end
end
