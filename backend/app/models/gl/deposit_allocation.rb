# frozen_string_literal: true

module Gl
  # Tracks which invoices a deposit has been applied to
  class DepositAllocation < ApplicationRecord
    self.table_name = "gl_deposit_allocations"

    belongs_to :deposit, class_name: "Gl::Deposit"
    belongs_to :invoice, class_name: "Gl::Invoice"
    belongs_to :allocated_by, class_name: "User", optional: true

    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :allocated_at, presence: true
    validates :invoice_id, uniqueness: { scope: :deposit_id, message: "already has this deposit allocated" }
  end
end
