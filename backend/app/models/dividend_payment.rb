class DividendPayment < ApplicationRecord
  # Associations
  belongs_to :dividend
  belongs_to :shareholder, class_name: "Contact"

  # Validations
  validates :shareholder_id, uniqueness: { scope: :dividend_id, message: "already has a payment for this dividend" }

  # Scopes
  scope :paid, -> { where.not(paid_date: nil) }
  scope :unpaid, -> { where(paid_date: nil) }
  scope :by_date, -> { order(paid_date: :desc) }

  # Callbacks
  before_save :calculate_amounts

  def paid?
    paid_date.present?
  end

  def shareholder_name
    shareholder&.display_name
  end

  def company
    dividend&.company
  end

  private

  def calculate_amounts
    return unless dividend.present?

    # Calculate based on shares held and dividend per share
    if shares_held.to_i > 0
      per_share = dividend.dividend_per_share
      self.gross_amount ||= (shares_held * per_share).round(2)
      self.franking_credit ||= (gross_amount * dividend.franking_percentage.to_f / 100 * 30 / 70).round(2)
      self.net_amount ||= gross_amount
    end
  end
end
