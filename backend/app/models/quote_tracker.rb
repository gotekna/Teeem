# frozen_string_literal: true

# QuoteTracker - Tracks supplier quotes for construction jobs
#
# This is a PreCon feature for internal tracking of quotes received from suppliers.
# Note: This is separate from QuoteRequest (which is for sending RFQs to suppliers).
#
# SSoT: Foundation slug = 'quote-tracker'
# SSoT: Tab = PreCon > Quote Tracker
#
class QuoteTracker < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  # Associations
  belongs_to :job
  belongs_to :sm_trade, optional: true  # Category
  belongs_to :supplier, class_name: 'Contact', optional: true
  belongs_to :contact, class_name: 'ContactPerson', optional: true  # Employee at supplier

  # Validations
  validates :job, presence: true
end
