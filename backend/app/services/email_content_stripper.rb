# frozen_string_literal: true

require "mail"

# Strips binary attachment parts from raw .eml MIME content to reduce storage.
#
# Attachments are already extracted and stored as individual StorageBlobs
# before the .eml blob is created, so the attachment data inside the .eml
# is redundant. Stripping it saves ~30-40% storage for emails with attachments.
#
# Preserves: all headers, text/plain body, text/html body, small inline images (<10KB)
# Removes: file attachments, large inline images (>50KB)
# Replaces removed parts with a text placeholder so the .eml remains valid.
class EmailContentStripper
  SMALL_INLINE_THRESHOLD = 10_240   # 10KB - keep (signature icons, bullets)
  LARGE_INLINE_THRESHOLD = 51_200   # 50KB - strip (photos, large images)

  # Strip attachment parts from raw MIME content.
  # Returns stripped MIME string (smaller, still valid .eml).
  # Falls back to original content if parsing fails.
  def self.strip_attachments(raw_content)
    return raw_content unless raw_content.present?

    mail = Mail.read_from_string(raw_content)

    # Single-part emails have no attachments to strip
    return raw_content unless mail.multipart?

    stripped = strip_parts(mail)
    return raw_content unless stripped

    stripped.to_s
  rescue => e
    Rails.logger.warn "[EmailContentStripper] Parse failed, storing unstripped: #{e.message}"
    raw_content
  end

  def self.strip_parts(mail)
    original_parts = mail.parts.dup
    mail.parts.clear

    original_parts.each do |part|
      if keep_part?(part)
        # Recurse into nested multipart parts (e.g., multipart/alternative inside multipart/mixed)
        if part.multipart?
          strip_parts(part)
        end
        mail.parts << part
      else
        mail.parts << build_placeholder(part)
      end
    end

    mail
  end

  def self.keep_part?(part)
    content_type = part.content_type&.downcase || ""
    disposition = part.content_disposition&.downcase || ""

    # Always keep text bodies
    return true if content_type.start_with?("text/plain", "text/html")

    # Always keep nested multipart containers (we recurse into them)
    return true if content_type.start_with?("multipart/")

    # Keep small inline images (signature logos, bullet icons)
    if disposition.start_with?("inline") && content_type.start_with?("image/")
      body_size = part.body&.raw_source&.bytesize || 0
      return body_size < SMALL_INLINE_THRESHOLD
    end

    # Strip everything else (attachments, large inline images)
    false
  end

  def self.build_placeholder(original_part)
    filename = original_part.filename || "unnamed"
    original_size = original_part.body&.raw_source&.bytesize || 0
    content_type = original_part.content_type&.split(";")&.first || "application/octet-stream"

    placeholder = Mail::Part.new
    placeholder.content_type = "text/plain; charset=UTF-8"
    placeholder.content_disposition = original_part.content_disposition&.gsub(/;.*/, "") || "attachment"
    placeholder["Content-Disposition"].parameters["filename"] = filename
    placeholder["X-TEEEM-Stripped"] = "true"
    placeholder["X-TEEEM-Original-Size"] = original_size.to_s
    placeholder["X-TEEEM-Original-Content-Type"] = content_type
    placeholder.body = "[Attachment removed - stored separately in TEEEM File Warehouse]\n" \
                        "Original file: #{filename} (#{number_to_human_size(original_size)})"
    placeholder
  end

  def self.number_to_human_size(bytes)
    if bytes < 1024
      "#{bytes} B"
    elsif bytes < 1024 * 1024
      "#{(bytes / 1024.0).round(1)} KB"
    else
      "#{(bytes / (1024.0 * 1024.0)).round(1)} MB"
    end
  end

  private_class_method :strip_parts, :keep_part?, :build_placeholder, :number_to_human_size
end
