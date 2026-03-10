# frozen_string_literal: true

# SmStage - Schedule Master stages (legacy table with serial ID)
#
# Simple lookup table for stage names used in schedule master tasks.
#
class SmStage < ApplicationRecord
  acts_as_tenant :tenant, has_global_records: true
  include ConfigSyncable
  include GlobalConfigRecord
  include CanonicalLinkable

  validates :name, presence: true

  scope :ordered, -> { order(:name) }
end
