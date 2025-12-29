class AddDisplayFieldsToColumnTypeDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :column_type_definitions, :display_formatter, :string, default: "text"
    add_column :column_type_definitions, :display_format, :string
    add_column :column_type_definitions, :link_template, :string
    add_column :column_type_definitions, :input_mask, :string
    add_column :column_type_definitions, :validation_message, :string
    add_column :column_type_definitions, :locale, :string, default: "en-AU"
  end
end
