class AddAlignmentToColumns < ActiveRecord::Migration[8.0]
  def change
    # Add alignment columns for headers and data cells
    # Options: 'left', 'center', 'right'
    # Default: 'left' for most types, 'right' for currency/number types
    add_column :columns, :header_align, :string, default: 'left'
    add_column :columns, :data_align, :string, default: 'left'

    # Set right alignment for existing currency, number, and percentage columns
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE columns
          SET data_align = 'right'
          WHERE column_type IN ('currency', 'number', 'whole_number', 'percentage');
        SQL
      end
    end
  end
end
