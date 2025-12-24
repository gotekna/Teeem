class AddPredecessorIdsBackupToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :predecessor_ids_backup, :jsonb
  end
end
