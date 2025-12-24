class AddPreviousManualStartDateToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :previous_manual_start_date, :date
  end
end
