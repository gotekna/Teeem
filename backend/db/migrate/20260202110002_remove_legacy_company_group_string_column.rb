# frozen_string_literal: true

# Remove legacy company_group string column from corporates
#
# SSoT Violation: Two columns existed for the same purpose:
# - company_group (string) - legacy, stores text like "tekna", "team_harder"
# - company_group_id (bigint FK) - SSoT, proper foreign key to company_groups table
#
# The company_group_id FK is now the SSoT. This migration removes the legacy column.
class RemoveLegacyCompanyGroupStringColumn < ActiveRecord::Migration[8.0]
  def up
    # Remove index first
    if index_exists?(:corporates, :company_group, name: 'index_corporates_on_company_group')
      remove_index :corporates, name: 'index_corporates_on_company_group'
    end

    # Remove the legacy string column
    remove_column :corporates, :company_group, :string
  end

  def down
    # Restore the legacy column (but data will be lost)
    add_column :corporates, :company_group, :string
    add_index :corporates, :company_group, name: 'index_corporates_on_company_group'
  end
end
