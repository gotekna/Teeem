class UserGroup < ApplicationRecord
  has_many :users, dependent: :nullify

  validates :name, presence: true, uniqueness: true
  validates :label, presence: true

  # Format: { groups: [{ value: 'name', label: 'Label' }, ...] }
  def self.as_dropdown_options
    order(:label).pluck(:name, :label).map { |name, label| { value: name, label: label } }
  end
end
