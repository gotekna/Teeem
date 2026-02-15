# frozen_string_literal: true

# Detects and splits couple contacts from Xero into individual person contacts.
#
# Examples:
#   "Madeleine Childs & Nicholas Childs"
#     → person1: { first: "Madeleine", last: "Childs" }
#     → person2: { first: "Nicholas", last: "Childs" }
#
#   "ARJUN & MEERA GANDHI"
#     → person1: { first: "Arjun", last: "Gandhi" }
#     → person2: { first: "Meera", last: "Gandhi" }
#
#   "Brock Trigger & Sue Rosairo"
#     → person1: { first: "Brock", last: "Trigger" }
#     → person2: { first: "Sue", last: "Rosairo" }
#
# Does NOT split company names like "Design & Build Pty Ltd"
#
class XeroContactCoupleSplitter
  # Words that indicate this is a company, not a couple
  COMPANY_INDICATORS = %w[
    pty ltd trust corp group atf trading holdings investments
    services supplies construction consulting management solutions
    builders building developments properties associates
    enterprises industries partners partnership foundation
    incorporated inc limited co company
  ].freeze

  # Check if a Xero contact name looks like a couple that should be split
  def self.couple?(name)
    return false if name.blank?

    result = analyze(name)
    result[:is_couple]
  end

  # Analyze a contact name and return split result
  # Returns { is_couple: bool, person1: { first:, last: }, person2: { first:, last: }, reason: }
  def self.analyze(name)
    return { is_couple: false, reason: "blank" } if name.blank?

    cleaned = name.strip

    # Quick reject: company indicators
    if contains_company_indicator?(cleaned)
      return { is_couple: false, reason: "company_indicator" }
    end

    # Must contain " & " to be a couple
    return { is_couple: false, reason: "no_ampersand" } unless cleaned.include?(" & ")

    # Split on " & "
    sides = cleaned.split(" & ", 2).map(&:strip)
    left = sides[0]
    right = sides[1]

    # Both sides must be non-empty
    return { is_couple: false, reason: "empty_side" } if left.blank? || right.blank?

    # Check each side for company indicators
    if contains_company_indicator?(left) || contains_company_indicator?(right)
      return { is_couple: false, reason: "company_indicator_in_side" }
    end

    left_words = left.split(/\s+/)
    right_words = right.split(/\s+/)

    # Single word on BOTH sides (like "Design & Build") → not a couple
    if left_words.length == 1 && right_words.length == 1
      return { is_couple: false, reason: "single_words_both_sides" }
    end

    # Parse the names
    person1, person2 = parse_couple_names(left_words, right_words)

    # Validate they look like real names (at least a first name each)
    if person1[:first].blank? || person2[:first].blank?
      return { is_couple: false, reason: "missing_first_name" }
    end

    {
      is_couple: true,
      person1: person1,
      person2: person2,
      original_name: cleaned,
      reason: "couple_detected"
    }
  end

  # Split names handling shared last name patterns
  def self.parse_couple_names(left_words, right_words)
    # Case 1: Both sides have first + last → "Madeleine Childs & Nicholas Childs"
    if left_words.length >= 2 && right_words.length >= 2
      person1 = { first: titleize_name(left_words[0..-2].join(" ")), last: titleize_name(left_words.last) }
      person2 = { first: titleize_name(right_words[0..-2].join(" ")), last: titleize_name(right_words.last) }
      return [person1, person2]
    end

    # Case 2: "ARJUN & MEERA GANDHI" → shared last name on right side
    if left_words.length == 1 && right_words.length >= 2
      shared_last = titleize_name(right_words.last)
      person1 = { first: titleize_name(left_words[0]), last: shared_last }
      person2 = { first: titleize_name(right_words[0..-2].join(" ")), last: shared_last }
      return [person1, person2]
    end

    # Case 3: "JOHN SMITH & JANE" → shared last name from left side
    if left_words.length >= 2 && right_words.length == 1
      shared_last = titleize_name(left_words.last)
      person1 = { first: titleize_name(left_words[0..-2].join(" ")), last: shared_last }
      person2 = { first: titleize_name(right_words[0]), last: shared_last }
      return [person1, person2]
    end

    # Fallback: treat each side as first name only
    [
      { first: titleize_name(left_words.join(" ")), last: nil },
      { first: titleize_name(right_words.join(" ")), last: nil }
    ]
  end

  # Create individual contacts from a couple analysis result
  # Returns array of created contacts, or empty array if not a couple
  def self.create_contacts_from_couple(analysis, xero_contact: nil, tenant: nil)
    return [] unless analysis[:is_couple]

    contacts = []

    [analysis[:person1], analysis[:person2]].each do |person|
      contact = Contact.find_or_initialize_by(
        first_name: person[:first],
        last_name: person[:last],
        entity_type: "person",
        tenant_id: tenant&.id || ActsAsTenant.current_tenant&.id
      )

      if contact.new_record?
        contact.display_name = [person[:first], person[:last]].compact.join(" ")
        contact.save!
      end

      contacts << contact
    end

    # Create relationship between the two if both exist
    if contacts.length == 2
      ContactRelationship.find_or_create_by!(
        source_contact: contacts[0],
        related_contact: contacts[1],
        relationship_type: "co_client"
      ) rescue nil # Ignore if relationship type not valid
    end

    contacts
  end

  private

  def self.contains_company_indicator?(text)
    words = text.downcase.gsub(/[^a-z\s\/]/, " ").split(/[\s\/]+/)
    (words & COMPANY_INDICATORS).any?
  end

  # Titleize names properly (handles ALL CAPS input)
  def self.titleize_name(name)
    return nil if name.blank?

    name.split(/\s+/).map do |word|
      # Handle McName, O'Name patterns
      if word.match?(/\AMc[A-Z]/i)
        "Mc" + word[2..].capitalize
      elsif word.include?("'")
        word.split("'").map(&:capitalize).join("'")
      else
        word.capitalize
      end
    end.join(" ")
  end
end
