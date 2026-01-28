# FRC: EmailAttachment model was removed in commit 6581f79afb but 52,256
# WarehouseDocument records still had documentable_type = 'EmailAttachment'.
# This caused "uninitialized constant EmailAttachment" errors.
#
# These WarehouseDocuments ARE the attachment records now - they don't need
# a documentable reference (they are self-contained with storage_blob).
class CleanupOrphanedEmailAttachmentReferences < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      UPDATE warehouse_documents
      SET documentable_type = NULL, documentable_id = NULL
      WHERE documentable_type = 'EmailAttachment'
    SQL
  end

  def down
    # Cannot restore - EmailAttachment table is gone
  end
end
