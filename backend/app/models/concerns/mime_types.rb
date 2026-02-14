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
  PDF = "application/pdf"
  DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

  # Data formats
  JSON = "application/json"
  CSV = "text/csv"
  OCTET_STREAM = "application/octet-stream"

  # Images
  PNG = "image/png"
  JPEG = "image/jpeg"
  JPG = "image/jpeg"  # Alias for JPEG
  GIF = "image/gif"
end
