class PricebookCategory < ApplicationRecord
  # Associations
  has_many :pricebook_items, foreign_key: :category_id, dependent: :nullify

  # Validations
  validates :name, presence: true, uniqueness: { case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  # Callbacks
  before_create :set_default_position

  # Class methods
  def self.for_dropdown
    active.ordered.pluck(:name, :id)
  end

  # Instance methods
  def display_name_or_name
    display_name.presence || name
  end

  def items_count
    pricebook_items.count
  end

  private

  def set_default_position
    self.position ||= (PricebookCategory.maximum(:position) || 0) + 1
  end
end
