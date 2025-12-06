class RemoveOrphanedSupplierRatingsFoundation < ActiveRecord::Migration[8.0]
  def up
    # Remove orphaned foundation that points to dropped supplier_ratings table
    # The supplier_ratings table was dropped in migration 20251130010034_drop_supplier_tables
    # but the foundation was left behind, causing 500 errors
    foundation = Foundation.find_by(slug: 'supplier_ratings')
    if foundation
      puts "Removing orphaned 'Supplier Rating' foundation (ID: #{foundation.id})"
      foundation.destroy
      puts "Successfully removed orphaned foundation"
    else
      puts "Foundation 'supplier_ratings' not found (may have been manually deleted)"
    end
  end

  def down
    # No need to recreate the foundation since the table doesn't exist
    # If you need supplier ratings, they should be implemented differently
    puts "Skipping foundation recreation - supplier_ratings table does not exist"
  end
end
