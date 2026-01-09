# frozen_string_literal: true

module Gl
  # Line item on a customer statement
  class CustomerStatementLine < ApplicationRecord
    self.table_name = "gl_customer_statement_lines"

    TRANSACTION_TYPES = %w[invoice payment credit adjustment].freeze

    belongs_to :statement, class_name: "Gl::CustomerStatement"
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :payment, class_name: "Gl::Payment", optional: true

    validates :transaction_date, presence: true
    validates :transaction_type, inclusion: { in: TRANSACTION_TYPES }

    scope :ordered, -> { order(:transaction_date, :created_at) }
  end
end
