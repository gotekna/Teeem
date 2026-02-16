# frozen_string_literal: true

# Parses Xero tracking option names into structured job address fields.
#
# Pilgrim Homes format: "106HAR 106 Harold Street, Holland Park"
#   → code: "106HAR", street_number: "106", street_name: "Harold",
#     street_type: "Street", suburb: "Holland Park"
#
# Lot+comma format: "IL23031 Lot2, 90 Uplands Terrace Wynnum"
#   → code: "IL23031", lot_number: "2", street_number: "90",
#     street_name: "Uplands", street_type: "Terrace", suburb: "Wynnum"
#   (comma separates lot from address, NOT address from suburb)
#
# Variant tracking categories (same job, different phases):
#   "106HAR 106 Harold Street, Holland Park"   → code: "106HAR", variant: nil
#   "P-106HAR 106 Harold St, Holland Park"     → code: "106HAR", variant: "P" (Production = SSoT)
#   Both map to the same job. P = Production is the authoritative source.
#
# Underscore-delimited format (suburb-first):
#   "PILD2206 CAMP HILL_LOT 2_62 BROOKS ST_KYABEL"
#   → code: "PILD2206", suburb: "Camp Hill", lot_number: "2",
#     street_number: "62", street_name: "Brooks", street_type: "Street"
#   Segments: CODE+SUBURB _ LOT _ ADDRESS _ (extra ignored)
#
# Also handles simpler formats like:
#   "J201 45 Smith St" → code: "J201", street_number: "45", street_name: "Smith", street_type: "St"
#   "CODE 90 Uplands Tce Wynnum" → suburb extracted after street type (no comma needed)
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
  # P = Production (SSoT), D = Design, C = Construction, S = Site
  # e.g., "P-106HAR" = Production phase of job "106HAR" (authoritative data source)
  VARIANT_PREFIXES = %w[P D C S].freeze

  # The production variant is the SSoT when data differs between variants
  PRODUCTION_VARIANT = "P".freeze

  # Parse a tracking option name into structured fields
  # Returns a hash with parsed components or nil values for unparseable parts
  def self.parse(tracking_option_name)
    return empty_result if tracking_option_name.blank?

    name = tracking_option_name.strip
    result = empty_result.merge(raw_name: name)

    # Step 0: Underscore-delimited format (suburb-first)
    # "PILD2206 CAMP HILL_LOT 2_62 BROOKS ST_KYABEL"
    if name.include?("_")
      underscore_result = parse_underscore_format(name)
      return underscore_result if underscore_result[:parsed]
    end

    # Step 1: Split on comma to extract suburb (last segment)
    parts = name.split(",").map(&:strip)
    if parts.length >= 2
      result[:suburb] = parts.last.strip
      address_part = parts[0..-2].join(", ").strip
    else
      address_part = name
    end

    # Step 1.5: Extract lot number from address_part if present
    # Handles: "CODE Lot2 NUM Street...", "CODE Lot 5A NUM Street..."
    lot_in_address = address_part.match(/\bLot\s*(\d+[A-Za-z]?)\b,?\s*/i)
    if lot_in_address
      result[:lot_number] = lot_in_address[1]
      address_part = address_part.sub(lot_in_address[0], "").strip
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
        # ─── FALLBACK A: Lot+comma format ───
        # "IL23031 Lot2, 90 Uplands Terrace Wynnum"
        # Comma separated lot from address instead of address from suburb.
        # Detected when "suburb" contains a street type (it's actually the address).
        if result[:suburb].present? && result[:suburb].match?(/\b(#{STREET_TYPE_PATTERN})\b/i)
          parse_lot_comma_format(result, name)
        end

        # ─── FALLBACK B: No comma, suburb after street type ───
        # "CODE 90 Uplands Terrace Wynnum" (suburb follows street type, no comma)
        unless result[:parsed]
          with_suburb = address_part.match(
            /^(\S+)\s+(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s+(.+)$/i
          )
          if with_suburb
            raw_code = with_suburb[1]
            variant_info = extract_variant(raw_code)
            result[:code] = variant_info[:code]
            result[:variant] = variant_info[:variant]
            result[:street_number] = with_suburb[2]
            result[:street_name] = with_suburb[3].strip
            result[:street_type] = normalize_street_type(with_suburb[4])
            result[:suburb] = with_suburb[5].strip
            result[:parsed] = true
          end
        end

        # ─── FALLBACK C: No code, suburb after street type ───
        # "90 Uplands Terrace Wynnum"
        unless result[:parsed]
          no_code_with_suburb = address_part.match(
            /^(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s+(.+)$/i
          )
          if no_code_with_suburb
            result[:street_number] = no_code_with_suburb[1]
            result[:street_name] = no_code_with_suburb[2].strip
            result[:street_type] = normalize_street_type(no_code_with_suburb[3])
            result[:suburb] = no_code_with_suburb[4].strip
            result[:parsed] = true
          end
        end

        # Original fallback: extract just the code
        unless result[:parsed]
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

  # Select the SSoT (primary) option from a group of variants.
  # P (Production) is authoritative when present; otherwise falls back to non-variant.
  def self.primary_option(options)
    # Prefer Production variant (P-prefix) as SSoT
    production = options.find { |o| o["_parsed"][:variant] == PRODUCTION_VARIANT }
    return production if production

    # Fall back to non-variant (base code)
    non_variant = options.find { |o| o["_parsed"][:variant].nil? }
    non_variant || options.first
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

  # Parse "CODE LotX, NUM STREET TYPE SUBURB" format
  # where comma incorrectly separates lot from address instead of address from suburb
  def self.parse_lot_comma_format(result, full_name)
    # Remove commas and work with clean text
    clean = full_name.gsub(",", " ").squeeze(" ").strip

    # Extract code (first word)
    code_match = clean.match(/^(\S+)\s+(.+)$/)
    return unless code_match

    raw_code = code_match[1]
    remaining = code_match[2]

    # Check if first word looks like a code
    if raw_code.match?(/\A[A-Z0-9\-]{3,}[A-Z0-9]*\z/i)
      variant_info = extract_variant(raw_code)
      result[:code] = variant_info[:code]
      result[:variant] = variant_info[:variant]
    else
      remaining = clean # Not a code, use full text
    end

    # Extract lot number
    lot_match = remaining.match(/\bLot\s*(\d+[A-Za-z]?)\b/i)
    if lot_match
      result[:lot_number] = lot_match[1]
      remaining = remaining.sub(lot_match[0], "").strip
    end

    # Parse: NUM STREET TYPE SUBURB
    addr_match = remaining.match(
      /^(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s+(.+)$/i
    )

    if addr_match
      result[:street_number] = addr_match[1]
      result[:street_name] = addr_match[2].strip
      result[:street_type] = normalize_street_type(addr_match[3])
      result[:suburb] = addr_match[4].strip
      result[:parsed] = true
    else
      # Try without suburb (street type at end)
      addr_no_suburb = remaining.match(
        /^(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\s*$/i
      )
      if addr_no_suburb
        result[:street_number] = addr_no_suburb[1]
        result[:street_name] = addr_no_suburb[2].strip
        result[:street_type] = normalize_street_type(addr_no_suburb[3])
        result[:suburb] = nil
        result[:parsed] = true
      end
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

    mapping[type.downcase] || type.capitalize
  end

  # Parse underscore-delimited format (suburb-first)
  # "PILD2206 CAMP HILL_LOT 2_62 BROOKS ST_KYABEL"
  # Segments: [CODE SUBURB, LOT X, NUM STREET TYPE, HOUSE_NAME]
  def self.parse_underscore_format(name)
    result = empty_result.merge(raw_name: name)
    segments = name.split("_").map(&:strip).reject(&:blank?)

    return result if segments.length < 2

    # First segment: CODE SUBURB (e.g., "PILD2206 CAMP HILL")
    first_seg = segments[0]
    first_words = first_seg.split(/\s+/)
    if first_words.length >= 2 && first_words[0].match?(/\A[A-Z0-9\-]{3,}[A-Z0-9]*\z/i)
      variant_info = extract_variant(first_words[0])
      result[:code] = variant_info[:code]
      result[:variant] = variant_info[:variant]
      result[:suburb] = first_words[1..].join(" ").strip.titlecase
    elsif first_words.length == 1 && first_words[0].match?(/\A[A-Z0-9\-]{3,}[A-Z0-9]*\z/i)
      variant_info = extract_variant(first_words[0])
      result[:code] = variant_info[:code]
      result[:variant] = variant_info[:variant]
    end

    # Process remaining segments
    segments[1..].each do |seg|
      # LOT segment
      lot_match = seg.match(/\ALOT\s*(\d+[A-Za-z]?)\z/i)
      if lot_match
        result[:lot_number] = lot_match[1]
        next
      end

      # Address segment: NUM STREET TYPE
      addr_match = seg.match(/\A(\d+[A-Za-z]?)\s+(.+?)\s+(#{STREET_TYPE_PATTERN})\z/i)
      if addr_match
        result[:street_number] = addr_match[1]
        result[:street_name] = addr_match[2].strip.titlecase
        result[:street_type] = normalize_street_type(addr_match[3])
        result[:parsed] = true
        next
      end

      # Remaining segment = house name (e.g., "KYABEL")
      if result[:house_name].nil? && result[:parsed]
        result[:house_name] = seg.strip.titlecase
      end
    end

    # Build display title
    if result[:parsed]
      street_parts = [result[:street_number], result[:street_name], result[:street_type]].compact.join(" ")
      result[:title] = [street_parts, result[:suburb]].compact.reject(&:blank?).join(", ")
    end

    result
  end

  def self.empty_result
    {
      raw_name: nil,
      code: nil,
      variant: nil,
      lot_number: nil,
      street_number: nil,
      street_name: nil,
      street_type: nil,
      suburb: nil,
      house_name: nil,
      title: nil,
      parsed: false
    }
  end
end
