class DocumentFolder < ApplicationRecord
  # Constants
  ENTITY_TYPES = %w[trading_company trust trustee_company].freeze

  # Hierarchy relationships
  belongs_to :parent, class_name: "DocumentFolder", optional: true
  has_many :children, class_name: "DocumentFolder", foreign_key: :parent_id, dependent: :destroy

  # Document type relationships (via join table)
  has_many :document_type_folders, dependent: :destroy
  has_many :document_types, through: :document_type_folders

  # Validations
  validates :name, presence: true, uniqueness: { scope: :parent_id }
  validates :order_position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :entity_types, presence: true
  validate :entity_types_must_be_valid

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:order_position) }
  scope :root_folders, -> { where(parent_id: nil) }
  scope :for_entity_type, ->(entity_type) {
    where("entity_types @> ?", [ entity_type ].to_json)
  }

  # Instance methods
  def parent_name
    parent&.name
  end

  def as_nested_json
    {
      id: id,
      name: name,
      description: description,
      order_position: order_position,
      entity_types: entity_types,
      sharepoint_path: sharepoint_path,
      active: active,
      parent_id: parent_id,
      parent_name: parent_name,
      children: children.ordered.map(&:as_nested_json)
    }
  end

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
