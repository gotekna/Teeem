# frozen_string_literal: true

# Read-only model for xero_sync_contacts_view
# This view aggregates contact + Xero sync data for the Xero Sync Contacts table
#
# SSoT: This model wraps a database VIEW that joins:
# - contacts (base contact info)
# - contact_external_links (Xero link, sync status)
# - external_invoices (invoice/bill counts)
# - corporate_company_documents (PDF sync stats)
class XeroSyncContact < ApplicationRecord
  self.table_name = "xero_sync_contacts_view"
  self.primary_key = "id"

  # Read-only - prevent accidental writes (it's a VIEW)
  def readonly?
    true
  end

  # Associations for convenience (used by eager loading)
  belongs_to :contact, class_name: "Contact", foreign_key: "id", optional: true
  belongs_to :primary_company, class_name: "Contact", foreign_key: "primary_company_id", optional: true

  # Scopes for filtering
  scope :synced, -> { where(synced: true) }
  scope :not_synced, -> { where(synced: false) }
  scope :with_errors, -> { where(has_error: true) }
  scope :for_tenant, ->(tenant_id) { where(xero_tenant_id: tenant_id) }
  scope :customers, -> { where(is_customer: true) }
  scope :suppliers, -> { where(is_supplier: true) }
  scope :team_contacts, -> { where(is_team_contact: true) }
  scope :needs_review_only, -> { where(needs_review: true) }

  # SSoT: Define which associations are safe to eager load
  # This prevents RecordsController from trying to load all belongs_to associations
  def self.safe_eager_load_associations
    [:primary_company]
  end

  # Computed: sync_status hash for frontend display
  def sync_status
    {
      contact_synced_at: contact_synced_at&.iso8601,
      invoices_synced_at: invoices_synced_at&.iso8601,
      pdfs_synced_at: pdfs_synced_at&.iso8601
    }
  end

  # Check if all syncs are up to date (within 24 hours)
  def fully_synced?
    return false unless synced?

    [contact_synced_at, invoices_synced_at, pdfs_synced_at].all? do |ts|
      ts.present? && ts > 24.hours.ago
    end
  end

  # For DisplayValueResolver
  def name
    display_name
  end
end
