# frozen_string_literal: true

# Fix: Corporate warehouse type was using `display_name` which returns
# trading_name (often person names like "Rachel") instead of the legal
# company name. Change to `name` to match the Corporate page display.
class FixCorporateWarehouseDisplayName < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL.squish
      UPDATE warehouse_types
      SET token_config = jsonb_set(token_config, '{CompanyName}', '"name"'),
          records_config = jsonb_set(records_config, '{display,name}', '"name"')
      WHERE code = 'corporate'
    SQL
  end

  def down
    execute <<~SQL.squish
      UPDATE warehouse_types
      SET token_config = jsonb_set(token_config, '{CompanyName}', '"display_name"'),
          records_config = jsonb_set(records_config, '{display,name}', '"display_name"')
      WHERE code = 'corporate'
    SQL
  end
end
