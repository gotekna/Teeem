class AddAllowReservedNameToFoundations < ActiveRecord::Migration[8.0]
  def change
    add_column :foundations, :allow_reserved_name, :boolean, default: false
  end
end
