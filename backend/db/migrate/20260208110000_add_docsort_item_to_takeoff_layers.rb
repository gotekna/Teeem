# frozen_string_literal: true

# Make TakeoffLayer work for both jobs AND docsort items.
# Previously job_id was required; now either job_id OR docsort_item_id must be set.
class AddDocsortItemToTakeoffLayers < ActiveRecord::Migration[8.0]
  def change
    # Add docsort_item_id (nullable)
    add_reference :takeoff_layers, :docsort_item, null: true, foreign_key: true

    # Make job_id nullable (layers can belong to docsort items instead)
    change_column_null :takeoff_layers, :job_id, true

    # Unique layer names per docsort item
    add_index :takeoff_layers, [:docsort_item_id, :name], unique: true, where: "docsort_item_id IS NOT NULL",
              name: "index_takeoff_layers_on_docsort_item_id_and_name"

    # Index for sorting by docsort item
    add_index :takeoff_layers, [:docsort_item_id, :display_order],
              name: "index_takeoff_layers_on_docsort_item_id_and_order"
  end
end
