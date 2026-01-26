# frozen_string_literal: true

# ContentTypeDetector - SSoT for detecting MIME types from filenames
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE place for content type detection                   ║
# ║  All other implementations should use this module                 ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   ContentTypeDetector.detect("document.pdf")  # => "application/pdf"
#   ContentTypeDetector.detect("image.jpg")     # => "image/jpeg"
#   ContentTypeDetector.detect("unknown.xyz")   # => "application/octet-stream"
#
module ContentTypeDetector
  # SSoT: All known content types mapped by extension
  CONTENT_TYPES = {
    # Documents
    ".pdf"  => "application/pdf",
    ".doc"  => "application/msword",
    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls"  => "application/vnd.ms-excel",
    ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt"  => "application/vnd.ms-powerpoint",
    ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".mpp"  => "application/vnd.ms-project",

    # Text
    ".txt"  => "text/plain",
    ".csv"  => "text/csv",
    ".json" => "application/json",
    ".xml"  => "application/xml",
    ".html" => "text/html",
    ".htm"  => "text/html",

    # Images
    ".jpg"  => "image/jpeg",
    ".jpeg" => "image/jpeg",
    ".png"  => "image/png",
    ".gif"  => "image/gif",
    ".webp" => "image/webp",
    ".svg"  => "image/svg+xml",
    ".bmp"  => "image/bmp",
    ".tiff" => "image/tiff",
    ".tif"  => "image/tiff",
    ".heic" => "image/heic",

    # Video
    ".mp4"  => "video/mp4",
    ".mov"  => "video/quicktime",
    ".avi"  => "video/x-msvideo",
    ".webm" => "video/webm",

    # Audio
    ".mp3"  => "audio/mpeg",
    ".wav"  => "audio/wav",

    # Archives
    ".zip"  => "application/zip",
    ".rar"  => "application/vnd.rar",
    ".7z"   => "application/x-7z-compressed",
    ".tar"  => "application/x-tar",
    ".gz"   => "application/gzip",

    # Email
    ".eml"  => "message/rfc822",
    ".msg"  => "application/vnd.ms-outlook"
  }.freeze

  DEFAULT_CONTENT_TYPE = "application/octet-stream"

  # Detect content type from filename
  # @param filename [String] The filename or path
  # @return [String] The MIME type
  def self.detect(filename)
    return DEFAULT_CONTENT_TYPE unless filename.is_a?(String) && filename.present?

    extension = File.extname(filename).downcase
    CONTENT_TYPES[extension] || DEFAULT_CONTENT_TYPE
  end

  # Alias for compatibility with existing code
  class << self
    alias_method :detect_content_type, :detect
    alias_method :for_filename, :detect
  end
end
