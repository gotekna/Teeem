# frozen_string_literal: true

# Parses Xero tracking option names into structured job address fields.
#
# Pilgrim Homes format: "106HAR 106 Harold Street, Holland Park"
#   → code: "106HAR", street_number: "106", street_name: "Harold",
#     street_type: "Street", suburb: "Holland Park"
#
# Duplicate tracking categories (design vs construction):
#   "106HAR 106 Harold Street, Holland Park"   → code: "106HAR", variant: nil (primary)
#   "P-106HAR 106 Harold St, Holland Park"     → code: "106HAR", variant: "P" (design)
#   Both map to the same job. The variant prefix is stripped from the code.
#
# Also handles simpler formats like:
#   "J201 45 Smith St" → code: "J201", street_number: "45", street_name: "Smith", street_type: "St"
#   "Custom Job Name"  → code: nil, title: "Custom Job Name" (unparseable)
#
class XeroTrackingAddressParser
  # Common Australian street type abbreviations and full forms
  STREET_TYPES = %w[
    Street St Road Rd Avenue Ave Drive Dr Court Ct Place Pl
    Crescent Cres Boulevard Blvd Lane Ln Way Terrace Tce Trc
    Circuit Cct Close Cl Parade Pde Esplanade Esp Highway Hwy
    Grove Gr View Outlook Rise Mews Walk Trail Path
  ].freeze

  STREET_TYPE_PATTERN = STREET_TYPES.map { |t| Regexp.escape(t) }.join("|")

  # Known variant prefixes that indicate a duplicate tracking option for the same job
  # e.g., "P-106HAR" = Planning/Design phase of job "106HAR"
  VARIANT_PREFIXES = %w[P D C S].freeze

  # Parse a tracking option name into structured fields
  # Returns a hash with parsed components or nil values for unparseable parts
  def self.parse(tracking_option_name)
    return empty_result if tracking_option_name.blank?

    name = tracking_option_name.strip
    result = empty_result.merge(raw_name: name)

    # Step 1: Split on comma to extract suburb (last segment)
    parts = name.split(",").map(&:strip)
    if parts.length >= 2
      result[:suburb] = parts.last.strip
      address_part = parts[0..-2].join(", ").strip
    else
      address_part = name
    end

    # Step 2: Try to extract street components with regex
    # Pattern: optional_code street_number street_name street_type
    street_match = address_part.match(
      /^(\S+)\s+(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s*$/i
    )

    if street_match
      raw_code = street_match[1]
      result[:street_number] = street_match[2]
      result[:street_name] = street_match[3].strip
      result[:street_type] = normalize_street_type(street_match[4])
      result[:parsed] = true

      # Detect variant prefix (e.g., "P-106HAR" → variant: "P", code: "106HAR")
      variant_info = extract_variant(raw_code)
      result[:code] = variant_info[:code]
      result[:variant] = variant_info[:variant]
    else
      # Try without job code prefix: "45 Smith Street, Holland Park"
      no_code_match = address_part.match(
        /^(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s*$/i
      )

      if no_code_match
        result[:street_number] = no_code_match[1]
        result[:street_name] = no_code_match[2].strip
        result[:street_type] = normalize_street_type(no_code_match[3])
        result[:parsed] = true
      else
        # Try to extract just the code (first word if it looks like a code)
        first_word = address_part.split(/\s+/).first
        if first_word && first_word.match?(/\A[A-Z0-9\-]{3,}[A-Z0-9]*\z/i)
          variant_info = extract_variant(first_word)
          result[:code] = variant_info[:code]
          result[:variant] = variant_info[:variant]
          result[:title] = address_part.sub(/\A#{Regexp.escape(first_word)}\s*/, "").strip
        else
          result[:title] = address_part
        end
      end
    end

    # Step 3: Build a display title from parsed components
    if result[:parsed]
      street_parts = [result[:street_number], result[:street_name], result[:street_type]].compact.join(" ")
      result[:title] = [street_parts, result[:suburb]].compact.reject(&:blank?).join(", ")
    end

    result
  end

  # Group tracking options by their base job code, handling variants.
  # Returns a hash: { "106HAR" => [option1, option2], ... }
  # Options without a parseable code get their own unique key.
  def self.group_by_job(tracking_options)
    groups = {}
    ungrouped_idx = 0

    tracking_options.each do |option|
      parsed = parse(option["Name"])
      option["_parsed"] = parsed

      if parsed[:code].present?
        key = parsed[:code].upcase
        groups[key] ||= []
        groups[key] << option
      else
        # Ungrouped options get unique keys
        groups["_ungrouped_#{ungrouped_idx}"] = [option]
        ungrouped_idx += 1
      end
    end

    groups
  end

  # Extract variant prefix from a code like "P-106HAR"
  # Returns { code: "106HAR", variant: "P" } or { code: "106HAR", variant: nil }
  def self.extract_variant(raw_code)
    return { code: raw_code, variant: nil } if raw_code.blank?

    # Match pattern: single letter + hyphen + rest (e.g., "P-106HAR")
    variant_match = raw_code.match(/\A([A-Za-z])-(.+)\z/)
    if variant_match && VARIANT_PREFIXES.include?(variant_match[1].upcase)
      { code: variant_match[2], variant: variant_match[1].upcase }
    else
      { code: raw_code, variant: nil }
    end
  end

  # Normalize abbreviated street types to full form
  def self.normalize_street_type(type)
    return type if type.blank?

    mapping = {
      "st" => "Street", "rd" => "Road", "ave" => "Avenue",
      "dr" => "Drive", "ct" => "Court", "pl" => "Place",
      "cres" => "Crescent", "blvd" => "Boulevard", "ln" => "Lane",
      "tce" => "Terrace", "trc" => "Terrace", "cct" => "Circuit",
      "cl" => "Close", "pde" => "Parade", "esp" => "Esplanade",
      "hwy" => "Highway", "gr" => "Grove"
    }

    mapping[type.downcase] || type
  end

  def self.empty_result
    {
      raw_name: nil,
      code: nil,
      variant: nil,
      street_number: nil,
      street_name: nil,
      street_type: nil,
      suburb: nil,
      title: nil,
      parsed: false
    }
  end
end
