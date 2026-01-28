# frozen_string_literal: true

# PresignedUploadHandler - SSoT for handling presigned URL uploads
#
# Include in controllers that accept file uploads. This concern provides
# a unified way to handle both traditional multipart uploads AND presigned
# URL uploads (where the file is already in S3).
#
# Usage:
#   class MyController < ApplicationController
#     include PresignedUploadHandler
#
#     def upload
#       file = resolve_uploaded_file(:file, :storage_key)
#       return render_upload_error unless file
#
#       # Process file normally...
#     end
#   end
#
# The method accepts either:
#   - params[:file] - traditional multipart file upload
#   - params[:storage_key] - S3 key from presigned URL upload
#
# For presigned URL uploads, it downloads the file from S3 and creates
# a temporary ActionDispatch::Http::UploadedFile for compatibility.
#
module PresignedUploadHandler
  extend ActiveSupport::Concern

  # Resolve uploaded file from either multipart upload or S3 key
  #
  # @param file_param [Symbol] param name for multipart file (default: :file)
  # @param key_param [Symbol] param name for S3 key (default: :storage_key)
  # @return [ActionDispatch::Http::UploadedFile, nil] the file or nil if not found
  def resolve_uploaded_file(file_param = :file, key_param = :storage_key)
    # Prefer direct file upload if present
    if params[file_param].present?
      return params[file_param]
    end

    # Fall back to S3 key
    storage_key = params[key_param]
    return nil unless storage_key.present?

    download_from_storage(storage_key)
  end

  # Resolve multiple uploaded files from either multipart upload or S3 keys
  #
  # @param files_param [Symbol] param name for multipart files array
  # @param keys_param [Symbol] param name for S3 keys array
  # @return [Array<ActionDispatch::Http::UploadedFile>] array of files
  def resolve_uploaded_files(files_param = :files, keys_param = :storage_keys)
    files = []

    # Add direct file uploads
    if params[files_param].present?
      files += Array(params[files_param])
    end

    # Add files from S3 keys
    if params[keys_param].present?
      Array(params[keys_param]).each do |key|
        file = download_from_storage(key)
        files << file if file
      end
    end

    files
  end

  # Render standard error for missing upload
  def render_upload_error(message = "No file provided. Use 'file' for multipart or 'storage_key' for presigned URL upload.")
    render json: { success: false, error: message }, status: :bad_request
  end

  private

  # Download file from S3 and wrap in UploadedFile for compatibility
  #
  # @param storage_key [String] S3 key to download
  # @return [ActionDispatch::Http::UploadedFile, nil]
  def download_from_storage(storage_key)
    provider = DocumentProviders::S3Compatible.for_organization(current_organization)

    # Log root path for debugging
    Rails.logger.info "[PresignedUploadHandler] download_from_storage: key=#{storage_key}, root_path=#{provider.instance_variable_get(:@root_path).inspect}, bucket=#{provider.instance_variable_get(:@bucket)}"

    # Download file content
    content = provider.download_file(storage_key)
    unless content
      Rails.logger.error "[PresignedUploadHandler] download_file returned nil for #{storage_key}"
      return nil
    end

    # FRC (Jan 2026): Force binary encoding to prevent PDF corruption
    # S3 returns binary content but Ruby may interpret as UTF-8, corrupting PDFs
    content = content.dup.force_encoding(Encoding::ASCII_8BIT)
    Rails.logger.info "[PresignedUploadHandler] Content size: #{content.bytesize} bytes, encoding: #{content.encoding}"

    # Extract filename from key
    filename = File.basename(storage_key)
    # Remove timestamp prefix if present (e.g., "1706012345_abc123_filename.pdf")
    filename = filename.sub(/^\d+_[a-f0-9]+_/, "")

    # Detect content type
    content_type = detect_content_type(filename)

    # Create temp file
    temp_file = Tempfile.new([File.basename(filename, ".*"), File.extname(filename)])
    temp_file.binmode
    temp_file.write(content)
    temp_file.rewind

    # Wrap in UploadedFile for Rails compatibility
    ActionDispatch::Http::UploadedFile.new(
      tempfile: temp_file,
      filename: filename,
      type: content_type
    )
  rescue DocumentProviders::NotFoundError => e
    Rails.logger.error "[PresignedUploadHandler] File not found in storage: #{storage_key}"
    nil
  rescue => e
    Rails.logger.error "[PresignedUploadHandler] Failed to download #{storage_key}: #{e.message}"
    nil
  end

  # SSoT: ContentTypeDetector (lib/utils/content_type_detector.rb)
  def detect_content_type(filename)
    ContentTypeDetector.detect(filename)
  end
end
