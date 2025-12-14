class ContactAddress < ApplicationRecord
  belongs_to :contact

  ADDRESS_TYPES = %w[STREET POBOX DELIVERY].freeze

  validates :address_type, inclusion: { in: ADDRESS_TYPES }, allow_nil: true
  validate :only_one_primary_per_contact, if: :is_primary?

  # SSoT: Sync contact_addresses → legacy contact fields
  # When address changes, update the parent contact's legacy address fields
  after_save :sync_to_contact_legacy_fields
  after_destroy :sync_to_contact_legacy_fields

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

  # SSoT: Trigger sync of legacy fields on parent contact
  def sync_to_contact_legacy_fields
    return unless contact.present?

    contact.sync_legacy_address_fields_from_contact_addresses
  end
end
