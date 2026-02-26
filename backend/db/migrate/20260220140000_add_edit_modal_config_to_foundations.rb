class AddEditModalConfigToFoundations < ActiveRecord::Migration[8.0]
  def change
    add_column :foundations, :edit_modal_config, :jsonb, default: {}
  end
end
