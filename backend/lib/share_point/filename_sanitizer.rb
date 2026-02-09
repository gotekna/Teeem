# frozen_string_literal: true

# ⚠️ DEPRECATED: Use Warehouse::FilenameSanitizer instead
# This file exists only for backward compatibility during transition.
# All new code should use: Warehouse::FilenameSanitizer.sanitize(filename)
require_relative "../warehouse/filename_sanitizer"

module SharePoint
  FilenameSanitizer = Warehouse::FilenameSanitizer
end
