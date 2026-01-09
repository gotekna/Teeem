class RenameDefaultSupplierToPriceOnly < ActiveRecord::Migration[8.0]
  def up
    # Rename entity_type from 'default_supplier' to 'price_only' for clarity
    # 'price_only' better describes contacts used only for pricebook pricing data
    # (e.g., web-scraped prices, legacy suppliers with no contact info)
    execute <<-SQL
      UPDATE contacts
      SET entity_type = 'price_only'
      WHERE entity_type = 'default_supplier';
    SQL
  end

  def down
    # Rename back to 'default_supplier' for rollback
    execute <<-SQL
      UPDATE contacts
      SET entity_type = 'default_supplier'
      WHERE entity_type = 'price_only';
    SQL
  end
end
