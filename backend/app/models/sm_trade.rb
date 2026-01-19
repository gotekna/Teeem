# frozen_string_literal: true

# Schedule Master Trade - represents a trade/subcontractor category
#
# SSoT: Trades table for Schedule Master tasks
class SmTrade < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  validates :name, presence: true
end
