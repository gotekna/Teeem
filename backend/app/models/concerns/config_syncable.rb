# frozen_string_literal: true

# ConfigSyncable - Immutable sync_key for cross-tenant config matching
#
# Include in any model that participates in TenantConfigSyncService config sync.
# Auto-generates a sync_key on create from the record's sync_key_source fields.
# Once set, sync_key never changes - this allows tenants to rename records
# freely without breaking the sync link.
#
# Usage:
#   class DocumentType < ApplicationRecord
#     include ConfigSyncable
#     self.sync_key_source = :name  # or [:name, :scope] for composite
#   end
#
module ConfigSyncable
  extend ActiveSupport::Concern

  included do
    class_attribute :sync_key_source, default: :name

    before_validation :generate_sync_key, on: :create, if: -> { respond_to?(:sync_key) && sync_key.blank? }
    before_save :set_record_updated_at, if: -> { respond_to?(:record_updated_at=) }
    after_destroy :record_sync_deletion_tombstone, if: -> { respond_to?(:sync_key) && sync_key.present? }
  end

  # Generate a stable, slugified key from source field(s).
  # Called automatically on create, or manually when backfilling.
  def generate_sync_key
    return unless respond_to?(:sync_key=)
    return if sync_key.present? # Never overwrite

    sources = Array(self.class.sync_key_source)
    parts = sources.map { |field| send(field).to_s.strip }

    self.sync_key = self.class.build_sync_key(*parts)
  end

  private

  # Write a tombstone so cascade sync can propagate this deletion to TEEEM and all tenants.
  # Without this, cascade sync would re-import the deleted record from TEEEM.
  def record_sync_deletion_tombstone
    current = ActsAsTenant.current_tenant
    return unless current

    ConfigSyncDeletion.create!(
      tenant_id: current.id,
      model_type: self.class.name,
      sync_key: sync_key,
      deleted_at: Time.current
    )
  rescue => e
    Rails.logger.warn "[ConfigSyncable] Failed to write tombstone for #{self.class.name}##{id} sync_key=#{sync_key}: #{e.message}"
  end

  # ⚠️ DO NOT SIMPLIFY - Bidirectional sync timestamp propagation (2026-03-03)
  # ════════════════════════════════════════════════════════════════════════════
  # Why: record_updated_at carries the ORIGINAL human edit time across sync hops.
  #      Tekna edits at 10:00 → TEEEM gets record_updated_at=10:00 (not sync time).
  #      TEEEM→Pilgrim: incoming 10:00 vs local 09:00 → 10:00 wins → correct update.
  # ❌ WRONG: Always setting Time.current would lose the original edit time.
  # ✅ CORRECT: If sync explicitly assigned record_updated_at (dirty + present),
  #             preserve it. Otherwise (local user edit) → set to now.
  # ════════════════════════════════════════════════════════════════════════════
  def set_record_updated_at
    self.record_updated_at = Time.current unless record_updated_at_changed? && record_updated_at.present?
  end

  # Clear sync_key on .dup so the copy gets its own unique key on save.
  # Without this, duplicated records share the original's sync_key,
  # which causes cascade sync to confuse them as the same record.
  def initialize_dup(other)
    super
    self.sync_key = nil
    self.record_updated_at = nil if respond_to?(:record_updated_at=)
  end

  public

  class_methods do
    # Build a sync_key from one or more string values.
    # Slugifies: lowercase, spaces/underscores/dots → hyphens, strip non-alphanumeric.
    # Multiple parts joined with "--".
    def build_sync_key(*parts)
      parts.map { |p|
        p.to_s
         .strip
         .downcase
         .gsub(/[_\s.]+/, "-")   # underscores, spaces, dots → hyphens
         .gsub(/[^a-z0-9\-]/, "") # strip non-alphanumeric (keep hyphens)
         .gsub(/-{2,}/, "-")     # collapse multiple hyphens
         .gsub(/\A-|-\z/, "")    # trim leading/trailing hyphens
      }.join("--")
    end
  end
end
