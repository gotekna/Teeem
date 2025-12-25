class RemoveStartDayOffsetFromSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_template_rows, :start_day_offset, :integer
  end
end
