# Generates WebP thumbnails from PDF files for instant preview
# Creates TWO thumbnails for progressive loading:
#   1. Micro (50px, blurred) - 3KB, inline in JSON for instant display
#   2. Full (500px, sharp) - 15KB, loads in background for quality
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
#
# Usage:
#   PdfThumbnailService.new(revision).generate!
#
class PdfThumbnailService
  include DocumentProviderAware
  # Micro thumbnail (instant display, large enough for preview panel)
  MICRO_WIDTH = 600   # Large enough to fill preview panel without pixelation
  MICRO_BLUR = 0      # No blur - keep it readable
  MICRO_QUALITY = 60  # Balance quality vs file size

  # Full thumbnail (high quality, loads in background)
  FULL_WIDTH = 800    # Larger for when user clicks "View Full PDF"
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
    # Check for storage identifier (path or file_id)
    unless @revision.storage_path.present? || @revision.sharepoint_file_id.present?
      raise ThumbnailError, "Revision has no storage file"
    end
    raise ThumbnailError, "File is not a PDF" unless pdf_file?
  end

  def pdf_file?
    return true if @revision.file_name&.downcase&.end_with?('.pdf')
    # Could also check MIME type if available
    true
  end

  # Download PDF using provider-agnostic storage
  # SSoT: Uses DocumentStorageService for downloads
  def download_pdf
    Rails.logger.info "[PdfThumbnail] Downloading PDF from storage..."

    # Create a document-like object for the storage service
    doc = OpenStruct.new(
      storage_path: @revision.storage_path,
      sharepoint_file_id: @revision.sharepoint_file_id
    )

    service = DocumentStorageService.new
    result = service.download(doc)

    raise ThumbnailError, "Storage not connected: #{result[:error]}" unless result[:success]
    raise ThumbnailError, "Failed to download file content" if result[:content].blank?

    result[:content]
  rescue DocumentProviders::NotConnectedError => e
    raise ThumbnailError, "Storage not connected: #{e.message}"
  rescue DocumentProviders::Error => e
    raise ThumbnailError, "Storage API error: #{e.message}"
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

  # Upload thumbnail using provider-agnostic storage
  # SSoT: Uses DocumentProviderAware for uploads
  def upload_thumbnail(thumbnail_content)
    Rails.logger.info "[PdfThumbnail] Uploading thumbnail to storage..."

    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      raise ThumbnailError, "Storage not connected: #{e.message}"
    end

    # Generate thumbnail filename: original_name_thumb.webp
    base_name = File.basename(@revision.file_name || 'plan', '.*')
    thumbnail_name = "#{base_name}_thumb.#{THUMBNAIL_FORMAT}"

    # Determine parent folder path from original file
    parent_folder_path = if @revision.storage_path.present?
      File.dirname(@revision.storage_path)
    elsif @job_plan&.job&.storage_folder_path.present?
      @job_plan.job.storage_folder_path
    else
      raise ThumbnailError, "Could not determine parent folder for thumbnail"
    end

    # Upload thumbnail to same folder
    result = upload_to_provider(
      parent_folder_path,
      thumbnail_content,
      thumbnail_name,
      content_type: "image/webp"
    )

    {
      file_id: result[:id],
      name: thumbnail_name,
      web_url: result[:web_url] || result[:url],
      path: result[:path]
    }
  rescue DocumentProviders::Error => e
    raise ThumbnailError, "Storage API error: #{e.message}"
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
