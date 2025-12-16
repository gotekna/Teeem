class ContactExternalLink < ApplicationRecord
  belongs_to :contact

  # Callbacks to keep Contact's cached xero columns in sync
  after_save :update_contact_xero_cache
  after_destroy :update_contact_xero_cache

  # Sources
  SOURCES = %w[xero myob quickbooks].freeze

  # Sync directions
  SYNC_DIRECTIONS = %w[import_only export_only bidirectional].freeze

  # Match types for cross-tenant matching
  MATCH_TYPES = %w[exact_abn exact_email fuzzy_name manual].freeze

  # Xero contact status tracking
  XERO_STATUSES = %w[active archived deleted not_found].freeze

  validates :source, presence: true, inclusion: { in: SOURCES }
  validates :xero_contact_status, inclusion: { in: XERO_STATUSES }, allow_nil: true
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
  scope :pending_review, -> { where(needs_review: true) }
  scope :reviewed, -> { where(needs_review: false).where.not(reviewed_at: nil) }
  scope :active_status, -> { where(xero_contact_status: 'active') }
  scope :stale_status, -> { where(xero_contact_status: ['archived', 'deleted', 'not_found']) }
  scope :unverified_since, ->(timestamp) { where("last_verified_at < ? OR last_verified_at IS NULL", timestamp) }

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

  # Mark as verified (contact exists and is active in external system)
  def mark_verified!
    update!(
      xero_contact_status: 'active',
      last_verified_at: Time.current
    )
  end

  # Mark as stale (contact not found in external system)
  def mark_stale!(status = 'not_found')
    raise ArgumentError, "Invalid status: #{status}" unless XERO_STATUSES.include?(status)
    update!(xero_contact_status: status)
  end

  # Check if this link is stale
  def stale?
    %w[archived deleted not_found].include?(xero_contact_status)
  end

  # Check if this link is active
  def active_status?
    xero_contact_status == 'active'
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

  # Approve a fuzzy match review
  def approve_review!(reviewer_email = nil)
    update!(
      needs_review: false,
      sync_enabled: true,
      reviewed_at: Time.current,
      reviewed_by: reviewer_email
    )
  end

  # Check if this link was auto-matched (not manually linked)
  def auto_matched?
    match_type.present? && match_type != "manual"
  end

  # Check if this was a high-confidence match
  def high_confidence?
    match_confidence.present? && match_confidence >= 0.95
  end

  # Check if this was a fuzzy match
  def fuzzy_match?
    match_type == "fuzzy_name"
  end

  private

  # Update the contact's cached xero columns
  def update_contact_xero_cache
    return unless contact && xero?

    contact.update_xero_link_cache!
  end
end
