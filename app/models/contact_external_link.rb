class ContactExternalLink < ApplicationRecord
  belongs_to :contact

  # Sources
  SOURCES = %w[xero myob quickbooks].freeze

  # Sync directions
  SYNC_DIRECTIONS = %w[import_only export_only bidirectional].freeze

  validates :source, presence: true, inclusion: { in: SOURCES }
  validates :tenant_id, presence: true
  validates :external_contact_id, presence: true
  validates :sync_direction, inclusion: { in: SYNC_DIRECTIONS }
  validates :contact_id, uniqueness: { scope: [ :source, :tenant_id ], message: "already linked to this organization" }
  validates :external_contact_id, uniqueness: { scope: [ :source, :tenant_id ], message: "already linked to another contact" }

  scope :enabled, -> { where(sync_enabled: true) }
  scope :for_source, ->(source) { where(source: source) }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }
  scope :xero, -> { for_source("xero") }
  scope :myob, -> { for_source("myob") }
  scope :quickbooks, -> { for_source("quickbooks") }
  scope :with_errors, -> { where.not(sync_error: nil) }
  scope :with_conflicts, -> { where("conflict_fields != '{}'") }

  # Check if this link has sync conflicts
  def has_conflicts?
    conflict_fields.present? && conflict_fields.any?
  end

  # Clear sync error
  def clear_error!
    update!(sync_error: nil)
  end

  # Record sync error
  def record_error!(message)
    update!(sync_error: message)
  end

  # Mark as synced
  def mark_synced!(external_modified_at = nil)
    update!(
      last_synced_at: Time.current,
      external_last_modified_at: external_modified_at,
      sync_error: nil
    )
  end

  # Add a conflict field
  def add_conflict(field_name, teeem_value, external_value)
    conflicts = conflict_fields || {}
    conflicts[field_name] = {
      "teeem_value" => teeem_value,
      "external_value" => external_value,
      "detected_at" => Time.current.iso8601
    }
    update!(conflict_fields: conflicts)
  end

  # Resolve a conflict (choose which value to keep)
  def resolve_conflict(field_name, keep_source) # keep_source: 'teeem' or 'external'
    conflicts = conflict_fields || {}
    conflicts.delete(field_name)
    update!(conflict_fields: conflicts)
  end

  # Import only?
  def import_only?
    sync_direction == "import_only"
  end

  # Export only?
  def export_only?
    sync_direction == "export_only"
  end

  # Bidirectional sync?
  def bidirectional?
    sync_direction == "bidirectional"
  end

  # Can import from external system?
  def can_import?
    sync_enabled? && (import_only? || bidirectional?)
  end

  # Can export to external system?
  def can_export?
    sync_enabled? && (export_only? || bidirectional?)
  end

  # Convenience: is this a Xero link?
  def xero?
    source == "xero"
  end

  # Convenience: is this a MYOB link?
  def myob?
    source == "myob"
  end

  # Convenience: is this a QuickBooks link?
  def quickbooks?
    source == "quickbooks"
  end
end
