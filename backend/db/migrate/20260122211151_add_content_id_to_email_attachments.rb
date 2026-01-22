class AddContentIdToEmailAttachments < ActiveRecord::Migration[8.0]
  def up
    add_column :email_attachments, :content_id, :string
    add_index :email_attachments, [:email_warehouse_id, :content_id], name: 'idx_email_attachments_warehouse_content'

    # Backfill: Set content_id = filename for existing attachments
    # The frontend matches cid:image001.png@XXX by extracting "image001.png"
    # So setting content_id = filename allows immediate matching
    execute <<-SQL
      UPDATE email_attachments
      SET content_id = filename
      WHERE content_id IS NULL AND filename IS NOT NULL
    SQL

    Rails.logger.info "[Migration] Backfilled content_id for #{EmailAttachment.where.not(content_id: nil).count} attachments"
  end

  def down
    remove_index :email_attachments, name: 'idx_email_attachments_warehouse_content'
    remove_column :email_attachments, :content_id
  end
end
