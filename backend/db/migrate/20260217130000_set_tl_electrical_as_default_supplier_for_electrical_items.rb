class SetTlElectricalAsDefaultSupplierForElectricalItems < ActiveRecord::Migration[7.2]
  def up
    # TL Electrical Pty Ltd = Contact ID 2289 (oldest, has 33 price histories + 10 pricebook items)
    # 4 electrical pricebook items are missing default_supplier_id
    # 3 price histories on those items are missing supplier_id
    #
    # Raw SQL to bypass acts_as_tenant scoping and model callbacks
    # (PriceHistory has after_commit :sync_current_price_to_item which could change prices)

    tl_electrical_id = 2289

    # 1. Set default_supplier_id on electrical pricebook items that don't have one
    execute <<-SQL
      UPDATE pricebooks
      SET default_supplier_id = #{tl_electrical_id},
          supplier_id = COALESCE(supplier_id, #{tl_electrical_id}),
          updated_at = NOW()
      WHERE UPPER(category) = 'ELECTRICAL'
        AND default_supplier_id IS NULL
    SQL

    # 2. Set supplier_id on price histories for those items that don't have one
    execute <<-SQL
      UPDATE price_histories
      SET supplier_id = #{tl_electrical_id},
          updated_at = NOW()
      WHERE pricebook_item_id IN (
        SELECT id FROM pricebooks WHERE UPPER(category) = 'ELECTRICAL'
      )
      AND supplier_id IS NULL
    SQL
  end

  def down
    # Not reversible - would need to know which records were previously NULL
    raise ActiveRecord::IrreversibleMigration
  end
end
