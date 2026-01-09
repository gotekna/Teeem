# frozen_string_literal: true

# Creates a Foundation for XeroSyncContact model (backed by xero_sync_contacts_view)
# This enables TeeemTableView with saved views, filters, and column management
class CreateXeroSyncContactsFoundation < ActiveRecord::Migration[7.1]
  def up
    # Create Foundation record wrapping the view model
    foundation = Foundation.create!(
      name: "Xero Sync Contacts",
      singular_name: "Xero Sync Contact",
      plural_name: "Xero Sync Contacts",
      slug: "xero-sync-contacts",
      database_table_name: "xero_sync_contacts_view",
      table_type: "system",
      model_class: "XeroSyncContact",
      icon: "users",
      feature: "Xero",
      is_live: true,
      has_ui: true,
      has_saved_views: true,
      searchable: true,
      title_column: "display_name",
      allow_reserved_name: true
    )

    # Create columns matching the view schema
    columns = [
      # Core contact fields
      {
        name: "Contact",
        column_name: "display_name",
        column_type: "single_line_text",
        is_title: true,
        searchable: true,
        position: 1
      },
      {
        name: "Xero Name",
        column_name: "xero_name",
        column_type: "single_line_text",
        searchable: true,
        position: 2
      },
      {
        name: "Xero Org",
        column_name: "xero_tenant_name",
        column_type: "single_line_text",
        position: 3
      },
      {
        name: "Type",
        column_name: "entity_type",
        column_type: "single_line_text",
        position: 4
      },
      {
        name: "Linked",
        column_name: "synced",
        column_type: "boolean",
        data_align: "center",
        header_align: "center",
        position: 5
      },
      {
        name: "Role",
        column_name: "contact_role",
        column_type: "single_line_text",
        position: 6
      },
      {
        name: "Invoices",
        column_name: "invoices_count",
        column_type: "whole_number",
        data_align: "center",
        header_align: "center",
        position: 7
      },
      {
        name: "Bills",
        column_name: "bills_count",
        column_type: "whole_number",
        data_align: "center",
        header_align: "center",
        position: 8
      },
      {
        name: "PDF %",
        column_name: "pdf_sync_percent",
        column_type: "whole_number",
        data_align: "center",
        header_align: "center",
        position: 9
      },
      {
        name: "Sync Enabled",
        column_name: "sync_enabled",
        column_type: "boolean",
        position: 10
      },
      {
        name: "Has Error",
        column_name: "has_error",
        column_type: "boolean",
        position: 11
      },
      {
        name: "Contact Synced",
        column_name: "contact_synced_at",
        column_type: "date_and_time",
        position: 12
      },
      {
        name: "Invoices Synced",
        column_name: "invoices_synced_at",
        column_type: "date_and_time",
        position: 13
      },
      {
        name: "PDFs Synced",
        column_name: "pdfs_synced_at",
        column_type: "date_and_time",
        position: 14
      },
      {
        name: "Needs Review",
        column_name: "needs_review",
        column_type: "boolean",
        position: 15
      },
      {
        name: "Match Type",
        column_name: "match_type",
        column_type: "single_line_text",
        position: 16
      },
      {
        name: "Match Confidence",
        column_name: "match_confidence",
        column_type: "percentage",
        position: 17
      },
      {
        name: "Email",
        column_name: "email",
        column_type: "email",
        searchable: true,
        position: 18
      },
      {
        name: "Xero ID",
        column_name: "xero_id",
        column_type: "single_line_text",
        position: 19
      },
      {
        name: "Sync Error",
        column_name: "sync_error",
        column_type: "multiple_lines_text",
        position: 20
      },
      {
        name: "Team Contact",
        column_name: "is_team_contact",
        column_type: "boolean",
        position: 21
      },
      {
        name: "Customer",
        column_name: "is_customer",
        column_type: "boolean",
        position: 22
      },
      {
        name: "Supplier",
        column_name: "is_supplier",
        column_type: "boolean",
        position: 23
      },
      {
        name: "Primary Company",
        column_name: "primary_company_name",
        column_type: "single_line_text",
        position: 24
      },
      {
        name: "PDFs Synced Count",
        column_name: "pdfs_synced",
        column_type: "whole_number",
        position: 25
      }
    ]

    columns.each do |col_attrs|
      Column.create!(col_attrs.merge(foundation_id: foundation.id))
    end

    # Force the slug since the model callback generates it from database_table_name
    Foundation.where(id: foundation.id).update_all(slug: "xero-sync-contacts")

    puts "Created Foundation ##{foundation.id} for XeroSyncContact with #{columns.size} columns"
  end

  def down
    foundation = Foundation.find_by(model_class: "XeroSyncContact")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
      puts "Removed Foundation for XeroSyncContact"
    end
  end
end
