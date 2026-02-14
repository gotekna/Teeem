# frozen_string_literal: true

# MimeTypes - SSoT for MIME type string constants
#
# Replace hardcoded MIME type strings with semantic constants:
#   send_data(pdf, type: "application/pdf")  # ❌
#   send_data(pdf, type: MimeTypes::PDF)     # ✅
#
# Includes common document, image, and data formats used across TEEEM.
#
module MimeTypes
  # Documents
  PDF = "application/pdf".freeze
  DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".freeze
  XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".freeze
  PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation".freeze

  # Data formats
  JSON = "application/json".freeze
  CSV = "text/csv".freeze
  OCTET_STREAM = "application/octet-stream".freeze

  # Images
  PNG = "image/png".freeze
  JPEG = "image/jpeg".freeze
  JPG = "image/jpeg".freeze  # Alias for JPEG
  GIF = "image/gif".freeze
end
