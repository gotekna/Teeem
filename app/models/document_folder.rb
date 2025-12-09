class DocumentFolder < ApplicationRecord
  # Constants
  ENTITY_TYPES = %w[trading_company trust trustee_company].freeze

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :order_position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :entity_types, presence: true
  validate :entity_types_must_be_valid

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:order_position) }
  scope :for_entity_type, ->(entity_type) {
    where("entity_types @> ?", [entity_type].to_json)
  }

  # Class methods
  def self.folders_for_entity_type(entity_type)
    active.for_entity_type(entity_type).ordered
  end

  private

  def entity_types_must_be_valid
    return if entity_types.blank?

    invalid_types = entity_types - ENTITY_TYPES
    if invalid_types.any?
      errors.add(:entity_types, "contains invalid types: #{invalid_types.join(', ')}")
    end
  end
end
