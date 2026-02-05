# frozen_string_literal: true

# SSoT: Description column duplicates SM Task name for POs created via Unreal/templates
# Use notes field instead (which is aliased to description column in the model)
# This removes the column from the Foundation UI (data still in DB via 'notes' alias)
class HideDescriptionColumnFromPurchaseOrders < ActiveRecord::Migration[7.1]
  def up
    foundation = Foundation.find_by(slug: 'purchase-orders')
    return unless foundation

    # Try both case variations
    column = foundation.columns.find_by(name: 'description') ||
             foundation.columns.find_by(name: 'Description')
    return unless column

    column.destroy!
    puts "Deleted 'Description' column from purchase-orders Foundation"
  end

  def down
    # Column deletion is intentional - do not restore
    # Data still accessible via 'notes' alias on PurchaseOrder model
    puts "Note: Description column was intentionally deleted. Data accessible via 'notes' alias."
  end
end
