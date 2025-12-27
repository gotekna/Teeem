class AddDisplayOptionsToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    # display_mode: 'both' (default), 'icon_only', 'text_only'
    add_column :entity_tabs, :display_mode, :string, default: 'both', null: false
    # hidden_by_default: tabs that don't show in main row (accessed via overflow menu)
    add_column :entity_tabs, :hidden_by_default, :boolean, default: false, null: false
  end
end
