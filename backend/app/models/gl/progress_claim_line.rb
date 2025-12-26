# frozen_string_literal: true

module Gl
  # Line items for progress claims (detailed breakdown)
  class ProgressClaimLine < ApplicationRecord
    self.table_name = "gl_progress_claim_lines"

    belongs_to :progress_claim, class_name: "Gl::ProgressClaim"

    validates :description, presence: true
    validates :contract_value, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :this_pct, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }

    before_save :calculate_amounts

    default_scope { order(:sort_order) }

    private

    def calculate_amounts
      self.total_pct = previous_pct.to_d + this_pct.to_d
      self.this_claim_amount = (contract_value * this_pct / 100).round(2)
    end
  end
end
