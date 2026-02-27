# frozen_string_literal: true

# Fix sm_task_id column on purchase-orders Foundation so it can be searched.
#
# Root cause: sm_task_id was added as column_type "whole_number" when the
# sm_task_id DB column was added. The Foundation search system only joins
# lookup tables for columns with column_type "lookup" + lookup_foundation_id.
# Without this, searching by task name (e.g. "Req Aluminium Battens") returns
# no results even with "Search all columns" enabled.
class FixSmTaskIdColumnTypeOnPurchaseOrders < ActiveRecord::Migration[8.0]
  def up
    po_foundation = Foundation.find_by(slug: "purchase-orders")
    return unless po_foundation

    sm_foundation = Foundation.find_by(slug: "sm-tasks")
    return unless sm_foundation

    col = Column.find_by(foundation_id: po_foundation.id, column_name: "sm_task_id")
    return unless col

    col.update!(
      column_type: "lookup",
      lookup_foundation_id: sm_foundation.id,
      lookup_foundation_slug: sm_foundation.slug,
      lookup_display_column: "name"
    )

    puts "  ✅ sm_task_id → #{sm_foundation.slug} (display: name) [was: whole_number]"
  end

  def down
    po_foundation = Foundation.find_by(slug: "purchase-orders")
    return unless po_foundation

    col = Column.find_by(foundation_id: po_foundation.id, column_name: "sm_task_id")
    return unless col

    col.update!(
      column_type: "whole_number",
      lookup_foundation_id: nil,
      lookup_foundation_slug: nil,
      lookup_display_column: nil
    )
  end
end