# SSoT Cleanup: Remove duplicate CompanyDocument model
# CorporateCompanyDocument is THE SSoT for all company documents
# This table had 0 records - the CompanyDocument model was a legacy duplicate
class DropCompanyDocumentsTable < ActiveRecord::Migration[8.0]
  def up
    # Drop the legacy duplicate table
    drop_table :company_documents, if_exists: true
  end

  def down
    # Don't recreate on rollback - this table was empty and the model is deleted
    # If needed, restore from backup
    raise ActiveRecord::IrreversibleMigration, "Cannot recreate company_documents table - model has been deleted. Restore from backup if needed."
  end
end
