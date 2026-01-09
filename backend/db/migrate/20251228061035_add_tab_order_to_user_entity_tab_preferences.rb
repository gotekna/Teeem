class AddTabOrderToUserEntityTabPreferences < ActiveRecord::Migration[8.0]
  def change
    add_column :user_entity_tab_preferences, :tab_order, :jsonb, default: []
  end
end
