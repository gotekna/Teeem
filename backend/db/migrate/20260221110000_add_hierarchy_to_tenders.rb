# frozen_string_literal: true

# Add self-referential parent_id for two-level header/section hierarchy.
# Records with parent_id = NULL are headers; records with parent_id set are sections.
# Follows the CostCentre pattern (self-referential parent/children).
#
# Also adds default_note: text shown in tender documents when a section has no PO items
# (e.g., "No allowance has been made for flood requirements.")
#
class AddHierarchyToTenders < ActiveRecord::Migration[8.0]
  def change
    add_reference :tenders, :parent, foreign_key: { to_table: :tenders }, null: true
    add_column :tenders, :default_note, :text
  end
end
