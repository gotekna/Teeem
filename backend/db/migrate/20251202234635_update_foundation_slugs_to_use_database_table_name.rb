class UpdateFoundationSlugsToUseDatabaseTableName < ActiveRecord::Migration[8.0]
  def up
    # Update all foundation slugs to use database_table_name
    # This ensures clean URLs like /tables/42/purchase_orders
    execute <<-SQL
      UPDATE foundations
      SET slug = database_table_name
      WHERE database_table_name IS NOT NULL
    SQL
  end

  def down
    # No rollback needed - slugs will be regenerated from name if needed
  end
end
