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
