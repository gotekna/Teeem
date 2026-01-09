class XeroAccount < ApplicationRecord
  validates :code, presence: true, uniqueness: true
  validates :name, presence: true

  scope :active, -> { where(active: true) }
  scope :expense, -> { where(account_class: "EXPENSE") }
  scope :for_purchase, -> { active.expense.order(:code) }

  def display_name
    "#{code} - #{name}"
  end
end
