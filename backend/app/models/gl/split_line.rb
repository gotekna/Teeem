# frozen_string_literal: true

module Gl
  # Individual line in a split transaction
  class SplitLine < ApplicationRecord
    self.table_name = "gl_split_lines"

    belongs_to :split_transaction, class_name: "Gl::SplitTransaction"
    belongs_to :account, class_name: "Gl::Account"
    belongs_to :department, class_name: "Gl::Department", optional: true
    belongs_to :job, optional: true
    belongs_to :tax_rate, class_name: "Gl::TaxRate", optional: true

    validates :amount, presence: true, numericality: { other_than: 0 }

    before_save :calculate_percentage

    private

    def calculate_percentage
      return unless split_transaction&.original_amount&.positive?
      self.percentage = (amount / split_transaction.original_amount * 100).round(2)
    end
  end
end
