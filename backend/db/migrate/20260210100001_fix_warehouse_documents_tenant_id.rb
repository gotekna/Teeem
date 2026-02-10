# FRC (Feb 2026): Warehouse documents (source_type='warehouse') from BillInbox,
# ChatMessage, and NotebookPageAttachment were created with tenant_id=1 instead
# of tenant_id=2. This makes them invisible to acts_as_tenant scoping.
#
# Root cause: The parent models (BillInbox, ChatMessage, etc.) inherited tenant_id
# from the context at creation time, which resolved to tenant 1.
# The correct tenant for Tekna is tenant 2.
#
# Fix: Update all warehouse-sourced documents to the correct tenant.
class FixWarehouseDocumentsTenantId < ActiveRecord::Migration[7.2]
  def up
    # Only fix records with source_type='warehouse' that have tenant_id=1
    # These are from BillInbox, ChatMessage, and NotebookPageAttachment
    count = execute(<<~SQL).cmd_tuples
      UPDATE warehouse_documents
      SET tenant_id = 2
      WHERE source_type = 'warehouse'
        AND tenant_id = 1
    SQL
    say "Updated #{count} warehouse documents from tenant_id=1 to tenant_id=2"
  end

  def down
    # Reversible - but the original tenant_id=1 was incorrect
    execute(<<~SQL)
      UPDATE warehouse_documents
      SET tenant_id = 1
      WHERE source_type = 'warehouse'
        AND tenant_id = 2
    SQL
  end
end
