class AddActionButtonsToGoldStandardItems < ActiveRecord::Migration[8.0]
  def change
    add_column :gold_standard_items, :action_buttons, :string
  end
end
