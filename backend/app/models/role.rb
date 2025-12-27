# frozen_string_literal: true

class Role < ApplicationRecord
  # Associations
  has_many :user_roles, dependent: :destroy
  has_many :users, through: :user_roles

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position) }

  # Class methods
  def self.for_select
    active.ordered.pluck(:name, :display_name).map { |name, display| { value: name, label: display } }
  end
end
