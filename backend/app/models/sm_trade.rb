# frozen_string_literal: true

# Schedule Master Trade - represents a trade/subcontractor category
#
# SSoT: Trades table for Schedule Master tasks
class SmTrade < ApplicationRecord
  include ActsAsTenant::ModelExtensions
  acts_as_tenant :company_group, class_name: "CorporateGroup"

  validates :name, presence: true
end
