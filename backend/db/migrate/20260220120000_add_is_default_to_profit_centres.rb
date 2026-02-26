# frozen_string_literal: true

# Adds is_default boolean to profit_centres so one global template per tenant
# can be the default profit centre for new PO line items, claims, and claim stages.
#
# Also adds Foundation column definition so the checkbox appears in the
# TeeemTableView edit modal automatically.
class AddIsDefaultToProfitCentres < ActiveRecord::Migration[8.0]
  def up
    add_column :profit_centres, :is_default, :boolean, default: false, null: false
    add_index :profit_centres, :is_default, where: "is_default = true",
              name: "index_profit_centres_on_is_default"

    # Add Foundation column definition for TeeemTableView
    foundation = Foundation.find_by(slug: "profit_centres")
    if foundation
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: "is_default") do |col|
        col.name = "Default"
        col.column_type = "boolean"
        col.position = 10 # After "Active" (position 9)
        col.searchable = false
        col.is_title = false
        col.required = false
      end
      say "Added 'Default' column to Profit Centres foundation"
    else
      say "Warning: profit_centres foundation not found - column definition not created"
    end
  end

  def down
    # Remove Foundation column definition
    foundation = Foundation.find_by(slug: "profit_centres")
    if foundation
      foundation.columns.where(column_name: "is_default").destroy_all
    end

    remove_index :profit_centres, name: "index_profit_centres_on_is_default", if_exists: true
    remove_column :profit_centres, :is_default
  end
end
