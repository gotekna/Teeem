# frozen_string_literal: true

class AddSortOrderToWarehouseDocuments < ActiveRecord::Migration[7.2]
  def change
    add_column :warehouse_documents, :sort_order, :integer, default: 0
    add_index :warehouse_documents, [:warehouse_folder_id, :sort_order], name: "idx_wd_folder_sort"
  end
end
