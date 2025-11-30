class RemoveAbbreviationFromCompanies < ActiveRecord::Migration[8.0]
  def up
    # Copy abbreviation to code where code is blank but abbreviation exists
    execute <<-SQL
      UPDATE companies
      SET code = abbreviation
      WHERE (code IS NULL OR code = '')
        AND abbreviation IS NOT NULL
        AND abbreviation != ''
    SQL

    # Remove the abbreviation column
    remove_column :companies, :abbreviation
    remove_index :companies, :abbreviation if index_exists?(:companies, :abbreviation)
  end

  def down
    add_column :companies, :abbreviation, :string
    add_index :companies, :abbreviation

    # Copy code back to abbreviation
    execute <<-SQL
      UPDATE companies
      SET abbreviation = code
      WHERE code IS NOT NULL AND code != ''
    SQL
  end
end
