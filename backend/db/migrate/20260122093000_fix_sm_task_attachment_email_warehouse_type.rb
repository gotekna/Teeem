# frozen_string_literal: true

# Fix for polymorphic type in sm_task_attachments that was missed
# during the email_warehouses → synced_emails rename
#
# The RenameEmailWarehousesToSyncedEmails migration updated warehouse_documents
# but forgot to update sm_task_attachments. This caused email attachments to
# not display in the Task Hub UI because the controller only handles 'SyncedEmail'.
class FixSmTaskAttachmentEmailWarehouseType < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      UPDATE sm_task_attachments
      SET attachable_type = 'SyncedEmail'
      WHERE attachable_type = 'EmailWarehouse'
    SQL
  end

  def down
    execute <<-SQL
      UPDATE sm_task_attachments
      SET attachable_type = 'EmailWarehouse'
      WHERE attachable_type = 'SyncedEmail'
    SQL
  end
end
