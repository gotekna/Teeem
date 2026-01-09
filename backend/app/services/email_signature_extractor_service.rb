# Extracts contact information from email signatures
# Used for contact enrichment - populating missing phone/address/title fields
class EmailSignatureExtractorService
  # Common signature markers to identify signature block
  SIGNATURE_MARKERS = [
    /^--\s*$/,                          # -- on its own line
    /^_{3,}$/,                           # ___
    /^-{3,}$/,                           # ---
    /^Best\s*(regards|wishes)?/i,        # Best regards
    /^Kind\s*regards/i,                  # Kind regards
    /^Regards/i,                         # Regards
    /^Thanks/i,                          # Thanks
    /^Cheers/i,                          # Cheers
    /^Sincerely/i,                       # Sincerely
    /^Sent from my/i,                    # Sent from my iPhone
    /^Get Outlook for/i                  # Get Outlook for iOS
  ].freeze

  # Phone number patterns (Australian focus)
  PHONE_PATTERNS = [
    /(?:Phone|Ph|Tel|T|Office|O|Direct|D)[\s:]*([+\d\s\-().]{8,18})/i,
    /(?:Mobile|Mob|M|Cell|C)[\s:]*([+\d\s\-().]{8,18})/i,
    /(?:Fax|F)[\s:]*([+\d\s\-().]{8,18})/i,
    /(\+?61\s*\d[\s\d\-().]{8,15})/,     # Australian +61 format
    /(0[2478]\s*\d{4}\s*\d{4})/,          # Australian landline
    /(04\d{2}\s*\d{3}\s*\d{3})/           # Australian mobile
  ].freeze

  # ABN pattern (Australian Business Number)
  ABN_PATTERN = /ABN[\s:]*(\d{2}\s*\d{3}\s*\d{3}\s*\d{3})/i

  # ACN pattern (Australian Company Number)
  ACN_PATTERN = /ACN[\s:]*(\d{3}\s*\d{3}\s*\d{3})/i

  # Address patterns
  ADDRESS_PATTERNS = [
    /(?:Address|A)[\s:]*(.+?)(?:\n|$)/i,
    /(\d+\s+[A-Z][a-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Way|Lane|Ln)[,\s]+[A-Z][a-z]+(?:\s+[A-Z]+)?(?:\s+\d{4})?)/,
    /(Level\s+\d+[,\s]+\d+\s+[A-Z][a-z]+\s+(?:Street|St|Road|Rd)[,\s]+[A-Z][a-z]+)/i,
    /PO\s+Box\s+\d+[,\s]+[A-Z][a-z]+(?:\s+[A-Z]+)?(?:\s+\d{4})?/i
  ].freeze

  # Title patterns
  TITLE_PATTERNS = [
    /(?:Director|CEO|CFO|CTO|COO|Manager|Supervisor|Coordinator|Administrator|Executive|Assistant|Consultant|Analyst|Engineer|Developer|Designer|Architect|Partner|Principal|Associate|Senior|Junior|Lead|Head|Chief)/i
  ].freeze

  def initialize(email_warehouse)
    @email = email_warehouse
    @body_text = email_warehouse.body_text.to_s
  end

  # Extract all contact information from signature
  def extract
    return {} if @body_text.blank?

    signature_block = find_signature_block

    {
      phone: extract_phone(signature_block),
      mobile: extract_mobile(signature_block),
      office_phone: extract_office_phone(signature_block),
      fax: extract_fax(signature_block),
      title: extract_title(signature_block),
      company: extract_company(signature_block),
      address: extract_address(signature_block),
      abn: extract_abn(signature_block),
      acn: extract_acn(signature_block),
      website: extract_website(signature_block),
      linkedin: extract_linkedin(signature_block),
      raw_signature: signature_block.presence
    }.compact
  end

  # Enrich a contact with extracted data (only fills empty fields)
  def enrich_contact!(contact)
    return false if contact.nil?

    extracted = extract
    return false if extracted.empty?

    updates = {}

    # Only update fields that are currently empty
    updates[:mobile_phone] = extracted[:mobile] if contact.mobile_phone.blank? && extracted[:mobile].present?
    updates[:office_phone] = extracted[:office_phone] || extracted[:phone] if contact.office_phone.blank? && (extracted[:office_phone].present? || extracted[:phone].present?)
    # Create contact_address if extracted and contact has none (SSoT)
    if contact.contact_addresses.empty? && extracted[:address].present?
      contact.contact_addresses.create!(
        address_type: "STREET",
        line1: extracted[:address],
        is_primary: true
      )
    end
    updates[:title] = extracted[:title] if contact.title.blank? && extracted[:title].present?

    return false if updates.empty?

    contact.update!(updates)

    # Store extraction data in email for audit trail
    @email.update!(
      extracted_contacts: (@email.extracted_contacts || {}).merge(
        contact.id.to_s => {
          extracted_at: Time.current.iso8601,
          fields_updated: updates.keys,
          source_email_id: @email.id
        }
      )
    )

    true
  end

  private

  def find_signature_block
    lines = @body_text.split("\n")

    # Find where signature likely starts
    signature_start = nil

    lines.each_with_index do |line, index|
      if SIGNATURE_MARKERS.any? { |marker| line.match?(marker) }
        signature_start = index
        break
      end
    end

    # If no marker found, look at last 15 lines (typical signature length)
    if signature_start.nil? && lines.length > 15
      signature_start = lines.length - 15
    end

    return "" if signature_start.nil?

    lines[signature_start..].join("\n")
  end

  def extract_phone(text)
    PHONE_PATTERNS.each do |pattern|
      match = text.match(pattern)
      return normalize_phone(match[1]) if match
    end
    nil
  end

  def extract_mobile(text)
    # Look specifically for mobile
    patterns = [
      /(?:Mobile|Mob|M|Cell|C)[\s:]*([+\d\s\-().]{8,18})/i,
      /(04\d{2}\s*\d{3}\s*\d{3})/  # Australian mobile
    ]

    patterns.each do |pattern|
      match = text.match(pattern)
      return normalize_phone(match[1]) if match
    end
    nil
  end

  def extract_office_phone(text)
    patterns = [
      /(?:Phone|Ph|Tel|T|Office|O|Direct|D)[\s:]*([+\d\s\-().]{8,18})/i,
      /(0[2478]\s*\d{4}\s*\d{4})/  # Australian landline
    ]

    patterns.each do |pattern|
      match = text.match(pattern)
      phone = normalize_phone(match[1])
      # Make sure it's not a mobile (doesn't start with 04)
      return phone if phone && !phone.start_with?("04")
    end
    nil
  end

  def extract_fax(text)
    match = text.match(/(?:Fax|F)[\s:]*([+\d\s\-().]{8,18})/i)
    normalize_phone(match[1]) if match
  end

  def extract_title(text)
    TITLE_PATTERNS.each do |pattern|
      match = text.match(pattern)
      return match[0].strip if match
    end
    nil
  end

  def extract_company(text)
    # Look for company indicators
    patterns = [
      /(?:Company|Firm|Organisation|Organization)[\s:]*(.+?)(?:\n|$)/i,
      /Pty\s+Ltd/i,
      /(?:Ltd|Limited|Inc|Corp|LLC)(?:\s|$)/i
    ]

    # This is tricky - often company is just on its own line
    # For now, return nil and rely on AI for complex cases
    nil
  end

  def extract_address(text)
    ADDRESS_PATTERNS.each do |pattern|
      match = text.match(pattern)
      return match[1]&.strip || match[0]&.strip if match
    end
    nil
  end

  def extract_abn(text)
    match = text.match(ABN_PATTERN)
    match[1]&.gsub(/\s/, "") if match
  end

  def extract_acn(text)
    match = text.match(ACN_PATTERN)
    match[1]&.gsub(/\s/, "") if match
  end

  def extract_website(text)
    match = text.match(/(?:Website|Web|www)[\s:]*(\S+)/i) ||
            text.match(/(https?:\/\/[^\s]+)/i) ||
            text.match(/(www\.[^\s]+)/i)
    match[1]&.strip if match
  end

  def extract_linkedin(text)
    match = text.match(/linkedin\.com\/in\/([^\s\/]+)/i)
    "linkedin.com/in/#{match[1]}" if match
  end

  def normalize_phone(phone)
    return nil if phone.blank?

    # Remove all non-digit characters except +
    clean = phone.gsub(/[^\d+]/, "")

    # Minimum length check
    return nil if clean.length < 8

    clean
  end
end
