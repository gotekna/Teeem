class AddCompanyGroupIdToPriceHistories < ActiveRecord::Migration[8.0]
  def up
    add_column :price_histories, :company_group_id, :bigint
    add_index :price_histories, :company_group_id
    add_foreign_key :price_histories, :corporate_groups, column: :company_group_id

    # Populate company_group_id from the supplier's tenant
    # PriceHistory belongs to a supplier (Contact), which has company_group_id
    execute <<-SQL
      UPDATE price_histories
      SET company_group_id = contacts.company_group_id
      FROM contacts
      WHERE price_histories.supplier_id = contacts.id
        AND contacts.company_group_id IS NOT NULL
    SQL

    # For any remaining records without a supplier, use Tekna's tenant as default
    tekna = CorporateGroup.find_by(slug: "tekna")
    if tekna
      execute <<-SQL
        UPDATE price_histories
        SET company_group_id = #{tekna.id}
        WHERE company_group_id IS NULL
      SQL
    end
  end

  def down
    remove_foreign_key :price_histories, :corporate_groups, column: :company_group_id
    remove_index :price_histories, :company_group_id
    remove_column :price_histories, :company_group_id
  end
end
