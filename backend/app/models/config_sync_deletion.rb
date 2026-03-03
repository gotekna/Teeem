# frozen_string_literal: true

# Tombstone for propagating config record deletions across tenants.
#
# Written by ConfigSyncable#after_destroy when a synced record is destroyed.
# Read and cleared by cascade_push_table to propagate deletions to TEEEM + all tenants.
#
# SSoT: cascade_push_table in ConfigSyncController processes these.
class ConfigSyncDeletion < ApplicationRecord
  belongs_to :tenant

  scope :pending, -> { where(propagated_at: nil) }
end
