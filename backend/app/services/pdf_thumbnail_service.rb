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
    client = MicrosoftGraphClient.new
    client.download_file(@revision.sharepoint_file_id)
  end

  def convert_to_thumbnail(pdf_content)
    Rails.logger.info "[PdfThumbnail] Converting page 1 to PNG..."

    # Write PDF to temp file
    Tempfile.create(['pdf_thumbnail', '.pdf'], binmode: true) do |pdf_file|
      pdf_file.write(pdf_content)
      pdf_file.flush

      # Create output temp file for PNG
      output_file = Tempfile.new(['thumbnail', '.png'], binmode: true)
      output_path = output_file.path
      output_file.close

      begin
        # Use MiniMagick to convert PDF page 1 to PNG
        # -density sets DPI, [0] selects first page
        image = MiniMagick::Image.open(pdf_file.path + '[0]') do |b|
          b.density THUMBNAIL_DENSITY
        end

        # Resize to target width, maintaining aspect ratio
        image.resize "#{THUMBNAIL_WIDTH}x"
        image.format THUMBNAIL_FORMAT
        image.quality THUMBNAIL_QUALITY
        image.write output_path

        # Read the generated thumbnail
        File.binread(output_path)
      ensure
        File.delete(output_path) if File.exist?(output_path)
      end
    end
  end

  def upload_thumbnail(thumbnail_content)
    Rails.logger.info "[PdfThumbnail] Uploading thumbnail to SharePoint..."

    client = MicrosoftGraphClient.new

    # Get parent folder ID from the original file
    file_info = client.get_file(@revision.sharepoint_file_id)
    parent_folder_id = file_info.dig('parentReference', 'id')

    raise ThumbnailError, "Could not determine parent folder" unless parent_folder_id

    # Generate thumbnail filename: original_name_thumb.png
    base_name = File.basename(@revision.file_name || 'plan', '.*')
    thumbnail_name = "#{base_name}_thumb.#{THUMBNAIL_FORMAT}"

    # Upload thumbnail
    result = client.upload_file_content(parent_folder_id, thumbnail_name, thumbnail_content)

    {
      file_id: result[:id],
      name: result[:name],
      web_url: result[:web_url]
    }
  end

  def update_revision(thumbnail_info)
    @revision.update!(
      thumbnail_file_id: thumbnail_info[:file_id],
      thumbnail_url: thumbnail_info[:web_url],
      thumbnail_generated_at: Time.current
    )
  end
end
