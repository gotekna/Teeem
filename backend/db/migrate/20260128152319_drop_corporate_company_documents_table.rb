# frozen_string_literal: true

# SSoT Final Cleanup (Jan 2026)
#
# Drop the corporate_company_documents table and all dependent objects.
# Data was migrated to WarehouseDocument. This completes Phase 3.
#
# Dependent objects being dropped:
# - mv_invoice_po_reconciliation (materialized view - recreate without corp docs)
# - xero_sync_contacts_view (view - recreate without corp docs)
# - document_verification_feedbacks FK
# - document_duplicate_reviews FKs
# - document_activities FK
# - case_documents FK
class DropCorporateCompanyDocumentsTable < ActiveRecord::Migration[8.0]
  def up
    # Drop dependent views first (they reference the table)
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_invoice_po_reconciliation CASCADE"
    execute "DROP VIEW IF EXISTS xero_sync_contacts_view CASCADE"

    # Drop FKs from dependent tables
    if foreign_key_exists?(:document_verification_feedbacks, :corporate_company_documents)
      remove_foreign_key :document_verification_feedbacks, :corporate_company_documents
    end
    if foreign_key_exists?(:document_duplicate_reviews, :corporate_company_documents)
      remove_foreign_key :document_duplicate_reviews, :corporate_company_documents
    end
    if foreign_key_exists?(:document_activities, :corporate_company_documents)
      remove_foreign_key :document_activities, :corporate_company_documents
    end
    if foreign_key_exists?(:case_documents, :corporate_company_documents)
      remove_foreign_key :case_documents, :corporate_company_documents
    end

    # Drop any remaining FKs from document_duplicate_reviews (has 2 FKs)
    execute <<-SQL
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT constraint_name FROM information_schema.table_constraints
                  WHERE table_name = 'document_duplicate_reviews'
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%corporate_company_document%') LOOP
          EXECUTE 'ALTER TABLE document_duplicate_reviews DROP CONSTRAINT ' || r.constraint_name;
        END LOOP;
      END $$;
    SQL

    # Now drop the table with CASCADE for any remaining dependencies
    execute "DROP TABLE IF EXISTS corporate_company_documents CASCADE"

    # Clean up orphaned records and drop FK columns (only if they exist)
    if column_exists?(:document_verification_feedbacks, :corporate_company_document_id)
      execute "DELETE FROM document_verification_feedbacks WHERE corporate_company_document_id IS NOT NULL"
      remove_column :document_verification_feedbacks, :corporate_company_document_id
    end

    if column_exists?(:document_activities, :corporate_company_document_id)
      execute "DELETE FROM document_activities WHERE corporate_company_document_id IS NOT NULL"
      remove_column :document_activities, :corporate_company_document_id
    end

    if column_exists?(:case_documents, :corporate_company_document_id)
      execute "DELETE FROM case_documents WHERE corporate_company_document_id IS NOT NULL"
      remove_column :case_documents, :corporate_company_document_id
    end

    if column_exists?(:document_duplicate_reviews, :corporate_company_document_id)
      remove_column :document_duplicate_reviews, :corporate_company_document_id
    end
    if column_exists?(:document_duplicate_reviews, :duplicate_corporate_company_document_id)
      remove_column :document_duplicate_reviews, :duplicate_corporate_company_document_id
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Cannot restore - data migrated to WarehouseDocument"
  end
end
