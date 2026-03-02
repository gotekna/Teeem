# frozen_string_literal: true

# CanonicalSyncGroupMember - Tracks which tenants participate in canonical sync
#
# Sync directions:
#   - bidirectional: Changes propagate to AND from this tenant (TEEEM, Tekna, Pilgrim)
#   - pull_only: Receives canonical records on provision, does not push changes back (new SaaS tenants)
#
class CanonicalSyncGroupMember < ApplicationRecord
  SYNC_DIRECTIONS = %w[bidirectional pull_only].freeze

  belongs_to :tenant

  validates :tenant_id, presence: true, uniqueness: true
  validates :sync_direction, presence: true, inclusion: { in: SYNC_DIRECTIONS }

  scope :active, -> { where(is_active: true) }
  scope :bidirectional, -> { active.where(sync_direction: "bidirectional") }
  scope :pull_only, -> { active.where(sync_direction: "pull_only") }

  # Check if a tenant is a bidirectional member (can push changes to canonical)
  def self.bidirectional?(tenant_id)
    bidirectional.exists?(tenant_id: tenant_id)
  end

  # Check if a tenant is any kind of member
  def self.member?(tenant_id)
    active.exists?(tenant_id: tenant_id)
  end

  # Get all active tenant IDs except the given one (for propagation fan-out)
  def self.propagation_targets(exclude_tenant_id:)
    active.where.not(tenant_id: exclude_tenant_id).pluck(:tenant_id)
  end
end
