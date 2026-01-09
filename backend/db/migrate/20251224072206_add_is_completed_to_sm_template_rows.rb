class AddIsCompletedToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :is_completed, :boolean, default: false
    add_column :sm_template_rows, :completed_at, :date
  end
end
