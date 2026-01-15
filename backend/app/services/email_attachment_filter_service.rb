# frozen_string_literal: true

# EmailAttachmentFilterService - SSoT for filtering signature/embedded images from email attachments
#
# Problem: Email HTML contains embedded images (signatures, logos, social media icons) that
# should NOT be saved as document attachments. Microsoft Graph API returns these as attachments.
#
# This service determines whether an attachment should be skipped (not saved/displayed).
#
# Usage:
#   EmailAttachmentFilterService.signature_image?(attachment_data)  # => true/false
#   EmailAttachmentFilterService.filter_attachments(attachments)    # => filtered array
#
# SSoT: This is THE ONE place for attachment filtering logic. Do not duplicate elsewhere.
#
class EmailAttachmentFilterService
  # Patterns that indicate an image is likely a signature/embedded element
  SIGNATURE_PATTERNS = [
    /^image\d{1,3}\.(png|jpg|jpeg|gif|wmz)$/i,                              # image001.png, image2.jpg, image027.wmz (Outlook default)
    /^image\.(png|jpg|jpeg|gif)$/i,                                          # image.png, image.jpeg (generic inline)
    /^[a-f0-9]{32}\.(png|jpg|jpeg|gif)$/i,                                  # 32-char hex filenames (Outlook Content-IDs)
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|jpeg|gif)$/i, # UUID filenames
    /^cid:/i,                                                                # Content-ID references
    /^outlook-signature[_-]/i,                                               # Outlook signature files
    /^signature[_-]?[a-f0-9-]*\.(png|jpg|jpeg|gif)$/i,                      # signature.png, signature_uuid.png
    /email[_-]?signature/i,                                                  # email-signature, email_signature anywhere in name
    /^logo[_-]?\d*\.(png|jpg|jpeg|gif)$/i,                                  # logo.png, logo_1.jpg
    /^icon[_-]?\d*\.(png|jpg|jpeg|gif)$/i,                                  # icon.png, icon_1.jpg
    /^banner[_-]?\d*\.(png|jpg|jpeg|gif)$/i,                                # banner.png
    /^(facebook|twitter|linkedin|instagram|youtube)[_-]?(icon|logo)?\.(png|jpg|jpeg|gif)$/i, # Social media icons
  ].freeze

  # Minimum file size threshold - images smaller than this when inline are likely icons
  SMALL_IMAGE_THRESHOLD = 10_000  # 10KB

  class << self
    # Check if an attachment should be skipped (is a signature/embedded image)
    #
    # @param attachment_data [Hash] Microsoft Graph attachment object with keys:
    #   - name: filename
    #   - isInline: boolean (true if embedded in HTML)
    #   - size: file size in bytes
    #   - contentType: MIME type
    # @return [Boolean] true if attachment should be skipped
    #
    def signature_image?(attachment_data)
      filename = attachment_data["name"].to_s.downcase
      is_inline = attachment_data["isInline"] == true
      file_size = attachment_data["size"].to_i
      content_type = attachment_data["contentType"].to_s.downcase

      # Only apply filtering to images
      return false unless content_type.start_with?("image/")

      # Rule 1: Images matching signature patterns (filter even if not marked inline,
      # because Microsoft doesn't always set isInline correctly)
      if SIGNATURE_PATTERNS.any? { |pattern| filename.match?(pattern) }
        return true
      end

      # Rule 2: Very small inline images (< 10KB) are likely icons/social media buttons
      if is_inline && file_size < SMALL_IMAGE_THRESHOLD
        return true
      end

      false
    end

    # Filter an array of attachments, removing signature/embedded images
    #
    # @param attachments [Array<Hash>] Array of Microsoft Graph attachment objects
    # @return [Array<Hash>] Filtered array with signature images removed
    #
    def filter_attachments(attachments)
      return [] if attachments.blank?

      attachments.reject { |att| signature_image?(att) }
    end

    # Get document attachments only (non-signature, non-image OR large meaningful images)
    # Useful for displaying "real" attachments to users
    #
    # @param attachments [Array<Hash>] Array of Microsoft Graph attachment objects
    # @return [Array<Hash>] Only document/meaningful attachments
    #
    def document_attachments(attachments)
      filter_attachments(attachments)
    end

    # Check if attachment is a reference attachment (link to cloud file, not downloadable)
    #
    # @param attachment_data [Hash] Microsoft Graph attachment object
    # @return [Boolean] true if this is a reference/link attachment
    #
    def reference_attachment?(attachment_data)
      attachment_data["@odata.type"] == "#microsoft.graph.referenceAttachment"
    end

    # Check if attachment is downloadable (file attachment with content)
    #
    # @param attachment_data [Hash] Microsoft Graph attachment object
    # @return [Boolean] true if this is a downloadable file attachment
    #
    def downloadable_attachment?(attachment_data)
      attachment_data["@odata.type"] == "#microsoft.graph.fileAttachment" &&
        (attachment_data["contentBytes"].present? || attachment_data["size"].to_i > 0)
    end

    # Full filter: skip signatures, references, and non-downloadable attachments
    #
    # @param attachment_data [Hash] Microsoft Graph attachment object
    # @return [Boolean] true if attachment should be skipped entirely
    #
    def should_skip?(attachment_data)
      return true if signature_image?(attachment_data)
      return true if reference_attachment?(attachment_data)
      return true unless downloadable_attachment?(attachment_data)

      false
    end
  end
end
