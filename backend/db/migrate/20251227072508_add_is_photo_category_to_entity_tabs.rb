class AddIsPhotoCategoryToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :is_photo_category, :boolean, default: false, null: false

    # Set existing photo tabs based on name
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE entity_tabs
          SET is_photo_category = true
          WHERE LOWER(display_name) LIKE '%photo%'
        SQL
      end
    end
  end
end
