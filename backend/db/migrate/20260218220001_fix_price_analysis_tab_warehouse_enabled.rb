class FixPriceAnalysisTabWarehouseEnabled < ActiveRecord::Migration[8.0]
  def up
    # Fix: Price Analysis tab was created with warehouse_enabled=true (default),
    # which caused it to render as a document folder instead of the component.
    # Component tabs must have warehouse_enabled=false (same as BOQ tab).
    ActsAsTenant.without_tenant do
      WarehouseFolder.where(tab_key: "price-analysis").update_all(warehouse_enabled: false)
    end
  end

  def down
    # No-op
  end
end
