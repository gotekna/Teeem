class AddViewDisplayTypeToFoundationViews < ActiveRecord::Migration[8.0]
  def change
    add_column :foundation_views, :view_display_type, :string, default: "table", null: false, comment: "Display mode: 'table' for traditional grid, 'relational' for network graph"
  end
end
