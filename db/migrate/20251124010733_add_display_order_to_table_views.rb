class AddDisplayOrderToTableViews < ActiveRecord::Migration[8.0]
  def change
    add_column :table_views, :display_order, :integer, default: 0
    add_index :table_views, [ :table_id, :user_id, :display_order ], name: 'index_table_views_on_table_user_order'

    # Backfill existing records with sequential order based on created_at
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE table_views
          SET display_order = subquery.row_num
          FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY table_id, user_id ORDER BY created_at) - 1 as row_num
            FROM table_views
          ) AS subquery
          WHERE table_views.id = subquery.id
        SQL
      end
    end
  end
end
