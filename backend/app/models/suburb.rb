class Suburb < ApplicationRecord
  validates :name, presence: true
  validates :postcode, presence: true
  validates :state, presence: true
  validates :name, uniqueness: { scope: :state, message: "already exists in this state" }

  scope :active, -> { where(is_active: true) }
  scope :by_state, ->(state) { where(state: state) }
  scope :with_council, -> { where.not(council: nil) }
  scope :search, ->(query) {
    where("name ILIKE ? OR postcode ILIKE ?", "%#{query}%", "%#{query}%")
  }
  scope :ordered, -> { order(:name) }
end
