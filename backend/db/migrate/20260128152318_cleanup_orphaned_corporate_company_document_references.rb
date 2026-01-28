# frozen_string_literal: true

# SSoT Cleanup Migration (Jan 2026)
#
# Root Cause: CorporateCompanyDocument model was deleted as part of WarehouseDocument SSoT migration,
# but 52 SmTaskAttachment records still reference it via polymorphic association.
# This causes "uninitialized constant CorporateCompanyDocument" errors when loading tasks.
#
# Fix: Delete orphaned SmTaskAttachment records that reference the deleted model.
# The documents themselves were migrated to WarehouseDocument, but the task attachments
# were not re-linked. Since these are old test attachments, safe to remove.
class CleanupOrphanedCorporateCompanyDocumentReferences < ActiveRecord::Migration[8.0]
  def up
    # Delete SmTaskAttachment records referencing deleted CorporateCompanyDocument model
    orphaned_count = execute(<<-SQL).cmd_tuples
      DELETE FROM sm_task_attachments
      WHERE attachable_type = 'CorporateCompanyDocument'
    SQL

    say "Deleted #{orphaned_count} orphaned SmTaskAttachment records referencing CorporateCompanyDocument"

    # Also clean up any other polymorphic tables that might reference deleted models
    # Check activity_logs, versions, etc.
    %w[activity_logs].each do |table|
      if table_exists?(table) && column_exists?(table, :trackable_type)
        count = execute(<<-SQL).cmd_tuples
          DELETE FROM #{table}
          WHERE trackable_type = 'CorporateCompanyDocument'
        SQL
        say "Deleted #{count} orphaned #{table} records" if count > 0
      end
    end
  end

  def down
    # Cannot restore deleted records - this is a data cleanup
    say "Warning: Cannot restore deleted orphaned records"
  end
end
