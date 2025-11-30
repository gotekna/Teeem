class AddComplianceFieldsToCompanyComplianceItems < ActiveRecord::Migration[8.0]
  def change
    add_column :company_compliance_items, :recurrence, :string  # annual, quarterly, monthly
    add_column :company_compliance_items, :asic_related, :boolean, default: false
    add_column :company_compliance_items, :ato_related, :boolean, default: false

    add_index :company_compliance_items, :recurrence
    add_index :company_compliance_items, :asic_related
    add_index :company_compliance_items, :ato_related
  end
end
