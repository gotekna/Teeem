class SdaMrrcRate < ApplicationRecord
  belongs_to :sda_price_guide

  validates :participant_type, presence: true, inclusion: { in: %w[single couple_each couple_combined] }
  validates :payment_type, presence: true, inclusion: { in: %w[mrrc maximum_board] }
end
