# frozen_string_literal: true

# Migration: Add hierarchical support to base_folders
#
# Allows base folders to have parent-child relationships:
#   Xero (root)
#     └── Invoices (sub)
#           └── 2024 (sub-sub)
#
# SSoT: base_folders now support unlimited nesting via parent_id
#
class AddParentIdToBaseFolders < ActiveRecord::Migration[8.0]
  def change
    add_reference :base_folders, :parent, foreign_key: { to_table: :base_folders }, index: true
  end
end
