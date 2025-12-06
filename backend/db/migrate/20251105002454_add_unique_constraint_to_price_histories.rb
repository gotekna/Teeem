class AddUniqueConstraintToPriceHistories < ActiveRecord::Migration[8.0]
  def change
    # First, remove any existing duplicates before adding the constraint
    reversible do |dir|
      dir.up do
        # Keep the oldest record for each duplicate set
        execute <<-SQL
          DELETE FROM price_histories
          WHERE id NOT IN (
            SELECT MIN(id)
            FROM price_histories
            GROUP BY pricebook_item_id, supplier_id, new_price, DATE_TRUNC('second', created_at)
          )
        SQL
      end
    end

    # Add unique index to prevent future duplicates
    # Using created_at truncated to seconds to allow for legitimate rapid updates
    # but prevent exact duplicates from race conditions
    add_index :price_histories,
              [ :pricebook_item_id, :supplier_id, :new_price, :created_at ],
              unique: true,
              name: 'index_price_histories_on_unique_combination',
              comment: 'Prevents duplicate price history entries from race conditions'
  end
end
