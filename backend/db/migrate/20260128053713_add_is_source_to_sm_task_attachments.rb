class AddIsSourceToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def up
    add_column :sm_task_attachments, :is_source, :boolean, default: false, null: false

    # Backfill: Mark existing source emails
    execute <<-SQL
      UPDATE sm_task_attachments
      SET is_source = TRUE
      WHERE notes LIKE 'Source email%'
    SQL
  end

  def down
    remove_column :sm_task_attachments, :is_source
  end
end
