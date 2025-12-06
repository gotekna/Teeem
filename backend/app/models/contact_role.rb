class ContactRole < ApplicationRecord
  CONTACT_TYPES = %w[customer supplier sales land_agent].freeze

  validates :name, presence: true, uniqueness: { case_sensitive: false }
  validate :contact_types_are_valid

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:name) }
  # Returns roles for specific type + shared roles (empty array means shared)
  scope :for_type, ->(type) { where("? = ANY(contact_types) OR contact_types = '{}'", type) }
  scope :shared, -> { where("contact_types = '{}'") } # Empty array means shared
  scope :type_specific, -> { where("contact_types != '{}'") } # Non-empty array

  before_validation :normalize_name
  before_validation :ensure_contact_types_is_array

  def shared?
    contact_types.blank? || contact_types.empty?
  end

  def type_label
    return "All Types (Shared)" if shared?
    contact_types.map(&:titleize).join(", ")
  end

  private

  def normalize_name
    self.name = name.strip if name.present?
  end

  def ensure_contact_types_is_array
    self.contact_types = [] if contact_types.nil?
  end

  def contact_types_are_valid
    return if contact_types.blank?

    invalid_types = contact_types - CONTACT_TYPES
    if invalid_types.any?
      errors.add(:contact_types, "contains invalid types: #{invalid_types.join(', ')}")
    end
  end
end
