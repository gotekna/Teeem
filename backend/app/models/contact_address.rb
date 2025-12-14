class ContactAddress < ApplicationRecord
  belongs_to :contact

  ADDRESS_TYPES = %w[STREET POBOX DELIVERY].freeze

  validates :address_type, inclusion: { in: ADDRESS_TYPES }, allow_nil: true
  validate :only_one_primary_per_contact, if: :is_primary?

  # SSoT: contact_addresses IS the source of truth for all address data.
  # Legacy columns on contacts table have been removed.
  # Clear parent contact's address cache when addresses change.
  after_save :clear_contact_address_cache
  after_destroy :clear_contact_address_cache

  scope :primary, -> { where(is_primary: true) }
  scope :secondary, -> { where(is_primary: false) }
  scope :street, -> { where(address_type: "STREET") }
  scope :pobox, -> { where(address_type: "POBOX") }
  scope :delivery, -> { where(address_type: "DELIVERY") }

  def display_address
    parts = [ line1, line2, line3, line4, city, region, postal_code, country ].compact.reject(&:empty?)
    parts.join(", ")
  end

  def single_line
    display_address
  end

  def multi_line
    lines = []
    lines << line1 if line1.present?
    lines << line2 if line2.present?
    lines << line3 if line3.present?
    lines << line4 if line4.present?

    city_line = [ city, region, postal_code ].compact.reject(&:empty?).join(" ")
    lines << city_line if city_line.present?
    lines << country if country.present?

    lines.join("\n")
  end

  private

  def only_one_primary_per_contact
    if contact && contact.contact_addresses.where(is_primary: true).where.not(id: id).exists?
      errors.add(:is_primary, "can only have one primary address")
    end
  end

  # Clear parent contact's cached address lookup
  def clear_contact_address_cache
    contact&.clear_address_cache!
  end
end
