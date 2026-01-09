class SyncContractValueToContractPrice < ActiveRecord::Migration[8.0]
  def up
    # SSoT Migration: contract_price is THE ONE for total contract price
    # This migration syncs contract_value data into contract_price
    # See: TEEEM_DOCS/SSOT_CONTRACT_VALUE_MIGRATION.md

    # Step 1: Copy contract_value to contract_price where contract_price is null
    execute <<-SQL
      UPDATE jobs
      SET contract_price = contract_value
      WHERE contract_price IS NULL
        AND contract_value IS NOT NULL
        AND contract_value > 0;
    SQL

    # Log what was updated (use raw SQL to avoid model loading issues)
    result = execute("SELECT COUNT(*) FROM jobs WHERE contract_value IS NOT NULL AND contract_value > 0 AND contract_price IS NOT NULL")
    puts "[SSoT Migration] Jobs now with contract_price synced from contract_value"

    # Step 2: Add comment to contract_value column marking it as deprecated
    execute <<-SQL
      COMMENT ON COLUMN jobs.contract_value IS 'DEPRECATED: Use contract_price instead. See TEEEM_DOCS/SSOT_CONTRACT_VALUE_MIGRATION.md';
    SQL
  end

  def down
    # Remove the deprecation comment
    execute <<-SQL
      COMMENT ON COLUMN jobs.contract_value IS NULL;
    SQL

    # Note: We don't reverse the data sync as it's non-destructive
    # Both columns retain their values
  end
end
