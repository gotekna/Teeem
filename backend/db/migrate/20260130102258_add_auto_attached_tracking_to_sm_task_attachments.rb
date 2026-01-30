class AddAutoAttachedTrackingToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    # Track which attachments were auto-added from emails
    add_column :sm_task_attachments, :auto_attached, :boolean, default: false, null: false

    # Link to the email attachment that triggered the auto-attach
    # Used for cascade delete when email is removed from task
    add_column :sm_task_attachments, :source_email_attachment_id, :bigint
    add_index :sm_task_attachments, :source_email_attachment_id
  end
end
