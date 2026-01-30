# frozen_string_literal: true

# FRC (Jan 2026): Migration 20260120062803 renamed email_warehouses → synced_emails
# but FORGOT to update polymorphic references in sm_task_attachments.
#
# This caused tasks created between Jan 6-20 to lose their email attachments
# because attachable_type was still 'EmailWarehouse' after the table rename.
#
# Root cause: Only warehouse_documents.documentable_type was updated, not
# sm_task_attachments.attachable_type.
#
# This migration fixes any remaining orphaned references.
class FixEmailWarehousePolymorphicReferences < ActiveRecord::Migration[8.0]
  def up
    # Fix sm_task_attachments polymorphic type
    execute <<-SQL
      UPDATE sm_task_attachments
      SET attachable_type = 'SyncedEmail'
      WHERE attachable_type = 'EmailWarehouse'
    SQL

    # Also check other tables that might have polymorphic references to emails
    # (defensive - these may not exist or may already be correct)

    # task_action_items might have email references
    if column_exists?(:task_action_items, :attachable_type)
      execute <<-SQL
        UPDATE task_action_items
        SET attachable_type = 'SyncedEmail'
        WHERE attachable_type = 'EmailWarehouse'
      SQL
    end

    # notifications might reference emails
    if column_exists?(:notifications, :notifiable_type)
      execute <<-SQL
        UPDATE notifications
        SET notifiable_type = 'SyncedEmail'
        WHERE notifiable_type = 'EmailWarehouse'
      SQL
    end
  end

  def down
    # Reversing this would break things again, so we don't reverse
    # The old EmailWarehouse class no longer exists
  end
end
