# frozen_string_literal: true

# FRC: Tax column in Purchase Orders shows as plain number (e.g., "2,080")
# instead of currency (e.g., "$2,080.00") because column_type is "number"
# while Sub Total and Total are correctly set to "currency".
#
# Root cause: When the Purchase Orders Foundation was created, the Tax column
# was configured with column_type "number" instead of "currency".
class FixPurchaseOrdersTaxColumnType < ActiveRecord::Migration[8.0]
  def up
    po_foundation = Foundation.find_by(slug: 'purchase-orders')
    return unless po_foundation

    tax_col = Column.find_by(foundation_id: po_foundation.id, column_name: 'tax')
    if tax_col && tax_col.column_type != 'currency'
      old_type = tax_col.column_type
      tax_col.update!(column_type: 'currency')
      puts "  Fixed purchase-orders.tax: #{old_type} => currency"
    end
  end

  def down
    po_foundation = Foundation.find_by(slug: 'purchase-orders')
    return unless po_foundation

    tax_col = Column.find_by(foundation_id: po_foundation.id, column_name: 'tax')
    tax_col&.update!(column_type: 'number')
  end
end
