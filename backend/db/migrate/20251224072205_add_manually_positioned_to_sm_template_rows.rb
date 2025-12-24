class AddManuallyPositionedToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :manually_positioned, :boolean
    add_column :sm_template_rows, :manual_start_date, :date
  end
end
