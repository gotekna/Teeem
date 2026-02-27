class RemoveContractValueFromJobs < ActiveRecord::Migration[7.2]
  def up
    # SSoT: contract_price is THE ONE for total contract price
    # contract_value was deprecated and all data was migrated to contract_price
    # in migration 20251223020712_sync_contract_value_to_contract_price
    #
    # Final safety check: copy any remaining contract_value data to contract_price
    execute <<-SQL
      UPDATE jobs
      SET contract_price = contract_value
      WHERE contract_price IS NULL
        AND contract_value IS NOT NULL
        AND contract_value > 0;
    SQL

    # Step 1: Delete the old "Contract Value" Foundation column (reads from deprecated DB column)
    # Keep "Contract Price" column (id 1952) which reads from contract_price
    jobs_foundation_id = execute("SELECT id FROM foundations WHERE slug = 'jobs' LIMIT 1").first&.dig("id")

    if jobs_foundation_id
      # Delete the deprecated column definition
      execute <<-SQL
        DELETE FROM columns
        WHERE column_name = 'contract_value'
          AND foundation_id = #{jobs_foundation_id};
      SQL

      # Clean up saved views: remove 'contract_value' from column order/visible arrays
      # The views will keep 'contract_price' which is the SSoT
      execute <<-SQL
        UPDATE foundation_views
        SET columns = jsonb_set(
          columns,
          '{order}',
          (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(columns->'order') elem
            WHERE elem::text != '"contract_value"'
          )
        )
        WHERE foundation_id = #{jobs_foundation_id}
          AND columns->'order' IS NOT NULL
          AND columns::text LIKE '%contract_value%';
      SQL

      execute <<-SQL
        UPDATE foundation_views
        SET columns = columns #- '{visible,contract_value}'
        WHERE foundation_id = #{jobs_foundation_id}
          AND columns->'visible' ? 'contract_value';
      SQL

      execute <<-SQL
        UPDATE foundation_views
        SET filters = filters - 'contract_value'
        WHERE foundation_id = #{jobs_foundation_id}
          AND filters ? 'contract_value';
      SQL
    end

    # Step 2: Drop the deprecated DB column
    remove_column :jobs, :contract_value
  end

  def down
    add_column :jobs, :contract_value, :decimal, precision: 15, scale: 2
  end
end
