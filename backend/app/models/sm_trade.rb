# frozen_string_literal: true

# Schedule Master Trade - represents a trade/subcontractor category
#
# SSoT: Trades table for Schedule Master tasks
class SmTrade < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant
  belongs_to :corporate_group, foreign_key: :company_group_id, optional: true  # Business grouping (not multi-tenancy)

  validates :name, presence: true
end
