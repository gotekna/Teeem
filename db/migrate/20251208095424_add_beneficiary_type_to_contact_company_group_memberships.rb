class AddBeneficiaryTypeToContactCompanyGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_company_group_memberships, :beneficiary_type, :string
    add_column :contact_company_group_memberships, :class_description, :string
  end
end
