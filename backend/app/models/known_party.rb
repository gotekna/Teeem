class KnownParty < ApplicationRecord
  belongs_to :contact, optional: true

  validates :name, presence: true
  validates :email, uniqueness: { allow_blank: true }
  validates :default_alignment, inclusion: { in: %w[friendly neutral opposing], allow_blank: true }

  scope :by_email, ->(email) { where("LOWER(email) = LOWER(?)", email) if email.present? }
  scope :by_name, ->(name) { where("LOWER(name) = LOWER(?)", name) if name.present? }
  scope :by_name_and_org, ->(name, org) {
    where("LOWER(name) = LOWER(?) AND LOWER(organisation) = LOWER(?)", name, org) if name.present? && org.present?
  }

  # Find a known party by email or name+organisation
  def self.find_match(name:, email: nil, organisation: nil)
    # First try email (most reliable)
    if email.present?
      found = by_email(email).first
      return found if found
    end

    # Then try name + organisation
    if name.present? && organisation.present?
      found = by_name_and_org(name, organisation).first
      return found if found
    end

    # Finally try just name (less reliable, may have duplicates)
    if name.present?
      found = by_name(name).first
      return found if found
    end

    nil
  end

  # Create or update a known party from case contact data
  def self.upsert_from_party(party_data)
    return nil unless party_data["name"].present?

    email = party_data["email"]
    email = nil if email.blank? || email.include?("example.com")

    existing = find_match(
      name: party_data["name"],
      email: email,
      organisation: party_data["company"]
    )

    if existing
      # Update with new info (only if provided)
      updates = { seen_count: existing.seen_count + 1, last_seen_at: Time.current }
      updates[:email] = email if email.present? && existing.email.blank?
      updates[:phone] = party_data["phone"] if party_data["phone"].present?
      updates[:organisation] = party_data["company"] if party_data["company"].present? && existing.organisation.blank?
      updates[:relationship_type] = party_data["relationship_type"] if party_data["relationship_type"].present?
      updates[:default_alignment] = party_data["alignment"] if party_data["alignment"].present?

      existing.update(updates)
      existing
    else
      # Create new
      create(
        name: party_data["name"],
        email: email,
        phone: party_data["phone"],
        organisation: party_data["company"],
        relationship_type: party_data["relationship_type"],
        default_alignment: party_data["alignment"] || "neutral",
        last_seen_at: Time.current
      )
    end
  end

  # Update linked contact with latest details
  def sync_to_contact!
    return unless contact

    updates = {}
    updates[:email] = email if email.present? && contact.email.blank?
    updates[:mobile_phone] = phone if phone.present? && contact.mobile_phone.blank?

    # SSoT: Link to company via primary_company_id (creates relationship via callback)
    # Don't just set company_name_or_trust text - that bypasses the relationship system
    if organisation.present? && contact.primary_company_id.blank? && contact.entity_type == "person"
      # Try to find the company contact by name
      company = Contact.where(entity_type: %w[company trust])
                       .where("LOWER(company_name_or_trust) = LOWER(?) OR LOWER(display_name) = LOWER(?)",
                              organisation, organisation)
                       .first
      if company
        # Set primary_company_id - callback will create employee_of relationship
        updates[:primary_company_id] = company.id
      else
        # Company doesn't exist yet - store as text for now (legacy fallback)
        # TODO: Consider creating the company contact automatically
        updates[:company_name_or_trust] = organisation if contact.company_name_or_trust.blank?
      end
    end

    contact.update(updates) if updates.present?
  end
end
