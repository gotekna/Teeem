class RemoveContractValueFromJobs < ActiveRecord::Migration[7.2]
  def up
    # SSoT: contract_price is THE ONE for total contract price
    # Skip if already done (column already dropped manually)
    return unless column_exists?(:jobs, :contract_value)

    # Safety sync: copy any remaining data
    execute <<-SQL
      UPDATE jobs
      SET contract_price = contract_value
      WHERE contract_price IS NULL
        AND contract_value IS NOT NULL
        AND contract_value > 0;
    SQL

    # Clean up Foundation column definition
    jobs_foundation_id = execute("SELECT id FROM foundations WHERE slug = 'jobs' LIMIT 1").first&.dig("id")
    if jobs_foundation_id
      execute("DELETE FROM columns WHERE column_name = 'contract_value' AND foundation_id = #{jobs_foundation_id}")
    end

    remove_column :jobs, :contract_value
  end

  def down
    add_column :jobs, :contract_value, :decimal, precision: 15, scale: 2
  end
end
