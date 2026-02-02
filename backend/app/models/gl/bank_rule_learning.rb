# frozen_string_literal: true

module Gl
  # Stores manual bank transaction categorizations for learning patterns
  class BankRuleLearning < ApplicationRecord
    self.table_name = "gl_bank_rule_learnings"

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :gl_account, class_name: "Gl::Account"
    belongs_to :user, optional: true

    validates :transaction_description, presence: true
    validates :gl_account_id, presence: true

    scope :recent, -> { where("learned_at > ?", 90.days.ago) }
    scope :for_description, ->(desc) { where(transaction_description: desc) }
  end
end
