# frozen_string_literal: true

# Reorder xero-sync-contacts columns to show Match % near the top.
# User wants: Contact, Xero Name, Match %, then other columns.
# Match % should be visible immediately for quick review.
class ReorderXeroSyncContactsColumns < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "xero-sync-contacts")
    return unless foundation

    # New column order: Contact, Xero Name, Match %, Linked, Type, Role, Invoices, Bills...
    column_positions = {
      "display_name" => 1,        # Contact
      "xero_name" => 2,           # Xero Name
      "match_confidence" => 3,    # Match % (moved from position 17)
      "synced" => 4,              # Linked
      "entity_type" => 5,         # Type
      "contact_role" => 6,        # Role
      "invoices_count" => 7,      # Invoices
      "bills_count" => 8,         # Bills
      "pdf_sync_percent" => 9,    # PDF %
      "xero_tenant_name" => 10,   # Xero Org (hidden in drilldown since filtered)
      "sync_enabled" => 11,
      "has_error" => 12,
      "contact_synced_at" => 13,
      "invoices_synced_at" => 14,
      "pdfs_synced_at" => 15,
      "needs_review" => 16,
      "match_type" => 17,
      "email" => 18,
      "xero_id" => 19,
      "sync_error" => 20,
      "is_team_contact" => 21,
      "is_customer" => 22,
      "is_supplier" => 23,
      "primary_company_name" => 24,
      "pdfs_synced" => 25
    }

    column_positions.each do |column_name, position|
      column = foundation.columns.find_by(column_name: column_name)
      column&.update!(position: position)
    end

    puts "Reordered xero-sync-contacts columns - Match % now at position 3"
  end

  def down
    # Original positions from 20251230042501_create_xero_sync_contacts_foundation.rb
    foundation = Foundation.find_by(slug: "xero-sync-contacts")
    return unless foundation

    original_positions = {
      "display_name" => 1,
      "xero_name" => 2,
      "xero_tenant_name" => 3,
      "entity_type" => 4,
      "synced" => 5,
      "contact_role" => 6,
      "invoices_count" => 7,
      "bills_count" => 8,
      "pdf_sync_percent" => 9,
      "sync_enabled" => 10,
      "has_error" => 11,
      "contact_synced_at" => 12,
      "invoices_synced_at" => 13,
      "pdfs_synced_at" => 14,
      "needs_review" => 15,
      "match_type" => 16,
      "match_confidence" => 17,
      "email" => 18,
      "xero_id" => 19,
      "sync_error" => 20,
      "is_team_contact" => 21,
      "is_customer" => 22,
      "is_supplier" => 23,
      "primary_company_name" => 24,
      "pdfs_synced" => 25
    }

    original_positions.each do |column_name, position|
      column = foundation.columns.find_by(column_name: column_name)
      column&.update!(position: position)
    end
  end
end
