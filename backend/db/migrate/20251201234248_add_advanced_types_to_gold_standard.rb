class AddAdvancedTypesToGoldStandard < ActiveRecord::Migration[8.0]
  def change
    # Add 3 new advanced column types to Gold Standard table
    # These represent PostgreSQL-specific types used across TEEEM

    # JSONB for structured/flexible data (metadata, config, nested objects)
    add_column :gold_standard_table, :structured_data, :jsonb, default: {}

    # Array for multiple items (tags, IDs, multiple values)
    add_column :gold_standard_table, :array_of_items, :text, array: true, default: []

    # TSVECTOR for full-text search indexing (read-only, auto-generated)
    add_column :gold_standard_table, :searchable_text, :tsvector

    # Update currency/number columns to NUMERIC(15,2) for enterprise scale
    # Supports up to $9.99 trillion per field
    change_column :gold_standard_table, :currency, :decimal, precision: 15, scale: 2
    change_column :gold_standard_table, :number, :decimal, precision: 15, scale: 2
    change_column :gold_standard_table, :percentage, :decimal, precision: 15, scale: 2
  end
end
