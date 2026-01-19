class AddCompanyGroupIdToDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :document_templates, :company_group_id, :bigint
    add_index :document_templates, :company_group_id
    add_foreign_key :document_templates, :corporate_groups, column: :company_group_id

    # Assign existing records to Tekna (primary tenant with data)
    reversible do |dir|
      dir.up do
        tekna = CorporateGroup.find_by(slug: 'tekna')
        if tekna
          execute "UPDATE document_templates SET company_group_id = #{tekna.id} WHERE company_group_id IS NULL"
        end
      end
    end
  end
end
