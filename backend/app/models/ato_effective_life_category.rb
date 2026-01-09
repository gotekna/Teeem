# World-Class Asset Register - ATO Effective Life Category
# Categories from ATO Tax Ruling TR 2023/1
class AtoEffectiveLifeCategory < ApplicationRecord
  has_many :ato_effective_life_rates, dependent: :destroy
  belongs_to :parent_category, class_name: "AtoEffectiveLifeCategory",
             foreign_key: "parent_code", primary_key: "code", optional: true
  has_many :subcategories, class_name: "AtoEffectiveLifeCategory",
           foreign_key: "parent_code", primary_key: "code"

  # Validations
  validates :code, presence: true, uniqueness: true
  validates :name, presence: true

  # Scopes
  scope :active, -> { where(active: true) }
  scope :top_level, -> { where(parent_code: nil) }

  # Get all rates for this category
  def current_rates
    ato_effective_life_rates.where(effective_until: nil)
  end

  # Search categories by name
  def self.search(query)
    where("name ILIKE ?", "%#{query}%").active
  end
end
