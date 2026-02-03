# frozen_string_literal: true

# SSoT Migration: Drop legacy document tables
#
# WarehouseDocument is now THE ONE SSoT for all document metadata.
# These legacy tables are empty and can be safely removed.
#
# Tables dropped:
# - corporate_company_documents (0 records, migrated to WarehouseDocument)
# - contact_documents (0 records, migrated to WarehouseDocument)
# - document_verification_feedbacks (0 records, referenced corporate_company_documents)
# - document_activities (0 records, referenced corporate_company_documents)
# - document_duplicate_reviews (0 records, referenced corporate_company_documents)
# - case_documents (0 records, referenced corporate_company_documents)
#
# Views dropped:
# - mv_invoice_po_reconciliation (materialized view depending on corporate_company_documents)
# - xero_sync_contacts_view (view depending on corporate_company_documents)
#
class DropLegacyDocumentTables < ActiveRecord::Migration[8.0]
  def up
    # Safety check: Ensure tables are empty before dropping
    safety_checks = {
      corporate_company_documents: "SELECT COUNT(*) FROM corporate_company_documents",
      contact_documents: "SELECT COUNT(*) FROM contact_documents"
    }

    safety_checks.each do |table, query|
      if table_exists?(table)
        count = execute(query).first["count"].to_i
        if count > 0
          raise "Cannot drop #{table}: #{count} records still exist. Migrate data first."
        end
      end
    end

    # Drop views that depend on corporate_company_documents
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_invoice_po_reconciliation CASCADE"
    execute "DROP VIEW IF EXISTS xero_sync_contacts_view CASCADE"

    # Drop tables that reference corporate_company_documents
    drop_table :document_verification_feedbacks if table_exists?(:document_verification_feedbacks)
    drop_table :document_activities if table_exists?(:document_activities)
    drop_table :document_duplicate_reviews if table_exists?(:document_duplicate_reviews)
    drop_table :case_documents if table_exists?(:case_documents)

    # Drop the main legacy tables
    drop_table :corporate_documents if table_exists?(:corporate_documents)
    drop_table :contact_documents if table_exists?(:contact_documents)
  end

  def down
    # This migration is not reversible - tables would need to be recreated with all columns
    raise ActiveRecord::IrreversibleMigration, "Cannot restore dropped legacy document tables. Use WarehouseDocument (SSoT)."
  end
end
