# frozen_string_literal: true

module SharePoint
  # =============================================================================
  # SINGLE SOURCE OF TRUTH: SharePoint Filename Sanitization
  # =============================================================================
  # This module is THE ONLY place for SharePoint filename sanitization logic.
  # All services, jobs, and clients MUST use this module.
  #
  # DO NOT add inline gsub patterns for SharePoint filenames elsewhere.
  # If you need to sanitize a filename for SharePoint, use:
  #   SharePoint::FilenameSanitizer.sanitize(filename)
  #
  # SharePoint/OneDrive Invalid Characters:
  # - " (double quote)
  # - * (asterisk)
  # - : (colon)
  # - < (less than)
  # - > (greater than)
  # - ? (question mark)
  # - / (forward slash)
  # - \ (backslash)
  # - | (pipe)
  # - + (plus) - causes URL encoding issues
  # - = (equals) - causes URL encoding issues
  # - # (hash) - URL fragment identifier
  # - % (percent) - URL encoding conflicts
  #
  # Additional restrictions:
  # - Cannot start or end with a period
  # - Cannot start or end with a space
  # - Max 400 characters for full path
  # - Max 255 characters for filename
  # =============================================================================
  module FilenameSanitizer
    # Characters that SharePoint/OneDrive cannot handle
    INVALID_CHARS = /[<>:"\/\\|?*+=#%]/

    # Characters that can cause path issues
    PATH_INVALID_CHARS = /[<>:"|?*+=#%]/

    # Maximum filename length (SharePoint limit)
    MAX_FILENAME_LENGTH = 255

    # Maximum path length (SharePoint limit)
    MAX_PATH_LENGTH = 400

    class << self
      # Sanitize a filename for SharePoint upload
      # @param filename [String] Original filename
      # @param replacement [String] Character to replace invalid chars with (default: "_")
      # @return [String] Sanitized filename safe for SharePoint
      def sanitize(filename, replacement: "_")
        return "" if filename.blank?

        result = filename.to_s.dup

        # Replace invalid characters
        result.gsub!(INVALID_CHARS, replacement)

        # Collapse multiple consecutive replacements
        result.gsub!(/#{Regexp.escape(replacement)}{2,}/, replacement)

        # Remove leading/trailing periods and spaces (SharePoint doesn't allow)
        result.strip!
        result.gsub!(/^\.+|\.+$/, "")

        # Ensure we don't start or end with the replacement character
        result.gsub!(/^#{Regexp.escape(replacement)}+|#{Regexp.escape(replacement)}+$/, "")

        # Truncate to max length while preserving extension
        if result.length > MAX_FILENAME_LENGTH
          extension = File.extname(result)
          basename = File.basename(result, extension)
          max_basename = MAX_FILENAME_LENGTH - extension.length - 1
          result = "#{basename[0...max_basename]}#{extension}"
        end

        result.presence || "unnamed_file"
      end

      # Sanitize a path segment (folder name) for SharePoint
      # @param segment [String] Folder or path segment
      # @param replacement [String] Character to replace invalid chars with
      # @return [String] Sanitized path segment
      def sanitize_path_segment(segment, replacement: "_")
        return "" if segment.blank?

        result = segment.to_s.dup

        # Path segments have slightly different rules (allow forward slash for paths)
        result.gsub!(PATH_INVALID_CHARS, replacement)

        # Collapse multiple consecutive replacements
        result.gsub!(/#{Regexp.escape(replacement)}{2,}/, replacement)

        # Remove leading/trailing periods and spaces
        result.strip!
        result.gsub!(/^\.+|\.+$/, "")

        result.presence || "unnamed_folder"
      end

      # Sanitize a full path for SharePoint
      # @param path [String] Full path with multiple segments
      # @return [String] Sanitized path
      def sanitize_path(path)
        return "" if path.blank?

        segments = path.split("/").map do |segment|
          next "" if segment.blank?
          sanitize_path_segment(segment)
        end

        result = segments.reject(&:blank?).join("/")

        # Truncate if too long
        if result.length > MAX_PATH_LENGTH
          result = result[0...MAX_PATH_LENGTH]
          # Don't truncate mid-segment
          result = result.rpartition("/").first if result.include?("/")
        end

        result
      end

      # Check if a filename is valid for SharePoint (without sanitizing)
      # @param filename [String] Filename to check
      # @return [Boolean] true if valid, false if needs sanitization
      def valid?(filename)
        return false if filename.blank?
        return false if filename.length > MAX_FILENAME_LENGTH
        return false if filename.match?(INVALID_CHARS)
        return false if filename.start_with?(".") || filename.end_with?(".")
        return false if filename.start_with?(" ") || filename.end_with?(" ")

        true
      end

      # Get list of invalid characters found in a filename
      # @param filename [String] Filename to check
      # @return [Array<String>] List of invalid characters found
      def invalid_chars_in(filename)
        return [] if filename.blank?

        filename.chars.select { |c| c.match?(INVALID_CHARS) }.uniq
      end
    end
  end
end
